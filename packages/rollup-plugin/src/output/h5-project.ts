import * as fs from 'node:fs';
import * as path from 'node:path';

export interface H5ProjectConfig {
  outputDir: string;
}

export function generateH5Project(config: H5ProjectConfig): void {
  const { outputDir } = config;

  fs.mkdirSync(outputDir, { recursive: true });

  // index.html — minimal H5 shell that loads game.js
  const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no">
  <title>Phaser Game</title>
  <style>
    * { margin: 0; padding: 0; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: #000; }
    canvas { display: block; margin: 0 auto; }
  </style>
</head>
<body>
  <script src="game.js"></script>
</body>
</html>
`;

  fs.writeFileSync(path.join(outputDir, 'index.html'), indexHtml, 'utf-8');
}
