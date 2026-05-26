# STATUS.md — Project State

## Current State
- **Phase:** Live Telegram Mini App + group event bot
- **Last updated:** 2026-05-26 by Cedric
- **Blocked by:** None for Mini App launch. BotFather Main Mini App is enabled (`getMe.has_main_web_app:true`), production `TELEGRAM_MAIN_MINI_APP=true` is set, and group buttons use `?startapp=` deep links. `RANDOM_EVENT_CHAT_ID=-5106616662` is verified against Telegram. Vercel deployment protection remains disabled for this public game project so the generated cron host can reach the function. Mobile Mini App has large tower buttons below the map, no horizontal overflow in phone smoke tests, compact Telegram-native header/status controls, Telegram viewport/theme/safe-area integration, and Telegram MainButton/BackButton handling. Random waves are weekly cron-only (`0 17 * * 0`); ordinary group messages no longer have an 8% surprise-wave trigger.

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
