import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    // --- Progress bar ---
    const { width, height } = this.cameras.main;
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

    // --- Load your assets here ---
    // Local assets (from public/assets/)
    this.load.image('ball', 'assets/images/ball.png');
    this.load.audio('ball_hit', 'assets/audio/ball_hit.mp3');

    // Remote assets (from public/remote-assets/, loaded via CDN at runtime)
    this.load.image('game_logo', 'remote-assets/images/game_logo.png');
    this.load.audio('bgm', 'remote-assets/audio/bgm.mp3');
  }

  create() {
    // Simulate a 1-second loading animation so the progress bar is visible
    this.tweens.add({
      targets: this.fillBar,
      width: this.barWidth,
      duration: 1000,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.loadingText.setText('Complete!');
        this.time.delayedCall(200, () => {
          this.scene.start('MenuScene');
        });
      },
    });
  }
}
