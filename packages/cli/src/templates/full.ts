export interface TemplateContext {
  projectName: string;
  appid: string;
  orientation: 'portrait' | 'landscape';
  cdn: string;
}

export function generateFullTemplate(ctx: TemplateContext): Map<string, string> {
  const files = new Map<string, string>();

  files.set('package.json', packageJson(ctx));
  files.set('phaser-wx.config.json', configJson(ctx));
  files.set('README.md', readme(ctx));
  files.set('src/main.js', mainJs(ctx));
  files.set('src/scenes/BootScene.js', bootSceneJs());
  files.set('src/scenes/MenuScene.js', menuSceneJs());
  files.set('src/scenes/GameScene.js', gameSceneJs());
  files.set('src/ui/Button.js', buttonJs());
  files.set('public/assets/images/.gitkeep', '');
  files.set('public/assets/audio/.gitkeep', '');

  return files;
}

function packageJson(ctx: TemplateContext): string {
  const pkg = {
    name: ctx.projectName,
    version: '0.1.0',
    private: true,
    scripts: {
      dev: 'npx serve public',
      build: 'pnpm exec phaser-wx build',
    },
    dependencies: {
      phaser: '^3.80.0',
    },
    devDependencies: {
      serve: '^14.0.0',
    },
  };
  return JSON.stringify(pkg, null, 2) + '\n';
}

function configJson(ctx: TemplateContext): string {
  const config = {
    appid: ctx.appid,
    orientation: ctx.orientation,
    cdn: ctx.cdn,
    entry: 'src/main.js',
    assets: {
      dir: 'public/assets',
      remoteSizeThreshold: 204800,
    },
    output: {
      dir: 'dist-wx',
    },
  };
  return JSON.stringify(config, null, 2) + '\n';
}

function readme(ctx: TemplateContext): string {
  return `# ${ctx.projectName}

A Phaser.js 3.x game project configured for WeChat Mini-Game deployment.

## Getting Started

\`\`\`bash
# Install dependencies
npm install

# Start local development server
npm run dev

# Build for WeChat Mini-Game
npm run build
\`\`\`

## Project Structure

\`\`\`
src/
  main.js              Entry point — creates the Phaser.Game instance
  scenes/
    BootScene.js       Loading screen with progress bar
    MenuScene.js       Title screen with Start button
    GameScene.js       Main game scene
  ui/
    Button.js          Reusable button component
public/
  assets/
    images/            Image assets (png, jpg, webp)
    audio/             Audio assets (mp3, ogg)
phaser-wx.config.json  WeChat Mini-Game build configuration
\`\`\`

## WeChat Mini-Game Build

The \`npm run build\` command uses \`phaser-wx\` to:

1. Transform Phaser.js code for WeChat Mini-Game compatibility
2. Split assets between local package and CDN
3. Generate WeChat project files (game.js, game.json, project.config.json)

Output is written to \`dist-wx/\`. Open it in WeChat DevTools to preview.

## Configuration

Edit \`phaser-wx.config.json\` to change:

- **appid**: Your WeChat Mini-Game AppID
- **orientation**: Screen orientation (portrait / landscape)
- **cdn**: CDN base URL for remote assets
- **assets.remoteSizeThreshold**: Size threshold (bytes) for CDN offloading
`;
}

function mainJs(ctx: TemplateContext): string {
  const isLandscape = ctx.orientation === 'landscape';
  const width = isLandscape ? 1334 : 750;
  const height = isLandscape ? 750 : 1334;

  return `import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.js';
import { MenuScene } from './scenes/MenuScene.js';
import { GameScene } from './scenes/GameScene.js';

const config = {
  type: Phaser.AUTO,
  width: ${width},
  height: ${height},
  parent: 'game-container',
  backgroundColor: '#2d2d2d',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, MenuScene, GameScene],
};

const game = new Phaser.Game(config);
`;
}

function bootSceneJs(): string {
  return `import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    // --- Progress bar ---
    const { width, height } = this.cameras.main;
    const barWidth = width * 0.6;
    const barHeight = 30;
    const barX = (width - barWidth) / 2;
    const barY = height / 2;

    const bgBar = this.add.rectangle(barX + barWidth / 2, barY, barWidth, barHeight, 0x444444);
    bgBar.setOrigin(0.5, 0.5);

    const fillBar = this.add.rectangle(barX, barY, 0, barHeight, 0x00cc66);
    fillBar.setOrigin(0, 0.5);

    const loadingText = this.add.text(width / 2, barY - 40, 'Loading...', {
      fontSize: '24px',
      color: '#ffffff',
    });
    loadingText.setOrigin(0.5, 0.5);

    this.load.on('progress', (value) => {
      fillBar.width = barWidth * value;
    });

    this.load.on('complete', () => {
      loadingText.setText('Complete!');
    });

    // --- Load your assets here ---
    // this.load.image('logo', 'assets/images/logo.png');
    // this.load.audio('bgm', 'assets/audio/bgm.mp3');
  }

  create() {
    this.scene.start('MenuScene');
  }
}
`;
}

