import * as fs from 'node:fs';
import * as path from 'node:path';

export interface WxProjectConfig {
  outputDir: string;
  adapterPath: string;
  orientation: 'portrait' | 'landscape';
  appid: string;
}

export function generateWxProject(config: WxProjectConfig): void {
  const { outputDir, adapterPath, orientation, appid } = config;

  fs.mkdirSync(outputDir, { recursive: true });

  // game.js
  // Capture adapter CJS exports into a custom (writable) GameGlobal property.
  // We cannot rely on GameGlobal.window etc. because WeChat defines them as
  // read-only getters that safeSet may silently fail to override.
  // The intro code in each chunk reads from __adapterExports instead.
  const gameJs = `GameGlobal.__adapterExports = require('./phaser-wx-adapter.js');
if (typeof GameGlobal.__wxCustomAdapter !== 'undefined') {
  require('./phaser-wx-custom-adapter.js');
}
require('./phaser-engine.js');
require('./game-bundle.js');
`;
  fs.writeFileSync(path.join(outputDir, 'game.js'), gameJs, 'utf-8');

  // game.json
  const gameJson = {
    deviceOrientation: orientation,
    showStatusBar: false,
    networkTimeout: {
      request: 10000,
      connectSocket: 10000,
      uploadFile: 10000,
      downloadFile: 10000,
    },
  };
  fs.writeFileSync(
    path.join(outputDir, 'game.json'),
    JSON.stringify(gameJson, null, 2),
    'utf-8'
  );

  // project.config.json
  const projectConfig = {
    appid,
    setting: {
      urlCheck: false,
      es6: true,
      postcss: true,
      minified: true,
    },
    compileType: 'game',
    libVersion: '2.10.0',
    projectname: 'phaser-wx-game',
  };
  fs.writeFileSync(
    path.join(outputDir, 'project.config.json'),
    JSON.stringify(projectConfig, null, 2),
    'utf-8'
  );

  // Copy adapter file if it exists and is a single-file bundle.
  // If the adapter source has sub-module imports, it must be bundled
  // externally (e.g., by the CLI) before this step.
  if (adapterPath && fs.existsSync(adapterPath)) {
    const adapterContent = fs.readFileSync(adapterPath, 'utf-8');
    const hasSubModuleImports = /(?:^|\n)\s*import\s+.*from\s+['"]\.\//.test(adapterContent);
    if (!hasSubModuleImports) {
      fs.copyFileSync(adapterPath, path.join(outputDir, 'phaser-wx-adapter.js'));
    }
  }
}
