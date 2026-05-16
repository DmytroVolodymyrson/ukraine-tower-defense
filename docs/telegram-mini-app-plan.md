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

## Publishing through BotFather

We cannot complete BotFather registration without the target bot identity. Use a project-specific bot, not Cedric's bot.

1. Create or choose a bot in `@BotFather`.
2. Confirm the token identity before wiring it anywhere:

```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getMe"
```

3. In BotFather, create/configure the Mini App or menu button with:

```text
https://tower-defense-blond.vercel.app
```

4. Suggested title:

```text
Захист України
```

5. Suggested short description:

```text
Tower defense Mini App про українську оборону. Будуй башти, стримуй хвилі, ділись результатом.
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
