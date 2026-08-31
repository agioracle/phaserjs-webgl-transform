import type { Plugin, NormalizedOutputOptions, OutputBundle } from 'rollup';
import { transformGameConfig } from './transforms/game-config';
import { scanAssets, type AssetReference } from './asset-pipeline/scanner';
import { splitAssets } from './asset-pipeline/splitter';
import { generateManifest } from './asset-pipeline/manifest';
import { generateTtProject } from './output/tt-project';
import { generateH5Project } from './output/h5-project';

export interface PhaserTtTransformOptions {
  /** Directory where output Douyin project files are written */
  outputDir: string;
  /** Directory containing game asset files */
  assetsDir: string;
  /** Directory for remote/CDN assets that exceed the size threshold */
  remoteDir: string;
  /** Path to the tt-adapter.js runtime file (bundled with this package) */
  adapterPath: string;
  /**
   * Path to the tt-polyfill.js runtime file (supplementary Blob/URL). Optional;
   * defaults to the file shipped next to adapterPath.
   */
  polyfillPath?: string;
  /** Device orientation: 'portrait' or 'landscape' */
  orientation: 'portrait' | 'landscape';
  /** Douyin Mini-Game appid */
  appid: string;
  /** CDN base URL for remote assets */
  cdnBase: string;
  /** Size threshold in bytes; assets larger go to remote (default: 1MB) */
  sizeThreshold?: number;
  /** Directory containing assets that should always be treated as remote */
  remoteAssetsDir?: string;
  /** Scene subpackages configuration */
  subpackages?: { name: string; root: string }[];
  /** Build target: 'tt' for Douyin Mini-Game, 'h5' for browser */
  target?: 'tt' | 'h5';
}

const TRANSFORMABLE_EXTENSIONS = /\.(js|ts|jsx|tsx)$/;

const SIZE_WARN_THRESHOLD = 16 * 1024 * 1024; // 16MB
const SIZE_ERROR_THRESHOLD = 20 * 1024 * 1024; // 20MB

export function phaserTtTransform(options: PhaserTtTransformOptions): Plugin {
  const {
    outputDir,
    assetsDir,
    remoteDir,
    adapterPath,
    polyfillPath,
    orientation,
    appid,
    cdnBase,
    sizeThreshold = 1024 * 1024,
    remoteAssetsDir = '',
    subpackages = [],
    target = 'tt',
  } = options;

  const collectedAssetRefs: AssetReference[] = [];

  // The game-config transform takes the same target vocabulary as this plugin:
  // 'tt' selects the mini-game branch (WEBGL, window.canvas, NONE scale,
  // disableWebAudio, imageLoadType), 'h5' selects the browser branch.
  const transformTarget: 'tt' | 'h5' = target === 'h5' ? 'h5' : 'tt';

  return {
    name: 'phaser-tt-transform',

    transform(code: string, id: string) {
      if (!TRANSFORMABLE_EXTENSIONS.test(id)) {
        return null;
      }

      // Run game config transform
      const configResult = transformGameConfig(code, transformTarget);
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

        // Calculate total local size for warnings (tt only)
        if (target !== 'h5') {
          let totalLocalSize = 0;
          for (const entry of splitResult.local) {
            totalLocalSize += entry.size;
          }

          if (totalLocalSize > SIZE_ERROR_THRESHOLD) {
            this.error(
              `Total local asset size (${(totalLocalSize / 1024 / 1024).toFixed(1)}MB) exceeds Douyin Mini-Game 20MB limit. Move large assets to CDN by lowering sizeThreshold.`
            );
          } else if (totalLocalSize > SIZE_WARN_THRESHOLD) {
            this.warn(
              `Total local asset size (${(totalLocalSize / 1024 / 1024).toFixed(1)}MB) exceeds 16MB. Consider moving large assets to CDN.`
            );
          }
        }
      } else {
        // No assets found, still generate an empty manifest
        generateManifest({ local: [], remote: [] }, cdnBase, outputDir);
      }

      // Generate project structure based on target
      if (target === 'h5') {
        generateH5Project({ outputDir });
      } else {
        generateTtProject({
          outputDir,
          adapterPath,
          polyfillPath,
          orientation,
          appid,
          subpackages,
        });
      }
    },
  };
}

export type { AssetReference } from './asset-pipeline/scanner';
export type { SplitResult, AssetEntry } from './asset-pipeline/splitter';
export type { AssetManifest } from './asset-pipeline/manifest';
export type { TtProjectConfig } from './output/tt-project';
export type { H5ProjectConfig } from './output/h5-project';
export { transformGameConfig } from './transforms/game-config';
export { scanAssets } from './asset-pipeline/scanner';
export { splitAssets } from './asset-pipeline/splitter';
export { generateManifest } from './asset-pipeline/manifest';
export { generateTtProject } from './output/tt-project';
export { generateH5Project } from './output/h5-project';
