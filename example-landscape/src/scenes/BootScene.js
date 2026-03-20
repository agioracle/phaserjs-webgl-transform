import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    const { width, height } = this.cameras.main;

    // --- Load game_logo for display after loading ---
    this.load.image('game_logo', 'remote-assets/images/game_logo.png');

    // --- Title ---
    this.add.text(width / 2, height / 2 - 120, 'Flappy Bird', {
      fontSize: '56px',
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5, 0.5);

    // --- Progress bar ---
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

    // Show game logo above progress bar
    this.add.image(width / 2, height / 2 - 180, 'game_logo').setOrigin(0.5, 0.5);

    const proceed = () => {
      if (this._menuReady) {
        this.scene.start('MenuScene');
      } else {
        this.time.delayedCall(100, proceed);
      }
    };

    // Simulate a 1-second loading animation so the progress bar is visible
    this.tweens.add({
      targets: this.fillBar,
      width: this.barWidth,
      duration: 1000,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.loadingText.setText('Complete!');
        this.time.delayedCall(200, proceed);
      },
    });
  }
}
