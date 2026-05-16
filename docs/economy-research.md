# Economy deep research notes

## Practical target

For Telegram distribution, the game should become a short mobile run:

- 10 to 15 minutes per full clear.
- 10 to 20 waves, with early loss usually not before wave 4 or 5.
- A meaningful build or upgrade decision every 1 to 2 waves.
- Near-miss tension: a normal player should often survive waves with low base health, not steamroll.

## Current game audit

Current economy is intentionally tight:

- Start resources: `120`.
- Towers: Soldier 70, Sniper 140, Artillery 190, Drone 260.
- Enemy rewards: 6, 14, 28, 24, boss 90.
- Wave bonus: `12 + wave * 2`.
- Upgrade cost: `baseCost * (0.95 + level * 0.65)`.
- Sell value: `baseCost * 0.35 + (level - 1) * baseCost * 0.18`.

This produces hard choices quickly, but it violates one researched mobile rule: starting resources should usually allow 2 to 4 basic towers or multiple viable openings. Here, start resources allow one Soldier plus leftover 50, or nothing else. That creates difficulty, but weakens first-session readability for viral Telegram traffic.

## Recommended v3 economy

Keep the hard economy feeling, but change the shape:

1. Start resources: 140 to 160.
   - Allows two Soldiers only if Soldier is reduced to 70 and the player commits fully.
   - Keeps premium towers gated.
2. Keep tower costs close to current values for now.
   - Soldier 70, Sniper 140, Artillery 190, Drone 260.
3. Move from flat enemy HP to wave-scaled HP.
   - Formula: `hp = baseHp * (1 + 0.10 to 0.14)^(wave - 1)`.
   - This lets early waves teach and late waves spike without overpaying early kills.
4. Income target per wave:
   - `ExpectedIncomePerWave = AverageMeaningfulPurchase / 1.5`.
   - Split 50 to 60 percent per-kill and 40 to 50 percent wave bonus.
5. Upgrade cost curve should be easier at level 2, steeper after.
   - Suggested: level 2 cost around `1.15 * base`, level 3 `1.9 * base`, level 4 `2.8 * base`.
   - Current formula makes level 2 `1.6 * base`, which is punishing for mobile onboarding.
6. Sell value should be based on total investment with a 55 to 65 percent refund.
   - Current formula refunds only 35 percent of base plus tiny upgrade value. Good for hardcore commitment, bad for mobile experimentation.
7. Add no-leak bonuses, capped.
   - Example: `+10` for no leaks, `+5` streak bonus up to 3.
   - Do not let perfect players snowball too far.

## Balancing formula to implement next

Track a simple survival index per wave:

```text
SurvivalIndex = PlayerDamagePotentialOnPath / TotalEnemyHP
```

Tune normal mode so a typical spender is around:

- `0.9 to 1.2` for tension.
- `> 1.5` means too easy.
- `< 0.7` means likely unfair without special mechanics.

## Next logic redesign

The current code mixes renderer, economy, input, and game state in one file. Before deeper economy iteration, split into modules:

- `config/economy.js`: tower stats, enemy stats, wave formulas.
- `engine/state.js`: state, reset, wave lifecycle.
- `engine/combat.js`: targeting, projectile, damage, rewards.
- `ui/telegram.js`: SDK, viewport, haptics, sharing.
- `ui/canvasInput.js`: pointer-to-canvas scaling and hit testing.

## Sources used

- Goal Defense tower-defense balancing, wave pacing, starting towers, and path-time examples: https://www.gamedeveloper.com/design/balance-in-td-games
- Machinations tower-defense economy modeling and Bloons-style reward modeling: https://www.youtube.com/watch?v=s2C-PfZVOek
