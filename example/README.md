# phaser-wx-example

Example Phaser.js 3.x Breakout game for WeChat Mini-Game, built with `phaser-wx`.

This project serves as both a development/test target and the source template for `phaser-wx new`.

## Getting Started

```bash
# Install dependencies
npm install

# Start local development server
npm run dev

# Build for WeChat Mini-Game
npm run build
```

## Scene Flow

1. **BootScene** — Loading screen with progress bar
2. **MenuScene** — Title screen with Start button
3. **GameScene** — Breakout gameplay (paddle, ball, bricks, score, lives)

## Project Structure

```
src/
  main.js              Entry point — creates the Phaser.Game instance
  scenes/
    BootScene.js       Loading screen with progress bar
    MenuScene.js       Title screen with Start button
    GameScene.js       Breakout game scene
  ui/
    Button.js          Reusable button component
public/
  assets/            Local assets
    images/            Image assets (png, jpg, webp)
    audio/             Audio assets (mp3)
  remote-assets/     Remote assets
    images/            Image assets (png, jpg, webp)
    audio/             Audio assets (mp3)
phaser-wx.config.json  WeChat Mini-Game build configuration
```
