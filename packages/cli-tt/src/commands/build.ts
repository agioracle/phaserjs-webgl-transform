import * as fs from 'node:fs';
import * as path from 'node:path';
import { createRequire } from 'node:module';
import { loadConfig } from '../utils/config.js';

interface BuildOptions {
  cdn?: string;
  target?: 'tt' | 'h5';
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


function assertProjectDependency(packageName: string, projectRoot: string = process.cwd()): string {
  const projectRequire = createRequire(path.join(projectRoot, 'package.json'));
  try {
    return projectRequire.resolve(packageName);
  } catch {
    throw new Error(
      `Cannot resolve dependency "${packageName}" from ${projectRoot}. ` +
        `Run "npm install" (or "pnpm install") in this project before running phaser-tt build.`
    );
  }
}

/**
 * Build module-scope intro for the Douyin Mini-Game target.
 *
 * Unlike WeChat, the Douyin tt-adapter is a self-injecting IIFE: once required
 * (first line of game.js), it installs window/document/canvas/Image/Audio/...
 * onto GameGlobal AND sets `global.window = global`, so bare global reads
 * (`window`, `document`, ...) resolve through GameGlobal automatically. That
 * means NO `var window = ...` module-scope aliasing is needed here.
 *
 * The only thing the intro provides is the remote asset loader, which reads
 * asset-manifest.json via tt.getFileSystemManager() and rewrites CDN URLs.
 */
function buildTtIntro(): string {
  const introLines: string[] = [];

  // --- Remote asset loader initializer (tt version) ---
  introLines.push('// --- Remote asset loader (Douyin) ---');
  introLines.push('var __remoteAssetLoaderInitialized = false;');
  introLines.push('function __initRemoteAssetLoader(Phaser) {');
  introLines.push('  if (__remoteAssetLoaderInitialized) return;');
  introLines.push('  __remoteAssetLoaderInitialized = true;');
  introLines.push('  try {');
  introLines.push('    var _fs = tt.getFileSystemManager();');
  introLines.push('    var manifestStr = _fs.readFileSync("asset-manifest.json", "utf-8");');
  introLines.push('    var manifest = JSON.parse(manifestStr);');
  introLines.push('    if (!manifest || !manifest.assets) return;');
  introLines.push('    var hasRemote = false;');
  introLines.push('    for (var k in manifest.assets) { if (manifest.assets[k].remote) { hasRemote = true; break; } }');
  introLines.push('    if (!hasRemote) return;');
  introLines.push('    var _cdnBase = manifest.cdnBase || "";');
  introLines.push('    if (_cdnBase && _cdnBase[_cdnBase.length - 1] !== "/") _cdnBase += "/";');
  introLines.push('    var _origStart = Phaser.Loader.LoaderPlugin.prototype.start;');
  introLines.push('    Phaser.Loader.LoaderPlugin.prototype.start = function() {');
  introLines.push('      var entries = this.list && this.list.entries;');
  introLines.push('      if (entries) {');
  introLines.push('        for (var i = 0; i < entries.length; i++) {');
  introLines.push('          var file = entries[i];');
  introLines.push('          var fileUrl = file.url || "";');
  introLines.push('          var entry = manifest.assets[fileUrl];');
  introLines.push('          if (entry && entry.remote) {');
  introLines.push('            file.url = _cdnBase + fileUrl;');
  introLines.push('          }');
  introLines.push('        }');
  introLines.push('      }');
  introLines.push('      return _origStart.apply(this, arguments);');
  introLines.push('    };');
  introLines.push('  } catch(e) { /* manifest not found or parse error — no remote assets */ }');
  introLines.push('}');
  introLines.push('// --- end remote asset loader ---');
  introLines.push('');

  return introLines.join('\n');
}

/**
 * Build module-scope intro for H5 browser target.
 * Uses synchronous XMLHttpRequest to read asset-manifest.json for the remote
 * asset loader.
 */
function buildH5Intro(): string {
  const introLines: string[] = [];

  // --- Remote asset loader initializer (H5 version) ---
  introLines.push('// --- Remote asset loader (H5) ---');
  introLines.push('var __remoteAssetLoaderInitialized = false;');
  introLines.push('function __initRemoteAssetLoader(Phaser) {');
  introLines.push('  if (__remoteAssetLoaderInitialized) return;');
  introLines.push('  __remoteAssetLoaderInitialized = true;');
  introLines.push('  try {');
  introLines.push('    var xhr = new XMLHttpRequest();');
  introLines.push('    xhr.open("GET", "asset-manifest.json", false);');
  introLines.push('    xhr.send();');
  introLines.push('    if (xhr.status !== 200) return;');
  introLines.push('    var manifest = JSON.parse(xhr.responseText);');
  introLines.push('    if (!manifest || !manifest.assets) return;');
  introLines.push('    var hasRemote = false;');
  introLines.push('    for (var k in manifest.assets) { if (manifest.assets[k].remote) { hasRemote = true; break; } }');
  introLines.push('    if (!hasRemote) return;');
  introLines.push('    var _cdnBase = manifest.cdnBase || "";');
  introLines.push('    if (_cdnBase && _cdnBase[_cdnBase.length - 1] !== "/") _cdnBase += "/";');
  introLines.push('    var _origStart = Phaser.Loader.LoaderPlugin.prototype.start;');
  introLines.push('    Phaser.Loader.LoaderPlugin.prototype.start = function() {');
  introLines.push('      var entries = this.list && this.list.entries;');
  introLines.push('      if (entries) {');
  introLines.push('        for (var i = 0; i < entries.length; i++) {');
  introLines.push('          var file = entries[i];');
  introLines.push('          var fileUrl = file.url || "";');
  introLines.push('          var entry = manifest.assets[fileUrl];');
  introLines.push('          if (entry && entry.remote) {');
  introLines.push('            file.url = _cdnBase + fileUrl;');
  introLines.push('          }');
  introLines.push('        }');
  introLines.push('      }');
  introLines.push('      return _origStart.apply(this, arguments);');
  introLines.push('    };');
  introLines.push('  } catch(e) { /* manifest not found or parse error — no remote assets */ }');
  introLines.push('}');
  introLines.push('// --- end remote asset loader ---');
  introLines.push('');

  return introLines.join('\n');
}

/**
 * Generate a temporary H5 entry file that imports all scene subpackages
 * into a single bundle. Reads main.js and each subpackage entry, extracts
 * exported class names, and wires them into the Phaser game config's scene array.
 */
function generateH5Entry(
  mainEntry: string,
  subpackages: Array<{ name: string; root: string; entry: string; outputFile: string }>,
): { tempEntryPath: string } {
  let mainSource = fs.readFileSync(mainEntry, 'utf-8');
  const mainDir = path.dirname(mainEntry);

  // Collect all scene class names and their import paths
  const sceneImports: string[] = [];
  const sceneClassNames: string[] = [];

  for (const sub of subpackages) {
    const entryPath = sub.entry;
    if (!fs.existsSync(entryPath)) {
      console.warn(`  Warning: subpackage entry not found: ${entryPath}, skipping.`);
      continue;
    }
    const entrySource = fs.readFileSync(entryPath, 'utf-8');

    // Extract exported class names: export class XXX or export default class XXX
    const classMatches = entrySource.matchAll(/export\s+(?:default\s+)?class\s+(\w+)/g);
    const classNames: string[] = [];
    for (const match of classMatches) {
      classNames.push(match[1]);
    }

    if (classNames.length === 0) {
      console.warn(`  Warning: no exported classes found in ${entryPath}, skipping.`);
      continue;
    }

    // Compute relative import path from main entry dir to subpackage entry
    let relativePath = path.relative(mainDir, entryPath);
    if (!relativePath.startsWith('.')) {
      relativePath = './' + relativePath;
    }
    // Remove .ts/.js extension for import (rollup resolves it)
    relativePath = relativePath.replace(/\.(ts|js|tsx|jsx)$/, '');

    sceneImports.push(`import { ${classNames.join(', ')} } from '${relativePath}';`);
    sceneClassNames.push(...classNames);
  }

  // Inject imports at the top of main source
  if (sceneImports.length > 0) {
    mainSource = sceneImports.join('\n') + '\n' + mainSource;
  }

  // Expand scene array: find `scene: [SomeScene]` or `scene: [SomeScene, ...]`
  // and append all collected scene class names
  if (sceneClassNames.length > 0) {
    mainSource = mainSource.replace(
      /scene\s*:\s*\[([^\]]*)\]/,
      (match, inner) => {
        const existing = inner.trim();
        // Avoid duplicating already-listed classes
        const existingNames = existing.split(',').map((s: string) => s.trim()).filter(Boolean);
        const newNames = sceneClassNames.filter((n) => !existingNames.includes(n));
        if (newNames.length === 0) return match;
        return `scene: [${existing}, ${newNames.join(', ')}]`;
      }
    );
  }

