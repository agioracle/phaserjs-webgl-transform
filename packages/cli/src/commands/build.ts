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
  const { phaserWxTransform, scanAssets } = await import('@aspect/rollup-plugin');
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

  // Resolve adapter path: walk up from __dirname to find monorepo root (pnpm-workspace.yaml),
  // then use packages/adapter/src/index.js. This works regardless of where cwd is.
  let adapterPath = '';
  {
    let dir = __dirname;
    while (true) {
      if (fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) {
        const candidate = path.join(dir, 'packages', 'adapter', 'src', 'index.js');
        if (fs.existsSync(candidate)) {
          adapterPath = candidate;
        }
        break;
      }
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
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
    remoteAssetsDir: config.assets.remoteAssetsDir || '',
  };

  // Bundle the adapter into a single file.
  let adapterCode = '';
  if (adapterPath && fs.existsSync(adapterPath)) {
    const adapterBundle = await rollup({
      input: adapterPath,
      plugins: [nodeResolve(), commonjs()],
    });
    const adapterOutput = await adapterBundle.generate({
      format: 'cjs' as const,
      exports: 'named' as const,
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

  // Build a module-scope intro that creates var aliases from the adapter's
  // CJS exports (captured into GameGlobal.__adapterExports by game.js).
  // We cannot read from GameGlobal.window etc. directly because WeChat
  // defines some of them as read-only getters that safeSet may silently
  // fail to override, leaving them undefined.
  // Bare references like `document` inside Phaser resolve up the scope chain
  // to these module-scope vars, ensuring polyfills are used.
  const introLines = [];
  // _ae = adapter exports (guaranteed correct), _g = GameGlobal fallback
  introLines.push('var _g = typeof GameGlobal !== "undefined" ? GameGlobal : globalThis;');
  introLines.push('var _ae = _g.__adapterExports || {};');
  introLines.push('var window = _ae.window || _g.window;');
  introLines.push('var document = _ae.document || _g.document;');
  introLines.push('var navigator = _ae.navigator || _g.navigator;');
  introLines.push('var canvas = _ae.canvas || _g.canvas;');
  introLines.push('var screen = _ae.screen || _g.screen || {};');
  introLines.push('var Image = _ae.Image || _g.Image;');
  introLines.push('var Audio = _ae.Audio || _g.Audio;');
  introLines.push('var AudioContext = _ae.AudioContext || _g.AudioContext;');
  introLines.push('var XMLHttpRequest = _ae.XMLHttpRequest || _g.XMLHttpRequest;');
  introLines.push('var fetch = _ae.fetch || _g.fetch;');
  introLines.push('var localStorage = _ae.localStorage || _g.localStorage;');
  introLines.push('var Blob = _ae.Blob || _g.Blob;');
  introLines.push('var URL = _ae.URL || _g.URL;');
  introLines.push('var webkitAudioContext = _ae.AudioContext || _g.AudioContext;');
  introLines.push('var self = _ae.window || _g.window;');
  introLines.push('var setTimeout = (_ae.window || _g.window || {}).setTimeout;');
  introLines.push('var clearTimeout = (_ae.window || _g.window || {}).clearTimeout;');
  introLines.push('var setInterval = (_ae.window || _g.window || {}).setInterval;');
  introLines.push('var clearInterval = (_ae.window || _g.window || {}).clearInterval;');
  introLines.push('var requestAnimationFrame = (_ae.window || _g.window || {}).requestAnimationFrame;');
  introLines.push('var cancelAnimationFrame = (_ae.window || _g.window || {}).cancelAnimationFrame;');
  introLines.push('var HTMLElement = _g.HTMLElement || function HTMLElement() {};');
  introLines.push('var HTMLCanvasElement = _g.HTMLCanvasElement || function HTMLCanvasElement() {};');

  // --- Remote asset loader initializer ---
  // Called by injected code right before `new Phaser.Game(config)`.
  // At that point Phaser module has been evaluated, so Phaser.Loader exists.
  introLines.push('');
  introLines.push('// --- Remote asset loader ---');
  introLines.push('var __remoteAssetLoaderInitialized = false;');
  introLines.push('function __initRemoteAssetLoader(Phaser) {');
  introLines.push('  if (__remoteAssetLoaderInitialized) return;');
  introLines.push('  __remoteAssetLoaderInitialized = true;');
  introLines.push('  try {');
  introLines.push('    var _fs = wx.getFileSystemManager();');
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
  const introCode = introLines.join('\n');

  // Pass subpackages config to the plugin so it can generate correct game.json
  (pluginOptions as any).subpackages = config.subpackages;

  const rollupConfig = {
    input: config.entry,
    plugins: [
      nodeResolve({ browser: true }),
      commonjs(),
      phaserWxTransform(pluginOptions),
    ],
  };

  // --- Main bundle build (game-bundle.js + phaser-engine) ---
  const mainBundle = await rollup(rollupConfig);
  const { output: mainChunks } = await mainBundle.generate({
    dir: config.output.dir,
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
      // Rollup generates require('./phaser-engine.js') but we moved it to engine/.
      code = code.replace(
        /require\(['"]\.\/phaser-engine\.js['"]\)/g,
        "require('engine/phaser-engine.min.js')"
      );
      // Expose Phaser globally so scene subpackages can access it.
      // game-bundle.js resolves Phaser through the engine chunk's helper functions;
      // scene subpackages (built separately) cannot re-derive it the same way.
      if (chunk.isEntry) {
        code += '\nif (typeof GameGlobal !== "undefined" && typeof Phaser !== "undefined") { GameGlobal.Phaser = Phaser; }\n';
      }
    }

    const outPath = path.join(config.output.dir, fileName);
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
    const outFile = path.join(config.output.dir, sub.root, sub.outputFile);
    // Use generate() instead of write() so we can post-process the output
    const { output: sceneChunks } = await sceneBundle.generate({
      file: outFile,
      format: 'cjs' as const,
      intro: introCode,
      strict: false,
    });
    await sceneBundle.close();

    // Write scene chunks, replacing require('phaser') with GameGlobal.Phaser
    // and fixing cross-subpackage require paths (make them relative from this subpackage)
    for (const sceneChunk of sceneChunks) {
      if (sceneChunk.type !== 'chunk') continue;
      let sceneCode = sceneChunk.code;
      // Replace external phaser require with global reference.
      sceneCode = sceneCode.replace(
        /require\(['"]phaser['"]\)/g,
        'GameGlobal.Phaser'
      );
      // Fix cross-subpackage require paths.
      // Source code uses root-relative paths like require('game-play/game-scene.js'),
      // but in WeChat require() resolves relative to the current file.
      // Since this file is inside sub.root (e.g. 'menu/'), we need '../' prefix.
      for (const otherSub of config.subpackages) {
        if (otherSub.name === sub.name) continue;
        const rootPrefix = otherSub.root.replace(/\/$/, '');
        // Match require('game-play/...') and rewrite to require('../game-play/...')
        const pattern = new RegExp(
          `require\\(['"]${rootPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/`,
          'g'
        );
        sceneCode = sceneCode.replace(pattern, `require('../${rootPrefix}/`);
      }
      fs.mkdirSync(path.dirname(outFile), { recursive: true });
      fs.writeFileSync(outFile, sceneCode, 'utf-8');
    }

    // Scan scene source for asset references (e.g. this.load.image/audio calls)
    // and copy local assets into the subpackage directory (not root) so they
    // don't count against main package size. Also rewrite asset paths in the
    // built JS to point at the subpackage-local copy.
    const sceneSource = fs.readFileSync(sub.entry, 'utf-8');
    const sceneAssetRefs = scanAssets(sceneSource);
    const assetPathRewrites: Array<{ original: string; rewritten: string }> = [];

    for (const ref of sceneAssetRefs) {
      // Skip remote-assets — they are loaded from CDN, not bundled
      if (ref.path.startsWith('remote-assets/')) continue;

      // Resolve source file
      let srcPath = path.join(path.dirname(config.assets.dir), ref.path);
      if (!fs.existsSync(srcPath)) {
        srcPath = path.join(config.assets.dir, ref.path);
      }
      if (!fs.existsSync(srcPath)) continue;

      // Copy to subpackage directory: e.g. dist-wx/game-play/assets/images/ball.png
      const destPath = path.join(config.output.dir, sub.root, ref.path);
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.copyFileSync(srcPath, destPath);

      // Record rewrite: 'assets/images/ball.png' → 'game-play/assets/images/ball.png'
      const rewrittenPath = sub.root + ref.path;
      if (rewrittenPath !== ref.path) {
        assetPathRewrites.push({ original: ref.path, rewritten: rewrittenPath });
      }
    }

    // Rewrite asset paths in the built scene JS
    if (assetPathRewrites.length > 0) {
      let updatedCode = fs.readFileSync(outFile, 'utf-8');
      for (const { original, rewritten } of assetPathRewrites) {
        // Replace string literals: 'assets/...' or "assets/..."
        updatedCode = updatedCode.split(original).join(rewritten);
      }
      fs.writeFileSync(outFile, updatedCode, 'utf-8');
    }
  }

  // Post-build size check (exclude 'remote' and subpackage directories)
  const excludeDirs = ['remote', 'engine'];
  for (const sub of config.subpackages) {
    excludeDirs.push(sub.root.replace(/\/$/, ''));
  }
  const localFiles = walkDir(config.output.dir, excludeDirs);
  const totalSize = localFiles.reduce((sum, f) => sum + f.size, 0);

  // Count remote assets from manifest
  let remoteAssetCount = 0;
  const manifestPath = path.join(config.output.dir, 'asset-manifest.json');
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
    console.log(`  Remote assets: ${remoteAssetCount}`);
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
