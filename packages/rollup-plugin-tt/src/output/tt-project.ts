import * as fs from 'node:fs';
import * as path from 'node:path';

export interface TtSubpackageConfig {
  name: string;
  root: string;
}

export interface TtProjectConfig {
  outputDir: string;
  /** Path to the tt-adapter.js runtime file to copy into the output */
  adapterPath: string;
  /**
   * Path to the tt-polyfill.js runtime file to copy into the output.
   * Optional — when omitted the plugin resolves the copy shipped alongside
   * adapterPath (same directory), so callers that only set adapterPath still
   * get the supplementary Blob/URL polyfill.
   */
  polyfillPath?: string;
  orientation: 'portrait' | 'landscape';
  appid: string;
  subpackages?: TtSubpackageConfig[];
}

/**
 * Locate the bundled tt-adapter.js runtime shipped with this package.
 * Falls back to the provided adapterPath (used by the CLI / tests).
 */
function resolveAdapterSource(adapterPath: string): string | null {
  if (adapterPath && fs.existsSync(adapterPath)) {
    return adapterPath;
  }
  // Bundled runtime: dist/index.cjs -> ../src/runtime/tt-adapter.js is not
  // available after build, so the CLI passes an explicit adapterPath. During
  // tests the caller passes a stub path. If neither resolves, return null.
  return null;
}

