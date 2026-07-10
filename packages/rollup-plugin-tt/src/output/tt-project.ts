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
