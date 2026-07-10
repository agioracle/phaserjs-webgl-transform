import Phaser from 'phaser';
import { getSafeArea } from '../utils/safe-area.js';
import {
  drawPanel,
  createPillButton,
  casualText,
  PALETTE,
} from '../utils/casual-ui.js';

/**
 * GameOverScene — shown at the end of a round.
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

    // ── Dim overlay ──
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.45).setDepth(0);

    // ── Main result card ──
    const cardW = Math.min(W - 80, 620);
    const cardH = 580;
    const cardY = saTop + saH * 0.48;
    drawPanel(this, W / 2, cardY, cardW, cardH, {
      radius: 26,
    });

    // ── Title ribbon ──
    const ribbonColor = this.won ? PALETTE.success : PALETTE.danger;
    const ribbonDark = this.won ? PALETTE.successDark : PALETTE.dangerDark;
    const ribbonHi = this.won ? PALETTE.successHi : PALETTE.dangerHi;

    const ribbonY = cardY - cardH / 2 + 20;
    const ribbonW = cardW - 80;
    const ribbonH = 110;

    const ribbon = this.add.graphics();
    // shadow
    ribbon.fillStyle(0x000000, 0.35);
    ribbon.fillRoundedRect(W / 2 - ribbonW / 2 + 3, ribbonY - ribbonH / 2 + 5, ribbonW, ribbonH, 22);
    // dark edge
    ribbon.fillStyle(ribbonDark, 1);
    ribbon.fillRoundedRect(W / 2 - ribbonW / 2, ribbonY - ribbonH / 2, ribbonW, ribbonH, 22);
    // main
    ribbon.fillStyle(ribbonColor, 1);
    ribbon.fillRoundedRect(W / 2 - ribbonW / 2 + 3, ribbonY - ribbonH / 2 + 3, ribbonW - 6, ribbonH - 10, 20);
    // gloss
    ribbon.fillStyle(ribbonHi, 0.55);
    ribbon.fillRoundedRect(W / 2 - ribbonW / 2 + 10, ribbonY - ribbonH / 2 + 6, ribbonW - 20, ribbonH * 0.35, 16);

    const title = this.won ? 'YOU WIN!' : 'GAME OVER';
    casualText(this, W / 2, ribbonY, title, {
      fontSize: 64,
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 8,
    });

    // ── Vertical layout constants (avoid overlap between score / stars / button) ──
    // Content zone is the area inside the card below the ribbon.
    const ribbonBottom = ribbonY + ribbonH / 2;
    const cardBottom = cardY + cardH / 2;
    const btnH = 100;
    const btnBottomMargin = 36;                        // gap between button & card edge
    const btnY = cardBottom - btnBottomMargin - btnH / 2;
    const contentTop = ribbonBottom + 24;
    const contentBottom = btnY - btnH / 2 - 24;        // 24px gap above button
    const contentMid = (contentTop + contentBottom) / 2;

    // ── Score label ──
    casualText(this, W / 2, contentMid - 110, 'FINAL SCORE', {
      fontSize: 32,
      color: '#d08512',
      stroke: '#3d2a1a',
      strokeThickness: 4,
    });

    // ── Big score number ──
    const scoreNum = casualText(this, W / 2, contentMid - 20, String(this.finalScore), {
      fontSize: 128,
      color: '#3d2a1a',
      stroke: '#ffe89a',
      strokeThickness: 12,
    });
    // Pop-in animation
    scoreNum.setScale(0.2);
    this.tweens.add({
      targets: scoreNum,
      scale: 1,
      duration: 500,
      ease: 'Back.easeOut',
    });

    // ── Stars row (decorative on win, grayed on loss) ──
    const starY = contentBottom - 38; // star radius is 34, leaves ~4px cushion above button gap
    const starColor = this.won ? PALETTE.primary : 0xcfa98a;
    const starHi = this.won ? PALETTE.primaryHi : 0xe8d5c2;
    [-1, 0, 1].forEach((i, idx) => {
      const sx = W / 2 + i * 90;
      const g = this.add.graphics();
      g.x = sx;
      g.y = starY;
      this.drawStar(g, 30, starColor, starHi);
      if (this.won) {
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

    // ── Buttons ──
    createPillButton(this, W / 2, btnY, {
      w: cardW - 100,
      h: btnH,
      label: 'PLAY AGAIN',
      fontSize: 42,
      color: PALETTE.primary,
      colorDark: PALETTE.primaryDark,
      colorHi: PALETTE.primaryHi,
      textColor: PALETTE.textDark,
      onClick: () => this.goMenu(),
    });

    // Delay input slightly to avoid carry-over taps
    this._inputEnabled = false;
    this.time.delayedCall(300, () => { this._inputEnabled = true; });

    // Tap anywhere as fallback
    this.input.on('pointerdown', () => {
      if (this._inputEnabled) this.goMenu();
    });
  }

  drawStar(gfx, size, color, highlight) {
    gfx.clear();
    // dark outline
    gfx.fillStyle(0x000000, 0.4);
    this._starPath(gfx, 0, 2, size + 2);
    gfx.fillPath();
    // main
    gfx.fillStyle(color, 1);
    this._starPath(gfx, 0, 0, size);
    gfx.fillPath();
    // highlight
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
