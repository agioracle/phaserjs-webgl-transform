import Phaser from 'phaser';
import {
  drawPanel,
  createPillButton,
  casualText,
  PALETTE,
} from '../utils/casual-ui.js';

/**
 * GameOverScene — shown at the end of a FlappyBird round.
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

    // Dim overlay
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.45).setDepth(0);

    // Main card
    const cardW = 640;
    const cardH = 520;
    const cardY = H / 2;
    drawPanel(this, W / 2, cardY, cardW, cardH, { radius: 28 });

    // Title ribbon
    const ribbonY = cardY - cardH / 2 + 15;
    const ribbonW = cardW - 80;
    const ribbonH = 100;
    const ribbon = this.add.graphics();
    ribbon.fillStyle(0x000000, 0.35);
    ribbon.fillRoundedRect(W / 2 - ribbonW / 2 + 3, ribbonY - ribbonH / 2 + 5, ribbonW, ribbonH, 22);
    ribbon.fillStyle(PALETTE.dangerDark, 1);
    ribbon.fillRoundedRect(W / 2 - ribbonW / 2, ribbonY - ribbonH / 2, ribbonW, ribbonH, 22);
    ribbon.fillStyle(PALETTE.danger, 1);
    ribbon.fillRoundedRect(W / 2 - ribbonW / 2 + 3, ribbonY - ribbonH / 2 + 3, ribbonW - 6, ribbonH - 10, 20);
    ribbon.fillStyle(PALETTE.dangerHi, 0.55);
    ribbon.fillRoundedRect(W / 2 - ribbonW / 2 + 10, ribbonY - ribbonH / 2 + 6, ribbonW - 20, ribbonH * 0.35, 16);

    casualText(this, W / 2, ribbonY, 'GAME OVER', {
      fontSize: 58,
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 7,
    });

    // ── Vertical layout constants (avoid overlap between score / stars / button) ──
    const ribbonBottom = ribbonY + ribbonH / 2;
    const cardBottom = cardY + cardH / 2;
    const btnH = 92;
    const btnBottomMargin = 32;
    const btnY = cardBottom - btnBottomMargin - btnH / 2;
    const contentTop = ribbonBottom + 20;
    const contentBottom = btnY - btnH / 2 - 22;
    const contentMid = (contentTop + contentBottom) / 2;

    // Score label
    casualText(this, W / 2, contentMid - 90, 'YOUR SCORE', {
      fontSize: 28,
      color: '#d08512',
      stroke: '#3d2a1a',
      strokeThickness: 3,
    });

    // Big score
    const scoreNum = casualText(this, W / 2, contentMid - 10, String(this.finalScore), {
      fontSize: 110,
      color: '#3d2a1a',
      stroke: '#ffe89a',
      strokeThickness: 10,
    });
    scoreNum.setScale(0.2);
    this.tweens.add({
      targets: scoreNum,
      scale: 1,
      duration: 500,
      ease: 'Back.easeOut',
    });

    // Stars row (based on score)
    const starY = contentBottom - 34;
    const earned = Math.min(3, Math.floor(this.finalScore / 5)); // cheap tier: every 5 pts = 1 star
    [-1, 0, 1].forEach((i, idx) => {
      const sx = W / 2 + i * 90;
      const active = idx < earned;
      const color = active ? PALETTE.primary : 0xcfa98a;
      const hi = active ? PALETTE.primaryHi : 0xe8d5c2;
      const g = this.add.graphics();
      g.x = sx;
      g.y = starY;
      this.drawStar(g, 28, color, hi);
      if (active) {
        g.setScale(0.2);
        this.tweens.add({
          targets: g,
          scale: 1,
          delay: 200 + idx * 150,
          duration: 350,
          ease: 'Back.easeOut',
        });
      }
    });

    // Play again button
    createPillButton(this, W / 2, btnY, {
      w: cardW - 120,
      h: btnH,
      label: 'PLAY AGAIN',
      fontSize: 42,
      color: PALETTE.primary,
      colorDark: PALETTE.primaryDark,
      colorHi: PALETTE.primaryHi,
      textColor: PALETTE.textDark,
      onClick: () => this.goMenu(),
    });

    // Tap anywhere as fallback (after a small delay)
    this._inputEnabled = false;
    this.time.delayedCall(500, () => { this._inputEnabled = true; });
    this.input.on('pointerdown', () => {
      if (this._inputEnabled) this.goMenu();
    });
  }

  drawStar(gfx, size, color, highlight) {
    gfx.clear();
    gfx.fillStyle(0x000000, 0.4);
    this._starPath(gfx, 0, 2, size + 2);
    gfx.fillPath();
    gfx.fillStyle(color, 1);
    this._starPath(gfx, 0, 0, size);
    gfx.fillPath();
    gfx.fillStyle(highlight, 0.7);
    this._starPath(gfx, -size * 0.15, -size * 0.2, size * 0.55);
    gfx.fillPath();
  }

  _starPath(gfx, cx, cy, r) {
    const points = 5;
    const inner = r * 0.45;
    gfx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const angle = (Math.PI / points) * i - Math.PI / 2;
      const rr = i % 2 === 0 ? r : inner;
      const x = cx + Math.cos(angle) * rr;
      const y = cy + Math.sin(angle) * rr;
      if (i === 0) gfx.moveTo(x, y);
      else gfx.lineTo(x, y);
    }
    gfx.closePath();
  }

  goMenu() {
    this.scene.start('MenuScene');
  }
}
