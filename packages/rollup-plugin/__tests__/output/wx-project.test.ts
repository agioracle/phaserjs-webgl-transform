import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { generateWxProject, WxProjectConfig } from '../../src/output/wx-project';

describe('generateWxProject', () => {
  let outputDir: string;
  let adapterDir: string;

  beforeEach(() => {
    outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wx-project-test-'));
    adapterDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wx-adapter-src-'));
    fs.writeFileSync(
      path.join(adapterDir, 'phaser-wx-adapter.js'),
      '// mock adapter content\nconsole.log("adapter loaded");',
      'utf-8'
    );
  });

  afterEach(() => {
    fs.rmSync(outputDir, { recursive: true, force: true });
    fs.rmSync(adapterDir, { recursive: true, force: true });
  });

  it('generates game.js with correct require chain', () => {
    const config: WxProjectConfig = {
      outputDir,
      adapterPath: path.join(adapterDir, 'phaser-wx-adapter.js'),
      orientation: 'portrait',
      appid: 'wx1234567890',
    };

    generateWxProject(config);

    const gameJs = fs.readFileSync(path.join(outputDir, 'game.js'), 'utf-8');
    expect(gameJs).toContain("require('./phaser-wx-adapter.js')");
    expect(gameJs).toContain("GameGlobal.__wxCustomAdapter");
    expect(gameJs).toContain("require('./phaser-wx-custom-adapter.js')");
    expect(gameJs).toContain("require('./game-bundle.js')");
  });

  it('generates game.json with correct orientation and defaults', () => {
    const config: WxProjectConfig = {
      outputDir,
      adapterPath: path.join(adapterDir, 'phaser-wx-adapter.js'),
      orientation: 'landscape',
      appid: 'wx1234567890',
    };

    generateWxProject(config);

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
  });

  it('generates project.config.json with appid and settings', () => {
    const config: WxProjectConfig = {
      outputDir,
      adapterPath: path.join(adapterDir, 'phaser-wx-adapter.js'),
      orientation: 'portrait',
      appid: 'wxABCDEF123456',
    };

    generateWxProject(config);

    const projectConfig = JSON.parse(
      fs.readFileSync(path.join(outputDir, 'project.config.json'), 'utf-8')
    );
    expect(projectConfig.appid).toBe('wxABCDEF123456');
    expect(projectConfig.setting.urlCheck).toBe(false);
    expect(projectConfig.setting.es6).toBe(true);
    expect(projectConfig.setting.postcss).toBe(true);
    expect(projectConfig.setting.minified).toBe(true);
    expect(projectConfig.compileType).toBe('game');
    expect(projectConfig.libVersion).toBe('2.10.0');
    expect(projectConfig.projectname).toBe('phaser-wx-game');
  });

  it('copies adapter file to outputDir', () => {
    const config: WxProjectConfig = {
      outputDir,
      adapterPath: path.join(adapterDir, 'phaser-wx-adapter.js'),
      orientation: 'portrait',
      appid: 'wx1234567890',
    };

    generateWxProject(config);

    const adapterContent = fs.readFileSync(
      path.join(outputDir, 'phaser-wx-adapter.js'),
      'utf-8'
    );
    expect(adapterContent).toContain('mock adapter content');
  });

  it('creates outputDir if it does not exist', () => {
    const nestedOutput = path.join(outputDir, 'deep', 'nested', 'output');

    const config: WxProjectConfig = {
      outputDir: nestedOutput,
      adapterPath: path.join(adapterDir, 'phaser-wx-adapter.js'),
      orientation: 'portrait',
      appid: 'wx1234567890',
    };

    generateWxProject(config);

    expect(fs.existsSync(path.join(nestedOutput, 'game.js'))).toBe(true);
    expect(fs.existsSync(path.join(nestedOutput, 'game.json'))).toBe(true);
    expect(fs.existsSync(path.join(nestedOutput, 'project.config.json'))).toBe(true);
    expect(fs.existsSync(path.join(nestedOutput, 'phaser-wx-adapter.js'))).toBe(true);
  });

  it('generates game.json with portrait orientation', () => {
    const config: WxProjectConfig = {
      outputDir,
      adapterPath: path.join(adapterDir, 'phaser-wx-adapter.js'),
      orientation: 'portrait',
      appid: 'wx1234567890',
    };

    generateWxProject(config);

    const gameJson = JSON.parse(
      fs.readFileSync(path.join(outputDir, 'game.json'), 'utf-8')
    );
    expect(gameJson.deviceOrientation).toBe('portrait');
  });
});
