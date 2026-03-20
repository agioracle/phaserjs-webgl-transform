import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';
import type { NodePath } from '@babel/traverse';
import _generate from '@babel/generator';
import * as t from '@babel/types';

// Handle CJS/ESM interop — @babel/traverse and @babel/generator are CJS
// and may be wrapped as { default: fn } when imported from ESM
const traverse = typeof _traverse === 'function' ? _traverse : (_traverse as any).default;
const generate = typeof _generate === 'function' ? _generate : (_generate as any).default;

export interface TransformResult {
  code: string;
  warnings: string[];
}

function buildMemberExpression(...parts: string[]): t.MemberExpression {
  if (parts.length === 2) {
    return t.memberExpression(t.identifier(parts[0]), t.identifier(parts[1]));
  }
  const obj = buildMemberExpression(...parts.slice(0, -1));
  return t.memberExpression(obj, t.identifier(parts[parts.length - 1]));
}

function buildDefaultType(): t.ObjectProperty {
  return t.objectProperty(
    t.identifier('type'),
    buildMemberExpression('Phaser', 'WEBGL')
  );
}

function buildCanvasValue(): t.MemberExpression {
  return t.memberExpression(
    t.identifier('GameGlobal'),
    t.identifier('__wxCanvas')
  );
}

function buildDefaultAudio(): t.ObjectProperty {
  return t.objectProperty(
    t.identifier('audio'),
    t.objectExpression([
      t.objectProperty(t.identifier('disableWebAudio'), t.booleanLiteral(true)),
    ])
  );
}

function buildDefaultLoader(): t.ObjectProperty {
  return t.objectProperty(
    t.identifier('loader'),
    t.objectExpression([
      t.objectProperty(
        t.identifier('imageLoadType'),
        t.stringLiteral('HTMLImageElement')
      ),
    ])
  );
}

function buildDefaultScale(): t.ObjectProperty {
  return t.objectProperty(
    t.identifier('scale'),
    t.objectExpression([
      t.objectProperty(
        t.identifier('mode'),
        buildMemberExpression('Phaser', 'Scale', 'NONE')
      ),
      t.objectProperty(
        t.identifier('autoCenter'),
        buildMemberExpression('Phaser', 'Scale', 'NO_CENTER')
      ),
    ])
  );
}

function buildH5Scale(): t.ObjectProperty {
  return t.objectProperty(
    t.identifier('scale'),
    t.objectExpression([
      t.objectProperty(
        t.identifier('mode'),
        buildMemberExpression('Phaser', 'Scale', 'FIT')
      ),
      t.objectProperty(
        t.identifier('autoCenter'),
        buildMemberExpression('Phaser', 'Scale', 'CENTER_BOTH')
      ),
    ])
  );
}

function buildDefaultParent(): t.ObjectProperty {
  return t.objectProperty(t.identifier('parent'), t.nullLiteral());
}

function getPropertyName(prop: t.ObjectProperty | t.ObjectMethod | t.SpreadElement): string | null {
  if (t.isSpreadElement(prop)) return null;
  if (t.isObjectMethod(prop)) {
    return t.isIdentifier(prop.key) ? prop.key.name : null;
  }
  if (t.isIdentifier(prop.key)) return prop.key.name;
  if (t.isStringLiteral(prop.key)) return prop.key.value;
  return null;
}

function isMemberExpressionMatch(node: t.Node, parts: string[]): boolean {
  if (parts.length === 1) {
    return t.isIdentifier(node) && node.name === parts[0];
  }
  if (!t.isMemberExpression(node)) return false;
  const lastPart = parts[parts.length - 1];
  if (!t.isIdentifier(node.property) || node.property.name !== lastPart) return false;
  return isMemberExpressionMatch(node.object, parts.slice(0, -1));
}

function isWebGLType(value: t.Node): boolean {
  return isMemberExpressionMatch(value, ['Phaser', 'WEBGL']);
}

