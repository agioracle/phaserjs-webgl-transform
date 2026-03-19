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
  files.set('src/scenes/MenuScene.js', menuSceneJs(ctx));
  files.set('src/scenes/GameScene.js', gameSceneJs());
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
    MenuScene.js       Title screen with Tap to Launch
    GameScene.js       Breakout game scene
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
  type: Phaser.WEBGL,
  width: ${width},
  height: ${height},
  backgroundColor: '#1a1a2e',
  physics: {
    default: 'arcade',
    arcade: {
      debug: false,
      checkCollision: { up: true, down: true, left: true, right: true },
    },
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

    this.fillBar = this.add.rectangle(barX, barY, 0, barHeight, 0x00cc66);
    this.fillBar.setOrigin(0, 0.5);
    this.barWidth = barWidth;

    this.loadingText = this.add.text(width / 2, barY - 40, 'Loading...', {
      fontSize: '24px',
      color: '#ffffff',
    });
    this.loadingText.setOrigin(0.5, 0.5);

    this.load.on('progress', (value) => {
      this.fillBar.width = barWidth * value;
    });

    // --- Load your assets here ---
    // this.load.image('logo', 'assets/images/logo.png');
    // this.load.audio('bgm', 'assets/audio/bgm.mp3');
  }

  create() {
    // Simulate a 1-second loading animation so the progress bar is visible
    this.tweens.add({
      targets: this.fillBar,
      width: this.barWidth,
      duration: 1000,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.loadingText.setText('Complete!');
        this.time.delayedCall(200, () => {
          this.scene.start('MenuScene');
        });
      },
    });
  }
}
`;
}

function menuSceneJs(ctx: TemplateContext): string {
  return `import Phaser from 'phaser';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
  }

  create() {
    const W = this.cameras.main.width;
    const H = this.cameras.main.height;

    // Title
    this.add.text(W / 2, H * 0.3, '${ctx.projectName}', {
      fontSize: '52px',
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5, 0.5);

    // Description
    this.add.text(W / 2, H * 0.42, 'Classic brick-breaking game\\nSwipe to move paddle, break all bricks!', {
      fontSize: '24px',
      color: '#aaaaaa',
      align: 'center',
    }).setOrigin(0.5, 0.5);

    // Tap to Launch button
    const btn = this.add.text(W / 2, H * 0.6, 'Tap to Launch', {
      fontSize: '36px',
      color: '#ffffff',
    }).setOrigin(0.5, 0.5).setAlpha(0.8);

    btn.setInteractive({ useHandCursor: true });

    btn.on('pointerdown', () => {
      this.scene.start('GameScene');
    });

    // Pulsing animation on the button
    this.tweens.add({
      targets: btn,
      alpha: 0.4,
      duration: 800,
      yoyo: true,
      repeat: -1,
    });
  }
}
`;
}

function gameSceneJs(): string {
  return `import Phaser from 'phaser';

// Color palette for brick rows
const ROW_COLORS = [
  0xff4757, // red
  0xff6348, // orange-red
  0xffa502, // orange
  0xffda79, // yellow
  0x2ed573, // green
  0x1e90ff, // blue
  0x5352ed, // indigo
  0xa55eea, // purple
];

