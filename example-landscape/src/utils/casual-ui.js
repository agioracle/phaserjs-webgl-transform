/**
 * Casual-game UI toolkit
 *
 * Reusable helpers that render juicy, mobile-casual-looking UI elements
 * (deep-blue gradient backgrounds, chunky pill buttons with drop shadow,
 * rounded card panels, badges) with Phaser Graphics only — no extra
 * assets required.
 *
 * Palette is tuned to match the reference hero-screen mock (deep navy
 * background + saturated primary/accent colors with white bevel highlight).
 */

// ────────────────────────────────────────────────
// Palette
// ────────────────────────────────────────────────
export const PALETTE = {
  // Background (deep gradient navy)
  bgTop:      0x0f2252,
  bgBottom:   0x1f4aa0,

  // Panel / card
  panelFill:  0x0b1a3e,
  panelEdge:  0x1b3a7a,
  panelHi:    0x3a68c2,

  // Primary action (warm yellow/orange — BATTLE button in mock)
  primary:     0xffc23a,
  primaryDark: 0xd08512,
  primaryHi:   0xffe89a,

  // Secondary action (cyan / sky blue — STAGE button in mock)
  accent:      0x3ea6ff,
  accentDark:  0x1b63c4,
  accentHi:    0x9cd6ff,

  // Success (green — Lv upgrade button)
  success:     0x5ad15a,
  successDark: 0x2f8a2f,
  successHi:   0xb5ee8e,

  // Danger (red badges)
  danger:      0xff4d4d,
  dangerDark:  0xb21f2a,
  dangerHi:    0xffb3b3,

  // Text
  textLight:   '#ffffff',
  textSub:     '#bcd2ff',
  textDark:    '#0b1a3e',
  textStroke:  '#0b1a3e',
};

// ────────────────────────────────────────────────
// Background
// ────────────────────────────────────────────────

/**
 * Draw a vertical gradient background filling the whole camera.
 * Also sprinkles faint star-like dots so it doesn't look flat.
 */
export function drawCasualBackground(scene, opts = {}) {
  const W = scene.cameras.main.width;
  const H = scene.cameras.main.height;
  const top = opts.top || PALETTE.bgTop;
  const bottom = opts.bottom || PALETTE.bgBottom;

  const gfx = scene.add.graphics();
  gfx.setDepth(-1000);

  // Gradient via thin horizontal strips
  const steps = 48;
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const c = Phaser.Display.Color.Interpolate.ColorWithColor(
      Phaser.Display.Color.IntegerToColor(top),
      Phaser.Display.Color.IntegerToColor(bottom),
      1,
      t
    );
    const color = Phaser.Display.Color.GetColor(c.r, c.g, c.b);
    gfx.fillStyle(color, 1);
    gfx.fillRect(0, Math.floor(i * H / steps), W, Math.ceil(H / steps) + 1);
  }

  // Sparkle dots (very subtle)
  gfx.fillStyle(0xffffff, 0.12);
  const seedRng = Phaser.Math.RND;
  for (let i = 0; i < 40; i++) {
    const x = seedRng.between(0, W);
    const y = seedRng.between(0, H);
    const r = seedRng.between(1, 2);
    gfx.fillCircle(x, y, r);
  }

  return gfx;
}

// ────────────────────────────────────────────────
// Card panel (rounded rectangle with bevel edges)
// ────────────────────────────────────────────────

/**
 * Draw a rounded card panel. Returns the Graphics object.
 * Layers (back → front):
 *   1. drop shadow
 *   2. outer dark edge
 *   3. main fill
 *   4. inner highlight stroke
 */
