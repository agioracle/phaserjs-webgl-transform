import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { rollup, type RollupOutput } from 'rollup';
import { phaserWxTransform, type PhaserWxTransformOptions } from '../src/index';

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'rollup-plugin-test-'));
}

describe('phaserWxTransform', () => {
  let tempDir: string;
  let inputDir: string;
  let outputDir: string;
  let assetsDir: string;
  let remoteDir: string;
  let adapterPath: string;

  beforeEach(() => {
    tempDir = createTempDir();
    inputDir = path.join(tempDir, 'src');
    outputDir = path.join(tempDir, 'dist');
    assetsDir = path.join(tempDir, 'assets');
    remoteDir = path.join(tempDir, 'remote');

    fs.mkdirSync(inputDir, { recursive: true });
    fs.mkdirSync(assetsDir, { recursive: true });

    const adapterDir = path.join(tempDir, 'adapter');
    fs.mkdirSync(adapterDir, { recursive: true });
    adapterPath = path.join(adapterDir, 'phaser-wx-adapter.js');
    fs.writeFileSync(adapterPath, '// wx adapter stub', 'utf-8');
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('returns a plugin with correct name', () => {
    const plugin = phaserWxTransform({
      outputDir,
      assetsDir,
      remoteDir,
      adapterPath,
      orientation: 'portrait',
      appid: 'wx123',
      cdnBase: 'https://cdn.example.com',
    });

    expect(plugin.name).toBe('phaser-wx-transform');
  });

  it('transforms Phaser.Game config in .js files', async () => {
    const inputFile = path.join(inputDir, 'game.js');
    fs.writeFileSync(
      inputFile,
      `
const game = new Phaser.Game({
  width: 800,
  height: 600,
  type: Phaser.CANVAS,
  scene: []
});
export default game;
`,
      'utf-8'
    );

    const plugin = phaserWxTransform({
      outputDir,
      assetsDir,
      remoteDir,
      adapterPath,
      orientation: 'portrait',
      appid: 'wx123',
      cdnBase: 'https://cdn.example.com',
    });

    const bundle = await rollup({
      input: inputFile,
      plugins: [plugin],
      external: ['phaser'],
    });

    const { output } = await bundle.generate({ format: 'es' });
    const mainChunk = output[0];

    expect(mainChunk.code).toContain('Phaser.WEBGL');
    expect(mainChunk.code).toContain('GameGlobal.__wxCanvas');
    expect(mainChunk.code).toContain('disableWebAudio');
  });

  it('collects asset references during transform', async () => {
    fs.writeFileSync(path.join(assetsDir, 'logo.png'), 'fake-png-data', 'utf-8');

    const inputFile = path.join(inputDir, 'scene.js');
    fs.writeFileSync(
      inputFile,
      `
export class BootScene {
  preload() {
    this.load.image('logo', 'logo.png');
  }
}
`,
      'utf-8'
    );

    const plugin = phaserWxTransform({
      outputDir,
      assetsDir,
      remoteDir,
      adapterPath,
      orientation: 'portrait',
      appid: 'wx123',
      cdnBase: 'https://cdn.example.com',
      sizeThreshold: 1024 * 1024,
    });

    const bundle = await rollup({
      input: inputFile,
      plugins: [plugin],
    });

    await bundle.write({ dir: outputDir, format: 'es' });

    expect(fs.existsSync(path.join(outputDir, 'game.js'))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, 'game.json'))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, 'project.config.json'))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, 'phaser-wx-adapter.js'))).toBe(true);
  });

  it('generates asset manifest during generateBundle', async () => {
    fs.writeFileSync(path.join(assetsDir, 'tile.png'), 'X'.repeat(500), 'utf-8');

    const inputFile = path.join(inputDir, 'loader.js');
    fs.writeFileSync(
      inputFile,
      `
export function preload() {
  this.load.image('tile', 'tile.png');
}
`,
      'utf-8'
    );

    const plugin = phaserWxTransform({
      outputDir,
      assetsDir,
      remoteDir,
      adapterPath,
      orientation: 'landscape',
      appid: 'wxABC',
      cdnBase: 'https://cdn.test.com',
      sizeThreshold: 1024 * 1024,
    });

    const bundle = await rollup({
      input: inputFile,
      plugins: [plugin],
    });

    await bundle.write({ dir: outputDir, format: 'es' });

    const manifestPath = path.join(outputDir, 'asset-manifest.json');
    expect(fs.existsSync(manifestPath)).toBe(true);

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    expect(manifest.version).toBe(1);
    expect(manifest.cdnBase).toBe('https://cdn.test.com');
  });

  it('does not transform non-js files', async () => {
    const plugin = phaserWxTransform({
      outputDir,
      assetsDir,
      remoteDir,
      adapterPath,
      orientation: 'portrait',
      appid: 'wx123',
      cdnBase: 'https://cdn.example.com',
    });

    const transformHook = plugin.transform as (code: string, id: string) => any;
    const jsonResult = transformHook?.call({} as any, '{"key": "value"}', 'data.json');
    expect(jsonResult).toBeNull();
  });
});
