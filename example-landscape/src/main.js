import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.js';

const config = {
  type: Phaser.WEBGL,
  width: 1334,
  height: 750,
  backgroundColor: '#70c5ce',
  physics: {
    default: 'arcade',
    arcade: {
      debug: false,
      gravity: { y: 1200 },
      checkCollision: { up: true, down: true, left: true, right: true },
    },
  },
  scene: [BootScene], // Only BootScene in main bundle; other scenes loaded from subpackages
};

const game = new Phaser.Game(config);
