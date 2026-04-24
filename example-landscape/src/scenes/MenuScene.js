import Phaser from 'phaser';
import { getSafeArea } from '../utils/safe-area.js';
import {
  drawCasualBackground,
  drawPanel,
  createPillButton,
  casualText,
  PALETTE,
} from '../utils/casual-ui.js';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
  }

  preload() {
    this.load.audio('bgm', 'remote-assets/audio/bgm.mp3');

    this._gameReady = false;
    if (typeof wx !== 'undefined' && wx.loadSubpackage) {
      wx.loadSubpackage({
        name: 'game-play',
        success: () => {
          if (!this.scene.get('GameScene')) {
            const { GameScene } = require('game-play/game-scene.js');
            this.scene.add('GameScene', GameScene, false);
          }
          this._gameReady = true;
        },
        fail: (err) => {
          console.error('Failed to load game-play subpackage:', err);
        },
      });
    } else {
      this._gameReady = true;
    }
  }

  create() {
    const W = this.cameras.main.width;   // 1334
    const H = this.cameras.main.height;  // 750
    const sa = getSafeArea(this);

    // --- Sky gradient background ---
    drawCasualBackground(this, { top: 0x4bbfe8, bottom: 0x97e0ff });

    // --- Decorative clouds ---
    this.drawClouds(W, H);

    // --- Ground strip at the bottom ---
    this.drawGround(W, H);

    // --- Bird bobbing ---
    const bird = this.add.image(W / 2, H * 0.46, 'game_logo').setOrigin(0.5, 0.5);
    this.tweens.add({
      targets: bird,
      y: bird.y - 20,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // --- BGM ---
    if (!this.sound.get('bgm')) {
      this.sound.play('bgm', { loop: true, volume: 0.5 });
    }

    // --- Title plate (rounded panel behind text) ---
    const titleY = sa.top + 80;
    drawPanel(this, W / 2, titleY, 520, 120, {
      radius: 24,
      fill: 0x0b1a3e,
      edge: 0x2d6b1e,
      hi: 0x5ad15a,
    });
    casualText(this, W / 2, titleY - 4, 'FLAPPY BIRD', {
      fontSize: 64,
      color: '#ffffff',
      stroke: '#2d6b1e',
      strokeThickness: 8,
    });

    // --- Hint card under the bird ---
    const hintY = H * 0.70;
    drawPanel(this, W / 2, hintY, 560, 90, {
      radius: 18,
      fill: 0x0b1a3e,
      edge: 0x1b3a7a,
      hi: 0x3a68c2,
    });
    this.add.text(W / 2, hintY, 'Tap to flap. Avoid the pipes!', {
      fontSize: '30px',
      fontStyle: 'bold',
      color: PALETTE.textSub,
    }).setOrigin(0.5, 0.5);

    // --- PLAY button (yellow) ---
    createPillButton(this, W / 2, H * 0.88, {
      w: 380,
      h: 100,
      label: 'PLAY',
      fontSize: 48,
      color: PALETTE.primary,
      colorDark: PALETTE.primaryDark,
      colorHi: PALETTE.primaryHi,
      textColor: PALETTE.textDark,
      onClick: () => this.startGame(),
    });
  }

  drawClouds(W, H) {
    const gfx = this.add.graphics();
    gfx.setDepth(-500);
    const seed = Phaser.Math.RND;
    for (let i = 0; i < 6; i++) {
      const x = seed.between(60, W - 60);
      const y = seed.between(40, H * 0.5);
      const r = seed.between(24, 44);
      gfx.fillStyle(0xffffff, 0.55);
      gfx.fillCircle(x, y, r);
      gfx.fillCircle(x + r * 0.8, y + 4, r * 0.85);
      gfx.fillCircle(x - r * 0.8, y + 6, r * 0.75);
      gfx.fillCircle(x + r * 0.2, y - r * 0.5, r * 0.7);
    }
  }

  drawGround(W, H) {
    const groundH = 80;
    const top = H - groundH;
    const gfx = this.add.graphics();
    gfx.setDepth(-100);
    // green strip (grass)
    gfx.fillStyle(0x5ad15a, 1);
    gfx.fillRect(0, top, W, 22);
    gfx.fillStyle(0x2d6b1e, 1);
    gfx.fillRect(0, top + 20, W, 6);
    // sand base
    gfx.fillStyle(0xfde49e, 1);
    gfx.fillRect(0, top + 26, W, groundH - 26);
    // decorative dashes
    gfx.fillStyle(0xf0ca74, 1);
    for (let x = 0; x < W; x += 80) {
      gfx.fillRect(x + 10, top + 42, 40, 4);
      gfx.fillRect(x + 30, top + 58, 40, 4);
    }
  }

  startGame() {
    if (this._gameReady) {
      this.scene.start('GameScene');
    } else {
      const waitAndStart = () => {
        if (this._gameReady) {
          this.scene.start('GameScene');
        } else {
          this.time.delayedCall(100, waitAndStart);
        }
      };
      waitAndStart();
    }
  }
}