export function drawPanel(scene, x, y, w, h, opts = {}) {
  const radius = opts.radius ?? 18;
  const fill = opts.fill ?? PALETTE.panelFill;
  const edge = opts.edge ?? PALETTE.panelEdge;
  const hi = opts.hi ?? PALETTE.panelHi;
  const shadowAlpha = opts.shadowAlpha ?? 0.35;

  const gfx = scene.add.graphics();
  // shadow
  gfx.fillStyle(0x000000, shadowAlpha);
  gfx.fillRoundedRect(x - w / 2 + 3, y - h / 2 + 6, w, h, radius);
  // outer edge
  gfx.fillStyle(edge, 1);
  gfx.fillRoundedRect(x - w / 2, y - h / 2, w, h, radius);
  // main fill
  gfx.fillStyle(fill, 1);
  gfx.fillRoundedRect(x - w / 2 + 3, y - h / 2 + 3, w - 6, h - 6, radius - 3);
  // inner highlight stroke (top-only feel)
  gfx.lineStyle(2, hi, 0.9);
  gfx.strokeRoundedRect(x - w / 2 + 3, y - h / 2 + 3, w - 6, h - 6, radius - 3);

  return gfx;
}

// ────────────────────────────────────────────────
// Pill button (chunky casual-style with bevel & drop shadow)
// ────────────────────────────────────────────────

/**
 * Create an interactive chunky pill button.
 *
 * Returns an object: { container, label, setEnabled(bool), setTint(color) }
 * The container emits 'pointerdown' for convenience via onClick.
 *
 * opts:
 *   w, h        : size
 *   label       : string text
 *   fontSize    : number (default 40)
 *   color       : main fill (PALETTE.primary etc.)
 *   colorDark   : bottom edge color
 *   colorHi     : top highlight color
 *   textColor   : css color (default dark on warm buttons)
 *   onClick     : fn
 */