export function generateTtProject(config: TtProjectConfig): void {
  const { outputDir, adapterPath, polyfillPath, orientation, appid, subpackages = [] } = config;

  fs.mkdirSync(outputDir, { recursive: true });

  // Build subpackages list for game.json (always include engine)
  const allSubpackages: TtSubpackageConfig[] = [
    { name: 'engine', root: 'engine/' },
    ...subpackages,
  ];

  // game.js
  // Douyin develops "as H5": the tt-adapter is a self-injecting IIFE that,
  // once required, populates the runtime globals with
  // window/document/canvas/Image/... and mounts the on-screen canvas as
  // window.canvas. So game.js:
  //   Stage 1: require tt-adapter FIRST, then show a WebGL splash on
  //            window.canvas (the same canvas Phaser will reuse), while
  //            the engine subpackage downloads in parallel.
  //   Stage 2: once engine is ready + splash min-duration elapsed, clean up
  //            the splash GL state and require engine + game-bundle.
  // The tt-adapter guards re-injection via GameGlobal.__isAdapterInjected, so
  // requiring it is idempotent.
  const gameJs = `// --- Douyin Mini-Game entry ---
// 1. Inject H5 compatibility layer (self-injecting IIFE). This must run first:
//    it creates the on-screen canvas (window.canvas) and installs
//    window/document/Image/Audio/XMLHttpRequest/... onto the runtime globals.
require('./tt-adapter.js');
// 2. Supplement the adapter with a Blob + URL.createObjectURL polyfill that
//    Phaser needs for SVG / HTMLTexture loading (the official adapter omits a
//    usable Blob global). This EXTENDS the adapter; it does not modify it.
require('./tt-polyfill.js');

// 3. Enable Phaser's touch input.
//    Phaser detects touch support via
//      'ontouchstart' in document.documentElement || navigator.maxTouchPoints >= 1
//    and, when false, sets config.inputTouch = false and NEVER creates its
//    TouchManager — so none of the adapter's touch events reach the input
//    system and nothing is clickable (Phaser's MouseManager only listens for
//    mouse events, not the adapter's synthetic pointer events). The official
//    tt-adapter sets neither signal, so we set them here (the WeChat adapter
//    does the same via navigator.maxTouchPoints = 10). This must run BEFORE the
//    engine is required, since Phaser's device detection runs at engine load.
//    Done as an extension here; tt-adapter.js is not modified.
(function () {
  try {
    if (typeof navigator !== 'undefined' && !navigator.maxTouchPoints) {
      navigator.maxTouchPoints = 10;
    }
    if (typeof document !== 'undefined' && document.documentElement &&
        !('ontouchstart' in document.documentElement)) {
      document.documentElement.ontouchstart = null;
    }
  } catch (e) { /* if globals are read-only, Phaser falls back to its own detection */ }
})();

// 4. Provide document.elementFromPoint for Phaser's touch-move handler.
//    Phaser's InputManager calls document.elementFromPoint(x, y) on every
//    touchmove to test whether the pointer is over the canvas. The official
//    tt-adapter does not implement it, so the handler throws
//    ("document.elementFromPoint is not a function") on every move — the
//    pointer position stops updating (drag/paddle input dies) and the repeated
//    exceptions stutter the frame rate. The mini-game canvas is the only
//    element, so return it (matches the WeChat adapter). tt-adapter.js is not
//    modified.
(function () {
  try {
    if (typeof document !== 'undefined' && typeof document.elementFromPoint !== 'function') {
      document.elementFromPoint = function () {
        return (typeof window !== 'undefined' && window.canvas) ||
          (typeof GameGlobal !== 'undefined' && (GameGlobal.canvas || GameGlobal.screencanvas)) ||
          null;
      };
    }
  } catch (e) { /* leave input as-is if document is read-only */ }
})();

// 5. Make the adapter's Audio Phaser-compatible.
//    (a) Phaser's HTML5 audio assigns PROPERTY callbacks (audio.oncanplaythrough
//        = fn, onerror, onended, ...), but the adapter's Audio.dispatchEvent only
//        invokes addEventListener listeners — the on<type> properties never fire,
//        so audio never finishes loading and never plays.
//    (b) The adapter's Audio.load() is a no-op, but Phaser's audio-unlock flow
//        calls tag.load() and waits for oncanplaythrough to fire before it marks
//        the audio unlocked. With an empty load() the unlock never completes.
//    Patch both (the WeChat adapter's Audio does the same: fire on<type> + emit
//    canplaythrough from load()). tt-adapter.js is not modified.
(function () {
  try {
    var A = (typeof window !== 'undefined' && window.Audio) ||
      (typeof GameGlobal !== 'undefined' && GameGlobal.Audio);
    if (A && A.prototype && !A.prototype.__ttOnHandlerPatched) {
      var _origDispatch = A.prototype.dispatchEvent;
      A.prototype.dispatchEvent = function (event) {
        event = event || {};
        if (!event.target) { event.target = this; }
        var r;
        if (typeof _origDispatch === 'function') { r = _origDispatch.call(this, event); }
        var on = 'on' + event.type;
        if (typeof this[on] === 'function') { this[on](event); }
        return r;
      };
      // load(): the InnerAudioContext loads on src assignment, so (re)emit
      // canplaythrough asynchronously to complete Phaser's load / unlock.
      A.prototype.load = function () {
        var self = this;
        var fire = function () { self.dispatchEvent({ type: 'canplaythrough' }); };
        if (typeof setTimeout === 'function') { setTimeout(fire, 0); } else { fire(); }
      };
      // currentTime setter guard: Phaser's HTML5 loop manager sets
      // audio.currentTime every frame; when duration reads as 0 (a sound played
      // before it finished loading) it repeatedly seeks to ~the current
      // position. On a real <audio> element that is a harmless no-op, but the
      // adapter maps it to InnerAudioContext.seek(), which restarts playback
      // each frame → continuous static/noise on looping BGM. Skip redundant
      // seeks (target within 0.15s of the current time); genuine seeks (loop
      // wrap to 0, markers) have a large delta and still go through.
      var _ctDesc = Object.getOwnPropertyDescriptor(A.prototype, 'currentTime');
      if (_ctDesc && typeof _ctDesc.set === 'function' && typeof _ctDesc.get === 'function') {
        var _ctGet = _ctDesc.get, _ctSet = _ctDesc.set;
        Object.defineProperty(A.prototype, 'currentTime', {
          configurable: true,
          enumerable: _ctDesc.enumerable,
          get: _ctGet,
          set: function (v) {
            try {
              var cur = _ctGet.call(this);
              if (typeof v === 'number' && typeof cur === 'number' && Math.abs(v - cur) < 0.15) {
                return; // redundant/degenerate seek — skip to avoid audio glitches
              }
            } catch (_) {}
            _ctSet.call(this, v);
          }
        });
      }
      A.prototype.__ttOnHandlerPatched = true;
    }
  } catch (e) { /* leave audio as-is if not patchable */ }
})();

// 5b. Unlock Phaser's HTML5 audio. Phaser locks audio until a user gesture and
//    listens for 'touchend' / 'touchmove' on document.body — but the adapter
//    dispatches touch events to document, not document.body, so audio never
//    unlocks and BGM/SFX never play. Forward touch events to document.body on
//    the first gesture (the WeChat adapter bridges the same way).
(function () {
  try {
    if (typeof document === 'undefined' || !document.body || !document.addEventListener) return;
    ['touchend', 'touchmove'].forEach(function (type) {
      document.addEventListener(type, function (e) {
        try { document.body.dispatchEvent(e || { type: type }); } catch (_) {}
      });
    });
  } catch (e) { /* leave audio locked if document.body is unavailable */ }
})();

// 5c. Prevent Phaser from locking HTML5 audio in the first place.
//    Phaser sets this.locked = ("ontouchstart" in window) and, when true, queues
//    all sounds until a user-gesture "unlock". That gate exists for BROWSER
//    autoplay policy — but a Douyin mini-game's InnerAudioContext plays without
//    a gesture, so the lock only gets in the way (BGM played on scene create,
//    before any tap, never starts). The adapter puts ontouchstart on the global,
//    so remove it: ("ontouchstart" in window) becomes false and audio plays
//    immediately. Touch INPUT detection is unaffected — it uses
//    navigator.maxTouchPoints (set above), not window.ontouchstart. (#5/#5b
//    remain as a fallback in case this delete is not permitted.)
(function () {
  try {
    if (typeof window !== 'undefined' && ('ontouchstart' in window)) {
      delete window.ontouchstart;
    }
  } catch (e) { /* fall back to the touch-to-body unlock bridge above */ }
})();

// 6. Ensure requestAnimationFrame / cancelAnimationFrame are on window.
//    Phaser's game loop calls window.requestAnimationFrame with no fallback.
//    Douyin exposes these as bare globals; on a real device the adapter aliases
//    window to the global scope where they may not be own properties, so bind
//    them explicitly (the WeChat adapter does the same). Drives the loop at the
//    platform frame rate.
(function () {
  try {
    var w = (typeof window !== 'undefined') ? window
      : (typeof GameGlobal !== 'undefined') ? GameGlobal : this;
    if (w && typeof w.requestAnimationFrame !== 'function' &&
        typeof requestAnimationFrame === 'function') {
      w.requestAnimationFrame = requestAnimationFrame;
    }
    if (w && typeof w.cancelAnimationFrame !== 'function' &&
        typeof cancelAnimationFrame === 'function') {
      w.cancelAnimationFrame = cancelAnimationFrame;
    }
  } catch (e) { /* loop falls back to whatever the runtime provides */ }
})();

// --- Stage 1: Splash screen (WebGL) + engine download ---
var _engineReady = false;
var _booted = false;
var _splashStart = Date.now();
var _minSplashDuration = 2000;

// requestAnimationFrame is not guaranteed to be a bare global in the Douyin
// runtime; resolve a scheduler defensively (canvas rAF > global > setTimeout).
//
// The on-screen canvas is referenced per the official Adapter docs as
// window.canvas. It resolves in both environments: on real devices the adapter
// sets global.window = GameGlobal and copies canvas onto it; in the developer
// tool it defines window.canvas on the real window. GameGlobal.screencanvas is
// set unconditionally by the adapter and used as a final fallback.
var _canvas =
  (typeof window !== 'undefined' && window.canvas) ||
  (typeof GameGlobal !== 'undefined' && (GameGlobal.canvas || GameGlobal.screencanvas)) ||
  (typeof canvas !== 'undefined' ? canvas : null);
var _raf =
  (typeof requestAnimationFrame !== 'undefined' && requestAnimationFrame) ||
  (typeof GameGlobal !== 'undefined' && GameGlobal.requestAnimationFrame) ||
  (_canvas && typeof _canvas.requestAnimationFrame === 'function'
    ? function(cb) { return _canvas.requestAnimationFrame(cb); }
    : null) ||
  function(cb) { return setTimeout(function() { cb(Date.now()); }, 16); };

function _boot() {
  if (_booted) return;
  _booted = true;
  try { _cleanupGL(); } catch (e) { /* splash may have failed to init */ }
  require('engine/phaser-engine.min.js');
  require('./game-bundle.js');
}

// Load the Phaser engine subpackage asynchronously.
if (typeof tt !== 'undefined' && tt.loadSubpackage) {
  tt.loadSubpackage({
    name: 'engine',
    success: function() { _engineReady = true; },
    fail: function(err) {
      console.error('Failed to load engine subpackage:', err);
      // Boot anyway so a load error does not hang on the splash forever.
      _engineReady = true;
    }
  });
} else {
  _engineReady = true;
}

// --- WebGL splash setup (best-effort; boot proceeds even if this fails) ---
var _gl = null;
var _vs, _fs, _prog, _buf, _tex, _aPos, _aUv, _uAlpha;
var _offCanvas, _ctx2d, _cw, _ch, _shortSide, _fontSize, _dpr;

function _cleanupGL() {
  if (!_gl) return;
  _gl.disableVertexAttribArray(_aPos);
  _gl.disableVertexAttribArray(_aUv);
  _gl.deleteTexture(_tex);
  _gl.deleteBuffer(_buf);
  _gl.deleteProgram(_prog);
  _gl.deleteShader(_vs);
  _gl.deleteShader(_fs);
  _gl.useProgram(null);
  _gl.bindBuffer(_gl.ARRAY_BUFFER, null);
  _gl.bindTexture(_gl.TEXTURE_2D, null);
}

function _initSplash() {
  if (!_canvas) return false;
  var _info = tt.getSystemInfoSync();
  _dpr = _info.pixelRatio || 1;
  var _w = _info.screenWidth;
  var _h = _info.screenHeight;
  _canvas.width = _w * _dpr;
  _canvas.height = _h * _dpr;

  _gl = _canvas.getContext('webgl', { alpha: false });
  if (!_gl) _gl = _canvas.getContext('experimental-webgl', { alpha: false });
  if (!_gl) return false;

  // --- Compile shaders ---
  _vs = _gl.createShader(_gl.VERTEX_SHADER);
  _gl.shaderSource(_vs, [
    'attribute vec2 a_pos;',
    'attribute vec2 a_uv;',
    'varying vec2 v_uv;',
    'void main() {',
    '  v_uv = a_uv;',
    '  gl_Position = vec4(a_pos, 0.0, 1.0);',
    '}'
  ].join('\\n'));
  _gl.compileShader(_vs);

  _fs = _gl.createShader(_gl.FRAGMENT_SHADER);
  _gl.shaderSource(_fs, [
    'precision mediump float;',
    'varying vec2 v_uv;',
    'uniform sampler2D u_tex;',
    'uniform float u_alpha;',
    'void main() {',
    '  vec4 c = texture2D(u_tex, v_uv);',
    '  gl_FragColor = vec4(c.rgb, c.a * u_alpha);',
    '}'
  ].join('\\n'));
  _gl.compileShader(_fs);

  _prog = _gl.createProgram();
  _gl.attachShader(_prog, _vs);
  _gl.attachShader(_prog, _fs);
  _gl.linkProgram(_prog);
  _gl.useProgram(_prog);

  _aPos = _gl.getAttribLocation(_prog, 'a_pos');
  _aUv = _gl.getAttribLocation(_prog, 'a_uv');
  _uAlpha = _gl.getUniformLocation(_prog, 'u_alpha');

  // Full-screen quad: position (x,y) + uv (u,v)
  _buf = _gl.createBuffer();
  _gl.bindBuffer(_gl.ARRAY_BUFFER, _buf);
  _gl.bufferData(_gl.ARRAY_BUFFER, new Float32Array([
    -1, -1, 0, 1,
     1, -1, 1, 1,
    -1,  1, 0, 0,
     1,  1, 1, 0,
  ]), _gl.STATIC_DRAW);
  _gl.enableVertexAttribArray(_aPos);
  _gl.vertexAttribPointer(_aPos, 2, _gl.FLOAT, false, 16, 0);
  _gl.enableVertexAttribArray(_aUv);
  _gl.vertexAttribPointer(_aUv, 2, _gl.FLOAT, false, 16, 8);

  // --- Off-screen 2D canvas for pinwheel animation ---
  _offCanvas = tt.createCanvas();
  _offCanvas.width = _canvas.width;
  _offCanvas.height = _canvas.height;
  _ctx2d = _offCanvas.getContext('2d');
  _shortSide = Math.min(_w, _h);
  _fontSize = Math.round(_shortSide * _dpr * 0.05);
  _cw = _offCanvas.width;
  _ch = _offCanvas.height;

  _drawScene(Date.now());

  // --- Upload as WebGL texture ---
  _tex = _gl.createTexture();
  _gl.bindTexture(_gl.TEXTURE_2D, _tex);
  _gl.texParameteri(_gl.TEXTURE_2D, _gl.TEXTURE_WRAP_S, _gl.CLAMP_TO_EDGE);
  _gl.texParameteri(_gl.TEXTURE_2D, _gl.TEXTURE_WRAP_T, _gl.CLAMP_TO_EDGE);
  _gl.texParameteri(_gl.TEXTURE_2D, _gl.TEXTURE_MIN_FILTER, _gl.LINEAR);
  _gl.texParameteri(_gl.TEXTURE_2D, _gl.TEXTURE_MAG_FILTER, _gl.LINEAR);
  _gl.texImage2D(_gl.TEXTURE_2D, 0, _gl.RGBA, _gl.RGBA, _gl.UNSIGNED_BYTE, _offCanvas);

  _gl.viewport(0, 0, _canvas.width, _canvas.height);
  _gl.enable(_gl.BLEND);
  _gl.blendFunc(_gl.SRC_ALPHA, _gl.ONE_MINUS_SRC_ALPHA);
  return true;
}

var _sceneStartTime = Date.now();
function _drawScene(now) {
  var t = (now - _sceneStartTime) / 1000;
  _ctx2d.fillStyle = '#1a1a2e';
  _ctx2d.fillRect(0, 0, _cw, _ch);

  // Draw rotating cartoon pinwheel with 6 blades
  var cx = _cw / 2;
  var cy = _ch * 0.38;
  var R = _shortSide * _dpr * 0.18;
  var angle = t * 1.5;
  var blades = 6;
  var colors = ['#e94560', '#4ecdc4', '#ffe66d', '#a55eea', '#45b7d1', '#ff6348'];

  // Stick (drawn first so it appears behind the blades)
  _ctx2d.strokeStyle = '#b0845a';
  _ctx2d.lineWidth = 3 * _dpr;
  _ctx2d.lineCap = 'round';
  _ctx2d.beginPath();
  _ctx2d.moveTo(cx, cy + R * 0.1);
  _ctx2d.lineTo(cx + R * 0.15, cy + R * 1.2);
  _ctx2d.stroke();

  _ctx2d.save();
  _ctx2d.translate(cx, cy);
  _ctx2d.rotate(angle);

  for (var i = 0; i < blades; i++) {
    var a = (i / blades) * Math.PI * 2;
    _ctx2d.save();
    _ctx2d.rotate(a);
    _ctx2d.beginPath();
    _ctx2d.moveTo(0, 0);
    _ctx2d.quadraticCurveTo(R * 0.5, -R * 0.35, R * 0.85, -R * 0.08);
    _ctx2d.quadraticCurveTo(R * 0.5, R * 0.12, 0, 0);
    _ctx2d.fillStyle = colors[i % colors.length];
    _ctx2d.fill();
    _ctx2d.strokeStyle = 'rgba(255,255,255,0.5)';
    _ctx2d.lineWidth = 1 * _dpr;
    _ctx2d.stroke();
    _ctx2d.restore();
  }

  // Center hub
  _ctx2d.beginPath();
  _ctx2d.arc(0, 0, R * 0.12, 0, Math.PI * 2);
  _ctx2d.fillStyle = '#ffffff';
  _ctx2d.fill();
  _ctx2d.strokeStyle = '#cccccc';
  _ctx2d.lineWidth = 2 * _dpr;
  _ctx2d.stroke();
  _ctx2d.beginPath();
  _ctx2d.arc(0, 0, R * 0.05, 0, Math.PI * 2);
  _ctx2d.fillStyle = '#e94560';
  _ctx2d.fill();

  _ctx2d.restore();

  // Text
  _ctx2d.font = 'bold ' + _fontSize + 'px Arial';
  _ctx2d.textAlign = 'center';
  _ctx2d.textBaseline = 'middle';
  _ctx2d.fillStyle = '#ffffff';
  _ctx2d.fillText('Made with MiniPlay', _cw / 2, _ch * 0.7);
}

// --- Splash animation (fade-in, then stay at full opacity) ---
var _alpha = 0;
var _fadeInDuration = 1000;
var _lastTime = Date.now();
var _timer = 0;

function _drawSplash() {
  var now = Date.now();
  var dt = now - _lastTime;
  _lastTime = now;
  _timer += dt;

  if (_alpha < 1) {
    _alpha = Math.min(_timer / _fadeInDuration, 1);
  }

  _drawScene(now);
  _gl.bindTexture(_gl.TEXTURE_2D, _tex);
  _gl.texImage2D(_gl.TEXTURE_2D, 0, _gl.RGBA, _gl.RGBA, _gl.UNSIGNED_BYTE, _offCanvas);

  _gl.clearColor(0.102, 0.102, 0.180, 1);
  _gl.clear(_gl.COLOR_BUFFER_BIT);
  _gl.uniform1f(_uAlpha, _alpha);
  _gl.drawArrays(_gl.TRIANGLE_STRIP, 0, 4);

  if (_engineReady && (Date.now() - _splashStart) >= _minSplashDuration) {
    _boot();
    return; // stop the animation loop — Phaser takes over
  }

  _raf(_drawSplash);
}

// Kick off the splash if WebGL is available; otherwise wait for the engine
// and boot without a splash animation.
var _splashOk = false;
try { _splashOk = _initSplash(); } catch (e) { _splashOk = false; }
if (_splashOk) {
  _raf(_drawSplash);
} else {
  function _waitBoot() {
    if (_engineReady && (Date.now() - _splashStart) >= _minSplashDuration) {
      _boot();
      return;
    }
    _raf(_waitBoot);
  }
  _raf(_waitBoot);
}
`;
  fs.writeFileSync(path.join(outputDir, 'game.js'), gameJs, 'utf-8');

  // Generate game.js entry for each subpackage
  for (const sp of allSubpackages) {
    const spDir = path.join(outputDir, sp.root);
    fs.mkdirSync(spDir, { recursive: true });
    const spGameJs = path.join(spDir, 'game.js');
    if (!fs.existsSync(spGameJs)) {
      fs.writeFileSync(spGameJs, '// Subpackage entry\n', 'utf-8');
    }
  }

  // game.json
  const gameJson: Record<string, unknown> = {
    deviceOrientation: orientation,
    showStatusBar: false,
    subpackages: allSubpackages.map((sp) => ({
      name: sp.name,
      root: sp.root,
    })),
    networkTimeout: {
      request: 10000,
      connectSocket: 10000,
      uploadFile: 10000,
      downloadFile: 10000,
    },
  };
  fs.writeFileSync(
    path.join(outputDir, 'game.json'),
    JSON.stringify(gameJson, null, 2),
    'utf-8'
  );

  // project.config.json — Douyin developer tool project config.
  // compileType 'game' selects the mini-game project type; appid is the
  // Douyin app id (no "wx" prefix requirement).
  const projectConfig = {
    appid,
    setting: {
      es6: true,
      minified: true,
      autoAudits: false,
      newFeature: true,
    },
    compileType: 'game',
    projectname: 'phaser-tt-game',
  };
  fs.writeFileSync(
    path.join(outputDir, 'project.config.json'),
    JSON.stringify(projectConfig, null, 2),
    'utf-8'
  );

  // Copy the tt-adapter.js runtime into the output so game.js can require it.
  const adapterSource = resolveAdapterSource(adapterPath);
  if (adapterSource) {
    fs.copyFileSync(adapterSource, path.join(outputDir, 'tt-adapter.js'));
  }

  // Copy the tt-polyfill.js runtime (supplementary Blob/URL). Prefer an
  // explicit polyfillPath; otherwise look for tt-polyfill.js next to the
  // adapter source (both ship in the same runtime/ directory).
  let polyfillSource: string | null = null;
  if (polyfillPath && fs.existsSync(polyfillPath)) {
    polyfillSource = polyfillPath;
  } else if (adapterSource) {
    const sibling = path.join(path.dirname(adapterSource), 'tt-polyfill.js');
    if (fs.existsSync(sibling)) {
      polyfillSource = sibling;
    }
  }
  if (polyfillSource) {
    fs.copyFileSync(polyfillSource, path.join(outputDir, 'tt-polyfill.js'));
  }
}
