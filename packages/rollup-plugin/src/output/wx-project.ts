import * as fs from 'node:fs';
import * as path from 'node:path';

export interface WxSubpackageConfig {
  name: string;
  root: string;
}

export interface WxProjectConfig {
  outputDir: string;
  adapterPath: string;
  orientation: 'portrait' | 'landscape';
  appid: string;
  subpackages?: WxSubpackageConfig[];
}

export function generateWxProject(config: WxProjectConfig): void {
  const { outputDir, adapterPath, orientation, appid, subpackages = [] } = config;

  fs.mkdirSync(outputDir, { recursive: true });

  // Build subpackages list for game.json (always include engine)
  const allSubpackages: WxSubpackageConfig[] = [
    { name: 'engine', root: 'engine/' },
    ...subpackages,
  ];

  // game.js
  // Stage 1: Show "Made with PhaserJS" splash with fade-in animation using WebGL
  //          (must use WebGL on the main canvas so Phaser can reuse it later).
  //          Text is rendered on an off-screen 2D canvas, then drawn as a WebGL texture.
  // Stage 2: After engine loads + splash finishes, require adapter + engine + game-bundle.
  const gameJs = `// --- Stage 1: Splash screen (WebGL) + engine download ---
// Ensure timer globals are available on iOS real devices where they may not
// be enumerable on GameGlobal but exist in the JavaScript global scope (globalThis).
(function() {
  var _g = typeof GameGlobal !== 'undefined' ? GameGlobal : {};
  var _gt = typeof globalThis !== 'undefined' ? globalThis : {};
  var _fns = ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
              'requestAnimationFrame', 'cancelAnimationFrame'];
  for (var i = 0; i < _fns.length; i++) {
    if (typeof _g[_fns[i]] === 'undefined' && typeof _gt[_fns[i]] !== 'undefined') {
      _g[_fns[i]] = _gt[_fns[i]];
    }
  }
})();

var _canvas = wx.createCanvas();
GameGlobal.__wxCanvas = _canvas;
var _info = wx.getSystemInfoSync();
var _dpr = _info.pixelRatio || 1;
var _w = _info.screenWidth;
var _h = _info.screenHeight;
_canvas.width = _w * _dpr;
_canvas.height = _h * _dpr;

// --- WebGL setup for splash ---
var _gl = _canvas.getContext('webgl', { alpha: false });
if (!_gl) _gl = _canvas.getContext('experimental-webgl', { alpha: false });

var _engineReady = false;
var _splashStart = Date.now();
var _minSplashDuration = 2000;

function _boot() {
  // Clean up all WebGL state before Phaser takes over
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
  GameGlobal.__adapterExports = require('./phaser-wx-adapter.js');
  if (typeof GameGlobal.__wxCustomAdapter !== 'undefined') {
    require('./phaser-wx-custom-adapter.js');
  }
  require('engine/phaser-engine.min.js');
  require('./game-bundle.js');
}

// --- Compile shaders ---
var _vs = _gl.createShader(_gl.VERTEX_SHADER);
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

var _fs = _gl.createShader(_gl.FRAGMENT_SHADER);
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

var _prog = _gl.createProgram();
_gl.attachShader(_prog, _vs);
_gl.attachShader(_prog, _fs);
_gl.linkProgram(_prog);
_gl.useProgram(_prog);

var _aPos = _gl.getAttribLocation(_prog, 'a_pos');
var _aUv = _gl.getAttribLocation(_prog, 'a_uv');
var _uAlpha = _gl.getUniformLocation(_prog, 'u_alpha');

// Full-screen quad: position (x,y) + uv (u,v)
var _buf = _gl.createBuffer();
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
var _offCanvas = wx.createCanvas();
_offCanvas.width = _canvas.width;
_offCanvas.height = _canvas.height;
var _ctx2d = _offCanvas.getContext('2d');
var _shortSide = Math.min(_w, _h);
var _fontSize = Math.round(_shortSide * _dpr * 0.05);
var _cw = _offCanvas.width;
var _ch = _offCanvas.height;

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
  _ctx2d.fillText('Made with PhaserJS', _cw / 2, _ch * 0.7);
}

// Initial draw
_drawScene(Date.now());

// --- Upload as WebGL texture ---
var _tex = _gl.createTexture();
_gl.bindTexture(_gl.TEXTURE_2D, _tex);
_gl.texParameteri(_gl.TEXTURE_2D, _gl.TEXTURE_WRAP_S, _gl.CLAMP_TO_EDGE);
_gl.texParameteri(_gl.TEXTURE_2D, _gl.TEXTURE_WRAP_T, _gl.CLAMP_TO_EDGE);
_gl.texParameteri(_gl.TEXTURE_2D, _gl.TEXTURE_MIN_FILTER, _gl.LINEAR);
_gl.texParameteri(_gl.TEXTURE_2D, _gl.TEXTURE_MAG_FILTER, _gl.LINEAR);
_gl.texImage2D(_gl.TEXTURE_2D, 0, _gl.RGBA, _gl.RGBA, _gl.UNSIGNED_BYTE, _offCanvas);

_gl.viewport(0, 0, _canvas.width, _canvas.height);
_gl.enable(_gl.BLEND);
_gl.blendFunc(_gl.SRC_ALPHA, _gl.ONE_MINUS_SRC_ALPHA);

// --- Splash animation (fade-in, then stay at full opacity) ---
var _alpha = 0;
var _fadeInDuration = 1000;
var _lastTime = Date.now();
var _timer = 0;
var _splashRafId = 0;

function _drawSplash() {
  var now = Date.now();
  var dt = now - _lastTime;
  _lastTime = now;
  _timer += dt;

  // Fade in only, then stay at full opacity
  if (_alpha < 1) {
    _alpha = Math.min(_timer / _fadeInDuration, 1);
  }

  // Re-draw pinwheel animation and re-upload texture
  _drawScene(now);
  _gl.bindTexture(_gl.TEXTURE_2D, _tex);
  _gl.texImage2D(_gl.TEXTURE_2D, 0, _gl.RGBA, _gl.RGBA, _gl.UNSIGNED_BYTE, _offCanvas);

  _gl.clearColor(0.102, 0.102, 0.180, 1);
  _gl.clear(_gl.COLOR_BUFFER_BIT);
  _gl.uniform1f(_uAlpha, _alpha);
  _gl.drawArrays(_gl.TRIANGLE_STRIP, 0, 4);

  // Try to boot if engine is ready and min splash duration has passed
  if (_engineReady && (Date.now() - _splashStart) >= _minSplashDuration) {
    _boot();
    return; // stop the animation loop — Phaser takes over
  }

  _splashRafId = requestAnimationFrame(_drawSplash);
}
_splashRafId = requestAnimationFrame(_drawSplash);

wx.loadSubpackage({
  name: 'engine',
  success: function() {
    _engineReady = true;
  },
  fail: function(err) {
    console.error('Failed to load engine subpackage:', err);
  }
});
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

  // project.config.json
  const projectConfig = {
    appid,
    setting: {
      urlCheck: false,
      es6: true,
      postcss: true,
      minified: true,
    },
    compileType: 'game',
    libVersion: '2.10.0',
    projectname: 'phaser-wx-game',
  };
  fs.writeFileSync(
    path.join(outputDir, 'project.config.json'),
    JSON.stringify(projectConfig, null, 2),
    'utf-8'
  );

  // Copy adapter file if it exists and is a single-file bundle.
  // If the adapter source has sub-module imports, it must be bundled
  // externally (e.g., by the CLI) before this step.
  if (adapterPath && fs.existsSync(adapterPath)) {
    const adapterContent = fs.readFileSync(adapterPath, 'utf-8');
    const hasSubModuleImports = /(?:^|\n)\s*import\s+.*from\s+['"]\.\//.test(adapterContent);
    if (!hasSubModuleImports) {
      fs.copyFileSync(adapterPath, path.join(outputDir, 'phaser-wx-adapter.js'));
    }
  }
}
