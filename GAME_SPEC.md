# Ukraine Tower Defense — Game Spec

## Concept
Tower Defense game. Ukrainian defenders build towers to stop waves of Russian enemies advancing along a path.

## Tech
- Pure HTML5 Canvas + vanilla JavaScript (no frameworks)
- Single index.html file for simplicity
- Served via http-server on port 8080

## Gameplay
- Grid-based map with a path enemies follow
- Player places defensive towers on open tiles
- Enemies spawn in waves, walk along path
- Towers auto-attack enemies in range
- Kill enemies = earn coins = buy more towers
- Lose lives when enemies reach the end

## Tower Types (Ukrainian defenders)
1. **Солдат (Soldier)** — basic, cheap, fast fire rate, low damage. Cost: 50
2. **Снайпер (Sniper)** — long range, high damage, slow fire. Cost: 100
3. **Артилерія (Artillery)** — splash damage, medium range. Cost: 150
4. **Дрон (Drone)** — fast, medium damage, can hit air units. Cost: 200

## Enemy Types (Russian forces)
1. **Піхотинець (Infantry)** — slow, low HP. Reward: 10
2. **БТР (APC)** — medium speed, medium HP. Reward: 25
3. **Танк (Tank)** — slow, high HP, armored. Reward: 50
4. **Гелікоптер (Helicopter)** — fast, flies (only Drone towers can target). Reward: 40

## Waves
- Each wave has more/tougher enemies
- Every 5 waves = boss wave (extra tanky Tank)
- Short break between waves, player can build

## UI
- Top bar: wave number, coins, lives
- Tower selection panel on right side
- Hover to see tower range before placing
- Ukrainian blue/yellow color scheme
- Simple pixel/geometric art style

## Map
- Green terrain, dirt path
- Path winds from left to right with curves
- Grid: ~20x15 tiles
