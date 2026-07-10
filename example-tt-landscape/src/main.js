import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.js';

// In browser (H5) the canvas must be fit to the viewport so that
// Phaser's pointer coordinates stay in sync with CSS pixels; otherwise
// clicks land on an offset area (top-left sliver) of the visible canvas.
// In WeChat mini-game the canvas is managed by the platform, so use NONE.
const isTtGame = typeof tt !== 'undefined' && typeof tt.getSystemInfoSync === 'function';

const config = {
  type: Phaser.WEBGL,
  width: 1334,
  height: 750,
  backgroundColor: '#8fd9ff',
  scale: isTtGame
    ? { mode: Phaser.Scale.NONE, autoCenter: Phaser.Scale.NO_CENTER }
    : {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: 1334,
        height: 750,
      },
  physics: {
    default: 'matter',
    matter: {
      // World gravity is kept at zero; the bird's fall is integrated manually
      // in GameScene.update() (in px/step units) so the Flappy-Bird feel maps
      // 1:1 to the old Arcade tuning and stays fully under our control.
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  scene: [BootScene], // Only BootScene in main bundle; other scenes loaded from subpackages
};

const game = new Phaser.Game(config);
