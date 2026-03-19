/**
 * Get safe area insets in game coordinates.
 *
 * GameGlobal.__safeArea provides physical screen points.
 * This helper converts them to the game's coordinate system
 * based on the Phaser camera dimensions.
 *
 * Usage:
 *   const sa = getSafeArea(this);  // in a Phaser Scene
 *   this.add.text(24, sa.top + 20, 'Score: 0', ...);
 *
 * @param {Phaser.Scene} scene - The current Phaser scene
 * @returns {{ top: number, bottom: number, left: number, right: number }}
 */
export function getSafeArea(scene) {
  const raw = (typeof GameGlobal !== 'undefined' && GameGlobal.__safeArea) || {};
  const gameW = scene.cameras.main.width;
  const gameH = scene.cameras.main.height;
  const screenW = raw.screenWidth || gameW;
  const screenH = raw.screenHeight || gameH;

  return {
    top: (raw.top || 0) * (gameH / screenH),
    bottom: (raw.bottom || 0) * (gameH / screenH),
    left: (raw.left || 0) * (gameW / screenW),
    right: (raw.right || 0) * (gameW / screenW),
  };
}