function mergeObjectProperties(
  objExpr: t.ObjectExpression,
  warnings: string[]
): void {
  const existingProps = new Map<string, t.ObjectProperty>();

  for (const prop of objExpr.properties) {
    if (t.isObjectProperty(prop)) {
      const name = getPropertyName(prop);
      if (name) {
        existingProps.set(name, prop);
      }
    }
  }

  // Handle 'type' property
  if (existingProps.has('type')) {
    const typeProp = existingProps.get('type')!;
    if (!isWebGLType(typeProp.value as t.Node)) {
      warnings.push(
        'Renderer type is not Phaser.WEBGL. Overriding to Phaser.WEBGL for WeChat Mini-Game compatibility.'
      );
      typeProp.value = buildMemberExpression('Phaser', 'WEBGL');
    }
  } else {
    objExpr.properties.push(buildDefaultType());
  }

  // Handle 'canvas' property
  if (!existingProps.has('canvas')) {
    objExpr.properties.push(
      t.objectProperty(t.identifier('canvas'), buildCanvasValue())
    );
  }

  // Handle 'parent' property — always force to null
  if (existingProps.has('parent')) {
    const parentProp = existingProps.get('parent')!;
    parentProp.value = t.nullLiteral();
  } else {
    objExpr.properties.push(buildDefaultParent());
  }

  // Handle 'audio' property
  if (existingProps.has('audio')) {
    const audioProp = existingProps.get('audio')!;
    if (t.isObjectExpression(audioProp.value)) {
      const audioProps = new Map<string, t.ObjectProperty>();
      for (const p of audioProp.value.properties) {
        if (t.isObjectProperty(p)) {
          const n = getPropertyName(p);
          if (n) audioProps.set(n, p);
        }
      }
      if (!audioProps.has('disableWebAudio')) {
        audioProp.value.properties.push(
          t.objectProperty(t.identifier('disableWebAudio'), t.booleanLiteral(true))
        );
      }
    }
  } else {
    objExpr.properties.push(buildDefaultAudio());
  }

  // Handle 'scale' property — force NONE mode for WeChat Mini-Game
  // (the canvas IS the screen, no DOM parent to scale into)
  if (existingProps.has('scale')) {
    const scaleProp = existingProps.get('scale')!;
    if (t.isObjectExpression(scaleProp.value)) {
      const scaleProps = new Map<string, t.ObjectProperty>();
      for (const p of scaleProp.value.properties) {
        if (t.isObjectProperty(p)) {
          const n = getPropertyName(p);
          if (n) scaleProps.set(n, p);
        }
      }
      // Always override mode to NONE
      if (scaleProps.has('mode')) {
        scaleProps.get('mode')!.value = buildMemberExpression('Phaser', 'Scale', 'NONE');
      } else {
        scaleProp.value.properties.push(
          t.objectProperty(
            t.identifier('mode'),
            buildMemberExpression('Phaser', 'Scale', 'NONE')
          )
        );
      }
      // Always override autoCenter to NO_CENTER
      if (scaleProps.has('autoCenter')) {
        scaleProps.get('autoCenter')!.value = buildMemberExpression('Phaser', 'Scale', 'NO_CENTER');
      } else {
        scaleProp.value.properties.push(
          t.objectProperty(
            t.identifier('autoCenter'),
            buildMemberExpression('Phaser', 'Scale', 'NO_CENTER')
          )
        );
      }
    }
  } else {
    objExpr.properties.push(buildDefaultScale());
  }

  // Handle 'loader' property — inject imageLoadType: 'HTMLImageElement'
  // This tells Phaser to load images via Image.src directly instead of XHR+Blob,
  // which works natively with wx.createImage() for local file paths.
  if (existingProps.has('loader')) {
    const loaderProp = existingProps.get('loader')!;
    if (t.isObjectExpression(loaderProp.value)) {
      const loaderProps = new Map<string, t.ObjectProperty>();
      for (const p of loaderProp.value.properties) {
        if (t.isObjectProperty(p)) {
          const n = getPropertyName(p);
          if (n) loaderProps.set(n, p);
        }
      }
      if (!loaderProps.has('imageLoadType')) {
        loaderProp.value.properties.push(
          t.objectProperty(
            t.identifier('imageLoadType'),
            t.stringLiteral('HTMLImageElement')
          )
        );
      }
    }
  } else {
    objExpr.properties.push(buildDefaultLoader());
  }
}

/**
 * Merge H5-specific properties into the Phaser game config.
 * Injects scale: { mode: FIT, autoCenter: CENTER_BOTH } for responsive browser display.
 * Does NOT touch canvas, parent, audio, loader — browser defaults work fine.
 */
function mergeH5Properties(
  objExpr: t.ObjectExpression,
): void {
  const existingProps = new Map<string, t.ObjectProperty>();

  for (const prop of objExpr.properties) {
    if (t.isObjectProperty(prop)) {
      const name = getPropertyName(prop);
      if (name) {
        existingProps.set(name, prop);
      }
    }
  }

  // Handle 'scale' property — inject FIT + CENTER_BOTH for responsive browser display
  if (existingProps.has('scale')) {
    const scaleProp = existingProps.get('scale')!;
    if (t.isObjectExpression(scaleProp.value)) {
      const scaleProps = new Map<string, t.ObjectProperty>();
      for (const p of scaleProp.value.properties) {
        if (t.isObjectProperty(p)) {
          const n = getPropertyName(p);
          if (n) scaleProps.set(n, p);
        }
      }
      if (scaleProps.has('mode')) {
        scaleProps.get('mode')!.value = buildMemberExpression('Phaser', 'Scale', 'FIT');
      } else {
        scaleProp.value.properties.push(
          t.objectProperty(
            t.identifier('mode'),
            buildMemberExpression('Phaser', 'Scale', 'FIT')
          )
        );
      }
      if (scaleProps.has('autoCenter')) {
        scaleProps.get('autoCenter')!.value = buildMemberExpression('Phaser', 'Scale', 'CENTER_BOTH');
      } else {
        scaleProp.value.properties.push(
          t.objectProperty(
            t.identifier('autoCenter'),
            buildMemberExpression('Phaser', 'Scale', 'CENTER_BOTH')
          )
        );
      }
    }
  } else {
    objExpr.properties.push(buildH5Scale());
  }
}

