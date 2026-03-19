import type { Plugin, NormalizedOutputOptions, OutputBundle } from 'rollup';
import { transformGameConfig } from './transforms/game-config';
import { scanAssets, type AssetReference } from './asset-pipeline/scanner';
import { splitAssets } from './asset-pipeline/splitter';
import { generateManifest } from './asset-pipeline/manifest';
import { generateWxProject } from './output/wx-project';
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface PhaserWxTransformOptions {
  /** Directory where output WeChat project files are written */
  outputDir: string;
  /** Directory containing game asset files */
  assetsDir: string;
  /** Directory for remote/CDN assets that exceed the size threshold */
  remoteDir: string;
  /** Path to the phaser-wx-adapter.js file (from @aspect/adapter) */
  adapterPath: string;
  /** Device orientation: 'portrait' or 'landscape' */
  orientation: 'portrait' | 'landscape';
  /** WeChat Mini-Game appid */
  appid: string;
  /** CDN base URL for remote assets */
  cdnBase: string;
  /** Size threshold in bytes; assets larger go to remote (default: 1MB) */
  sizeThreshold?: number;
  /** Directory containing assets that should always be treated as remote */
  remoteAssetsDir?: string;
  /** Scene subpackages configuration */
  subpackages?: { name: string; root: string }[];
}

const TRANSFORMABLE_EXTENSIONS = /\.(js|ts|jsx|tsx)$/;

const SIZE_WARN_THRESHOLD = 16 * 1024 * 1024; // 16MB
const SIZE_ERROR_THRESHOLD = 20 * 1024 * 1024; // 20MB

export function phaserWxTransform(options: PhaserWxTransformOptions): Plugin {
  const {
    outputDir,
    assetsDir,
    remoteDir,
    adapterPath,
    orientation,
    appid,
    cdnBase,
    sizeThreshold = 1024 * 1024,
    remoteAssetsDir = '',
    subpackages = [],
  } = options;

  const collectedAssetRefs: AssetReference[] = [];

  return {
    name: 'phaser-wx-transform',

    transform(code: string, id: string) {
      if (!TRANSFORMABLE_EXTENSIONS.test(id)) {
        return null;
      }

      // Run game config transform
      const configResult = transformGameConfig(code);
      for (const warning of configResult.warnings) {
        this.warn(warning);
      }

      // Scan for asset references
      const assetRefs = scanAssets(configResult.code);
      collectedAssetRefs.push(...assetRefs);

      return {
        code: configResult.code,
        map: null,
      };
    },

    generateBundle(
      this: any,
      _outputOptions: NormalizedOutputOptions,
      _bundle: OutputBundle
    ) {
      // Run asset pipeline
      if (collectedAssetRefs.length > 0 || remoteAssetsDir) {
        const splitResult = splitAssets(
          collectedAssetRefs,
          assetsDir,
          outputDir,
          remoteDir,
          sizeThreshold,
          remoteAssetsDir
        );

        generateManifest(splitResult, cdnBase, outputDir);

        // Calculate total local size for warnings
        let totalLocalSize = 0;
        for (const entry of splitResult.local) {
          totalLocalSize += entry.size;
        }

        if (totalLocalSize > SIZE_ERROR_THRESHOLD) {
          this.error(
            `Total local asset size (${(totalLocalSize / 1024 / 1024).toFixed(1)}MB) exceeds WeChat Mini-Game 20MB limit. Move large assets to CDN by lowering sizeThreshold.`
          );
        } else if (totalLocalSize > SIZE_WARN_THRESHOLD) {
          this.warn(
            `Total local asset size (${(totalLocalSize / 1024 / 1024).toFixed(1)}MB) exceeds 16MB. Consider moving large assets to CDN.`
          );
        }
      } else {
        // No assets found, still generate an empty manifest
        generateManifest({ local: [], remote: [] }, cdnBase, outputDir);
      }

      // Generate WeChat project structure
      generateWxProject({
        outputDir,
        adapterPath,
        orientation,
        appid,
        subpackages,
      });
    },
  };
}

export type { AssetReference } from './asset-pipeline/scanner';
export type { SplitResult, AssetEntry } from './asset-pipeline/splitter';
export type { AssetManifest } from './asset-pipeline/manifest';
export type { WxProjectConfig } from './output/wx-project';
export { transformGameConfig } from './transforms/game-config';
export { scanAssets } from './asset-pipeline/scanner';
export { splitAssets } from './asset-pipeline/splitter';
export { generateManifest } from './asset-pipeline/manifest';
export { generateWxProject } from './output/wx-project';