  // Write temporary entry file next to main entry
  const tempEntryPath = path.join(mainDir, '_h5_entry.js');
  fs.writeFileSync(tempEntryPath, mainSource, 'utf-8');

  return { tempEntryPath };
}

/**
 * Resolve a bundled runtime file from the rollup-plugin-tt package.
 * Walk up from __dirname to the monorepo root (pnpm-workspace.yaml), then use
 * packages/rollup-plugin-tt/src/runtime/<fileName>.
 */
function resolveRuntimeFile(fileName: string): string {
  let dir = __dirname;
  while (true) {
    if (fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) {
      const candidate = path.join(
        dir,
        'packages',
        'rollup-plugin-tt',
        'src',
        'runtime',
        fileName
      );
      if (fs.existsSync(candidate)) {
        return candidate;
      }
      break;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return '';
}

export async function buildCommand(options: BuildOptions): Promise<void> {
  const config = loadConfig();
  const isH5 = options.target === 'h5';

  // Phaser must be resolvable from the game project. If it is missing, Rollup
  // either emits a broken H5 bundle with an external `Phaser$1` global or fails
  // later while creating the engine manual chunk. Fail early with an actionable
  // message instead of producing a bad dist-h5/.
  assertProjectDependency('phaser');

  // Lazy imports: rollup and plugins are external and only needed for build
  const { rollup } = await import('rollup');
  const { phaserTtTransform, scanAssets } = await import('@aspect/rollup-plugin-tt');
  const nodeResolve = (await import('@rollup/plugin-node-resolve')).default;
  const commonjs = (await import('@rollup/plugin-commonjs')).default;

  if (options.cdn) {
    config.cdn = options.cdn;
  }

  // Output directory — H5 uses dist-h5/
  const outputDir = isH5 ? 'dist-h5' : config.output.dir;

  console.log(`Building ${isH5 ? 'H5 browser' : 'Douyin Mini-Game'}...`);
  console.log(`  Entry: ${config.entry}`);
  console.log(`  Output: ${outputDir}`);
  console.log(`  CDN: ${config.cdn}`);

  const adapterPath = resolveRuntimeFile('tt-adapter.js');
  const polyfillPath = resolveRuntimeFile('tt-polyfill.js');

  const pluginOptions: Record<string, unknown> = {
    outputDir,
    assetsDir: config.assets.dir,
    remoteDir: path.join(outputDir, 'remote'),
    adapterPath,
    polyfillPath,
    orientation: config.orientation,
    appid: config.appid,
    cdnBase: config.cdn,
    sizeThreshold: config.assets.remoteSizeThreshold,
    remoteAssetsDir: config.assets.remoteAssetsDir || '',
    target: isH5 ? 'h5' : 'tt',
  };

  // Intro code — branch by target
  const introCode = isH5 ? buildH5Intro() : buildTtIntro();

  // Pass subpackages config to the plugin so it can generate correct game.json
  pluginOptions.subpackages = config.subpackages;

  if (isH5) {
    // =====================================================
    // H5 build path — single IIFE bundle
    // =====================================================

    // Generate temporary H5 entry that imports all subpackage scenes
    const { tempEntryPath } = generateH5Entry(config.entry, config.subpackages);

    try {
      const rollupConfig = {
        input: tempEntryPath,
        plugins: [
          nodeResolve({ browser: true }),
          commonjs(),
          phaserTtTransform(pluginOptions as any),
        ],
      };

      const h5Bundle = await rollup(rollupConfig);
      const { output: h5Chunks } = await h5Bundle.generate({
        format: 'iife' as const,
        name: 'PhaserGame',
        entryFileNames: 'game.js',
        intro: introCode,
        strict: false,
      });
      await h5Bundle.close();

      // Write output — single game.js, minified with esbuild
      const { transform: esbuildTransform } = await import('esbuild');
      fs.mkdirSync(outputDir, { recursive: true });
      for (const chunk of h5Chunks) {
        if (chunk.type !== 'chunk') continue;
        console.log(`  Minifying H5 bundle with esbuild...`);
        const minified = await esbuildTransform(chunk.code, { minify: true, target: 'es2015' });
        fs.writeFileSync(path.join(outputDir, 'game.js'), minified.code, 'utf-8');
      }
    } finally {
      // Clean up temporary entry file
      if (fs.existsSync(tempEntryPath)) {
        fs.unlinkSync(tempEntryPath);
      }
    }

    // H5 skips subpackage builds entirely — all scenes are in game.js

  } else {
    // =====================================================
    // Douyin (tt) build path
    // =====================================================

    const rollupConfig = {
      input: config.entry,
      plugins: [
        nodeResolve({ browser: true }),
        commonjs(),
        phaserTtTransform(pluginOptions as any),
      ],
    };

    // --- Main bundle build (game-bundle.js + phaser-engine) ---
    const mainBundle = await rollup(rollupConfig);
    const { output: mainChunks } = await mainBundle.generate({
      dir: outputDir,
      format: 'cjs' as const,
      manualChunks: {
        'phaser-engine': ['phaser'],
      },
      chunkFileNames: '[name].js',
      entryFileNames: 'game-bundle.js',
      intro: introCode,
      strict: false,
    });
    await mainBundle.close();

    // Write chunks, minify phaser-engine with esbuild → engine/ subpackage
    const { transform: esbuildTransform } = await import('esbuild');
    for (const chunk of mainChunks) {
      if (chunk.type !== 'chunk') continue;
      let code = chunk.code;
      let fileName = chunk.fileName;

      if (chunk.name === 'phaser-engine') {
        console.log(`  Minifying Phaser engine with esbuild...`);
        const minified = await esbuildTransform(code, { minify: true, target: 'es2015' });
        code = minified.code;
        fileName = 'engine/phaser-engine.min.js';
      } else {
        // Rewrite cross-chunk require to point at the engine subpackage location.
        code = code.replace(
          /require\(['"]\.\/phaser-engine\.js['"]\)/g,
          "require('engine/phaser-engine.min.js')"
        );
        // Expose Phaser globally so scene subpackages can access it.
        if (chunk.isEntry) {
          code += '\nif (typeof GameGlobal !== "undefined" && typeof Phaser !== "undefined") { GameGlobal.Phaser = Phaser; }\n';
        }
        // Downlevel to ES2015: the Douyin compiler rejects ES2020 syntax
        // (nullish coalescing ??, optional chaining ?., etc.). Match the H5
        // target and the engine chunk, which both esbuild-transform to es2015.
        const lowered = await esbuildTransform(code, { minify: true, target: 'es2015' });
        code = lowered.code;
      }

      const outPath = path.join(outputDir, fileName);
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, code, 'utf-8');
    }

    // --- Scene subpackage builds ---
    for (const sub of config.subpackages) {
      console.log(`  Building subpackage: ${sub.name} (${sub.entry})`);
      const sceneBundle = await rollup({
        input: sub.entry,
        external: ['phaser'], // Phaser is already loaded globally from engine subpackage
        plugins: [
          nodeResolve({ browser: true }),
          commonjs(),
        ],
      });
      const outFile = path.join(outputDir, sub.root, sub.outputFile);
      // Use generate() instead of write() so we can post-process the output
      const { output: sceneChunks } = await sceneBundle.generate({
        file: outFile,
        format: 'cjs' as const,
        intro: introCode,
        strict: false,
      });
      await sceneBundle.close();

      // Write scene chunks, replacing require('phaser') with GameGlobal.Phaser
      for (const sceneChunk of sceneChunks) {
        if (sceneChunk.type !== 'chunk') continue;
        let sceneCode = sceneChunk.code;
        sceneCode = sceneCode.replace(
          /require\(['"]phaser['"]\)/g,
          'GameGlobal.Phaser'
        );
        // Fix cross-subpackage require paths.
        for (const otherSub of config.subpackages) {
          if (otherSub.name === sub.name) continue;
          const rootPrefix = otherSub.root.replace(/\/$/, '');
          const pattern = new RegExp(
            `require\\(['"]${rootPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/`,
            'g'
          );
          sceneCode = sceneCode.replace(pattern, `require('../${rootPrefix}/`);
        }
        // Downlevel to ES2015 for the Douyin compiler (no ?? / ?. support).
        // Done after the require() string rewrites above (esbuild preserves
        // string literals, so the later asset-path replace still matches).
        const loweredScene = await esbuildTransform(sceneCode, { minify: true, target: 'es2015' });
        sceneCode = loweredScene.code;
        fs.mkdirSync(path.dirname(outFile), { recursive: true });
        fs.writeFileSync(outFile, sceneCode, 'utf-8');
      }

      // Scan scene source for asset references and copy local assets into subpackage
      const sceneSource = fs.readFileSync(sub.entry, 'utf-8');
      const sceneAssetRefs = scanAssets(sceneSource);
      const assetPathRewrites: Array<{ original: string; rewritten: string }> = [];

      for (const ref of sceneAssetRefs) {
        if (ref.path.startsWith('remote-assets/')) continue;

        let srcPath = path.join(path.dirname(config.assets.dir), ref.path);
        if (!fs.existsSync(srcPath)) {
          srcPath = path.join(config.assets.dir, ref.path);
        }
        if (!fs.existsSync(srcPath)) continue;

        const destPath = path.join(outputDir, sub.root, ref.path);
        fs.mkdirSync(path.dirname(destPath), { recursive: true });
        fs.copyFileSync(srcPath, destPath);

        const rewrittenPath = sub.root + ref.path;
        if (rewrittenPath !== ref.path) {
          assetPathRewrites.push({ original: ref.path, rewritten: rewrittenPath });
        }
      }

      if (assetPathRewrites.length > 0) {
        let updatedCode = fs.readFileSync(outFile, 'utf-8');
        for (const { original, rewritten } of assetPathRewrites) {
          updatedCode = updatedCode.split(original).join(rewritten);
        }
        fs.writeFileSync(outFile, updatedCode, 'utf-8');
      }
    }
  }

  // Asset handling and size check
  // Count remote assets from manifest
  let remoteAssetCount = 0;
  const manifestPath = path.join(outputDir, 'asset-manifest.json');
  if (fs.existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      for (const entry of Object.values(manifest.assets || {})) {
        if ((entry as any).remote) remoteAssetCount++;
      }
    } catch {
      // ignore
    }
  }

  if (isH5) {
    // H5: no 20MB limit check, just output build summary
    const localFiles = walkDir(outputDir);
    const totalSize = localFiles.reduce((sum, f) => sum + f.size, 0);
    console.log(`\n✅ H5 build complete!`);
    console.log(`  Output: ${outputDir}/`);
    console.log(`  Total size: ${formatSize(totalSize)}`);
    console.log(`  Local files: ${localFiles.length}`);
    console.log(`  Remote assets: ${remoteAssetCount}`);
  } else {
    // tt: Post-build size check (exclude 'remote' and subpackage directories)
    const excludeDirs = ['remote', 'engine'];
    for (const sub of config.subpackages) {
      excludeDirs.push(sub.root.replace(/\/$/, ''));
    }
    const localFiles = walkDir(outputDir, excludeDirs);
    const totalSize = localFiles.reduce((sum, f) => sum + f.size, 0);

    if (totalSize > SIZE_LIMIT_ERROR) {
      console.error(`\n❌ Error: Package size ${formatSize(totalSize)} exceeds 20MB limit!`);
      console.error(`\nFile size breakdown:`);
      for (const file of localFiles.sort((a, b) => b.size - a.size)) {
        console.error(`  ${formatSize(file.size).padStart(10)}  ${path.relative(outputDir, file.path)}`);
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
      console.log(`  Remote assets: ${remoteAssetCount}`);
    }
  }

  // Remind user to upload remote assets to CDN
  if (remoteAssetCount > 0) {
    const remoteAssetsDir = config.assets.remoteAssetsDir;
    const remoteAssetsDirName = remoteAssetsDir ? path.basename(remoteAssetsDir) : 'remote';
    console.log(`\n📦 ${remoteAssetCount} remote asset(s) need to be uploaded to CDN.`);
    console.log(`  Upload the contents of "${remoteAssetsDir || 'remote assets directory'}" to:`);
    console.log(`  ${config.cdn}/${remoteAssetsDirName}/`);
    console.log(`  (Runtime will load them from CDN via asset-manifest.json)`);
  }
}
