import * as fs from 'node:fs';
import * as path from 'node:path';

export interface PhaserWxConfig {
  appid: string;
  orientation: 'portrait' | 'landscape';
  cdn: string;
  entry: string;
  assets: {
    dir: string;
    remoteSizeThreshold: number;
    cacheMaxSize: number;
    downloadRetries: number;
    downloadTimeout: number;
  };
  output: {
    dir: string;
  };
  webgl: {
    version: number;
    antialias: boolean;
    preserveDrawingBuffer: boolean;
  };
}

const ASSET_DEFAULTS = {
  remoteSizeThreshold: 204800,
  cacheMaxSize: 52428800,
  downloadRetries: 3,
  downloadTimeout: 30000,
};

const WEBGL_DEFAULTS = {
  version: 1,
  antialias: false,
  preserveDrawingBuffer: false,
};

function isValidUrl(str: string): boolean {
  try {
    const url = new URL(str);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function loadConfig(configPath?: string): PhaserWxConfig {
  const resolvedPath = configPath ?? path.join(process.cwd(), 'phaser-wx.config.json');

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Config file not found: ${resolvedPath}`);
  }

  const raw = fs.readFileSync(resolvedPath, 'utf-8');

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Failed to parse config file as valid JSON: ${resolvedPath}`);
  }

  // --- Validate required fields ---

  if (!parsed.appid || typeof parsed.appid !== 'string') {
    throw new Error('Config validation error: "appid" is required and must be a string.');
  }
  if (!parsed.appid.startsWith('wx')) {
    throw new Error(
      'Config validation error: "appid" must start with "wx" (e.g. "wx1234567890abcdef").'
    );
  }

  if (!parsed.orientation || (parsed.orientation !== 'portrait' && parsed.orientation !== 'landscape')) {
    throw new Error(
      'Config validation error: "orientation" is required and must be "portrait" or "landscape".'
    );
  }

  if (!parsed.cdn || typeof parsed.cdn !== 'string') {
    throw new Error('Config validation error: "cdn" is required and must be a string.');
  }
  if (!isValidUrl(parsed.cdn)) {
    throw new Error(
      'Config validation error: "cdn" must be a valid URL (starting with http:// or https://).'
    );
  }

  if (!parsed.entry || typeof parsed.entry !== 'string') {
    throw new Error('Config validation error: "entry" is required and must be a string.');
  }

  const output = parsed.output as Record<string, unknown> | undefined;
  if (!output || typeof output !== 'object' || !output.dir || typeof output.dir !== 'string') {
    throw new Error('Config validation error: "output.dir" is required and must be a string.');
  }

  const assets = (parsed.assets ?? {}) as Record<string, unknown>;
  const webgl = (parsed.webgl ?? {}) as Record<string, unknown>;

  return {
    appid: parsed.appid,
    orientation: parsed.orientation as 'portrait' | 'landscape',
    cdn: parsed.cdn,
    entry: parsed.entry,
    assets: {
      dir: typeof assets.dir === 'string' ? assets.dir : '',
      remoteSizeThreshold:
        typeof assets.remoteSizeThreshold === 'number'
          ? assets.remoteSizeThreshold
          : ASSET_DEFAULTS.remoteSizeThreshold,
      cacheMaxSize:
        typeof assets.cacheMaxSize === 'number'
          ? assets.cacheMaxSize
          : ASSET_DEFAULTS.cacheMaxSize,
      downloadRetries:
        typeof assets.downloadRetries === 'number'
          ? assets.downloadRetries
          : ASSET_DEFAULTS.downloadRetries,
      downloadTimeout:
        typeof assets.downloadTimeout === 'number'
          ? assets.downloadTimeout
          : ASSET_DEFAULTS.downloadTimeout,
    },
    output: {
      dir: output.dir as string,
    },
    webgl: {
      version: typeof webgl.version === 'number' ? webgl.version : WEBGL_DEFAULTS.version,
      antialias: typeof webgl.antialias === 'boolean' ? webgl.antialias : WEBGL_DEFAULTS.antialias,
      preserveDrawingBuffer:
        typeof webgl.preserveDrawingBuffer === 'boolean'
          ? webgl.preserveDrawingBuffer
          : WEBGL_DEFAULTS.preserveDrawingBuffer,
    },
  };
}
