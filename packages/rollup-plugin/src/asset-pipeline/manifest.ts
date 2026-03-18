import * as fs from 'node:fs';
import * as path from 'node:path';
import type { SplitResult } from './splitter';

export interface AssetManifestEntry {
  size: number;
  hash: string;
  remote: boolean;
  type: string;
}

export interface AssetManifest {
  version: 1;
  cdnBase: string;
  assets: Record<string, AssetManifestEntry>;
}

export function generateManifest(
  splitResult: SplitResult,
  cdnBase: string,
  outputDir: string
): AssetManifest {
  const assets: Record<string, AssetManifestEntry> = {};

  for (const entry of splitResult.local) {
    assets[entry.path] = {
      size: entry.size,
      hash: entry.hash,
      remote: false,
      type: entry.type,
    };
  }

  for (const entry of splitResult.remote) {
    assets[entry.path] = {
      size: entry.size,
      hash: entry.hash,
      remote: true,
      type: entry.type,
    };
  }

  const manifest: AssetManifest = {
    version: 1,
    cdnBase,
    assets,
  };

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(
    path.join(outputDir, 'asset-manifest.json'),
    JSON.stringify(manifest, null, 2),
    'utf-8'
  );

  return manifest;
}
