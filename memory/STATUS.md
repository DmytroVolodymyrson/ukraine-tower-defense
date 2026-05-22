# STATUS.md — Project State

## Current State
- **Phase:** Live Telegram Mini App + group event bot
- **Last updated:** 2026-05-22 by Cedric
- **Blocked by:** True one-tap group Mini App launch still requires BotFather to enable the bot's Main Mini App; Bot API `getMe` currently reports `has_main_web_app:false`, so `?startapp=` links show Telegram's generic Mini App error. Live group buttons now fall back to `?start=` private-chat handoff, where the bot returns a private `web_app` button. `RANDOM_EVENT_CHAT_ID=-5106616662` is verified against Telegram. Vercel deployment protection remains disabled for this public game project so the generated cron host can reach the function. Mobile Mini App now has large tower buttons below the map. Random waves are weekly cron-only (`0 17 * * 0`); ordinary group messages no longer have an 8% surprise-wave trigger.

## Done
- [x] Telegram Mini App game deployed at `https://tower-defense-blond.vercel.app`.
- [x] Group event bot webhook deployed at `/api/telegram`.
- [x] Added `/chatid` helper command and masked random-event target logging for cron debugging.

## In Progress
- [ ] Initial setup and requirements gathering

## Next Up
- [ ] Discovery call with client
- [ ] Requirements documentation
- [ ] Tech stack decision
- [ ] MVP implementation plan

## Key Context
- (Add important decisions, client preferences, and gotchas here)
