import Phaser from 'phaser';
import { getSafeArea } from '../utils/safe-area.js';
import {
  drawCasualBackground,
  drawPanel,
  createBadge,
  PALETTE,
} from '../utils/casual-ui.js';

// Casual-game brick palette — saturated, high-contrast rows
const ROW_COLORS = [
  { fill: 0xff4d4d, dark: 0xa81f2a, hi: 0xffb3b3 }, // red
  { fill: 0xff8a3d, dark: 0xb24f16, hi: 0xffc89a }, // orange
  { fill: 0xffc23a, dark: 0xb27d0d, hi: 0xffe89a }, // yellow
  { fill: 0x5ad15a, dark: 0x2f8a2f, hi: 0xb5ee8e }, // green
  { fill: 0x3ea6ff, dark: 0x1b63c4, hi: 0x9cd6ff }, // blue
  { fill: 0xa86cff, dark: 0x5b2fb0, hi: 0xd8bcff }, // purple
];

// Matter velocity is expressed in pixels-per-step (~value * 60 = px/second at
// 60Hz), so these are roughly the old Arcade px/second values divided by 60.
const BALL_LAUNCH_VY = -8.5;   // upward launch speed  (~-510 px/s)
const BALL_LAUNCH_VX = 3.5;    // horizontal launch spread (±210 px/s)
const BALL_MAX_SPEED = 13;     // speed cap (~780 px/s)
const BALL_MIN_VY = 1.4;       // avoid near-horizontal trajectories (~84 px/s)

