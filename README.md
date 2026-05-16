# Захист України v2

Vanilla HTML5 Canvas tower defense game. Ukrainian defenders build towers to stop waves of Russian attackers.

## Run locally

```bash
npm install
npm run serve
```

Open `http://127.0.0.1:8080`.

## Validation

```bash
npm run check
npm run smoke
```

## v2 features

- Lean `index.html` with game code split into `src/app.js` and `src/styles.css`.
- Start overlay, pause, restart, and keyboard pause with Space.
- 10-wave win condition plus defeat overlay.
- Slower enemy spacing and staggered labels for more readable early waves.
- Tower selection, upgrade, and sell actions.
- Tighter economy: lower starting resources, lower enemy rewards, smaller wave bonuses, and more expensive upgrades force harder build choices.
- Build feedback messages and clearer wave status.
- Static-file deployment remains supported.
