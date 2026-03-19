import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { loadConfig } from '../../src/utils/config.js';
import type { PhaserWxConfig } from '../../src/utils/config.js';

vi.mock('node:fs');

const VALID_CONFIG = {
  appid: 'wx1234567890abcdef',
  orientation: 'portrait' as const,
  cdn: 'https://cdn.example.com/game',
  entry: 'src/main.js',
  assets: {
    dir: 'public/assets',
  },
  output: {
    dir: 'dist',
  },
};

const FULL_CONFIG_WITH_DEFAULTS: PhaserWxConfig = {
  appid: 'wx1234567890abcdef',
  orientation: 'portrait',
  cdn: 'https://cdn.example.com/game',
  entry: 'src/main.js',
  assets: {
    dir: 'public/assets',
    remoteAssetsDir: '',
    remoteSizeThreshold: 204800,
    cacheMaxSize: 52428800,
    downloadRetries: 3,
    downloadTimeout: 30000,
  },
  output: {
    dir: 'dist',
  },
  webgl: {
    version: 1,
    antialias: false,
    preserveDrawingBuffer: false,
  },
  subpackages: [],
};

describe('loadConfig', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads a valid config from default path and fills defaults', () => {
    const defaultPath = path.join(process.cwd(), 'phaser-wx.config.json');
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(VALID_CONFIG));

    const result = loadConfig();

    expect(fs.readFileSync).toHaveBeenCalledWith(defaultPath, 'utf-8');
    expect(result).toEqual(FULL_CONFIG_WITH_DEFAULTS);
  });

  it('loads a valid config from a custom path', () => {
    const customPath = '/my/project/custom-config.json';
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(VALID_CONFIG));

    const result = loadConfig(customPath);

    expect(fs.readFileSync).toHaveBeenCalledWith(customPath, 'utf-8');
    expect(result).toEqual(FULL_CONFIG_WITH_DEFAULTS);
  });

  it('preserves user-provided optional fields instead of overwriting with defaults', () => {
    const configWithOptionals = {
      ...VALID_CONFIG,
      assets: {
        dir: 'public/assets',
        remoteSizeThreshold: 500000,
        cacheMaxSize: 100000000,
        downloadRetries: 5,
        downloadTimeout: 60000,
      },
      webgl: {
        version: 2,
        antialias: true,
        preserveDrawingBuffer: true,
      },
    };
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(configWithOptionals));

    const result = loadConfig();

    expect(result.assets.remoteSizeThreshold).toBe(500000);
    expect(result.assets.cacheMaxSize).toBe(100000000);
    expect(result.assets.downloadRetries).toBe(5);
    expect(result.assets.downloadTimeout).toBe(60000);
    expect(result.webgl.version).toBe(2);
    expect(result.webgl.antialias).toBe(true);
    expect(result.webgl.preserveDrawingBuffer).toBe(true);
  });

  it('throws if config file does not exist', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    expect(() => loadConfig()).toThrow(/not found/i);
  });

  it('throws if config file contains invalid JSON', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('{ broken json!!!');

    expect(() => loadConfig()).toThrow(/parse|invalid json/i);
  });

  it('throws if appid is missing', () => {
    const { appid, ...noAppid } = VALID_CONFIG;
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(noAppid));

    expect(() => loadConfig()).toThrow(/appid/i);
  });

  it('throws if appid does not start with "wx"', () => {
    const badAppid = { ...VALID_CONFIG, appid: 'ab1234567890' };
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(badAppid));

    expect(() => loadConfig()).toThrow(/appid.*wx/i);
  });

  it('throws if orientation is invalid', () => {
    const badOrientation = { ...VALID_CONFIG, orientation: 'diagonal' };
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(badOrientation));

    expect(() => loadConfig()).toThrow(/orientation/i);
  });

  it('allows missing cdn and defaults to empty string', () => {
    const { cdn, ...noCdn } = VALID_CONFIG;
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(noCdn));

    const result = loadConfig();
    expect(result.cdn).toBe('');
  });

  it('allows empty string cdn', () => {
    const emptyCdn = { ...VALID_CONFIG, cdn: '' };
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(emptyCdn));

    const result = loadConfig();
    expect(result.cdn).toBe('');
  });

  it('throws if cdn is not a valid URL', () => {
    const badCdn = { ...VALID_CONFIG, cdn: 'not-a-url' };
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(badCdn));

    expect(() => loadConfig()).toThrow(/cdn.*url/i);
  });

  it('throws if entry is missing', () => {
    const { entry, ...noEntry } = VALID_CONFIG;
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(noEntry));

    expect(() => loadConfig()).toThrow(/entry/i);
  });

  it('throws if output.dir is missing', () => {
    const noOutputDir = { ...VALID_CONFIG, output: {} };
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(noOutputDir));

    expect(() => loadConfig()).toThrow(/output\.dir/i);
  });
});
