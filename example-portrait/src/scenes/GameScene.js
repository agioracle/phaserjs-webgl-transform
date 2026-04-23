import Phaser from 'phaser';
import { getSafeArea } from '../utils/safe-area.js';

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

  preload() {
    // Load GameScene-specific assets
    this.load.image('ball', 'assets/images/ball.png');
    this.load.audio('ball_hit', 'assets/audio/ball_hit.mp3');

    // Parallel: preload game-over subpackage so the round-end screen is ready
    // by the time the player wins/loses.
    this._gameOverReady = false;
    if (typeof wx !== 'undefined' && wx.loadSubpackage) {
      wx.loadSubpackage({
        name: 'game-over',
        success: () => {
          if (!this.scene.get('GameOverScene')) {
            const { GameOverScene } = require('game-over/game-over-scene.js');
            this.scene.add('GameOverScene', GameOverScene, false);
          }
          this._gameOverReady = true;
        },
        fail: (err) => {
          console.error('Failed to load game-over subpackage:', err);
        },
      });
    } else {
      // Fallback for non-WeChat environments (dev/test)
      this._gameOverReady = true;
    }
  }

  create() {
    const W = this.cameras.main.width;   // 750
    const H = this.cameras.main.height;  // 1334
    const sa = getSafeArea(this);

    this.safeArea = sa;

    // ── State ──
    this.score = 0;
    this.lives = 3;
    this.gameOver = false;
    this.waiting = false; // true when ball is on paddle waiting for tap

    // ── Paddle — offset from bottom safe area ──
    const paddleY = H - sa.bottom - 100;
    this.paddle = this.add.rectangle(W / 2, paddleY, 150, 20, 0xe8e8e8);
    this.physics.add.existing(this.paddle, false);
    this.paddle.body.setImmovable(true);
    this.paddle.body.allowGravity = false;
    this.paddle.body.setCollideWorldBounds(true);

    // ── Ball — placed above paddle ──
    const ballY = paddleY - 25;
    this.ball = this.add.image(W / 2, ballY, 'ball');
    this.ball.setDisplaySize(28, 28);
    this.physics.add.existing(this.ball, false);
    this.ball.body.setCollideWorldBounds(true, 1, 1, false);
    // Disable bottom-edge bounce so ball falls out
    this.physics.world.checkCollision.down = false;
    this.ball.body.setBounce(1, 1);
    this.ball.body.allowGravity = false;
    this.ball.body.setMaxVelocity(700, 700);
    // Make the physics body circular
    this.ball.body.setCircle(14);

    // ── Bricks — offset below top safe area ──
    this.bricks = this.physics.add.staticGroup();
    this.buildBricks(W, sa.top);

    // ── HUD — offset from top safe area ──
    this.scoreText = this.add.text(24, sa.top + 16, 'Score: 0', {
      fontSize: '28px', color: '#ffffff', fontStyle: 'bold',
    }).setDepth(10);

    this.livesText = this.add.text(W/2, sa.top + 16, '\u2764 3', {
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
      // When the round is over, input is handled by GameOverScene.
      if (this.gameOver) return;
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

  buildBricks(W, safeTop) {
    const cols = 8;
    const rows = ROW_COLORS.length;
    const brickW = 76;
    const brickH = 28;
    const padX = 10;
    const padY = 8;
    const totalW = cols * (brickW + padX) - padX;
    const startX = (W - totalW) / 2 + brickW / 2;
    // Start bricks below HUD, accounting for safe area
    const startY = safeTop + 80;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = startX + col * (brickW + padX);
        const y = startY + row * (brickH + padY);
        // Use Rectangle game object instead of generateTexture
        const brick = this.add.rectangle(x, y, brickW, brickH, ROW_COLORS[row]);
        this.bricks.add(brick);
        brick.body.updateFromGameObject();
        // Higher rows = more points
        brick.setData('points', (rows - row) * 10);
      }
    }
  }

  // ── Collision callbacks ──

  hitPaddle(ball, paddle) {
    this.sound.play('ball_hit', { volume: 0.3 });
    const diff = ball.x - paddle.x;
    const norm = diff / (paddle.width / 2); // -1 to 1
    const angle = norm * 60; // max ±60°
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
    this.sound.play('ball_hit', { volume: 0.3 });
    const points = brick.getData('points') || 10;
    this.score += points;
    this.scoreText.setText('Score: ' + this.score);

    brick.destroy();

    // Speed up slightly
    const vx = ball.body.velocity.x;
    const vy = ball.body.velocity.y;
    ball.body.setVelocity(vx * 1.01, vy * 1.01);

    // Win check
    if (this.bricks.countActive() === 0) {
      this.winGame();
    }
  }

  // ── Game loop ──

  update() {
    if (this.gameOver) return;

    // Ball fell below screen
    if (this.ball.y > this.cameras.main.height + 20) {
      this.lives--;
      this.livesText.setText('\u2764 ' + this.lives);

      if (this.lives <= 0) {
        this.loseGame();
      } else {
        this.resetBall();
      }
    }

    // Prevent ball from going purely horizontal (boring)
    if (!this.waiting && Math.abs(this.ball.body.velocity.y) < 80) {
      this.ball.body.velocity.y = this.ball.body.velocity.y < 0 ? -80 : 80;
    }
  }

  resetBall() {
    this.waiting = true;
    this.ball.setPosition(this.paddle.x, this.paddle.y - 25);
    this.ball.body.setVelocity(0, 0);
  }

  winGame() {
    this.endRound(true);
  }

  loseGame() {
    this.endRound(false);
  }

  /**
   * End the current round and hand off to GameOverScene.
   * If the game-over subpackage is still downloading, poll briefly.
   */
  endRound(won) {
    this.gameOver = true;
    this.ball.body.setVelocity(0, 0);

    const launchGameOver = () => {
      if (this._gameOverReady) {
        this.scene.start('GameOverScene', { score: this.score, won });
      } else {
        this.time.delayedCall(100, launchGameOver);
      }
    };
    launchGameOver();
  }
}