export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  create() {
    const W = this.cameras.main.width;
    const H = this.cameras.main.height;

    // ── State ──
    this.score = 0;
    this.lives = 3;
    this.gameOver = false;
    this.waiting = false; // true when ball is on paddle waiting for tap

    // ── Paddle ──
    this.paddle = this.add.rectangle(W / 2, H - 120, 150, 20, 0xe8e8e8);
    this.physics.add.existing(this.paddle, false);
    this.paddle.body.setImmovable(true);
    this.paddle.body.allowGravity = false;
    this.paddle.body.setCollideWorldBounds(true);

    // ── Ball ──
    this.ball = this.add.circle(W / 2, H - 145, 14, 0xffffff);
    this.physics.add.existing(this.ball, false);
    this.ball.body.setCollideWorldBounds(true, 1, 1, false);
    // Disable bottom-edge bounce so ball falls out
    this.physics.world.checkCollision.down = false;
    this.ball.body.setBounce(1, 1);
    this.ball.body.allowGravity = false;
    this.ball.body.setMaxVelocity(700, 700);
    this.ball.body.setCircle(14);

    // ── Bricks ──
    this.bricks = this.physics.add.staticGroup();
    this.buildBricks(W);

    // ── HUD ──
    this.scoreText = this.add.text(24, 20, 'Score: 0', {
      fontSize: '28px', color: '#ffffff', fontStyle: 'bold',
    }).setDepth(10);

    this.livesText = this.add.text(W - 24, 20, '\\u2764 3', {
      fontSize: '28px', color: '#ff4757', fontStyle: 'bold',
    }).setOrigin(1, 0).setDepth(10);

    // ── Collisions ──
    this.physics.add.collider(this.ball, this.paddle, this.hitPaddle, null, this);
    this.physics.add.collider(this.ball, this.bricks, this.hitBrick, null, this);

    // ── Input ──
    this.input.on('pointermove', (pointer) => {
      if (this.gameOver) return;
      this.paddle.x = Phaser.Math.Clamp(pointer.x, 75, W - 75);
      this.paddle.body.updateFromGameObject();
      // Keep ball on paddle while waiting
      if (this.waiting) {
        this.ball.x = this.paddle.x;
      }
    });

    this.input.on('pointerdown', (pointer) => {
      if (this.gameOver) {
        this.scene.start('MenuScene');
        return;
      }
      // Launch ball if waiting on paddle
      if (this.waiting) {
        this.waiting = false;
        this.ball.body.setVelocity(
          Phaser.Math.Between(-200, 200),
          -500
        );
      }
      // Move paddle to tap position
      this.paddle.x = Phaser.Math.Clamp(pointer.x, 75, W - 75);
      this.paddle.body.updateFromGameObject();
    });

    // ── Launch ball immediately ──
    this.ball.body.setVelocity(
      Phaser.Math.Between(-200, 200),
      -500
    );
  }

  buildBricks(W) {
    const cols = 8;
    const rows = ROW_COLORS.length;
    const brickW = 76;
    const brickH = 28;
    const padX = 10;
    const padY = 8;
    const totalW = cols * (brickW + padX) - padX;
    const startX = (W - totalW) / 2 + brickW / 2;
    const startY = 160;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = startX + col * (brickW + padX);
        const y = startY + row * (brickH + padY);
        const brick = this.add.rectangle(x, y, brickW, brickH, ROW_COLORS[row]);
        this.bricks.add(brick);
        brick.body.updateFromGameObject();
        brick.setData('points', (rows - row) * 10);
      }
    }
  }

  // ── Collision callbacks ──

  hitPaddle(ball, paddle) {
    const diff = ball.x - paddle.x;
    const norm = diff / (paddle.width / 2);
    const angle = norm * 60;
    const speed = Math.max(
      Math.sqrt(ball.body.velocity.x ** 2 + ball.body.velocity.y ** 2),
      400
    );
    const rad = Phaser.Math.DegToRad(angle - 90);
    ball.body.setVelocity(
      Math.cos(rad) * speed,
      Math.sin(rad) * speed
    );
  }

  hitBrick(ball, brick) {
    const points = brick.getData('points') || 10;
    this.score += points;
    this.scoreText.setText('Score: ' + this.score);

    brick.destroy();

    const vx = ball.body.velocity.x;
    const vy = ball.body.velocity.y;
    ball.body.setVelocity(vx * 1.01, vy * 1.01);

    if (this.bricks.countActive() === 0) {
      this.winGame();
    }
  }

  // ── Game loop ──

  update() {
    if (this.gameOver) return;

    if (this.ball.y > this.cameras.main.height + 20) {
      this.lives--;
      this.livesText.setText('\\u2764 ' + this.lives);

      if (this.lives <= 0) {
        this.loseGame();
      } else {
        this.resetBall();
      }
    }

    if (!this.waiting && Math.abs(this.ball.body.velocity.y) < 80) {
      this.ball.body.velocity.y = this.ball.body.velocity.y < 0 ? -80 : 80;
    }
  }

  resetBall() {
    this.waiting = true;
    const H = this.cameras.main.height;
    this.ball.setPosition(this.paddle.x, H - 145);
    this.ball.body.setVelocity(0, 0);
  }

  winGame() {
    this.gameOver = true;
    this.ball.body.setVelocity(0, 0);
    const W = this.cameras.main.width;
    const H = this.cameras.main.height;

    this.add.text(W / 2, H / 2 - 40, 'YOU WIN!', {
      fontSize: '52px', color: '#2ed573', fontStyle: 'bold',
    }).setOrigin(0.5, 0.5).setDepth(20);

    this.add.text(W / 2, H / 2 + 30, 'Final Score: ' + this.score, {
      fontSize: '32px', color: '#ffffff',
    }).setOrigin(0.5, 0.5).setDepth(20);

    this.add.text(W / 2, H / 2 + 90, 'Tap to return to Menu', {
      fontSize: '28px', color: '#ffffff',
    }).setOrigin(0.5, 0.5).setDepth(20).setAlpha(0.5);
  }

  loseGame() {
    this.gameOver = true;
    this.ball.body.setVelocity(0, 0);
    const W = this.cameras.main.width;
    const H = this.cameras.main.height;

    this.add.text(W / 2, H / 2 - 40, 'GAME OVER', {
      fontSize: '52px', color: '#ff4757', fontStyle: 'bold',
    }).setOrigin(0.5, 0.5).setDepth(20);

    this.add.text(W / 2, H / 2 + 30, 'Score: ' + this.score, {
      fontSize: '32px', color: '#ffffff',
    }).setOrigin(0.5, 0.5).setDepth(20);

    this.add.text(W / 2, H / 2 + 90, 'Tap to return to Menu', {
      fontSize: '28px', color: '#ffffff',
    }).setOrigin(0.5, 0.5).setDepth(20).setAlpha(0.5);
  }
}
`;
}
