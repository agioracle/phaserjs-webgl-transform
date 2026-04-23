import Phaser from 'phaser';
import { getSafeArea } from '../utils/safe-area.js';

/**
 * GameOverScene — shown at the end of a round.
 *
 * Launched from GameScene via:
 *   this.scene.start('GameOverScene', { score, won });
 *
 * Tap anywhere to return to MenuScene.
 */
export class GameOverScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameOverScene' });
  }

  init(data) {
    this.finalScore = (data && typeof data.score === 'number') ? data.score : 0;
    this.won = !!(data && data.won);
  }

  create() {
    const W = this.cameras.main.width;
    const H = this.cameras.main.height;
    const sa = getSafeArea(this);
    const saTop = sa.top;
    const saH = H - sa.top - sa.bottom;

    // ── Dim overlay (keeps GameScene's final frame visible behind if we ever want it) ──
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.55).setDepth(0);

    // ── Result title ──
    const title = this.won ? 'YOU WIN!' : 'GAME OVER';
    const titleColor = this.won ? '#2ed573' : '#ff4757';
    this.add.text(W / 2, saTop + saH * 0.35, title, {
      fontSize: '64px',
      fontStyle: 'bold',
      color: titleColor,
    }).setOrigin(0.5, 0.5).setDepth(10);

    // ── Final score ──
    const scoreLabel = this.won ? 'Final Score: ' : 'Score: ';
    this.add.text(W / 2, saTop + saH * 0.48, scoreLabel + this.finalScore, {
      fontSize: '36px',
      color: '#ffffff',
    }).setOrigin(0.5, 0.5).setDepth(10);

    // ── Tap-to-return hint (pulsing) ──
    const hint = this.add.text(W / 2, saTop + saH * 0.62, 'Tap to return to Menu', {
      fontSize: '28px',
      color: '#ffffff',
    }).setOrigin(0.5, 0.5).setAlpha(0.8).setDepth(10);

    this.tweens.add({
      targets: hint,
      alpha: 0.3,
      duration: 700,
      yoyo: true,
      repeat: -1,
    });

    // ── Delay input slightly to avoid accidental taps carried over from GameScene ──
    this.time.delayedCall(300, () => {
      this.input.once('pointerdown', () => {
        this.scene.start('MenuScene');
      });
    });
  }
}
