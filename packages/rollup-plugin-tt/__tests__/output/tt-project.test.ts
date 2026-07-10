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