function isPhaserGameNew(node: t.NewExpression): boolean {
  return (
    t.isMemberExpression(node.callee) &&
    t.isIdentifier(node.callee.object) &&
    node.callee.object.name === 'Phaser' &&
    t.isIdentifier(node.callee.property) &&
    node.callee.property.name === 'Game'
  );
}

export function transformGameConfig(code: string, target: 'wx' | 'h5' = 'wx'): TransformResult {
  const warnings: string[] = [];
  const isH5 = target === 'h5';

  let ast: ReturnType<typeof parse>;
  try {
    ast = parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
      allowReturnOutsideFunction: true,
    });
  } catch {
    return { code, warnings: ['Failed to parse source code'] };
  }

  let modified = false;

  traverse(ast, {
    NewExpression(path: NodePath<t.NewExpression>) {
      if (!isPhaserGameNew(path.node)) return;

      // H5 target: skip WeChat-specific config transforms (GameGlobal.__wxCanvas,
      // forced scale/audio/loader overrides). Only inject H5 scale and __initRemoteAssetLoader.
      if (isH5) {
        const args = path.node.arguments;
        if (args.length === 0) {
          const configObj = t.objectExpression([]);
          mergeH5Properties(configObj);
          path.node.arguments = [configObj];
          modified = true;
        } else {
          const firstArg = args[0];
          if (t.isObjectExpression(firstArg)) {
            mergeH5Properties(firstArg);
            modified = true;
          } else if (t.isIdentifier(firstArg)) {
            const binding = path.scope.getBinding(firstArg.name);
            if (binding && binding.path.isVariableDeclarator()) {
              const init = binding.path.node.init;
              if (t.isObjectExpression(init)) {
                mergeH5Properties(init);
                modified = true;
              }
            }
          }
        }
      } else {
        const args = path.node.arguments;
        if (args.length === 0) {
          const configObj = t.objectExpression([]);
          mergeObjectProperties(configObj, warnings);
          path.node.arguments = [configObj];
          modified = true;
        } else {
          const firstArg = args[0];

          if (t.isObjectExpression(firstArg)) {
            mergeObjectProperties(firstArg, warnings);
            modified = true;
          } else if (t.isIdentifier(firstArg)) {
            const varName = firstArg.name;
            const binding = path.scope.getBinding(varName);

            if (binding && binding.path.isVariableDeclarator()) {
              const init = binding.path.node.init;
              if (t.isObjectExpression(init)) {
                mergeObjectProperties(init, warnings);
                modified = true;
              } else {
                warnings.push(
                  `Could not resolve config variable "${varName}": initializer is not an object literal.`
                );
              }
            } else {
              warnings.push(
                `Could not resolve config variable "${varName}".`
              );
            }
          } else {
            warnings.push(
              'Could not resolve config argument: not an object literal or identifier.'
            );
          }
        }
      }

      // Insert __initRemoteAssetLoader(Phaser) call before new Phaser.Game(...)
      // At this point in the bundle, Phaser module has been evaluated so
      // Phaser.Loader.File.prototype is available for monkey-patching.
      const parentPath = path.parentPath;
      if (parentPath && parentPath.isExpressionStatement()) {
        const initCall = t.expressionStatement(
          t.callExpression(
            t.identifier('__initRemoteAssetLoader'),
            [t.identifier('Phaser')]
          )
        );
        parentPath.insertBefore(initCall);
        modified = true;
      } else if (parentPath && parentPath.isVariableDeclarator()) {
        // e.g. const game = new Phaser.Game(config);
        const declPath = parentPath.parentPath;
        if (declPath && declPath.isVariableDeclaration()) {
          const initCall = t.expressionStatement(
            t.callExpression(
              t.identifier('__initRemoteAssetLoader'),
              [t.identifier('Phaser')]
            )
          );
          declPath.insertBefore(initCall);
          modified = true;
        }
      }
    },
  });

  if (!modified && warnings.length === 0) {
    return { code, warnings };
  }

  const output = generate(ast, {
    retainLines: true,
    compact: false,
  });

  return { code: output.code, warnings };
}
