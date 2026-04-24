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

    // Parallel: preload game-play subpackage
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
    const W = this.cameras.main.width;
    const H = this.cameras.main.height;
    const sa = getSafeArea(this);

    const saTop = sa.top;
    const saH = H - sa.top - sa.bottom;

    // --- Casual navy-gradient background ---
    drawCasualBackground(this);

    // --- BGM ---
    if (!this.sound.get('bgm')) {
      this.sound.play('bgm', { loop: true, volume: 0.5 });
    }

    // --- Decorative floating bricks behind the panel ---
    this.drawDecorativeBricks(W, H);

    // --- Game logo ---
    const logo = this.add.image(W / 2, saTop + saH * 0.10, 'game_logo')
      .setOrigin(0.5, 0.5);
    this.tweens.add({
      targets: logo,
      y: logo.y - 8,
      duration: 1400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // --- Title ---
    casualText(this, W / 2, saTop + saH * 0.24, 'BREAKOUT', {
      fontSize: 100,
      color: PALETTE.textLight,
      stroke: '#000000',
      strokeThickness: 12,
    });
    casualText(this, W / 2, saTop + saH * 0.31, 'CLASSIC EDITION', {
      fontSize: 32,
      color: '#ffe89a',
      stroke: '#000000',
      strokeThickness: 5,
    });

    // --- Info panel ---
    const panelW = Math.min(W - 80, 620);
    const panelH = 260;
    const panelY = saTop + saH * 0.50;
    drawPanel(this, W / 2, panelY, panelW, panelH);

    casualText(this, W / 2, panelY - 80, 'HOW TO PLAY', {
      fontSize: 36,
      color: '#ffc23a',
      stroke: '#000000',
      strokeThickness: 5,
    });

    this.add.text(W / 2, panelY, 'Swipe or tap to move the paddle.\nBreak every brick to win!', {
      fontSize: '28px',
      color: PALETTE.textSub,
      align: 'center',
      lineSpacing: 8,
    }).setOrigin(0.5, 0.5);

    // --- PLAY button (yellow, primary) ---
    createPillButton(this, W / 2, saTop + saH * 0.76, {
      w: 440,
      h: 120,
      label: 'PLAY',
      fontSize: 54,
      color: PALETTE.primary,
      colorDark: PALETTE.primaryDark,
      colorHi: PALETTE.primaryHi,
      textColor: PALETTE.textDark,
      onClick: () => this.startGame(),
    });

    // --- Subtle "tap to start" hint underneath (pure decoration, blinking) ---
    const hint = this.add.text(W / 2, saTop + saH * 0.88, 'TAP TO START', {
      fontSize: '26px',
      fontStyle: 'bold',
      color: '#9cd6ff',
      stroke: '#0b1a3e',
      strokeThickness: 4,
      letterSpacing: 2,
    }).setOrigin(0.5, 0.5);
    this.tweens.add({
      targets: hint,
      alpha: 0.25,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  drawDecorativeBricks(W, H) {
    // A light scatter of translucent rounded bricks for atmosphere
    const colors = [0xff4d4d, 0xffc23a, 0x5ad15a, 0x3ea6ff, 0xa86cff];
    const gfx = this.add.graphics();
    gfx.setDepth(-500);
    const seed = Phaser.Math.RND;
    for (let i = 0; i < 14; i++) {
      const x = seed.between(30, W - 30);
      const y = seed.between(30, H - 30);
      const bw = seed.between(60, 100);
      const bh = 28;
      const c = colors[i % colors.length];
      gfx.fillStyle(c, 0.12);
      gfx.fillRoundedRect(x - bw / 2, y - bh / 2, bw, bh, 8);
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
