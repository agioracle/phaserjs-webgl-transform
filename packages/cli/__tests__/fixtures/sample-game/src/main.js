import Phaser from 'phaser';

class MainScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MainScene' });
  }

  preload() {
    this.load.image('logo', 'images/logo.png');
    this.load.audio('bgm', 'audio/bgm.mp3');
  }

  create() {
    this.add.image(400, 300, 'logo');
  }
}

const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  scene: MainScene,
};

const game = new Phaser.Game(config);
