import Phaser from 'phaser';
import { getSafeArea } from '../utils/safe-area.js';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
  }

  preload() {
    // bgm is a remote asset
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
    const W = this.cameras.main.width;   // 1334
    const H = this.cameras.main.height;  // 750
    const sa = getSafeArea(this);

    // --- Sky gradient background ---
    const skyGfx = this.add.graphics();
    const skyColors = [0x4ec0ca, 0x70c5ce, 0x87ceeb, 0xa8d8ea];
    const bandH = H / skyColors.length;
    for (let i = 0; i < skyColors.length; i++) {
      skyGfx.fillStyle(skyColors[i], 1);
      skyGfx.fillRect(0, i * bandH, W, bandH + 1);
    }

    // --- Ground decoration at bottom ---
    const groundGfx = this.add.graphics();
    groundGfx.fillStyle(0xded895, 1);
    groundGfx.fillRect(0, H - 80, W, 80);
    groundGfx.fillStyle(0x54b435, 1);
    groundGfx.fillRect(0, H - 80, W, 16);

    // --- Decorative bird (using game_logo image) ---
    const birdImg = this.add.image(W / 2, H * 0.42, 'game_logo');
    birdImg.setOrigin(0.5, 0.5);

    // Float bird up and down
    this.tweens.add({
      targets: birdImg,
      y: birdImg.y - 20,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // --- Background music ---
    if (!this.sound.get('bgm')) {
      this.sound.play('bgm', { loop: true, volume: 0.5 });
    }

    // --- Title ---
    this.add.text(W / 2, sa.top + 80, 'Flappy Bird', {
      fontSize: '64px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#2e7d32',
      strokeThickness: 6,
    }).setOrigin(0.5, 0.5);

    // --- Tap to Play button ---
    const btn = this.add.text(W / 2, H * 0.72, 'Tap to Play', {
      fontSize: '40px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5, 0.5).setAlpha(0.9);

    btn.setInteractive({ useHandCursor: true });

    btn.on('pointerdown', () => {
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
    });

    // Pulsing animation
    this.tweens.add({
      targets: btn,
      alpha: 0.4,
      duration: 800,
      yoyo: true,
      repeat: -1,
    });
  }
}
