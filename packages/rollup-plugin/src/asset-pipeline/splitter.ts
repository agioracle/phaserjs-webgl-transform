import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import type { AssetReference } from './scanner';

export interface AssetEntry {
  path: string;
  absolutePath: string;
  size: number;
  hash: string;
  type: string;
}

export interface SplitResult {
  local: AssetEntry[];
  remote: AssetEntry[];
}

function computeHash(filePath: string): string {
  const content = fs.readFileSync(filePath);
  const hash = crypto.createHash('sha256').update(content).digest('hex');
  return hash.slice(0, 16);
}

function copyFileWithDirs(src: string, dest: string): void {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

/**
 * Infer asset type from file extension.
 */
function inferTypeFromExt(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.png':
    case '.jpg':
    case '.jpeg':
    case '.gif':
    case '.webp':
    case '.svg':
    case '.bmp':
      return 'image';
    case '.mp3':
    case '.wav':
    case '.ogg':
    case '.aac':
    case '.m4a':
      return 'audio';
    case '.json':
      return 'tilemapJSON';
    default:
      return 'other';
  }
}

/**
 * Recursively walk a directory and return all file paths (relative to baseDir).
 */
function walkDirRelative(dir: string, baseDir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir);
  for (const entry of entries) {
    const fullPath = path.join(dir, entry as string);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results.push(...walkDirRelative(fullPath, baseDir));
    } else if (stat.isFile()) {
      // Skip .gitkeep and other dotfiles
      if ((entry as string).startsWith('.')) continue;
      results.push(path.relative(baseDir, fullPath));
    }
  }
  return results;
}

export function splitAssets(
  assetRefs: AssetReference[],
  assetsDir: string,
  outputDir: string,
  remoteDir: string,
  threshold: number,
  remoteAssetsDir: string = ''
): SplitResult {
  const result: SplitResult = {
    local: [],
    remote: [],
  };

  const seen = new Set<string>();

  // --- Process scanner-collected asset references (from this.load.*() calls) ---
  for (const ref of assetRefs) {
    if (seen.has(ref.path)) continue;
    seen.add(ref.path);

    // Try resolving from assetsDir first, then fall back to its parent dir.
    // Phaser loader paths like 'assets/images/foo.png' are relative to the
    // web root (e.g. 'public/'), while assetsDir is typically 'public/assets'.
    let absolutePath = path.join(assetsDir, ref.path);
    if (!fs.existsSync(absolutePath)) {
      absolutePath = path.join(path.dirname(assetsDir), ref.path);
    }

    // Also try resolving from remoteAssetsDir parent if configured
    if (!fs.existsSync(absolutePath) && remoteAssetsDir) {
      absolutePath = path.join(path.dirname(remoteAssetsDir), ref.path);
    }

    if (!fs.existsSync(absolutePath)) {
      continue;
    }

    const stat = fs.statSync(absolutePath);
    const size = stat.size;
    const hash = computeHash(absolutePath);

    const entry: AssetEntry = {
      path: ref.path,
      absolutePath,
      size,
      hash,
      type: ref.type,
    };

    // Check if this file lives under the remoteAssetsDir — force remote
    // Remote assets are NOT copied to outputDir to prevent accidental
    // packaging into the mini-game. Users must upload them to CDN manually.
    if (remoteAssetsDir && isUnderDir(absolutePath, remoteAssetsDir)) {
      result.remote.push(entry);
    } else if (size > threshold) {
      const destPath = path.join(remoteDir, ref.path);
      copyFileWithDirs(absolutePath, destPath);
      result.remote.push(entry);
    } else {
      const destPath = path.join(outputDir, ref.path);
      copyFileWithDirs(absolutePath, destPath);
      result.local.push(entry);
    }
  }

  // --- Scan assetsDir for files NOT already referenced by loader calls ---
  if (assetsDir && fs.existsSync(assetsDir)) {
    const webRoot = path.dirname(assetsDir); // e.g. "public"
    const allLocalFiles = walkDirRelative(assetsDir, webRoot);
    // Also build a set of absolute paths already seen, to deduplicate
    // against scanner refs that may use different relative path formats
    const seenAbsolute = new Set<string>();
    for (const ref of assetRefs) {
      let abs = path.resolve(path.join(assetsDir, ref.path));
      if (fs.existsSync(abs)) { seenAbsolute.add(abs); continue; }
      abs = path.resolve(path.join(webRoot, ref.path));
      if (fs.existsSync(abs)) { seenAbsolute.add(abs); }
    }

    for (const relPath of allLocalFiles) {
      if (seen.has(relPath)) continue;
      const absolutePath = path.join(webRoot, relPath);
      if (seenAbsolute.has(path.resolve(absolutePath))) continue;
      seen.add(relPath);
      const stat = fs.statSync(absolutePath);
      const size = stat.size;
      const hash = computeHash(absolutePath);

      const entry: AssetEntry = {
        path: relPath,
        absolutePath,
        size,
        hash,
        type: inferTypeFromExt(relPath),
      };

      if (size > threshold) {
        const destPath = path.join(remoteDir, relPath);
        copyFileWithDirs(absolutePath, destPath);
        result.remote.push(entry);
      } else {
        const destPath = path.join(outputDir, relPath);
        copyFileWithDirs(absolutePath, destPath);
        result.local.push(entry);
      }
    }
  }

  // --- Scan remoteAssetsDir for files NOT already referenced by loader calls ---
  if (remoteAssetsDir && fs.existsSync(remoteAssetsDir)) {
    // Determine the common parent used as web root (e.g. "public/")
    // remoteAssetsDir is like "public/remote-assets", we need paths relative to
    // the parent of remoteAssetsDir's parent to form "remote-assets/audio/bgm.mp3"
    const webRoot = path.dirname(remoteAssetsDir); // e.g. "public"
    const allRemoteFiles = walkDirRelative(remoteAssetsDir, webRoot);

    for (const relPath of allRemoteFiles) {
      if (seen.has(relPath)) continue;
      seen.add(relPath);

      const absolutePath = path.join(webRoot, relPath);
      const stat = fs.statSync(absolutePath);
      const size = stat.size;
      const hash = computeHash(absolutePath);

      const entry: AssetEntry = {
        path: relPath,
        absolutePath,
        size,
        hash,
        type: inferTypeFromExt(relPath),
      };

      // Remote assets are NOT copied to outputDir — only recorded in manifest
      result.remote.push(entry);
    }
  }

  return result;
}

/**
 * Check if a file path is under a given directory.
 */
function isUnderDir(filePath: string, dir: string): boolean {
  const resolvedFile = path.resolve(filePath);
  const resolvedDir = path.resolve(dir);
  return resolvedFile.startsWith(resolvedDir + path.sep) || resolvedFile === resolvedDir;
}