export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  preload() {
    this.load.image('ball', 'assets/images/ball.png');
    this.load.audio('ball_hit', 'assets/audio/ball_hit.mp3');

    this._gameOverReady = false;
    if (typeof tt !== 'undefined' && tt.loadSubpackage) {
      tt.loadSubpackage({
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
    const W = this.cameras.main.width;   // 750
    const H = this.cameras.main.height;  // 1334
    const sa = getSafeArea(this);

    this.safeArea = sa;

    // ── Casual background ──
    drawCasualBackground(this);

    // ── State ──
    this.score = 0;
    this.lives = 3;
    this.gameOver = false;
    this.waiting = false;

    // ── World bounds — left / right / top walls only; bottom is OPEN so a
    //    missed ball can fall out and cost a life (replaces Arcade's
    //    checkCollision.down = false). ──
    this.matter.world.setBounds(0, 0, W, H, 64, true, true, true, false);

    // ── Paddle — rounded casual look ──
    const paddleW = 170;
    const paddleH = 32;
    const paddleY = H - sa.bottom - 110;
    this.paddleY = paddleY;
    this.paddleHalfW = paddleW / 2;
    this.worldW = W;

    // Visual for paddle (rounded graphics)
    this.paddleGfx = this.add.graphics();
    this.drawPaddle(this.paddleGfx, paddleW, paddleH);

    // Physics body stays a simple rectangle for reliable collision. A static
    // Matter body still reflects the dynamic ball and is never pushed, while we
    // reposition it every pointer move to follow the finger.
    this.paddle = this.add.rectangle(W / 2, paddleY, paddleW, paddleH, 0x000000, 0);
    this.matter.add.gameObject(this.paddle, { isStatic: true });

    // ── Ball ──
    const ballY = paddleY - 30;
    this.ball = this.add.image(W / 2, ballY, 'ball');
    this.ball.setDisplaySize(32, 32);
    this.matter.add.gameObject(this.ball);
    // Circle body (radius 16 → 32px diameter), perfectly elastic and
    // frictionless so it keeps its speed exactly like the old Arcade ball.
    this.ball.setCircle(16, { restitution: 1, friction: 0, frictionAir: 0 });
    this.ball.setFixedRotation();

    // ── Bricks ──
    this.bricks = new Set();          // set of active brick GameObjects
    this.brickVisuals = new Map();    // brick GameObject -> Graphics
    this.buildBricks(W, sa.top);

    // ── HUD panel ──
    this.buildHud(W, sa);

    // ── Collisions — Matter has no per-pair collider callbacks, so listen to
    //    the world's collisionstart event and dispatch based on which body is
    //    the ball and what it hit. ──
    this.matter.world.on('collisionstart', this.handleCollision, this);

    // ── Input ──
    this.input.on('pointermove', (pointer) => {
      if (this.gameOver) return;
      const px = Phaser.Math.Clamp(pointer.x, this.paddleHalfW, this.worldW - this.paddleHalfW);
      this.paddle.setPosition(px, this.paddleY);
      if (this.waiting) this.ball.setPosition(this.paddle.x, this.ball.y);
    });

    this.input.on('pointerdown', (pointer) => {
      if (this.gameOver) return;
      if (this.waiting) {
        this.waiting = false;
        this.ball.setVelocity(Phaser.Math.FloatBetween(-BALL_LAUNCH_VX, BALL_LAUNCH_VX), BALL_LAUNCH_VY);
      }
      const px = Phaser.Math.Clamp(pointer.x, this.paddleHalfW, this.worldW - this.paddleHalfW);
      this.paddle.setPosition(px, this.paddleY);
    });

    // Launch ball immediately
    this.ball.setVelocity(Phaser.Math.FloatBetween(-BALL_LAUNCH_VX, BALL_LAUNCH_VX), BALL_LAUNCH_VY);
  }

  // ────────────────────────────────────────────
  // Collision dispatch
  // ────────────────────────────────────────────

  handleCollision(event) {
    if (this.gameOver) return;
    for (const pair of event.pairs) {
      const a = pair.bodyA.gameObject;
      const b = pair.bodyB.gameObject;
      // Figure out which side is the ball; the other side is what it hit.
      let other = null;
      if (a === this.ball) other = b;
      else if (b === this.ball) other = a;
      else continue; // neither body is the ball (e.g. wall pairs)

      if (other === this.paddle) {
        this.hitPaddle(this.ball, this.paddle);
      } else if (other && this.bricks.has(other)) {
        this.hitBrick(this.ball, other);
      }
    }
  }

  // ────────────────────────────────────────────
  // Visuals
  // ────────────────────────────────────────────

  drawPaddle(gfx, w, h) {
    gfx.clear();
    const radius = h / 2;
    // shadow
    gfx.fillStyle(0x000000, 0.4);
    gfx.fillRoundedRect(-w / 2 + 2, -h / 2 + 5, w, h, radius);
    // dark edge
    gfx.fillStyle(PALETTE.accentDark, 1);
    gfx.fillRoundedRect(-w / 2, -h / 2, w, h, radius);
    // main fill
    gfx.fillStyle(PALETTE.accent, 1);
    gfx.fillRoundedRect(-w / 2 + 2, -h / 2 + 2, w - 4, h - 6, radius - 2);
    // top gloss
    gfx.fillStyle(PALETTE.accentHi, 0.8);
    gfx.fillRoundedRect(-w / 2 + 10, -h / 2 + 4, w - 20, h * 0.35, radius - 4);
  }

  drawBrick(gfx, w, h, palette) {
    gfx.clear();
    const radius = 8;
    // shadow
    gfx.fillStyle(0x000000, 0.35);
    gfx.fillRoundedRect(-w / 2 + 2, -h / 2 + 3, w, h, radius);
    // dark edge
    gfx.fillStyle(palette.dark, 1);
    gfx.fillRoundedRect(-w / 2, -h / 2, w, h, radius);
    // main
    gfx.fillStyle(palette.fill, 1);
    gfx.fillRoundedRect(-w / 2 + 2, -h / 2 + 2, w - 4, h - 5, radius - 2);
    // top gloss
    gfx.fillStyle(palette.hi, 0.65);
    gfx.fillRoundedRect(-w / 2 + 6, -h / 2 + 4, w - 12, h * 0.38, radius - 3);
  }

  buildBricks(W, safeTop) {
    const cols = 7;
    const rows = ROW_COLORS.length;
    const brickW = 88;
    const brickH = 36;
    const padX = 10;
    const padY = 10;
    const totalW = cols * (brickW + padX) - padX;
    const startX = (W - totalW) / 2 + brickW / 2;
    const startY = safeTop + 190;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = startX + col * (brickW + padX);
        const y = startY + row * (brickH + padY);
        const palette = ROW_COLORS[row];

        // Physics body (invisible static rectangle)
        const brick = this.add.rectangle(x, y, brickW, brickH, 0x000000, 0);
        this.matter.add.gameObject(brick, { isStatic: true });
        brick.setData('points', (rows - row) * 10);
        this.bricks.add(brick);

        // Visual graphics overlay (attached at same x/y)
        const gfx = this.add.graphics();
        gfx.x = x;
        gfx.y = y;
        this.drawBrick(gfx, brickW, brickH, palette);
        this.brickVisuals.set(brick, gfx);
      }
    }
  }

  buildHud(W, sa) {
    const topY = sa.top + 80;

    // HUD background bar — slightly warm peach tint to stand out from the
    // cream sky background (panel default fill would be too close in tone).
    drawPanel(this, W / 2, topY, W - 40, 100, {
      radius: 24,
      fill: 0xffe2b8,
      edge: PALETTE.panelEdge,
      hi: PALETTE.panelHi,
    });

    // Score badge (yellow icon) — label + value on the SAME row
    this.scoreBadge = createBadge(this, W * 0.28, topY, {
      w: 280,
      h: 64,
      iconColor: PALETTE.primary,
      label: 'SCORE',
      text: '0',
      fontSize: 32,
    });

    // Lives badge (red icon) — label + value on the SAME row
    this.livesBadge = createBadge(this, W * 0.72, topY, {
      w: 280,
      h: 64,
      iconColor: PALETTE.danger,
      label: 'LIVES',
      text: '3',
      fontSize: 32,
    });
  }

  // ────────────────────────────────────────────
  // Collision callbacks
  // ────────────────────────────────────────────

  hitPaddle(ball, paddle) {
    // Pure Matter physics: the ball is perfectly elastic (restitution: 1) and
    // the paddle is a static body, so Matter reflects the ball off the paddle
    // by itself — exactly like the walls and bricks. We only play the sound and
    // do NOT override the velocity, so the bounce follows real reflection
    // (angle of incidence = angle of reflection).
    this.sound.play('ball_hit', { volume: 0.3 });
  }

  hitBrick(ball, brick) {
    this.sound.play('ball_hit', { volume: 0.3 });
    const points = brick.getData('points') || 10;
    this.score += points;
    this.scoreBadge.setText(String(this.score));

    // Pop effect on the visual
    const gfx = this.brickVisuals.get(brick);
    if (gfx) {
      this.tweens.add({
        targets: gfx,
        scale: 1.3,
        alpha: 0,
        duration: 150,
        onComplete: () => gfx.destroy(),
      });
      this.brickVisuals.delete(brick);
    }
    this.bricks.delete(brick);
    brick.destroy();

    // Speed up slightly
    const vx = ball.body.velocity.x;
    const vy = ball.body.velocity.y;
    ball.setVelocity(vx * 1.01, vy * 1.01);

    if (this.bricks.size === 0) {
      this.winGame();
    }
  }

  // ────────────────────────────────────────────
  // Game loop
  // ────────────────────────────────────────────

  update() {
    if (this.gameOver) return;

    // Sync paddle visual with its physics rect
    this.paddleGfx.x = this.paddle.x;
    this.paddleGfx.y = this.paddle.y;

    // Ball fell below screen
    if (this.ball.y > this.cameras.main.height + 20) {
      this.lives--;
      this.livesBadge.setText(String(Math.max(0, this.lives)));

      if (this.lives <= 0) {
        this.loseGame();
      } else {
        this.resetBall();
      }
    }

    // Cap the ball speed (Matter has no setMaxVelocity, so clamp manually)
    const v = this.ball.body.velocity;
    const sp = Math.sqrt(v.x * v.x + v.y * v.y);
    if (sp > BALL_MAX_SPEED) {
      const k = BALL_MAX_SPEED / sp;
      this.ball.setVelocity(v.x * k, v.y * k);
    }

    // Prevent ball from going purely horizontal
    if (!this.waiting && Math.abs(this.ball.body.velocity.y) < BALL_MIN_VY) {
      this.ball.setVelocityY(this.ball.body.velocity.y < 0 ? -BALL_MIN_VY : BALL_MIN_VY);
    }
  }

  resetBall() {
    this.waiting = true;
    this.ball.setPosition(this.paddle.x, this.paddle.y - 30);
    this.ball.setVelocity(0, 0);
  }

  winGame() {
    this.endRound(true);
  }

  loseGame() {
    this.endRound(false);
  }

  endRound(won) {
    this.gameOver = true;
    this.ball.setVelocity(0, 0);

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
