import * as fs from 'node:fs';
import * as path from 'node:path';
import { loadConfig } from '../utils/config.js';

interface BuildOptions {
  cdn?: string;
}

interface FileSizeEntry {
  path: string;
  size: number;
}

function walkDir(dir: string, excludeDirs: string[] = []): FileSizeEntry[] {
  const results: FileSizeEntry[] = [];

  if (!fs.existsSync(dir)) {
    return results;
  }

  const entries = fs.readdirSync(dir);

  for (const entry of entries) {
    const fullPath = path.join(dir, entry as string);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      if (!excludeDirs.includes(entry as string)) {
        results.push(...walkDir(fullPath, excludeDirs));
      }
    } else if (stat.isFile()) {
      results.push({ path: fullPath, size: stat.size });
    }
  }

  return results;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

const SIZE_LIMIT_ERROR = 20_971_520; // 20MB
const SIZE_LIMIT_WARN = 16_777_216; // 16MB

export async function buildCommand(options: BuildOptions): Promise<void> {
  // Lazy imports: rollup and plugins are external and only needed for build
  const { rollup } = await import('rollup');
  const { phaserWxTransform } = await import('@aspect/rollup-plugin');
  const nodeResolve = (await import('@rollup/plugin-node-resolve')).default;
  const commonjs = (await import('@rollup/plugin-commonjs')).default;

  const config = loadConfig();

  if (options.cdn) {
    config.cdn = options.cdn;
  }

  console.log(`Building WeChat Mini-Game...`);
  console.log(`  Entry: ${config.entry}`);
  console.log(`  Output: ${config.output.dir}`);
  console.log(`  CDN: ${config.cdn}`);

  // Resolve adapter path from monorepo
  let adapterPath = '';
  try {
    const adapterPkg = require.resolve('@aspect/adapter/package.json');
    adapterPath = path.join(path.dirname(adapterPkg), 'src', 'index.js');
  } catch {
    try {
      const pluginPkg = require.resolve('@aspect/rollup-plugin/package.json');
      adapterPath = path.resolve(path.dirname(pluginPkg), '..', 'adapter', 'src', 'index.js');
    } catch {
      // adapter path will remain empty
    }
  }

  const pluginOptions = {
    outputDir: config.output.dir,
    assetsDir: config.assets.dir,
    remoteDir: path.join(config.output.dir, 'remote'),
    adapterPath,
    orientation: config.orientation,
    appid: config.appid,
    cdnBase: config.cdn,
    sizeThreshold: config.assets.remoteSizeThreshold,
  };

  // Bundle the adapter into a single CJS string first.
  let adapterCode = '';
  if (adapterPath && fs.existsSync(adapterPath)) {
    const adapterBundle = await rollup({
      input: adapterPath,
      plugins: [nodeResolve(), commonjs()],
    });
    const adapterOutput = await adapterBundle.generate({
      format: 'iife' as const,
      name: '__phaserWxAdapter',
    });
    await adapterBundle.close();
    adapterCode = adapterOutput.output[0].code;
    // Write standalone adapter file too (for separate loading if needed)
    fs.mkdirSync(config.output.dir, { recursive: true });
    fs.writeFileSync(
      path.join(config.output.dir, 'phaser-wx-adapter.js'),
      adapterCode,
      'utf-8'
    );
  }

  // Build a module-scope intro that:
  // 1. Runs the adapter IIFE (sets up GameGlobal.window/document/etc.)
  // 2. Creates module-scope var aliases so bare references like `document`
  //    resolve to our polyfills even inside Phaser's nested webpack closures.
  //    In CJS strict mode, bare `document` only resolves through the scope chain,
  //    not globalThis. WeChat may also have its own partial `document` object
  //    that lacks properties like `documentElement`.
  const introLines = [];
  if (adapterCode) {
    introLines.push('// --- phaser-wx-adapter ---');
    introLines.push(adapterCode);
    introLines.push('// --- end adapter ---');
  }
  // Create module-scope aliases from GameGlobal polyfills
  introLines.push('var _g = typeof GameGlobal !== "undefined" ? GameGlobal : globalThis;');
  const globalAliases = [
    'window', 'document', 'navigator', 'canvas',
    'Image', 'Audio', 'AudioContext', 'webkitAudioContext',
    'XMLHttpRequest', 'fetch', 'localStorage',
    'HTMLElement', 'HTMLCanvasElement',
  ];
  for (const name of globalAliases) {
    introLines.push(`var ${name} = _g.${name};`);
  }
  introLines.push('var self = _g.window || _g;');
  introLines.push('');
  const introCode = introLines.join('\n');

  const rollupConfig = {
    input: config.entry,
    plugins: [
      nodeResolve({ browser: true }),
      commonjs(),
      phaserWxTransform(pluginOptions),
    ],
  };

  const bundle = await rollup(rollupConfig);
  await bundle.write({
    file: path.join(config.output.dir, 'game-bundle.js'),
    format: 'cjs' as const,
    // Use intro (inside the module wrapper) so var declarations create
    // module-scope variables that shadow any environment globals.
    intro: introCode,
    strict: false, // Avoid 'use strict' which changes global resolution
  });
  await bundle.close();

  // Post-build size check (exclude 'remote' subfolder)
  const localFiles = walkDir(config.output.dir, ['remote']);
  const totalSize = localFiles.reduce((sum, f) => sum + f.size, 0);

  // Count remote assets
  const remoteDir = path.join(config.output.dir, 'remote');
  const remoteFiles = walkDir(remoteDir);

  if (totalSize > SIZE_LIMIT_ERROR) {
    console.error(`\n❌ Error: Package size ${formatSize(totalSize)} exceeds 20MB limit!`);
    console.error(`\nFile size breakdown:`);
    for (const file of localFiles.sort((a, b) => b.size - a.size)) {
      console.error(`  ${formatSize(file.size).padStart(10)}  ${path.relative(config.output.dir, file.path)}`);
    }
    console.error(`\nTotal: ${formatSize(totalSize)} / 20MB`);
    process.exit(1);
  } else if (totalSize > SIZE_LIMIT_WARN) {
    console.warn(`\n⚠️  Warning: Package size ${formatSize(totalSize)} is approaching the 20MB limit.`);
    console.warn(`  Consider moving more assets to CDN.`);
  } else {
    console.log(`\n✅ Build complete!`);
    console.log(`  Total size: ${formatSize(totalSize)}`);
    console.log(`  Local files: ${localFiles.length}`);
    console.log(`  Remote assets: ${remoteFiles.length}`);
  }
}
