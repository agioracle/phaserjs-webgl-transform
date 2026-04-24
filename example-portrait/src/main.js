import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.js';

// In browser (H5) the canvas must be fit to the viewport so that
// Phaser's pointer coordinates stay in sync with CSS pixels; otherwise
// clicks land on an offset area (top-left sliver) of the visible canvas.
// In WeChat mini-game the canvas is managed by the platform, so use NONE.
const isWxGame = typeof wx !== 'undefined' && typeof wx.getSystemInfoSync === 'function';

const config = {
  type: Phaser.WEBGL,
  width: 750,
  height: 1334,
  backgroundColor: '#fff3d9',
  scale: isWxGame
    ? { mode: Phaser.Scale.NONE, autoCenter: Phaser.Scale.NO_CENTER }
    : {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: 750,
        height: 1334,
      },
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
