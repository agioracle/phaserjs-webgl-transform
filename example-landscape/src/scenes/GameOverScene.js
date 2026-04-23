import Phaser from 'phaser';

/**
 * GameOverScene — shown at the end of a FlappyBird round.
 *
 * Launched from GameScene via:
 *   this.scene.start('GameOverScene', { score });
 *
 * Tap anywhere to return to MenuScene.
 */
export class GameOverScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameOverScene' });
  }

  init(data) {
    this.finalScore = (data && typeof data.score === 'number') ? data.score : 0;
  }

  create() {
    const W = this.cameras.main.width;   // 1334
    const H = this.cameras.main.height;  // 750

    // ── Dim overlay over GameScene's final frame ──
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.5).setDepth(0);

    // ── Game Over title ──
    this.add.text(W / 2, H * 0.32, 'Game Over', {
      fontSize: '64px',
      fontStyle: 'bold',
      color: '#ff4757',
      stroke: '#000000',
      strokeThickness: 5,
    }).setOrigin(0.5, 0.5).setDepth(10);

    // ── Final score ──
    this.add.text(W / 2, H * 0.50, 'Score: ' + this.finalScore, {
      fontSize: '44px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5, 0.5).setDepth(10);

    // ── Tap-to-return hint (pulsing) ──
    const hint = this.add.text(W / 2, H * 0.70, 'Tap to return to Menu', {
      fontSize: '30px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5, 0.5).setDepth(10);

    this.tweens.add({
      targets: hint,
      alpha: 0.3,
      duration: 600,
      yoyo: true,
      repeat: -1,
    });

    // ── Delay input slightly to avoid accidental taps carried over from GameScene ──
    this.time.delayedCall(500, () => {
      this.input.once('pointerdown', () => {
        this.scene.start('MenuScene');
      });
    });
  }
}