export function createPillButton(scene, x, y, opts = {}) {
  const w = opts.w ?? 340;
  const h = opts.h ?? 96;
  const color = opts.color ?? PALETTE.primary;
  const colorDark = opts.colorDark ?? PALETTE.primaryDark;
  const colorHi = opts.colorHi ?? PALETTE.primaryHi;
  const textColor = opts.textColor ?? PALETTE.textDark;
  const fontSize = opts.fontSize ?? 40;
  const label = opts.label ?? '';

  const container = scene.add.container(x, y);

  // NOTE: use scene.make.graphics({ add: false }) so the Graphics object
  // is NOT added to the scene display list; it is owned solely by the
  // container. Using scene.add.graphics() would cause the graphics to be
  // rendered twice — once at scene-root (0,0) and once transformed by the
  // container — which manifests as a duplicated/mis-aligned "ghost" shape.
  const gfx = scene.make.graphics({ x: 0, y: 0, add: false });

  // Geometry — every layer is sized from the SAME w/h/radius reference so
  // the visual stack stays perfectly nested. Using rounded-rect radius
  // larger than half of the shortest side causes Phaser's rounded-rect
  // renderer to fall back to unexpected shapes, so we always clamp.
  const pillRadius = Math.min(w, h) / 2;
  const mainW = w - 4;
  const mainH = h - 10; // leaves 6px of dark edge at the bottom for bevel
  const mainRadius = Math.min(mainW, mainH) / 2;

  // Drop shadow (slightly offset down-right)
  gfx.fillStyle(0x000000, 0.35);
  gfx.fillRoundedRect(-w / 2 + 4, -h / 2 + 8, w, h, pillRadius);

  // Dark edge (bottom bevel)
  gfx.fillStyle(colorDark, 1);
  gfx.fillRoundedRect(-w / 2, -h / 2, w, h, pillRadius);

  // Main fill, inset by 2px around and 6px at the bottom to reveal the bevel
  gfx.fillStyle(color, 1);
  gfx.fillRoundedRect(-w / 2 + 2, -h / 2 + 2, mainW, mainH, mainRadius);

  // Top glossy highlight — a shallow ellipse sitting on the upper half of
  // the main fill. Using fillEllipse guarantees a clean curved shape that
  // never depends on rounded-rect radius clamping, so it won't bleed past
  // the button edge regardless of button aspect ratio.
  const hlW = mainW - 20;
  const hlH = Math.max(8, mainH * 0.42);
  const hlCenterY = -h / 2 + 2 + hlH / 2 + 4; // 4px down from the top fill edge
  gfx.fillStyle(colorHi, 0.65);
  gfx.fillEllipse(0, hlCenterY, hlW, hlH);

  container.add(gfx);

  const text = scene.add.text(0, -2, label, {
    fontSize: `${fontSize}px`,
    fontStyle: 'bold',
    color: textColor,
    stroke: '#000000',
    strokeThickness: textColor === '#ffffff' ? 4 : 0,
  }).setOrigin(0.5, 0.5);
  container.add(text);

  // Hit area — use an invisible Zone child as the interactive target.
  // Zone is a pure hit-test object: it ignores rendering entirely and its
  // hit bounds are independent from any Graphics / Text children, which
  // makes clicks reliable regardless of how the container is scaled or
  // tween-animated. A small padding is added so taps slightly outside the
  // visual edge still register, matching casual-game expectations.
  const hitPadX = opts.hitPadX ?? 12;
  const hitPadY = opts.hitPadY ?? 12;
  const hitW = w + hitPadX * 2;
  const hitH = h + hitPadY * 2;
  const hitZone = scene.add.zone(0, 0, hitW, hitH).setOrigin(0.5, 0.5);
  hitZone.setInteractive({ useHandCursor: true });
  container.add(hitZone);
  // Keep container.setSize consistent for any external code that reads it.
  container.setSize(hitW, hitH);

  // Press feedback
  const pressTween = () => {
    scene.tweens.add({ targets: container, scale: 0.94, duration: 80, yoyo: true });
  };

  if (opts.onClick) {
    hitZone.on('pointerdown', () => {
      pressTween();
      scene.time.delayedCall(80, opts.onClick);
    });
  } else {
    hitZone.on('pointerdown', pressTween);
  }

  // Idle pulse (subtle scale) to draw attention — disabled if opts.pulse === false
  if (opts.pulse !== false) {
    scene.tweens.add({
      targets: container,
      scale: 1.04,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  return { container, label: text };
}

// ────────────────────────────────────────────────
// Badge (rounded chip with a colored icon + value)
// ────────────────────────────────────────────────

/**
 * Create a small rounded stat chip, e.g. a score or lives counter.
 *
 * opts:
 *   w, h
 *   iconColor : small circle color at left
 *   text         value string (updatable via returned .setText)
 *   textColor    css color for the value
 *   label        optional caption shown between icon and value (e.g. "SCORE")
 *   labelColor   css color for the caption
 *   labelSize    font size (px) for the caption
 *   fill         chip fill
 *   edge         chip edge color
 */
export function createBadge(scene, x, y, opts = {}) {
  const w = opts.w ?? 180;
  const h = opts.h ?? 58;
  const radius = h / 2;
  const iconColor = opts.iconColor ?? PALETTE.primary;
  const fill = opts.fill ?? PALETTE.panelFill;
  const edge = opts.edge ?? PALETTE.panelEdge;
  const textColor = opts.textColor ?? PALETTE.textLight;
  const fontSize = opts.fontSize ?? 26;
  const label = opts.label ?? '';
  const labelColor = opts.labelColor ?? PALETTE.textSub;
  const labelSize = opts.labelSize ?? Math.max(16, Math.round(fontSize * 0.72));

  const container = scene.add.container(x, y);

  // See note in createPillButton: use make.graphics({ add: false }) to
  // avoid double registration in scene + container.
  const gfx = scene.make.graphics({ x: 0, y: 0, add: false });
  // shadow
  gfx.fillStyle(0x000000, 0.3);
  gfx.fillRoundedRect(-w / 2 + 2, -h / 2 + 4, w, h, radius);
  // edge
  gfx.fillStyle(edge, 1);
  gfx.fillRoundedRect(-w / 2, -h / 2, w, h, radius);
  // fill
  gfx.fillStyle(fill, 1);
  gfx.fillRoundedRect(-w / 2 + 2, -h / 2 + 2, w - 4, h - 4, radius - 2);
  // icon circle at left
  gfx.fillStyle(iconColor, 1);
  gfx.fillCircle(-w / 2 + h / 2, 0, h / 2 - 6);
  gfx.lineStyle(2, 0xffffff, 0.8);
  gfx.strokeCircle(-w / 2 + h / 2, 0, h / 2 - 6);

  container.add(gfx);

  // Row layout — icon occupies [-w/2, -w/2 + h], caption is left-aligned
  // right after the icon, value is right-aligned at the chip's right edge.
  const contentLeft = -w / 2 + h + 8;
  const contentRight = w / 2 - 16;

  let labelText = null;
  if (label) {
    labelText = scene.add.text(contentLeft, 0, label, {
      fontSize: `${labelSize}px`,
      fontStyle: 'bold',
      color: labelColor,
    }).setOrigin(0, 0.5);
    container.add(labelText);
  }

  const text = scene.add.text(contentRight, 0, opts.text || '0', {
    fontSize: `${fontSize}px`,
    fontStyle: 'bold',
    color: textColor,
  }).setOrigin(1, 0.5);
  container.add(text);

  return {
    container,
    text,
    label: labelText,
    setText(v) { text.setText(String(v)); },
  };
}

// ────────────────────────────────────────────────
// Label text helper (bold with stroke, casual style)
// ────────────────────────────────────────────────

export function casualText(scene, x, y, content, opts = {}) {
  const fontSize = opts.fontSize ?? 40;
  const color = opts.color ?? PALETTE.textLight;
  const stroke = opts.stroke ?? PALETTE.textStroke;
  const strokeThickness = opts.strokeThickness ?? 6;
  const align = opts.align ?? 'center';

  const t = scene.add.text(x, y, content, {
    fontSize: `${fontSize}px`,
    fontStyle: 'bold',
    color,
    stroke,
    strokeThickness,
    align,
  }).setOrigin(opts.originX ?? 0.5, opts.originY ?? 0.5);

  return t;
}

// ────────────────────────────────────────────────
// Progress bar (for the loading screen)
// ────────────────────────────────────────────────

/**
 * Create a casual-style progress bar. Returns { setProgress(v) }.
 */
export function createProgressBar(scene, x, y, w, h, opts = {}) {
  const radius = h / 2;
  const edge = opts.edge ?? PALETTE.panelEdge;
  const fill = opts.fill ?? 0x0a163a;
  const barColor = opts.barColor ?? PALETTE.success;
  const barHi = opts.barHi ?? PALETTE.successHi;

  const track = scene.add.graphics();
  track.fillStyle(0x000000, 0.4);
  track.fillRoundedRect(x - w / 2 + 2, y - h / 2 + 4, w, h, radius);
  track.fillStyle(edge, 1);
  track.fillRoundedRect(x - w / 2, y - h / 2, w, h, radius);
  track.fillStyle(fill, 1);
  track.fillRoundedRect(x - w / 2 + 3, y - h / 2 + 3, w - 6, h - 6, radius - 3);

  const barGfx = scene.add.graphics();

  const innerW = w - 10;
  const innerH = h - 10;
  const innerX = x - w / 2 + 5;
  const innerY = y - h / 2 + 5;
  const innerRadius = innerH / 2;

  function setProgress(v) {
    const vv = Phaser.Math.Clamp(v, 0, 1);
    barGfx.clear();
    if (vv <= 0.001) return;
    const bw = Math.max(innerH, innerW * vv);
    barGfx.fillStyle(barColor, 1);
    barGfx.fillRoundedRect(innerX, innerY, bw, innerH, innerRadius);
    // highlight stripe
    barGfx.fillStyle(barHi, 0.6);
    barGfx.fillRoundedRect(innerX + 4, innerY + 3, bw - 8, innerH * 0.4, innerRadius - 3);
  }

  setProgress(0);

  return { setProgress };
}
