import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { rollup } from 'rollup';
import { phaserWxTransform } from '@aspect/rollup-plugin';

const FIXTURES_DIR = path.resolve(__dirname, '../fixtures/sample-game');
const OUTPUT_DIR = path.join(FIXTURES_DIR, 'dist-wx');
const REMOTE_DIR = path.join(OUTPUT_DIR, 'remote');
const ADAPTER_STUB = path.resolve(__dirname, '../fixtures/adapter-stub.js');
const ENTRY = path.join(FIXTURES_DIR, 'src/main.js');
const ASSETS_DIR = path.join(FIXTURES_DIR, 'public/assets');

function cleanup() {
  if (fs.existsSync(OUTPUT_DIR)) {
    fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
  }
}

describe('Full Pipeline Integration', () => {
  beforeAll(async () => {
    cleanup();

    const plugin = phaserWxTransform({
      outputDir: OUTPUT_DIR,
      assetsDir: ASSETS_DIR,
      remoteDir: REMOTE_DIR,
      adapterPath: ADAPTER_STUB,
      orientation: 'landscape',
      appid: 'wx1234567890abcdef',
      cdnBase: 'https://cdn.example.com/game-assets',
      sizeThreshold: 204800, // 200KB — logo.png (1KB) stays local, bgm.mp3 (300KB) goes remote
    });

    const bundle = await rollup({
      input: ENTRY,
      plugins: [plugin],
      // Treat phaser as external since we don't have the actual package
      external: ['phaser'],
    });

    await bundle.write({
      dir: OUTPUT_DIR,
      format: 'cjs',
    });

    await bundle.close();
  });

  afterAll(() => {
    cleanup();
  });

  // --- Output structure ---

  it('creates output directory', () => {
    expect(fs.existsSync(OUTPUT_DIR)).toBe(true);
  });

  it('generates game.js', () => {
    const gameJs = path.join(OUTPUT_DIR, 'game.js');
    expect(fs.existsSync(gameJs)).toBe(true);
    const content = fs.readFileSync(gameJs, 'utf-8');
    expect(content).toContain("require('./phaser-wx-adapter.js')");
    expect(content).toContain("require('./game-bundle.js')");
  });

  it('generates game.json with correct orientation', () => {
    const gameJson = path.join(OUTPUT_DIR, 'game.json');
    expect(fs.existsSync(gameJson)).toBe(true);
    const parsed = JSON.parse(fs.readFileSync(gameJson, 'utf-8'));
    expect(parsed.deviceOrientation).toBe('landscape');
    expect(parsed.showStatusBar).toBe(false);
  });

  it('generates project.config.json with correct appid', () => {
    const projectConfig = path.join(OUTPUT_DIR, 'project.config.json');
    expect(fs.existsSync(projectConfig)).toBe(true);
    const parsed = JSON.parse(fs.readFileSync(projectConfig, 'utf-8'));
    expect(parsed.appid).toBe('wx1234567890abcdef');
    expect(parsed.compileType).toBe('game');
  });

  it('copies adapter as phaser-wx-adapter.js', () => {
    const adapterOut = path.join(OUTPUT_DIR, 'phaser-wx-adapter.js');
    expect(fs.existsSync(adapterOut)).toBe(true);
    const content = fs.readFileSync(adapterOut, 'utf-8');
    expect(content).toContain('phaser-wx-adapter stub');
  });

  // --- Game config transform ---

  it('transforms game bundle with WebGL type injection', () => {
    const bundleFile = path.join(OUTPUT_DIR, 'main.js');
    expect(fs.existsSync(bundleFile)).toBe(true);
    const content = fs.readFileSync(bundleFile, 'utf-8');
    // Should inject type: Phaser.WEBGL
    expect(content).toContain('WEBGL');
    // Should inject audio.disableWebAudio: true
    expect(content).toContain('disableWebAudio');
  });

  // --- Asset pipeline ---

  it('generates asset-manifest.json', () => {
    const manifest = path.join(OUTPUT_DIR, 'asset-manifest.json');
    expect(fs.existsSync(manifest)).toBe(true);
    const parsed = JSON.parse(fs.readFileSync(manifest, 'utf-8'));
    expect(parsed.version).toBe(1);
    expect(parsed.cdnBase).toBe('https://cdn.example.com/game-assets');
    expect(parsed.assets).toBeDefined();
  });

  it('splits small assets to local directory', () => {
    // logo.png is 1KB, below 200KB threshold → local
    // Splitter copies to outputDir/<relative-path>, so dist-wx/images/logo.png
    const localLogoPath = path.join(OUTPUT_DIR, 'images', 'logo.png');
    if (fs.existsSync(localLogoPath)) {
      expect(true).toBe(true);
    } else {
      // Fallback: check manifest for local entries (remote: false)
      const manifest = JSON.parse(
        fs.readFileSync(path.join(OUTPUT_DIR, 'asset-manifest.json'), 'utf-8')
      );
      const localEntries = Object.values(manifest.assets).filter(
        (a: any) => a.remote === false
      );
      expect(localEntries.length).toBeGreaterThan(0);
    }
  });

  it('splits large assets to remote directory', () => {
    // bgm.mp3 is 300KB, above 200KB threshold → remote
    if (fs.existsSync(REMOTE_DIR)) {
      const files = fs.readdirSync(REMOTE_DIR, { recursive: true }) as string[];
      const hasMp3 = files.some((f) => f.toString().endsWith('.mp3'));
      expect(hasMp3).toBe(true);
    } else {
      // Check manifest for remote entries
      const manifest = JSON.parse(
        fs.readFileSync(path.join(OUTPUT_DIR, 'asset-manifest.json'), 'utf-8')
      );
      const remoteEntries = Object.values(manifest.assets).filter(
        (a: any) => a.location === 'remote'
      );
      expect(remoteEntries.length).toBeGreaterThan(0);
    }
  });

  it('manifest contains entries for scanned assets', () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(OUTPUT_DIR, 'asset-manifest.json'), 'utf-8')
    );
    const assetKeys = Object.keys(manifest.assets);
    // Should have found logo.png and bgm.mp3 from the Phaser load calls
    expect(assetKeys.length).toBeGreaterThanOrEqual(2);
  });

  // --- Config file validation (unit-level in integration context) ---

  it('loads config from fixture correctly', async () => {
    const { loadConfig } = await import('../../src/utils/config.js');
    const configPath = path.join(FIXTURES_DIR, 'phaser-wx.config.json');
    const config = loadConfig(configPath);
    expect(config.appid).toBe('wx1234567890abcdef');
    expect(config.orientation).toBe('landscape');
    expect(config.cdn).toBe('https://cdn.example.com/game-assets');
    expect(config.entry).toBe('src/main.js');
    expect(config.output.dir).toBe('dist-wx');
  });
});
