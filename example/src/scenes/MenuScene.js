import Phaser from 'phaser';
import { getSafeArea } from '../utils/safe-area.js';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
  }

  preload() {
    // bgm is a remote asset — loaded from CDN via remote asset loader,
    // or from local assets/ if no CDN (new command rewrites the path)
    this.load.audio('bgm', 'remote-assets/audio/bgm.mp3');

    // Parallel: preload game-play subpackage
    this._gameReady = false;
    if (typeof wx !== 'undefined' && wx.loadSubpackage) {
      wx.loadSubpackage({
        name: 'game-play',
        success: () => {
          const { GameScene } = require('game-play/game-scene.js');
          this.scene.add('GameScene', GameScene, false);
          this._gameReady = true;
        },
        fail: (err) => {
          console.error('Failed to load game-play subpackage:', err);
        },
      });
    } else {
      // Fallback for non-WeChat environments
      this._gameReady = true;
    }
  }

  create() {
    const W = this.cameras.main.width;
    const H = this.cameras.main.height;
    const sa = getSafeArea(this);

    // Usable vertical range (between safe area insets)
    const saTop = sa.top;
    const saH = H - sa.top - sa.bottom;

    // Background music — start looping and persist across scenes
    if (!this.sound.get('bgm')) {
      this.sound.play('bgm', { loop: true, volume: 0.5 });
    }

    // Logo
    this.add.image(W / 2, saTop + saH * 0.15, 'game_logo').setOrigin(0.5, 0.5);

    // Title
    this.add.text(W / 2, saTop + saH * 0.28, 'Breakout', {
      fontSize: '52px',
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5, 0.5);

    // Description
    this.add.text(W / 2, saTop + saH * 0.40, 'Classic brick-breaking game\nSwipe to move paddle, break all bricks!', {
      fontSize: '24px',
      color: '#aaaaaa',
      align: 'center',
    }).setOrigin(0.5, 0.5);

    // Tap to Launch button
    const btn = this.add.text(W / 2, saTop + saH * 0.58, 'Tap to Launch', {
      fontSize: '36px',
      color: '#ffffff',
    }).setOrigin(0.5, 0.5).setAlpha(0.8);

    btn.setInteractive({ useHandCursor: true });

    btn.on('pointerdown', () => {
      if (this._gameReady) {
        this.scene.start('GameScene');
      } else {
        // Wait for game-play subpackage
        const waitAndStart = () => {
          if (this._gameReady) {
            this.scene.start('GameScene');
          } else {
            this.time.delayedCall(100, waitAndStart);
          }
        };
        waitAndStart();
      }
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
