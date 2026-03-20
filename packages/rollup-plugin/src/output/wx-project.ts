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
  // Clean up WebGL state before Phaser takes over
  _gl.deleteTexture(_tex);
  _gl.deleteBuffer(_buf);
  _gl.deleteProgram(_prog);
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

// --- Off-screen 2D canvas for solar system animation ---
var _offCanvas = wx.createCanvas();
_offCanvas.width = _canvas.width;
_offCanvas.height = _canvas.height;
var _ctx2d = _offCanvas.getContext('2d');
var _shortSide = Math.min(_w, _h);
var _fontSize = Math.round(_shortSide * _dpr * 0.05);
var _cw = _offCanvas.width;
var _ch = _offCanvas.height;

// Solar system parameters
var _sunX = _cw / 2;
var _sunY = _ch * 0.38;
var _sunRadius = Math.round(_shortSide * _dpr * 0.045);
var _planets = [
  { color: '#b0b0b0', radius: _sunRadius * 0.15, orbit: _sunRadius * 2.0,  orbitY: 0.45, speed: 4.5,  angle: 0.0 },
  { color: '#e8c44a', radius: _sunRadius * 0.25, orbit: _sunRadius * 2.8,  orbitY: 0.45, speed: 3.2,  angle: 1.0 },
  { color: '#4a9fe8', radius: _sunRadius * 0.27, orbit: _sunRadius * 3.6,  orbitY: 0.45, speed: 2.5,  angle: 2.5 },
  { color: '#e85a3a', radius: _sunRadius * 0.18, orbit: _sunRadius * 4.4,  orbitY: 0.45, speed: 2.0,  angle: 4.0 },
  { color: '#c8905a', radius: _sunRadius * 0.40, orbit: _sunRadius * 5.6,  orbitY: 0.45, speed: 1.2,  angle: 5.2 },
  { color: '#d4a847', radius: _sunRadius * 0.35, orbit: _sunRadius * 6.8,  orbitY: 0.45, speed: 0.8,  angle: 3.5, ring: true }
];
var _textY = _sunY + _sunRadius * 8.5;

function _drawScene(now) {
  var t = now / 1000;
  // Clear
  _ctx2d.fillStyle = '#232C37';
  _ctx2d.fillRect(0, 0, _cw, _ch);

  // Draw orbit lines
  _ctx2d.strokeStyle = 'rgba(255,255,255,0.08)';
  _ctx2d.lineWidth = 1;
  for (var i = 0; i < _planets.length; i++) {
    var p = _planets[i];
    _ctx2d.beginPath();
    _ctx2d.ellipse(_sunX, _sunY, p.orbit, p.orbit * p.orbitY, 0, 0, Math.PI * 2);
    _ctx2d.stroke();
  }

  // Collect planets with their z-order for proper layering
  var _drawList = [];
  for (var i = 0; i < _planets.length; i++) {
    var p = _planets[i];
    var a = p.angle + t * p.speed;
    var px = _sunX + Math.cos(a) * p.orbit;
    var py = _sunY + Math.sin(a) * p.orbit * p.orbitY;
    _drawList.push({ p: p, x: px, y: py, z: Math.sin(a) });
  }
  // Sort: draw far planets first (behind sun), near planets last (in front)
  _drawList.sort(function(a, b) { return a.z - b.z; });

  // Draw planets behind the sun (z < 0)
  for (var i = 0; i < _drawList.length; i++) {
    if (_drawList[i].z >= 0) break;
    _drawPlanet(_drawList[i]);
  }

  // Draw sun with glow
  var _glowSize = _sunRadius * 2.5;
  var _grd = _ctx2d.createRadialGradient(_sunX, _sunY, _sunRadius * 0.3, _sunX, _sunY, _glowSize);
  _grd.addColorStop(0, 'rgba(255, 220, 60, 1.0)');
  _grd.addColorStop(0.25, 'rgba(255, 180, 30, 0.8)');
  _grd.addColorStop(0.5, 'rgba(255, 140, 0, 0.2)');
  _grd.addColorStop(1, 'rgba(255, 100, 0, 0)');
  _ctx2d.fillStyle = _grd;
  _ctx2d.beginPath();
  _ctx2d.arc(_sunX, _sunY, _glowSize, 0, Math.PI * 2);
  _ctx2d.fill();
  // Sun core
  _ctx2d.fillStyle = '#ffdd44';
  _ctx2d.beginPath();
  _ctx2d.arc(_sunX, _sunY, _sunRadius, 0, Math.PI * 2);
  _ctx2d.fill();

  // Draw planets in front of the sun (z >= 0)
  for (var i = 0; i < _drawList.length; i++) {
    if (_drawList[i].z >= 0) _drawPlanet(_drawList[i]);
  }

  // Draw text with stroke outline
  _ctx2d.font = 'bold ' + _fontSize + 'px Arial';
  _ctx2d.textAlign = 'center';
  _ctx2d.textBaseline = 'middle';
  _ctx2d.lineWidth = Math.max(2, _fontSize * 0.08);
  _ctx2d.strokeStyle = 'rgba(0, 0, 0, 0.6)';
  _ctx2d.strokeText('Made with PhaserJS', _cw / 2, _textY);
  _ctx2d.fillStyle = '#ffffff';
  _ctx2d.fillText('Made with PhaserJS', _cw / 2, _textY);
}

function _drawPlanet(item) {
  var p = item.p;
  _ctx2d.fillStyle = p.color;
  _ctx2d.beginPath();
  _ctx2d.arc(item.x, item.y, p.radius, 0, Math.PI * 2);
  _ctx2d.fill();
  // Saturn ring
  if (p.ring) {
    _ctx2d.strokeStyle = 'rgba(212, 168, 71, 0.6)';
    _ctx2d.lineWidth = p.radius * 0.25;
    _ctx2d.beginPath();
    _ctx2d.ellipse(item.x, item.y, p.radius * 2.0, p.radius * 0.5, -0.3, 0, Math.PI * 2);
    _ctx2d.stroke();
  }
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

// --- Splash animation (fade-in → breathing glow until boot) ---
var _alpha = 0;
var _phase = 0; // 0=fade-in, 1=breathing
var _timer = 0;
var _fadeInDuration = 1000;
var _breathMin = 0.5;
var _breathMax = 1.0;
var _breathCycle = 2000; // one full breath cycle in ms
var _lastTime = Date.now();
var _splashRafId = 0;

function _drawSplash() {
  var now = Date.now();
  var dt = now - _lastTime;
  _lastTime = now;
  _timer += dt;

  if (_phase === 0) {
    _alpha = Math.min(_timer / _fadeInDuration, 1);
    if (_timer >= _fadeInDuration) { _phase = 1; _timer = 0; }
  } else {
    // Smooth sine breathing: oscillate between _breathMin and _breathMax
    var t = (_timer % _breathCycle) / _breathCycle;
    _alpha = _breathMin + (_breathMax - _breathMin) * (0.5 + 0.5 * Math.cos(t * 2 * Math.PI));
  }

  // Re-draw solar system animation and re-upload texture
  _drawScene(now);
  _gl.bindTexture(_gl.TEXTURE_2D, _tex);
  _gl.texImage2D(_gl.TEXTURE_2D, 0, _gl.RGBA, _gl.RGBA, _gl.UNSIGNED_BYTE, _offCanvas);

  _gl.clearColor(0.137, 0.173, 0.216, 1);
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
