# Son-of-Strength

A modern take on Doodle Jump, built as a single self-contained HTML5/CSS3/JavaScript project — no build step, no dependencies. Just open `index.html` in a browser and play.

## Features

- Endless upward jumping with a scrolling camera and screen-wrap on the left/right edges
- Procedurally generated platforms:
  - 🟩 normal
  - 🟦 moving
  - 🟧 breaking (crumbles after one landing)
  - 🟨 spring (extra-high bounce)
- Pseudo-3D look via gradients, highlights, and soft shadows
- Sky that shifts from a warm daytime gradient to a starry "space" gradient the higher you climb
- Score tracking with a persisted high score (`localStorage`)
- Procedural sound effects via the Web Audio API (no audio files needed)
- Keyboard controls (`←`/`→` or `A`/`D`) and on-screen touch controls for mobile

## Play

Open `index.html` directly in any modern browser, or serve the folder with any static file server:

```bash
python3 -m http.server 8080
# then visit http://localhost:8080
```

## Project structure

```
index.html   # page structure, menu/HUD overlay
style.css    # layout and visual styling
game.js      # game loop, physics, rendering, input, audio
```

## Roadmap ideas

- Enemies (flying, lasers)
- Power-ups (magnet, shield, jetpack)
- Themed worlds (space, forest, lava, ice, neon)
- Double jump / jetpack ability
