import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { generateTtProject, TtProjectConfig } from '../../src/output/tt-project';

describe('generateTtProject', () => {
  let outputDir: string;
  let adapterDir: string;
  let adapterPath: string;
  let polyfillPath: string;

  beforeEach(() => {
    outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tt-project-test-'));
    adapterDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tt-adapter-src-'));
    adapterPath = path.join(adapterDir, 'tt-adapter.js');
    fs.writeFileSync(
      adapterPath,
      '// mock tt-adapter content\nconsole.log("tt-adapter loaded");',
      'utf-8'
    );
    // tt-polyfill.js ships next to the adapter in the runtime dir; place a
    // sibling stub so the default (sibling) resolution path is exercised.
    polyfillPath = path.join(adapterDir, 'tt-polyfill.js');
    fs.writeFileSync(polyfillPath, '// mock tt-polyfill content', 'utf-8');
  });

  afterEach(() => {
    fs.rmSync(outputDir, { recursive: true, force: true });
    fs.rmSync(adapterDir, { recursive: true, force: true });
  });

  it('generates game.js that requires tt-adapter, then tt-polyfill, then engine + game-bundle', () => {
    const config: TtProjectConfig = {
      outputDir,
      adapterPath,
      orientation: 'portrait',
      appid: 'ttabc1234567890',
    };

    generateTtProject(config);

    const gameJs = fs.readFileSync(path.join(outputDir, 'game.js'), 'utf-8');
    expect(gameJs).toContain("require('./tt-adapter.js')");
    expect(gameJs).toContain("require('./tt-polyfill.js')");
    expect(gameJs).toContain("require('engine/phaser-engine.min.js')");
    expect(gameJs).toContain("require('./game-bundle.js')");
    // Order: adapter -> polyfill -> engine -> game-bundle
    const adapterIdx = gameJs.indexOf("require('./tt-adapter.js')");
    const polyfillIdx = gameJs.indexOf("require('./tt-polyfill.js')");
    const engineIdx = gameJs.indexOf("require('engine/phaser-engine.min.js')");
    expect(adapterIdx).toBeGreaterThanOrEqual(0);
    expect(adapterIdx).toBeLessThan(polyfillIdx);
    expect(polyfillIdx).toBeLessThan(engineIdx);
  });

  it('game.js uses tt.* APIs and no wx.* residue', () => {
    const config: TtProjectConfig = {
      outputDir,
      adapterPath,
      orientation: 'landscape',
      appid: 'ttabc1234567890',
    };

    generateTtProject(config);

    const gameJs = fs.readFileSync(path.join(outputDir, 'game.js'), 'utf-8');
    expect(gameJs).toContain('tt.loadSubpackage');
    expect(gameJs).toContain('tt.getSystemInfoSync');
    expect(gameJs).not.toMatch(/\bwx\./);
    expect(gameJs).not.toContain('__wxCanvas');
    // Splash reuses the on-screen canvas the adapter mounts on window.canvas
    expect(gameJs).toContain('window.canvas');
  });

  it('game.js enables Phaser touch input before the engine loads', () => {
    const config: TtProjectConfig = {
      outputDir,
      adapterPath,
      orientation: 'portrait',
      appid: 'ttabc1234567890',
    };

    generateTtProject(config);

    const gameJs = fs.readFileSync(path.join(outputDir, 'game.js'), 'utf-8');
    // Phaser detects touch via `'ontouchstart' in documentElement ||
    // navigator.maxTouchPoints >= 1`. The official tt-adapter sets neither, so
    // Phaser never creates its TouchManager and nothing is clickable. game.js
    // must set these BEFORE the engine is required (device detection runs then).
    expect(gameJs).toContain('navigator.maxTouchPoints = 10');
    expect(gameJs).toContain('document.documentElement.ontouchstart = null');
    // Must run before the engine require (where Phaser's device detection runs).
    const touchIdx = gameJs.indexOf('navigator.maxTouchPoints = 10');
    const engineIdx = gameJs.indexOf("require('engine/phaser-engine.min.js')");
    expect(touchIdx).toBeGreaterThanOrEqual(0);
    expect(engineIdx).toBeGreaterThan(touchIdx);
  });

  it('game.js provides document.elementFromPoint for the touch-move handler', () => {
    const config: TtProjectConfig = {
      outputDir,
      adapterPath,
      orientation: 'portrait',
      appid: 'ttabc1234567890',
    };

    generateTtProject(config);

    const gameJs = fs.readFileSync(path.join(outputDir, 'game.js'), 'utf-8');
    // Phaser calls document.elementFromPoint on every touchmove; the official
    // adapter omits it, so the handler throws and paddle/drag input dies.
    expect(gameJs).toContain('document.elementFromPoint = function');
    expect(gameJs).toContain('window.canvas');
  });

  it('game.js patches Audio to fire on<type> handlers and binds requestAnimationFrame', () => {
    const config: TtProjectConfig = {
      outputDir,
      adapterPath,
      orientation: 'portrait',
      appid: 'ttabc1234567890',
    };

    generateTtProject(config);

    const gameJs = fs.readFileSync(path.join(outputDir, 'game.js'), 'utf-8');
    // Audio: Phaser sets audio.oncanplaythrough/onerror as properties; the
    // adapter's dispatchEvent only calls addEventListener listeners, so patch
    // Audio.prototype.dispatchEvent to also invoke the on<type> handler.
    expect(gameJs).toContain('A.prototype.dispatchEvent');
    expect(gameJs).toContain("'on' + event.type");
    // Audio: the adapter's load() is a no-op; override it to emit canplaythrough
    // so Phaser's audio-unlock flow (which calls tag.load()) completes.
    expect(gameJs).toContain('A.prototype.load = function');
    // Audio: guard the currentTime setter so Phaser's per-frame loop re-seek
    // doesn't glitch InnerAudioContext (BGM static). Redundant seeks are skipped.
    expect(gameJs).toContain("Object.defineProperty(A.prototype, 'currentTime'");
    // Audio unlock: forward touch events to document.body (Phaser listens there).
    expect(gameJs).toContain('document.body.dispatchEvent');
    // Audio: prevent Phaser from locking audio (mini-game InnerAudioContext
    // plays without a gesture) by removing window.ontouchstart.
    expect(gameJs).toContain('delete window.ontouchstart');
    // rAF: bind window.requestAnimationFrame from the bare global if missing.
    expect(gameJs).toContain('w.requestAnimationFrame = requestAnimationFrame');
  });

  it('generates game.json with correct orientation and defaults', () => {
    const config: TtProjectConfig = {
      outputDir,
      adapterPath,
      orientation: 'landscape',
      appid: 'ttabc1234567890',
    };

    generateTtProject(config);

    const gameJson = JSON.parse(
      fs.readFileSync(path.join(outputDir, 'game.json'), 'utf-8')
    );
    expect(gameJson.deviceOrientation).toBe('landscape');
    expect(gameJson.showStatusBar).toBe(false);
    expect(gameJson.networkTimeout).toEqual({
      request: 10000,
      connectSocket: 10000,
      uploadFile: 10000,
      downloadFile: 10000,
    });
    // engine subpackage is always present
    expect(gameJson.subpackages).toContainEqual({ name: 'engine', root: 'engine/' });
  });

  it('includes scene subpackages in game.json after engine', () => {
    const config: TtProjectConfig = {
      outputDir,
      adapterPath,
      orientation: 'portrait',
      appid: 'ttabc1234567890',
      subpackages: [
        { name: 'menu', root: 'menu/' },
        { name: 'game-play', root: 'game-play/' },
      ],
    };

    generateTtProject(config);

    const gameJson = JSON.parse(
      fs.readFileSync(path.join(outputDir, 'game.json'), 'utf-8')
    );
    expect(gameJson.subpackages).toEqual([
      { name: 'engine', root: 'engine/' },
      { name: 'menu', root: 'menu/' },
      { name: 'game-play', root: 'game-play/' },
    ]);
    // subpackage entry stubs are created
    expect(fs.existsSync(path.join(outputDir, 'menu', 'game.js'))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, 'engine', 'game.js'))).toBe(true);
  });

  it('generates project.config.json with appid and Douyin settings', () => {
    const config: TtProjectConfig = {
      outputDir,
      adapterPath,
      orientation: 'portrait',
      appid: 'ttABCDEF123456',
    };

    generateTtProject(config);

    const projectConfig = JSON.parse(
      fs.readFileSync(path.join(outputDir, 'project.config.json'), 'utf-8')
    );
    expect(projectConfig.appid).toBe('ttABCDEF123456');
    expect(projectConfig.compileType).toBe('game');
    expect(projectConfig.projectname).toBe('phaser-tt-game');
    expect(projectConfig.setting.es6).toBe(true);
    expect(projectConfig.setting.minified).toBe(true);
  });

  it('copies the tt-adapter.js runtime into outputDir', () => {
    const config: TtProjectConfig = {
      outputDir,
      adapterPath,
      orientation: 'portrait',
      appid: 'ttabc1234567890',
    };

    generateTtProject(config);

    const adapterContent = fs.readFileSync(
      path.join(outputDir, 'tt-adapter.js'),
      'utf-8'
    );
    expect(adapterContent).toContain('mock tt-adapter content');
  });

  it('copies the tt-polyfill.js runtime found next to the adapter', () => {
    const config: TtProjectConfig = {
      outputDir,
      adapterPath,
      orientation: 'portrait',
      appid: 'ttabc1234567890',
    };

    generateTtProject(config);

    const polyfillContent = fs.readFileSync(
      path.join(outputDir, 'tt-polyfill.js'),
      'utf-8'
    );
    expect(polyfillContent).toContain('mock tt-polyfill content');
  });

  it('honours an explicit polyfillPath over the sibling default', () => {
    const explicitDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tt-poly-explicit-'));
    const explicit = path.join(explicitDir, 'tt-polyfill.js');
    fs.writeFileSync(explicit, '// explicit polyfill content', 'utf-8');

    const config: TtProjectConfig = {
      outputDir,
      adapterPath,
      polyfillPath: explicit,
      orientation: 'portrait',
      appid: 'ttabc1234567890',
    };

    generateTtProject(config);

    const polyfillContent = fs.readFileSync(
      path.join(outputDir, 'tt-polyfill.js'),
      'utf-8'
    );
    expect(polyfillContent).toContain('explicit polyfill content');
    fs.rmSync(explicitDir, { recursive: true, force: true });
  });

  it('creates outputDir if it does not exist', () => {
    const nestedOutput = path.join(outputDir, 'deep', 'nested', 'output');

    const config: TtProjectConfig = {
      outputDir: nestedOutput,
      adapterPath,
      orientation: 'portrait',
      appid: 'ttabc1234567890',
    };

    generateTtProject(config);

    expect(fs.existsSync(path.join(nestedOutput, 'game.js'))).toBe(true);
    expect(fs.existsSync(path.join(nestedOutput, 'game.json'))).toBe(true);
    expect(fs.existsSync(path.join(nestedOutput, 'project.config.json'))).toBe(true);
    expect(fs.existsSync(path.join(nestedOutput, 'tt-adapter.js'))).toBe(true);
  });
});
