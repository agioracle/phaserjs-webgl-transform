import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.js';

const config = {
  type: Phaser.WEBGL,
  width: 750,
  height: 1334,
  backgroundColor: '#1a1a2e',
  physics: {
    default: 'arcade',
    arcade: {
      debug: false,
      checkCollision: { up: true, down: true, left: true, right: true },
    },
  },
  scene: [BootScene], // Only BootScene in main bundle; other scenes loaded from subpackages
};

const game = new Phaser.Game(config);
