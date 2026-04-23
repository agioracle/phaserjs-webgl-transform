import Phaser from 'phaser';
import { getSafeArea } from '../utils/safe-area.js';

const PIPE_WIDTH = 80;
const PIPE_GAP = 200;
const PIPE_SPEED = -280;
const PIPE_INTERVAL = 1200;
const FLAP_VELOCITY = -350;
const GROUND_HEIGHT = 80;

export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  preload() {
    // Load bird sprite and hit sound
    this.load.image('bird', 'assets/images/bird.png');
    this.load.audio('bird_hit', 'assets/audio/bird_hit.mp3');

    // Parallel: preload game-over subpackage so the round-end screen is ready
    // by the time the bird crashes.
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
    const W = this.cameras.main.width;   // 1334
    const H = this.cameras.main.height;  // 750

    this.gameStarted = false;
    this.isGameOver = false;
    this.score = 0;

    // --- Sky gradient background ---
    const skyGfx = this.add.graphics();
    const skyColors = [0x4ec0ca, 0x70c5ce, 0x87ceeb, 0xa8d8ea];
    const bandH = H / skyColors.length;
    for (let i = 0; i < skyColors.length; i++) {
      skyGfx.fillStyle(skyColors[i], 1);
      skyGfx.fillRect(0, i * bandH, W, bandH + 1);
    }

    // --- Pipes container array (no texture needed) ---
    this.pipeGroups = [];  // track pipe groups for scoring & cleanup

    // --- Ground (graphics-based scrolling) ---
    this.groundGfx = this.add.graphics();
    this.groundGfx.setDepth(5);
    this._drawGround(0);

    // Ground physics body (invisible rectangle)
    this.groundBody = this.add.rectangle(W / 2, H - GROUND_HEIGHT / 2, W, GROUND_HEIGHT);
    this.groundBody.setAlpha(0);
    this.physics.add.existing(this.groundBody, true);
    this.groundBody.body.setSize(W, GROUND_HEIGHT);
    this.groundBody.setDepth(5);

    // --- Bird (using bird.png sprite) ---
    this.bird = this.physics.add.sprite(200, H / 2 - 60, 'bird');
    this.bird.setDepth(10);
    this.bird.body.allowGravity = false;
    this.bird.body.setSize(this.bird.width * 0.8, this.bird.height * 0.7);
    this.bird.body.setOffset(this.bird.width * 0.1, this.bird.height * 0.15);

    // --- Score HUD ---
    this.scoreText = this.add.text(W / 2, 50, '0', {
      fontSize: '60px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 5,
    }).setOrigin(0.5, 0.5).setDepth(20);

    // --- "Tap to Start" hint ---
    this.hintText = this.add.text(W / 2, H / 2 + 40, 'Tap to Start', {
      fontSize: '32px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5, 0.5).setDepth(20);

    this.tweens.add({
      targets: this.hintText,
      alpha: 0.3,
      duration: 600,
      yoyo: true,
      repeat: -1,
    });

    // Pre-start bird float animation
    this.floatTween = this.tweens.add({
      targets: this.bird,
      y: this.bird.y + 15,
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // --- Collisions ---
    this.physics.add.collider(this.bird, this.groundBody, this.onGameOver, null, this);

    // --- Input ---
    this.input.on('pointerdown', () => {
      if (this.isGameOver) return;

      if (!this.gameStarted) {
        this.startGame();
      }

      this.flap();
    });

    // Ground scroll offset
    this.groundScrollX = 0;
  }

  _drawGround(scrollX) {
    const W = this.cameras.main.width;
    const H = this.cameras.main.height;
    const gfx = this.groundGfx;
    gfx.clear();

    const groundTop = H - GROUND_HEIGHT;

    // Green strip
    gfx.fillStyle(0x54b435, 1);
    gfx.fillRect(0, groundTop, W, 16);
    // Dark green line
    gfx.fillStyle(0x2d6b1e, 1);
    gfx.fillRect(0, groundTop + 14, W, 4);
    // Sand base
    gfx.fillStyle(0xded895, 1);
    gfx.fillRect(0, groundTop + 18, W, GROUND_HEIGHT - 18);

    // Scrolling stripes on sand for movement illusion
    gfx.fillStyle(0xd4c878, 1);
    const stripeW = 40;
    const stripeGap = 60;
    const totalW = stripeW + stripeGap;
    const offset = -(scrollX % totalW);
    for (let sx = offset; sx < W + totalW; sx += totalW) {
      gfx.fillRect(sx, groundTop + 24, stripeW, 4);
      gfx.fillRect(sx + 20, groundTop + 34, stripeW, 4);
    }
  }

  _createPipeRect(x, y, w, h, color) {
    const rect = this.add.rectangle(x, y, w, h, color);
    this.physics.add.existing(rect, false);
    rect.body.allowGravity = false;
    rect.body.setVelocityX(PIPE_SPEED);
    rect.body.setImmovable(true);
    rect.setDepth(3);
    return rect;
  }

  startGame() {
    this.gameStarted = true;

    this.hintText.destroy();
    if (this.floatTween) {
      this.floatTween.stop();
    }

    this.bird.body.allowGravity = true;

    this.pipeTimer = this.time.addEvent({
      delay: PIPE_INTERVAL,
      callback: this.spawnPipePair,
      callbackScope: this,
      loop: true,
    });

    this.spawnPipePair();
  }

  flap() {
    this.bird.body.setVelocityY(FLAP_VELOCITY);
  }

  spawnPipePair() {
    if (this.isGameOver) return;

    const W = this.cameras.main.width;
    const H = this.cameras.main.height;
    const playableH = H - GROUND_HEIGHT;

    const minY = 120;
    const maxY = playableH - 120;
    const gapCenterY = Phaser.Math.Between(minY, maxY);

    const topPipeH = gapCenterY - PIPE_GAP / 2;
    const bottomPipeY = gapCenterY + PIPE_GAP / 2;
    const bottomPipeH = playableH - bottomPipeY;

    const pipeX = W + PIPE_WIDTH / 2 + 20;
    const capW = PIPE_WIDTH + 12;
    const capH = 32;

    // --- Top pipe ---
    const topBody = this._createPipeRect(pipeX, topPipeH / 2, PIPE_WIDTH, topPipeH, 0x54b435);
    // Top pipe border (slightly darker overlay on edges — use a slightly wider dark rect behind)
    const topBorder = this._createPipeRect(pipeX, topPipeH / 2, PIPE_WIDTH + 4, topPipeH, 0x2d6b1e);
    topBorder.setDepth(2);
    const topCap = this._createPipeRect(pipeX, topPipeH - capH / 2 + capH / 2, capW, capH, 0x54b435);
    const topCapBorder = this._createPipeRect(pipeX, topPipeH, capW + 4, capH + 4, 0x2d6b1e);
    topCapBorder.setDepth(2);

    // --- Bottom pipe ---
    const botBodyY = bottomPipeY + bottomPipeH / 2;
    const botBody = this._createPipeRect(pipeX, botBodyY, PIPE_WIDTH, bottomPipeH, 0x54b435);
    const botBorder = this._createPipeRect(pipeX, botBodyY, PIPE_WIDTH + 4, bottomPipeH, 0x2d6b1e);
    botBorder.setDepth(2);
    const botCap = this._createPipeRect(pipeX, bottomPipeY, capW, capH, 0x54b435);
    const botCapBorder = this._createPipeRect(pipeX, bottomPipeY, capW + 4, capH + 4, 0x2d6b1e);
    botCapBorder.setDepth(2);

    // All parts for collision detection with bird
    const allParts = [topBody, topBorder, topCap, topCapBorder, botBody, botBorder, botCap, botCapBorder];

    // Add overlap with bird for each part
    allParts.forEach((part) => {
      this.physics.add.overlap(this.bird, part, this.onGameOver, null, this);
    });

    // Track for scoring and cleanup
    this.pipeGroups.push({
      parts: allParts,
      scored: false,
      x: () => topBody.x, // use topBody x for score tracking
    });
  }

  update() {
    if (this.isGameOver) return;

    const W = this.cameras.main.width;

    // Scroll ground
    if (this.gameStarted) {
      this.groundScrollX += Math.abs(PIPE_SPEED) / 60;
      this._drawGround(this.groundScrollX);
    }

    // Bird rotation based on velocity
    if (this.gameStarted) {
      const vy = this.bird.body.velocity.y;
      const targetAngle = Phaser.Math.Clamp(vy / 6, -30, 90);
      this.bird.angle = targetAngle;
    }

    // Clamp bird at top
    if (this.bird.y < -50) {
      this.bird.y = -50;
      this.bird.body.setVelocityY(0);
    }

    // Check pipe groups for scoring and cleanup
    for (let i = this.pipeGroups.length - 1; i >= 0; i--) {
      const pg = this.pipeGroups[i];
      const px = pg.x();

      // Score detection
      if (!pg.scored && px + PIPE_WIDTH / 2 < this.bird.x) {
        pg.scored = true;
        this.score++;
        this.scoreText.setText('' + this.score);
      }

      // Cleanup off-screen pipes
      if (px < -PIPE_WIDTH - 40) {
        pg.parts.forEach((p) => { if (p.active) p.destroy(); });
        this.pipeGroups.splice(i, 1);
      }
    }
  }

  onGameOver() {
    if (this.isGameOver) return;
    this.isGameOver = true;

    // Play hit sound
    this.sound.play('bird_hit', { volume: 0.6 });

    if (this.pipeTimer) {
      this.pipeTimer.remove();
    }

    // Stop all pipe parts
    this.pipeGroups.forEach((pg) => {
      pg.parts.forEach((p) => {
        if (p.active && p.body) p.body.setVelocityX(0);
      });
    });

    // Stop bird
    this.bird.body.allowGravity = false;
    this.bird.body.setVelocity(0, 0);

    // Hand off to GameOverScene (loaded from the game-over subpackage).
    // If the subpackage is still downloading, poll briefly.
    const launchGameOver = () => {
      if (this._gameOverReady) {
        this.scene.start('GameOverScene', { score: this.score });
      } else {
        this.time.delayedCall(100, launchGameOver);
      }
    };
    launchGameOver();
  }
}
