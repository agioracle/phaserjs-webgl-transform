import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { rollup } from 'rollup';
import { phaserTtTransform } from '../src/index';

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'rollup-plugin-tt-test-'));
}

describe('phaserTtTransform', () => {
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
    adapterPath = path.join(adapterDir, 'tt-adapter.js');
    fs.writeFileSync(adapterPath, '// tt adapter stub', 'utf-8');
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('returns a plugin with correct name', () => {
    const plugin = phaserTtTransform({
      outputDir,
      assetsDir,
      remoteDir,
      adapterPath,
      orientation: 'portrait',
      appid: 'tt123',
      cdnBase: 'https://cdn.example.com',
    });

    expect(plugin.name).toBe('phaser-tt-transform');
  });

  it('transforms Phaser.Game config in .js files (canvas -> window.canvas)', async () => {
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

    const plugin = phaserTtTransform({
      outputDir,
      assetsDir,
      remoteDir,
      adapterPath,
      orientation: 'portrait',
      appid: 'tt123',
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
    expect(mainChunk.code).toContain('window.canvas');
    expect(mainChunk.code).not.toContain('__wxCanvas');
    expect(mainChunk.code).toContain('disableWebAudio');
  });

  it('generates tt project files during generateBundle', async () => {
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

    const plugin = phaserTtTransform({
      outputDir,
      assetsDir,
      remoteDir,
      adapterPath,
      orientation: 'portrait',
      appid: 'tt123',
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
    expect(fs.existsSync(path.join(outputDir, 'tt-adapter.js'))).toBe(true);
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

    const plugin = phaserTtTransform({
      outputDir,
      assetsDir,
      remoteDir,
      adapterPath,
      orientation: 'landscape',
      appid: 'ttABC',
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

  it('generates H5 project files when target is h5', async () => {
    const inputFile = path.join(inputDir, 'h5game.js');
    fs.writeFileSync(
      inputFile,
      `const game = new Phaser.Game({ width: 800, height: 600 });`,
      'utf-8'
    );

    const plugin = phaserTtTransform({
      outputDir,
      assetsDir,
      remoteDir,
      adapterPath,
      orientation: 'portrait',
      appid: 'tt123',
      cdnBase: 'https://cdn.example.com',
      target: 'h5',
    });

    const bundle = await rollup({
      input: inputFile,
      plugins: [plugin],
      external: ['phaser'],
    });

    await bundle.write({ dir: outputDir, format: 'es' });

    // H5 target: index.html, no tt-adapter/game.json
    expect(fs.existsSync(path.join(outputDir, 'index.html'))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, 'game.json'))).toBe(false);
    expect(fs.existsSync(path.join(outputDir, 'tt-adapter.js'))).toBe(false);
  });

  it('does not transform non-js files', async () => {
    const plugin = phaserTtTransform({
      outputDir,
      assetsDir,
      remoteDir,
      adapterPath,
      orientation: 'portrait',
      appid: 'tt123',
      cdnBase: 'https://cdn.example.com',
    });

    const transformHook = plugin.transform as (code: string, id: string) => any;
    const jsonResult = transformHook?.call({} as any, '{"key": "value"}', 'data.json');
    expect(jsonResult).toBeNull();
  });
});