function menuSceneJs(): string {
  return `import Phaser from 'phaser';
import { Button } from '../ui/Button.js';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
  }

  create() {
    const { width, height } = this.cameras.main;

    // Title
    this.add
      .text(width / 2, height * 0.3, 'My Phaser Game', {
        fontSize: '48px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5, 0.5);

    // Subtitle
    this.add
      .text(width / 2, height * 0.42, 'Tap Start to play', {
        fontSize: '20px',
        color: '#aaaaaa',
      })
      .setOrigin(0.5, 0.5);

    // Start button
    new Button(this, width / 2, height * 0.6, 'Start', {
      fontSize: '32px',
      color: '#ffffff',
      backgroundColor: '#4a90d9',
      padding: { x: 40, y: 16 },
    }, () => {
      this.scene.start('GameScene');
    });
  }
}
`;
}

function gameSceneJs(): string {
  return `import Phaser from 'phaser';

export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
    this.score = 0;
    this.scoreText = null;
  }

  create() {
    const { width, height } = this.cameras.main;

    // Score display
    this.score = 0;
    this.scoreText = this.add
      .text(20, 20, 'Score: 0', {
        fontSize: '24px',
        color: '#ffffff',
      })
      .setDepth(10);

    // Instructions
    this.add
      .text(width / 2, height - 40, 'Tap anywhere to create circles!', {
        fontSize: '18px',
        color: '#888888',
      })
      .setOrigin(0.5, 0.5);

    // Back button
    const backBtn = this.add
      .text(width - 20, 20, '← Menu', {
        fontSize: '20px',
        color: '#4a90d9',
      })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true });

    backBtn.on('pointerdown', () => {
      this.scene.start('MenuScene');
    });

    // Spawn circles on tap
    this.input.on('pointerdown', (pointer) => {
      this.spawnCircle(pointer.x, pointer.y);
    });
  }

  spawnCircle(x, y) {
    const radius = Phaser.Math.Between(15, 40);
    const color = Phaser.Math.Between(0x000000, 0xffffff);

    const circle = this.add.circle(x, y, radius, color);
    circle.setAlpha(0.8);
    circle.setInteractive();

    // Tap circle to score
    circle.on('pointerdown', (pointer, localX, localY, event) => {
      event.stopPropagation();
      this.score += 10;
      this.scoreText.setText('Score: ' + this.score);

      // Pop animation
      this.tweens.add({
        targets: circle,
        scaleX: 1.5,
        scaleY: 1.5,
        alpha: 0,
        duration: 200,
        onComplete: () => circle.destroy(),
      });
    });

    // Drift downward and fade out
    this.tweens.add({
      targets: circle,
      y: y + Phaser.Math.Between(80, 200),
      alpha: 0.2,
      duration: 3000,
      ease: 'Sine.easeIn',
      onComplete: () => circle.destroy(),
    });
  }
}
`;
}

function buttonJs(): string {
  return `import Phaser from 'phaser';

export class Button extends Phaser.GameObjects.Text {
  /**
   * @param {Phaser.Scene} scene - The scene this button belongs to
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {string} label - Button text
   * @param {object} style - Phaser text style config
   * @param {function} onClick - Callback when button is clicked
   */
  constructor(scene, x, y, label, style, onClick) {
    super(scene, x, y, label, style);

    this.setOrigin(0.5, 0.5);
    this.setInteractive({ useHandCursor: true });

    // Add to scene
    scene.add.existing(this);

    // Hover effects
    this.on('pointerover', () => {
      this.setScale(1.05);
      this.setAlpha(0.9);
    });

    this.on('pointerout', () => {
      this.setScale(1);
      this.setAlpha(1);
    });

    this.on('pointerdown', () => {
      this.setScale(0.95);
    });

    this.on('pointerup', () => {
      this.setScale(1.05);
      if (onClick) onClick();
    });
  }
}
`;
}
