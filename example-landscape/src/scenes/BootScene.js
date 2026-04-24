import Phaser from 'phaser';
import {
  drawCasualBackground,
  casualText,
  createProgressBar,
  PALETTE,
} from '../utils/casual-ui.js';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    const { width, height } = this.cameras.main;

    // --- Sky-colored casual gradient background ---
    drawCasualBackground(this, { top: 0x4bbfe8, bottom: 0x97e0ff });

    // --- Load game_logo (shown after loading) ---
    this.load.image('game_logo', 'remote-assets/images/game_logo.png');

    // --- Title ---
    casualText(this, width / 2, height * 0.34, 'FLAPPY BIRD', {
      fontSize: 84,
      color: '#ffffff',
      stroke: '#2d6b1e',
      strokeThickness: 10,
    });

    // --- Progress bar ---
    const barW = Math.min(width * 0.55, 700);
    const barH = 44;
    const barY = height * 0.66;
    this.progressBar = createProgressBar(this, width / 2, barY, barW, barH, {
      edge: 0x2d6b1e,
      fill: 0x1a4a1a,
      barColor: PALETTE.primary,
      barHi: PALETTE.primaryHi,
    });

    this.loadingText = casualText(this, width / 2, barY - 56, 'Loading...', {
      fontSize: 30,
      color: '#ffffff',
      stroke: '#2d6b1e',
      strokeThickness: 5,
    });

    this.load.on('progress', (value) => {
      this.progressBar.setProgress(value);
    });

    // --- Parallel: load menu subpackage ---
    this._menuReady = false;
    if (typeof wx !== 'undefined' && wx.loadSubpackage) {
      wx.loadSubpackage({
        name: 'menu',
        success: () => {
          if (!this.scene.get('MenuScene')) {
            const { MenuScene } = require('menu/menu-scene.js');
            this.scene.add('MenuScene', MenuScene, false);
          }
          this._menuReady = true;
        },
        fail: (err) => {
          console.error('Failed to load menu subpackage:', err);
        },
      });
    } else {
      this._menuReady = true;
    }
  }

  create() {
    const { width, height } = this.cameras.main;

    const logo = this.add.image(width / 2, height * 0.20, 'game_logo').setOrigin(0.5, 0.5);
    this.tweens.add({
      targets: logo,
      y: logo.y - 10,
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    const proceed = () => {
      if (this._menuReady) {
        this.scene.start('MenuScene');
      } else {
        this.time.delayedCall(100, proceed);
      }
    };

    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 1000,
      ease: 'Sine.easeInOut',
      onUpdate: (tw) => this.progressBar.setProgress(tw.getValue()),
      onComplete: () => {
        this.loadingText.setText('READY!');
        this.time.delayedCall(250, proceed);
      },
    });
  }
}
