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
  const gameJs = `require('./phaser-wx-adapter.js');
if (typeof GameGlobal.__wxCustomAdapter !== 'undefined') {
  require('./phaser-wx-custom-adapter.js');
}
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

  // Copy adapter file
  fs.copyFileSync(adapterPath, path.join(outputDir, 'phaser-wx-adapter.js'));
}
