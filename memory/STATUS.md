# STATUS.md — Project State

## Current State
- **Phase:** Live Telegram Mini App + group event bot
- **Last updated:** 2026-05-18 by Cedric
- **Blocked by:** Nothing known. `RANDOM_EVENT_CHAT_ID=-5106616662` is verified against Telegram and the random-wave endpoint sent message `11` to group `Orkodav TD`. Vercel deployment protection remains disabled for this public game project so the generated cron host can reach the function. Group buttons use Telegram `startapp` deep links because Bot API rejects `web_app` inline buttons in this group with `BUTTON_TYPE_INVALID`.

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
