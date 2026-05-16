# Захист України

Vanilla HTML5 Canvas tower defense game packaged for Telegram Mini App distribution. Ukrainian defenders build towers to stop waves of Russian attackers.

## Run locally

```bash
npm install
npm run serve
```

Open `http://127.0.0.1:8080`.


## Telegram chat multiplayer MVP

Group command:

```text
/bus
```

The bot posts an animated bus with inline buttons. Each participant can occupy one role only. The wave cannot start until at least 3 users join, so one person cannot use the full group mode alone.

Docs:

- `docs/chat-multiplayer-busification.md`

## Validation

```bash
npm run check
npm run smoke
```

## Telegram Mini App

Stable URL:

```text
https://tower-defense-blond.vercel.app
```

Use this URL in BotFather as the Mini App or menu-button URL. The app loads the Telegram WebApp SDK, expands inside Telegram, applies Telegram theme/viewport values, supports touch/pointer input, and has a Telegram share button.

Docs:

- `docs/telegram-mini-app-plan.md`
- `docs/economy-research.md`

## v2 features

- Lean `index.html` with game code split into `src/app.js` and `src/styles.css`.
- Start overlay, pause, restart, and keyboard pause with Space.
- 10-wave win condition plus defeat overlay.
- Slower enemy spacing and staggered labels for more readable early waves.
- Tower selection, upgrade, and sell actions.
- Tighter economy: lower starting resources, lower enemy rewards, smaller wave bonuses, and more expensive upgrades force harder build choices.
- Build feedback messages and clearer wave status.
- Static-file deployment remains supported.
