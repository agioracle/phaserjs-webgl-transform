import Phaser from 'phaser';
import { getSafeArea } from '../utils/safe-area.js';
import {
  drawCasualBackground,
  drawPanel,
  createBadge,
  PALETTE,
} from '../utils/casual-ui.js';

const PIPE_WIDTH = 90;
const PIPE_GAP = 210;
const PIPE_SPEED = -280;
const PIPE_INTERVAL = 1200;
const FLAP_VELOCITY = -350;
const GROUND_HEIGHT = 80;

// Pipe palette (grass-green body with darker edge + gloss)
const PIPE_FILL = 0x5ad15a;
const PIPE_DARK = 0x2d6b1e;
const PIPE_HI   = 0xb5ee8e;

export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  preload() {
    this.load.image('bird', 'assets/images/bird.png');
    this.load.audio('bird_hit', 'assets/audio/bird_hit.mp3');

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
      this._gameOverReady = true;
    }
  }

  create() {
    const W = this.cameras.main.width;   // 1334
    const H = this.cameras.main.height;  // 750
    const sa = getSafeArea(this);

    this.gameStarted = false;
    this.isGameOver = false;
    this.score = 0;

    // --- Sky casual gradient (bright pastel) ---
    drawCasualBackground(this, { top: 0x8fd9ff, bottom: 0xfff3d9 });

    // --- Clouds (scrolling subtly) ---
    this.cloudGfx = this.add.graphics();
    this.cloudGfx.setDepth(-500);
    this.cloudOffset = 0;
    this._drawClouds();

    // --- Pipes array ---
    this.pipeGroups = [];

    // --- Ground ---
    this.groundGfx = this.add.graphics();
    this.groundGfx.setDepth(5);
    this._drawGround(0);

    this.groundBody = this.add.rectangle(W / 2, H - GROUND_HEIGHT / 2, W, GROUND_HEIGHT);
    this.groundBody.setAlpha(0);
    this.physics.add.existing(this.groundBody, true);
    this.groundBody.body.setSize(W, GROUND_HEIGHT);
    this.groundBody.setDepth(5);

    // --- Bird ---
    this.bird = this.physics.add.sprite(260, H / 2 - 60, 'bird');
    this.bird.setDepth(10);
    this.bird.body.allowGravity = false;
    this.bird.body.setSize(this.bird.width * 0.8, this.bird.height * 0.7);
    this.bird.body.setOffset(this.bird.width * 0.1, this.bird.height * 0.15);

    // --- Score HUD (casual badge — single-row three-segment layout) ---
    // Pinned to a high depth so it always renders above pipes / bird / ground.
    const hudY = sa.top + 50;
    this.scoreBadge = createBadge(this, W / 2, hudY, {
      w: 280,
      h: 64,
      iconColor: PALETTE.primary,
      label: 'SCORE',
      text: '0',
      fontSize: 32,
    });
    this.scoreBadge.container.setDepth(100);

    // --- "Tap to Start" card ---
    this.startCardY = H / 2 + 140;
    this.startCard = drawPanel(this, W / 2, this.startCardY, 460, 80, {
      radius: 18,
    });
    this.hintText = this.add.text(W / 2, this.startCardY, 'TAP TO START', {
      fontSize: '36px',
      fontStyle: 'bold',
      color: '#d08512',
      stroke: '#3d2a1a',
      strokeThickness: 3,
    }).setOrigin(0.5, 0.5);

    this.tweens.add({
      targets: [this.hintText, this.startCard],
      alpha: 0.55,
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
      if (!this.gameStarted) this.startGame();
      this.flap();
    });

    this.groundScrollX = 0;
  }

  // ────────────────────────────────────────────
  // Visual helpers
  // ────────────────────────────────────────────

  _drawClouds() {
    const W = this.cameras.main.width;
    const H = this.cameras.main.height;
    const gfx = this.cloudGfx;
    gfx.clear();
    // Deterministic cloud positions using modulo of offset for subtle scroll
    const items = [
      { x: 100, y: 120, r: 38 },
      { x: 360, y: 80, r: 30 },
      { x: 640, y: 160, r: 44 },
      { x: 900, y: 100, r: 34 },
      { x: 1180, y: 140, r: 40 },
      { x: 1500, y: 90, r: 36 }, // off-screen; wraps
    ];
    const wrapW = W + 300;
    items.forEach((it) => {
      const x = ((it.x - this.cloudOffset) % wrapW + wrapW) % wrapW - 100;
      gfx.fillStyle(0xffffff, 0.55);
      gfx.fillCircle(x, it.y, it.r);
      gfx.fillCircle(x + it.r * 0.8, it.y + 4, it.r * 0.85);
      gfx.fillCircle(x - it.r * 0.8, it.y + 6, it.r * 0.75);
      gfx.fillCircle(x + it.r * 0.2, it.y - it.r * 0.5, it.r * 0.7);
    });
  }

  _drawGround(scrollX) {
    const W = this.cameras.main.width;
    const H = this.cameras.main.height;
    const gfx = this.groundGfx;
    gfx.clear();

    const groundTop = H - GROUND_HEIGHT;

    // Grass strip
    gfx.fillStyle(0x5ad15a, 1);
    gfx.fillRect(0, groundTop, W, 22);
    gfx.fillStyle(0x2d6b1e, 1);
    gfx.fillRect(0, groundTop + 20, W, 6);
    // Sand base
    gfx.fillStyle(0xfde49e, 1);
    gfx.fillRect(0, groundTop + 26, W, GROUND_HEIGHT - 26);

    // Scrolling dashes
    gfx.fillStyle(0xf0ca74, 1);
    const stripeW = 40;
    const stripeGap = 50;
    const totalW = stripeW + stripeGap;
    const offset = -(scrollX % totalW);
    for (let sx = offset; sx < W + totalW; sx += totalW) {
      gfx.fillRect(sx, groundTop + 42, stripeW, 4);
      gfx.fillRect(sx + 20, groundTop + 58, stripeW, 4);
    }
  }

  _drawPipePiece(x, y, w, h, isCap) {
    // Outer dark edge rectangle (a graphic that just draws, moves with the body)
    const radius = isCap ? 8 : 4;
    // We build a composite using a single Graphics attached to the physics body's container.
    const gfx = this.add.graphics();
    gfx.x = x;
    gfx.y = y;
    // dark outline
    gfx.fillStyle(PIPE_DARK, 1);
    gfx.fillRoundedRect(-w / 2, -h / 2, w, h, radius);
    // main fill
    gfx.fillStyle(PIPE_FILL, 1);
    gfx.fillRoundedRect(-w / 2 + 4, -h / 2 + 4, w - 8, h - 8, Math.max(0, radius - 2));
    // highlight stripe (left)
    gfx.fillStyle(PIPE_HI, 0.75);
    gfx.fillRoundedRect(-w / 2 + 8, -h / 2 + 8, Math.max(4, w * 0.18), h - 16, Math.max(0, radius - 4));
    return gfx;
  }

  _createPipeRect(x, y, w, h) {
    // Invisible physics rectangle — visual is a separate Graphics we move in sync.
    const rect = this.add.rectangle(x, y, w, h, 0x000000, 0);
    this.physics.add.existing(rect, false);
    rect.body.allowGravity = false;
    rect.body.setVelocityX(PIPE_SPEED);
    rect.body.setImmovable(true);
    rect.setDepth(3);
    return rect;
  }

  startGame() {
    this.gameStarted = true;

    this.tweens.killTweensOf([this.hintText, this.startCard]);
    this.hintText.destroy();
    this.startCard.destroy();
    if (this.floatTween) this.floatTween.stop();

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

    const minY = 140;
    const maxY = playableH - 140;
    const gapCenterY = Phaser.Math.Between(minY, maxY);

    const topPipeH = gapCenterY - PIPE_GAP / 2;
    const bottomPipeY = gapCenterY + PIPE_GAP / 2;
    const bottomPipeH = playableH - bottomPipeY;

    const pipeX = W + PIPE_WIDTH / 2 + 20;
    const capW = PIPE_WIDTH + 16;
    const capH = 34;

    // --- Top pipe ---
    const topBody = this._createPipeRect(pipeX, topPipeH / 2, PIPE_WIDTH, topPipeH);
    const topBodyGfx = this._drawPipePiece(pipeX, topPipeH / 2, PIPE_WIDTH, topPipeH, false);
    const topCap = this._createPipeRect(pipeX, topPipeH - capH / 2, capW, capH);
    const topCapGfx = this._drawPipePiece(pipeX, topPipeH - capH / 2, capW, capH, true);

    // --- Bottom pipe ---
    const botBodyY = bottomPipeY + bottomPipeH / 2;
    const botBody = this._createPipeRect(pipeX, botBodyY, PIPE_WIDTH, bottomPipeH);
    const botBodyGfx = this._drawPipePiece(pipeX, botBodyY, PIPE_WIDTH, bottomPipeH, false);
    const botCap = this._createPipeRect(pipeX, bottomPipeY + capH / 2, capW, capH);
    const botCapGfx = this._drawPipePiece(pipeX, bottomPipeY + capH / 2, capW, capH, true);

    const parts = [topBody, topCap, botBody, botCap];
    const visuals = [
      { gfx: topBodyGfx, body: topBody },
      { gfx: topCapGfx,  body: topCap  },
      { gfx: botBodyGfx, body: botBody },
      { gfx: botCapGfx,  body: botCap  },
    ];

    parts.forEach((part) => {
      this.physics.add.overlap(this.bird, part, this.onGameOver, null, this);
    });

    this.pipeGroups.push({
      parts,
      visuals,
      scored: false,
      x: () => topBody.x,
    });
  }

  update() {
    if (this.isGameOver) return;

    const W = this.cameras.main.width;

    // Scroll clouds + ground
    if (this.gameStarted) {
      this.cloudOffset += Math.abs(PIPE_SPEED) * 0.15 / 60;
      this._drawClouds();

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

    // Pipe group update
    for (let i = this.pipeGroups.length - 1; i >= 0; i--) {
      const pg = this.pipeGroups[i];
      const px = pg.x();

      // Sync visuals to bodies
      pg.visuals.forEach((v) => {
        v.gfx.x = v.body.x;
        v.gfx.y = v.body.y;
      });

      // Score detection
      if (!pg.scored && px + PIPE_WIDTH / 2 < this.bird.x) {
        pg.scored = true;
        this.score++;
        this.scoreBadge.setText('' + this.score);
        // Quick pulse
        this.tweens.add({
          targets: this.scoreBadge.text,
          scale: 1.2,
          duration: 120,
          yoyo: true,
        });
      }

      // Cleanup
      if (px < -PIPE_WIDTH - 40) {
        pg.parts.forEach((p) => { if (p.active) p.destroy(); });
        pg.visuals.forEach((v) => { if (v.gfx.active) v.gfx.destroy(); });
        this.pipeGroups.splice(i, 1);
      }
    }
  }

  onGameOver() {
    if (this.isGameOver) return;
    this.isGameOver = true;

    this.sound.play('bird_hit', { volume: 0.6 });

    if (this.pipeTimer) this.pipeTimer.remove();

    this.pipeGroups.forEach((pg) => {
      pg.parts.forEach((p) => {
        if (p.active && p.body) p.body.setVelocityX(0);
      });
    });

    this.bird.body.allowGravity = false;
    this.bird.body.setVelocity(0, 0);

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
