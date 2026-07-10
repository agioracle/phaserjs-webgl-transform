import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';
import type { NodePath } from '@babel/traverse';
import * as t from '@babel/types';

// Handle CJS/ESM interop — @babel/traverse is CJS
const traverse = typeof _traverse === 'function' ? _traverse : (_traverse as any).default;

export interface AssetReference {
  path: string;
  type: 'image' | 'audio' | 'spritesheet' | 'atlas' | 'tilemapJSON' | 'bitmapFont' | 'other';
  loaderMethod: string;
}

const LOADER_METHOD_TO_TYPE: Record<string, AssetReference['type']> = {
  image: 'image',
  audio: 'audio',
  spritesheet: 'spritesheet',
  atlas: 'atlas',
  tilemapTiledJSON: 'tilemapJSON',
  multiatlas: 'other',
  bitmapFont: 'bitmapFont',
};

const KNOWN_LOADER_METHODS = new Set(Object.keys(LOADER_METHOD_TO_TYPE));

function looksLikeFilePath(value: string): boolean {
  return /\.\w{1,10}$/.test(value);
}

function extractStringPaths(node: t.Node): string[] {
  if (t.isStringLiteral(node) && looksLikeFilePath(node.value)) {
    return [node.value];
  }
  if (t.isArrayExpression(node)) {
    const paths: string[] = [];
    for (const el of node.elements) {
      if (el && t.isStringLiteral(el) && looksLikeFilePath(el.value)) {
        paths.push(el.value);
      }
    }
    return paths;
  }
  return [];
}

export function scanAssets(code: string): AssetReference[] {
  const refs: AssetReference[] = [];

  let ast: ReturnType<typeof parse>;
  try {
    ast = parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript', 'decorators-legacy'],
      allowReturnOutsideFunction: true,
    });
  } catch {
    return refs;
  }

  traverse(ast, {
    CallExpression(path: NodePath<t.CallExpression>) {
      const callee = path.node.callee;

      if (
        !t.isMemberExpression(callee) ||
        !t.isIdentifier(callee.property) ||
        !KNOWN_LOADER_METHODS.has(callee.property.name)
      ) {
        return;
      }

      const obj = callee.object;
      if (
        !t.isMemberExpression(obj) ||
        !t.isThisExpression(obj.object) ||
        !t.isIdentifier(obj.property) ||
        obj.property.name !== 'load'
      ) {
        return;
      }

      const methodName = callee.property.name;
      const assetType = LOADER_METHOD_TO_TYPE[methodName];
      const args = path.node.arguments;

      if (args.length === 0) return;

      // Single argument: this.load.image('path.png')
      if (args.length === 1) {
        const paths = extractStringPaths(args[0]);
        for (const p of paths) {
          refs.push({ path: p, type: assetType, loaderMethod: methodName });
        }
        return;
      }

      // Multiple arguments: skip first arg (key), scan remaining for paths
      for (let i = 1; i < args.length; i++) {
        const arg = args[i];
        const paths = extractStringPaths(arg);
        for (const p of paths) {
          refs.push({ path: p, type: assetType, loaderMethod: methodName });
        }
      }
    },
  });

  return refs;
}
