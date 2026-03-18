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

export function splitAssets(
  assetRefs: AssetReference[],
  assetsDir: string,
  outputDir: string,
  remoteDir: string,
  threshold: number
): SplitResult {
  const result: SplitResult = {
    local: [],
    remote: [],
  };

  const seen = new Set<string>();

  for (const ref of assetRefs) {
    if (seen.has(ref.path)) continue;
    seen.add(ref.path);

    const absolutePath = path.join(assetsDir, ref.path);

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

    if (size > threshold) {
      const destPath = path.join(remoteDir, ref.path);
      copyFileWithDirs(absolutePath, destPath);
      result.remote.push(entry);
    } else {
      const destPath = path.join(outputDir, ref.path);
      copyFileWithDirs(absolutePath, destPath);
      result.local.push(entry);
    }
  }

  return result;
}
