# Chat multiplayer busification MVP

## Core loop

One Telegram group launches one raid with `/bus`. The bot posts an animated bus and an inline button: `Зайти в бусик`.

Rules:

- One user can occupy only one role in a raid.
- A raid has 5 unique roles: Commander, Drone Operator, Artillery, Engineer, Sniper.
- The wave cannot start with fewer than 3 joined users. This blocks solo use.
- Joined users can start a wave. Non-joined users cannot.
- The bot posts wave result back into the same group message.

## Viral loop

- Private `/start` pushes users to add the bot to a group.
- Group `/bus` creates a visible raid object in chat.
- The raid message includes `Покликати друзів`, pointing to `https://t.me/orkodavtd_bot?startgroup=bus`.
- The chat result says when more friends are needed.

## Technical shape

The Telegram bot is a Vercel serverless webhook at `/api/telegram`. To avoid adding a database in v0, raid state is encoded into a spoiler footer in the Telegram message caption itself. Callback handlers parse the message caption, update roster/state, and edit the same message.

This makes the MVP stateless and cheap, but it is not the final architecture. For production-scale chat-vs-chat and durable leaderboards, move state to Redis/Supabase/Postgres.

## Setup

Set production env on Vercel:

```bash
TELEGRAM_BOT_TOKEN=<bot token>
APP_URL=https://tower-defense-blond.vercel.app
```

Set webhook:

```bash
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -d "url=https://tower-defense-blond.vercel.app/api/telegram"
```
