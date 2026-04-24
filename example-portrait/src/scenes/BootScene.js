import Phaser from 'phaser';
import {
  drawCasualBackground,
  casualText,
  createProgressBar,
} from '../utils/casual-ui.js';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    const { width, height } = this.cameras.main;

    // --- Casual-style background ---
    drawCasualBackground(this);

    // --- Logo (loaded here, shown in create) ---
    this.load.image('game_logo', 'remote-assets/images/game_logo.png');

    // --- Title (shows even before the logo arrives) ---
    casualText(this, width / 2, height * 0.32, 'BREAKOUT', {
      fontSize: 88,
      color: '#3d2a1a',
      stroke: '#ffc890',
      strokeThickness: 10,
    });

    // --- Progress bar ---
    const barW = Math.min(width * 0.72, 600);
    const barH = 44;
    const barY = height * 0.62;
    this.progressBar = createProgressBar(this, width / 2, barY, barW, barH);

    this.loadingText = casualText(this, width / 2, barY - 56, 'Loading...', {
      fontSize: 30,
      color: '#6b4a2b',
      stroke: '#ffffff',
      strokeThickness: 4,
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

    // Logo above the title
    const logo = this.add.image(width / 2, height * 0.18, 'game_logo').setOrigin(0.5, 0.5);
    // Gentle bob
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

    // Animate the bar to full in ~1s so the UI feels alive
    let fakeProgress = 0;
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 1000,
      ease: 'Sine.easeInOut',
      onUpdate: (tw) => {
        fakeProgress = tw.getValue();
        this.progressBar.setProgress(fakeProgress);
      },
      onComplete: () => {
        this.loadingText.setText('READY!');
        this.time.delayedCall(250, proceed);
      },
    });
  }
}
