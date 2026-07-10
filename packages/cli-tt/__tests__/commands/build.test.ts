import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { buildCommand } from '../../src/commands/build.js';

describe('buildCommand', () => {
  let originalCwd: string;
  let projectDir: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'phaser-tt-build-'));
    fs.mkdirSync(path.join(projectDir, 'src'), { recursive: true });
    fs.writeFileSync(
      path.join(projectDir, 'package.json'),
      JSON.stringify({ name: 'missing-phaser-fixture', private: true }, null, 2),
      'utf-8'
    );
    fs.writeFileSync(
      path.join(projectDir, 'phaser-tt.config.json'),
      JSON.stringify(
        {
          appid: 'tt1234567890abcdef',
          orientation: 'landscape',
          cdn: '',
          entry: 'src/main.js',
          assets: {
            dir: 'public/assets',
          },
          output: {
            dir: 'dist-tt',
          },
        },
        null,
        2
      ),
      'utf-8'
    );
    fs.writeFileSync(
      path.join(projectDir, 'src/main.js'),
      "import Phaser from 'phaser';\nnew Phaser.Game({ width: 800, height: 600 });\n",
      'utf-8'
    );
    process.chdir(projectDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(projectDir, { recursive: true, force: true });
  });

  it('fails early with an actionable error when project dependency phaser is missing', async () => {
    await expect(buildCommand({ target: 'h5' })).rejects.toThrow(
      /Cannot resolve dependency "phaser".*npm install/
    );
    expect(fs.existsSync(path.join(projectDir, 'dist-h5'))).toBe(false);
  });
});

/**
 * Regression: the Douyin compiler (babylon) rejects ES2020 syntax such as the
 * nullish-coalescing operator `??`. The tt build must downlevel not only the
 * engine chunk but the main entry bundle AND every scene subpackage to ES2015,
 * otherwise `??` from shared UI helpers survives into menu-scene.js and fails
 * to compile in the Douyin devtools. This drives a real build (needs phaser)
 * and asserts the emitted subpackage/main bundles contain no `??`.
 */
describe('buildCommand ES2015 downlevel (Douyin subpackages)', () => {
  let originalCwd: string;
  let projectDir: string;

  // Resolve a phaser install to link into the fixture (walk up to the monorepo
  // root, reuse the example's phaser). Skip the test if none is available.
  function findPhaserDir(): string | null {
    let dir = __dirname;
    while (true) {
      const cand = path.join(dir, 'example-landscape', 'node_modules', 'phaser');
      if (fs.existsSync(cand)) return cand;
      const parent = path.dirname(dir);
      if (parent === dir) return null;
      dir = parent;
    }
  }

  const phaserDir = findPhaserDir();

  beforeEach(() => {
    originalCwd = process.cwd();
    projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'phaser-tt-es2015-'));
    fs.mkdirSync(path.join(projectDir, 'src', 'scenes'), { recursive: true });
    fs.mkdirSync(path.join(projectDir, 'node_modules'), { recursive: true });
    if (phaserDir) {
      fs.symlinkSync(phaserDir, path.join(projectDir, 'node_modules', 'phaser'), 'dir');
    }
    fs.writeFileSync(
      path.join(projectDir, 'package.json'),
      JSON.stringify({ name: 'es2015-fixture', private: true, dependencies: { phaser: '*' } }, null, 2),
      'utf-8'
    );
    fs.writeFileSync(
      path.join(projectDir, 'phaser-tt.config.json'),
      JSON.stringify(
        {
          appid: 'tt1234567890abcdef',
          orientation: 'landscape',
          cdn: '',
          entry: 'src/main.js',
          assets: { dir: 'public/assets' },
          output: { dir: 'dist-tt' },
          subpackages: [
            { name: 'menu', root: 'menu/', entry: 'src/scenes/MenuScene.js', outputFile: 'menu-scene.js' },
          ],
        },
        null,
        2
      ),
      'utf-8'
    );
    // Main bundle uses ?? too, to prove the entry chunk is downlevelled.
    fs.writeFileSync(
      path.join(projectDir, 'src/main.js'),
      "import Phaser from 'phaser';\n" +
        'const opts = {};\n' +
        'const w = opts.width ?? 800;\n' +
        'new Phaser.Game({ width: w, height: 600, scene: [] });\n',
      'utf-8'
    );
    // Scene subpackage uses ?? (the exact syntax that broke menu-scene.js).
    fs.writeFileSync(
      path.join(projectDir, 'src/scenes/MenuScene.js'),
      "import Phaser from 'phaser';\n" +
        'export class MenuScene extends Phaser.Scene {\n' +
        '  create(opts = {}) {\n' +
        '    const radius = opts.radius ?? 18;\n' +
        '    return radius;\n' +
        '  }\n' +
        '}\n',
      'utf-8'
    );
    process.chdir(projectDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(projectDir, { recursive: true, force: true });
  });

  it.skipIf(!phaserDir)(
    'downlevels ?? out of the main bundle and scene subpackages',
    async () => {
      await buildCommand({ target: 'tt' });

      const mainBundle = fs.readFileSync(path.join(projectDir, 'dist-tt', 'game-bundle.js'), 'utf-8');
      const menuScene = fs.readFileSync(
        path.join(projectDir, 'dist-tt', 'menu', 'menu-scene.js'),
        'utf-8'
      );

      // The nullish-coalescing operator must not survive into any Douyin bundle.
      expect(mainBundle.includes('??')).toBe(false);
      expect(menuScene.includes('??')).toBe(false);

      // The scene must still reference Phaser via the global the engine exposes.
      expect(menuScene.includes('GameGlobal.Phaser')).toBe(true);
    },
    30000
  );
});
