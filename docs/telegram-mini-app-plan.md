# Telegram Mini App conversion plan

## Fast decision

Ship the current HTML5 Canvas game as a Telegram Mini App first, then redesign economy and session loops after we get real play feedback. The current Vercel static app is already compatible with Telegram because Mini Apps are HTTPS web apps opened from a bot button.

Live app URL:

```text
https://tower-defense-blond.vercel.app
```

## What changed in this pass

- Added Telegram WebApp SDK loading from `https://telegram.org/js/telegram-web-app.js`.
- Initialize `Telegram.WebApp.ready()`, `expand()`, theme colors, viewport height, and vertical swipe disable when available.
- Added mobile-safe viewport meta with `viewport-fit=cover`, disabled user zoom, and safe-area padding.
- Replaced mouse-only canvas input with pointer input. Canvas coordinates now scale from CSS pixels to internal canvas pixels, which is required on phones.
- Added Telegram-style haptic feedback for build, upgrade, selection, warning, victory, and defeat.
- Added a share button that opens Telegram's share URL for the stable Vercel app.

## Telegram bot identity

Configured production bot:

```text
Name: Оркодав TD
Username: @orkodavtd_bot
Bot API id: 8632943487
Menu button: Играть -> https://tower-defense-blond.vercel.app
```

The live token was used only for Bot API setup and must not be committed. If it was posted in a public chat, rotate it in BotFather.

## Publishing through BotFather

1. The bot identity has been verified with Bot API `getMe`.
2. The default chat menu button has been set with Bot API `setChatMenuButton`.
3. If BotFather still asks for a Mini App URL or menu button URL, use:

```text
https://tower-defense-blond.vercel.app
```

4. Current title:

```text
Оркодав TD
```

5. Current short description:

```text
Сатирическая tower defense Mini App: строй башни, стопай орков, делись результатом.
```

6. If a backend bot is added later, validate `Telegram.WebApp.initData` server-side before trusting user IDs or scores.

## Product caveats

- The current map is landscape. It works in portrait because the canvas scales, but the panel gets small on narrow phones. A real viral Mini App should move tower controls outside the canvas into large Telegram-native buttons or redesign the board to portrait.
- Audio autoplay remains constrained by mobile browser/WebView rules. It starts after first user interaction.
- Sharing currently opens a generic Telegram share URL. A bot-backed score share should be added next with signed score payloads or bot `sendData`.

## Sources used

- Telegram Web Apps docs: https://core.telegram.org/bots/webapps
- Telegram Mini App setup and initData validation examples: https://aunimeda.com/blog/how-to-build-telegram-mini-app-2026
- Telegram Mini App development caveats: https://dev.to/dev_family/telegram-mini-app-development-and-testing-specifics-from-initialisation-to-launch-1ofh
