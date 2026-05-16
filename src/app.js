(() => {
      const canvas = document.getElementById("game");
      const ctx = canvas.getContext("2d");
      const startButton = document.getElementById("startButton");
      const pauseButton = document.getElementById("pauseButton");
      const restartButton = document.getElementById("restartButton");
      const shareButton = document.getElementById("shareButton");
      const overlay = document.getElementById("gameOverlay");
      const overlayTitle = document.getElementById("overlayTitle");
      const overlayText = document.getElementById("overlayText");
      const overlayAction = document.getElementById("overlayAction");

      const GRID_COLS = 20;
      const GRID_ROWS = 15;
      const TILE = 40;
      const TOP_H = 60;
      const MAP_W = GRID_COLS * TILE;
      const MAP_H = GRID_ROWS * TILE;
      const PANEL_X = MAP_W;
      const PANEL_W = canvas.width - MAP_W;
      const MAX_WAVES = 10;
      const telegram = window.Telegram?.WebApp || null;

      function applyTelegramViewport() {
        const h = telegram?.viewportHeight || window.innerHeight;
        document.documentElement.style.setProperty("--tg-viewport-height", `${Math.max(480, Math.round(h))}px`);
      }

      function applyTelegramTheme() {
        const theme = telegram?.themeParams || {};
        const root = document.documentElement;
        if (theme.bg_color) root.style.setProperty("--tg-theme-bg-color", theme.bg_color);
        if (theme.secondary_bg_color) root.style.setProperty("--tg-theme-secondary-bg-color", theme.secondary_bg_color);
        if (theme.text_color) root.style.setProperty("--tg-theme-text-color", theme.text_color);
        try {
          telegram?.setHeaderColor?.(theme.bg_color || "#0057b8");
          telegram?.setBackgroundColor?.(theme.bg_color || "#0d1520");
        } catch (_) {}
      }

      function initTelegramMiniApp() {
        applyTelegramViewport();
        window.addEventListener("resize", applyTelegramViewport);
        if (!telegram) return;
        document.documentElement.classList.add("telegram-mini-app");
        try {
          telegram.ready();
          telegram.expand();
          telegram.disableVerticalSwipes?.();
        } catch (_) {}
        applyTelegramTheme();
        telegram.onEvent?.("viewportChanged", applyTelegramViewport);
        telegram.onEvent?.("themeChanged", applyTelegramTheme);
      }

      function haptic(kind = "selection") {
        try {
          if (!telegram?.HapticFeedback) return;
          if (kind === "success" || kind === "error" || kind === "warning") {
            telegram.HapticFeedback.notificationOccurred(kind);
          } else if (kind === "impact") {
            telegram.HapticFeedback.impactOccurred("light");
          } else {
            telegram.HapticFeedback.selectionChanged();
          }
        } catch (_) {}
      }

      function shareGame() {
        const url = "https://tower-defense-blond.vercel.app";
        const text = "Зіграй у Захист України: Telegram Mini App tower defense 🇺🇦";
        const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
        haptic("impact");
        if (telegram?.openTelegramLink) telegram.openTelegramLink(shareUrl);
        else window.open(shareUrl, "_blank", "noopener,noreferrer");
      }

      const state = {
        wave: 0,
        coins: 120,
        lives: 20,
        towers: [],
        enemies: [],
        projectiles: [],
        selectedTowerId: "soldier",
        hoverTile: null,
        selectedTower: null,
        started: false,
        paused: false,
        victory: false,
        notice: "",
        noticeTimer: 0,
        spawnQueue: [],
        spawnTimer: 0,
        waveActive: false,
        intermission: 2.5,
        gameOver: false,
        score: 0,
        clickPulse: 0
      };

      // === ASSET LOADING ===
      const tilesheet = new Image();
      tilesheet.src = "assets/kenney/Tilesheet/towerDefense_tilesheet.png";
      const TS = 64; // tile size in tilesheet
      const TS_COLS = 23;
      function drawTile(tileNum, dx, dy, dw, dh) {
        // tileNum is 1-indexed
        const idx = tileNum - 1;
        const sx = (idx % TS_COLS) * TS;
        const sy = Math.floor(idx / TS_COLS) * TS;
        ctx.drawImage(tilesheet, sx, sy, TS, TS, dx, dy, dw || TILE, dh || TILE);
      }

      // Decoration positions (random trees/rocks on empty grass tiles, generated once)
      const decorations = [];
      function generateDecorations() {
        decorations.length = 0;
        const decoTiles = [136]; // rock only
        for (let row = 0; row < GRID_ROWS; row++) {
          for (let col = 0; col < GRID_COLS; col++) {
            if (pathTileSet.has(`${col},${row}`)) continue;
            // Don't place decorations adjacent to path (leave room for towers)
            let adjPath = false;
            for (const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
              if (pathTileSet.has(`${col+dx},${row+dy}`)) { adjPath = true; break; }
            }
            if (adjPath) continue;
            if (Math.random() < 0.06) {
              decorations.push({
                col, row,
                tile: decoTiles[Math.floor(Math.random() * decoTiles.length)]
              });
            }
          }
        }
      }

      // === AUDIO ===
      const bgMusic = new Audio("assets/audio/td-theme.mp3");
      bgMusic.loop = true;
      bgMusic.volume = 0.35;
      let musicStarted = false;

      const sfx = {
        shoot: new Audio("assets/audio/shoot.mp3"),
        explosion: new Audio("assets/audio/explosion.mp3"),
        explosion2: new Audio("assets/audio/explosion2.mp3"),
        coin: new Audio("assets/audio/coin.mp3"),
        waveStart: new Audio("assets/audio/wave-start.mp3"),
        click: new Audio("assets/audio/click.mp3")
      };
      // Pre-clone for overlapping sounds
      function playSfx(name, vol = 0.3) {
        const s = sfx[name];
        if (!s) return;
        const clone = s.cloneNode();
        clone.volume = vol;
        clone.play().catch(() => {});
      }

      const towerTypes = {
        soldier: {
          id: "soldier",
          name: "Солдат",
          icon: "🇺🇦",
          color: "#5fb1ff",
          cost: 70,
          range: 110,
          damage: 28,
          fireRate: 0.4,
          projectileSpeed: 330,
          canHitAir: false,
          splash: 0
        },
        sniper: {
          id: "sniper",
          name: "Снайпер",
          icon: "🔱",
          color: "#ffd76f",
          cost: 140,
          range: 200,
          damage: 110,
          fireRate: 1.3,
          projectileSpeed: 520,
          canHitAir: false,
          splash: 0
        },
        artillery: {
          id: "artillery",
          name: "Артилерія",
          icon: "🌻",
          color: "#ff9b7d",
          cost: 190,
          range: 145,
          damage: 70,
          fireRate: 1.6,
          projectileSpeed: 260,
          canHitAir: false,
          splash: 56
        },
        drone: {
          id: "drone",
          name: "Байрактар",
          icon: "🛩️",
          color: "#a6f5a1",
          cost: 260,
          range: 160,
          damage: 45,
          fireRate: 0.24,
          projectileSpeed: 370,
          canHitAir: true,
          splash: 0
        }
      };

      const orcFirstNames = [
        "Кельтиан","Борислав","Генадий","Дмитрий","Евгений","Захар","Игорь",
        "Константин","Леонид","Михаил","Николай","Олег","Павел","Руслан",
        "Сергей","Тимофей","Федор","Юрий","Артем","Виктор","Григорий",
        "Денис","Иван","Кирилл","Максим","Никита","Петр","Роман","Степан",
        "Алексей","Андрей","Василий","Владимир","Вячеслав","Геннадий"
      ];
      const orcLastNames = [
        "Путинков","Медведев","Лавров","Шойгу","Кадыров","Пригожин",
        "Иванов","Петров","Сидоров","Козлов","Баранов","Свинцов",
        "Мухин","Тупицын","Дуров","Орлов","Волков","Зайцев","Мышкин"
      ];
      function randomOrcName() {
        const f = orcFirstNames[Math.floor(Math.random() * orcFirstNames.length)];
        const l = orcLastNames[Math.floor(Math.random() * orcLastNames.length)];
        return f + " " + l;
      }
      function randomVehicleName(prefix) {
        return prefix + "-" + Math.floor(Math.random() * 900 + 100);
      }

      const enemyTypes = {
        infantry: {
          id: "infantry",
          name: "Орк",
          hp: 140,
          speed: 42,
          reward: 6,
          armor: 0,
          size: 14,
          isAir: false,
          color: "#a9d06a"
        },
        apc: {
          id: "apc",
          name: "БТР",
          hp: 350,
          speed: 34,
          reward: 14,
          armor: 3,
          size: 16,
          isAir: false,
          color: "#915353"
        },
        tank: {
          id: "tank",
          name: "Танк",
          hp: 800,
          speed: 20,
          reward: 28,
          armor: 7,
          size: 18,
          isAir: false,
          color: "#7f4545"
        },
        helicopter: {
          id: "helicopter",
          name: "Гелікоптер",
          hp: 400,
          speed: 58,
          reward: 24,
          armor: 2,
          size: 14,
          isAir: true,
          color: "#cd6060"
        },
        bossTank: {
          id: "bossTank",
          name: "Генерал",
          hp: 4000,
          speed: 18,
          reward: 90,
          armor: 12,
          size: 24,
          isAir: false,
          color: "#ff9f9f",
          isBoss: true
        }
      };

      const pathWaypoints = [
        [0, 7],
        [2, 7],
        [2, 3],
        [5, 3],
        [5, 10],
        [9, 10],
        [9, 5],
        [13, 5],
        [13, 12],
        [17, 12],
        [17, 6],
        [19, 6]
      ];

      function pointFromTile(tx, ty) {
        return {
          x: tx * TILE + TILE / 2,
          y: TOP_H + ty * TILE + TILE / 2
        };
      }

      function buildPathTiles() {
        const tiles = [];
        const seen = new Set();
        for (let i = 0; i < pathWaypoints.length - 1; i++) {
          const [sx, sy] = pathWaypoints[i];
          const [ex, ey] = pathWaypoints[i + 1];
          const dx = Math.sign(ex - sx);
          const dy = Math.sign(ey - sy);
          let x = sx;
          let y = sy;
          const key0 = `${x},${y}`;
          if (!seen.has(key0)) { seen.add(key0); tiles.push({ x, y }); }
          while (x !== ex || y !== ey) {
            if (x !== ex) x += dx;
            else if (y !== ey) y += dy;
            const key = `${x},${y}`;
            if (!seen.has(key)) { seen.add(key); tiles.push({ x, y }); }
          }
        }
        return tiles;
      }

      const pathTiles = buildPathTiles();
      const pathTileSet = new Set(pathTiles.map((t) => `${t.x},${t.y}`));
      const pathPoints = pathTiles.map((t) => pointFromTile(t.x, t.y));

      // Generate decorations after path is known
      tilesheet.onload = () => { generateDecorations(); };

      function dist(ax, ay, bx, by) {
        return Math.hypot(ax - bx, ay - by);
      }

      function isTowerAt(tx, ty) {
        return state.towers.some((t) => t.tx === tx && t.ty === ty);
      }

      function tileValidForTower(tx, ty) {
        if (tx < 0 || ty < 0 || tx >= GRID_COLS || ty >= GRID_ROWS) return false;
        if (pathTileSet.has(`${tx},${ty}`)) return false;
        if (isTowerAt(tx, ty)) return false;
        return true;
      }

      function makeTower(tx, ty, type) {
        const center = pointFromTile(tx, ty);
        return {
          tx,
          ty,
          x: center.x,
          y: center.y,
          cooldown: Math.random() * 0.15,
          level: 1,
          type
        };
      }

      function towerDamage(tower) {
        return Math.round(tower.type.damage * (1 + (tower.level - 1) * 0.35));
      }

      function towerRange(tower) {
        return Math.round(tower.type.range * (1 + (tower.level - 1) * 0.12));
      }

      function towerUpgradeCost(tower) {
        return Math.round(tower.type.cost * (0.95 + tower.level * 0.65));
      }

      function towerSellValue(tower) {
        return Math.round(tower.type.cost * 0.35 + (tower.level - 1) * tower.type.cost * 0.18);
      }

      function setNotice(text) {
        state.notice = text;
        state.noticeTimer = 2.1;
      }

      function makeEnemy(typeKey) {
        const type = enemyTypes[typeKey];
        const p0 = pathPoints[0];
        let nick;
        if (typeKey === "infantry") nick = randomOrcName();
        else if (typeKey === "bossTank") nick = "Ген. " + orcFirstNames[Math.floor(Math.random() * orcFirstNames.length)];
        else nick = randomVehicleName(type.name);
        return {
          typeKey,
          type,
          nick,
          hp: type.hp,
          maxHp: type.hp,
          x: p0.x,
          y: p0.y,
          pathIndex: 0,
          dead: false,
          reachedEnd: false,
          labelLane: Math.floor(Math.random() * 3)
        };
      }

      function spawnWave() {
        state.wave += 1;
        state.waveActive = true;
        playSfx("waveStart", 0.5);
        state.spawnQueue = [];
        state.spawnTimer = 0;

        const normalCount = 6 + state.wave * 2;
        const isBossWave = state.wave % 5 === 0;

        function pickEnemy() {
          const r = Math.random();
          if (state.wave <= 2) return r < 0.80 ? "infantry" : "apc";
          if (state.wave <= 4) {
            if (r < 0.60) return "infantry";
            if (r < 0.82) return "apc";
            if (r < 0.92) return "tank";
            return "helicopter";
          }
          if (r < 0.45) return "infantry";
          if (r < 0.70) return "apc";
          if (r < 0.85) return "tank";
          return "helicopter";
        }

        for (let i = 0; i < normalCount; i++) {
          state.spawnQueue.push(pickEnemy());
        }

        if (isBossWave) {
          state.spawnQueue.splice(Math.floor(state.spawnQueue.length * 0.5), 0, "bossTank");
          state.spawnQueue.push("tank", "tank", "helicopter");
        }
      }

      function damageEnemy(target, amount, splashRadius = 0) {
        if (!target || target.dead) return;

        const primary = Math.max(1, amount - (target.type.armor || 0));
        target.hp -= primary;
        if (target.hp <= 0) {
          target.dead = true;
          state.coins += target.type.reward;
          state.score += target.type.reward;
          if (target.type.isBoss) haptic("success");
          playSfx(target.type.isBoss ? "explosion2" : "explosion", 0.25);
          playSfx("coin", 0.15);
        }

        if (splashRadius > 0) {
          for (const enemy of state.enemies) {
            if (enemy === target || enemy.dead) continue;
            const d = dist(target.x, target.y, enemy.x, enemy.y);
            if (d <= splashRadius) {
              const splashDamage = Math.max(1, Math.floor(primary * 0.65) - (enemy.type.armor || 0));
              enemy.hp -= splashDamage;
              if (enemy.hp <= 0 && !enemy.dead) {
                enemy.dead = true;
                state.coins += enemy.type.reward;
                state.score += enemy.type.reward;
              }
            }
          }
        }
      }

      function updateEnemies(dt) {
        for (const enemy of state.enemies) {
          if (enemy.dead || enemy.reachedEnd) continue;

          let remaining = enemy.type.speed * dt;
          while (remaining > 0.1 && enemy.pathIndex < pathPoints.length - 1) {
            const nextPoint = pathPoints[enemy.pathIndex + 1];
            const vx = nextPoint.x - enemy.x;
            const vy = nextPoint.y - enemy.y;
            const len = Math.hypot(vx, vy);
            if (len <= remaining) {
              enemy.x = nextPoint.x;
              enemy.y = nextPoint.y;
              remaining -= len;
              enemy.pathIndex += 1;
            } else {
              enemy.x += (vx / len) * remaining;
              enemy.y += (vy / len) * remaining;
              remaining = 0;
            }
          }
          if (enemy.pathIndex >= pathPoints.length - 1) {
            enemy.reachedEnd = true;
            state.lives -= enemy.type.isBoss ? 5 : 1;
            if (state.lives <= 0) {
              state.lives = 0;
              state.gameOver = true;
              haptic("error");
              showOverlay("Поразка", `База впала на хвилі ${state.wave}. Рахунок: ${state.score}.`, "Спробувати ще");
              updateButtons();
            }
          }
        }

        state.enemies = state.enemies.filter((e) => !e.dead && !e.reachedEnd);
      }

      function chooseTarget(tower) {
        let best = null;
        let bestProgress = -1;
        for (const enemy of state.enemies) {
          if (enemy.dead) continue;
          if (enemy.type.isAir && !tower.type.canHitAir) continue;
          const d = dist(tower.x, tower.y, enemy.x, enemy.y);
          if (d <= towerRange(tower)) {
            const progress = enemy.pathIndex + (enemy.type.isAir ? 0.15 : 0);
            if (progress > bestProgress) {
              bestProgress = progress;
              best = enemy;
            }
          }
        }
        return best;
      }

      function updateTowers(dt) {
        for (const tower of state.towers) {
          tower.cooldown -= dt;
          if (tower.cooldown > 0) continue;

          const target = chooseTarget(tower);
          if (!target) continue;

          tower.cooldown = tower.type.fireRate;
          if (Math.random() < 0.3) playSfx("shoot", 0.1); // throttle shoot SFX
          state.projectiles.push({
            x: tower.x,
            y: tower.y,
            target,
            damage: tower.type.damage,
            speed: tower.type.projectileSpeed,
            splash: tower.type.splash,
            color: tower.type.color,
            life: 1.6
          });
        }
      }

      function updateProjectiles(dt) {
        for (const p of state.projectiles) {
          p.life -= dt;
          if (p.life <= 0 || !p.target || p.target.dead) {
            p.dead = true;
            continue;
          }

          const tx = p.target.x;
          const ty = p.target.y - (p.target.type.isAir ? 10 : 0);
          const vx = tx - p.x;
          const vy = ty - p.y;
          const len = Math.hypot(vx, vy) || 1;
          const step = p.speed * dt;

          if (len <= step + 3) {
            damageEnemy(p.target, p.damage, p.splash);
            p.dead = true;
          } else {
            p.x += (vx / len) * step;
            p.y += (vy / len) * step;
          }
        }

        state.projectiles = state.projectiles.filter((p) => !p.dead);
      }

      function updateWaveSpawner(dt) {
        if (!state.waveActive) {
          state.intermission -= dt;
          if (state.intermission <= 0) {
            spawnWave();
          }
          return;
        }

        state.spawnTimer -= dt;
        if (state.spawnQueue.length > 0 && state.spawnTimer <= 0) {
          const key = state.spawnQueue.shift();
          state.enemies.push(makeEnemy(key));
          const base = key === "infantry" ? 0.85 : key === "helicopter" ? 1.05 : 1.2;
          state.spawnTimer = base;
        }

        if (state.spawnQueue.length === 0 && state.enemies.length === 0) {
          if (state.wave >= MAX_WAVES) {
            state.victory = true;
            state.gameOver = true;
            haptic("success");
            showOverlay("Перемога", `Витримано ${MAX_WAVES} хвиль. Рахунок: ${state.score}.`, "Грати ще");
            return;
          }
          state.waveActive = false;
          state.intermission = 6;
          state.coins += 12 + state.wave * 2;
          setNotice(`Хвиля ${state.wave} відбита. Бонус ресурсів отримано.`);
        }
      }

      function update(dt) {
        state.noticeTimer = Math.max(0, state.noticeTimer - dt);
        if (!state.started || state.paused || state.gameOver) return;
        state.clickPulse = Math.max(0, state.clickPulse - dt * 3);
        updateWaveSpawner(dt);
        updateEnemies(dt);
        updateTowers(dt);
        updateProjectiles(dt);
      }

      function drawGrid() {
        const useTiles = tilesheet.complete && tilesheet.naturalWidth > 0;
        for (let y = 0; y < GRID_ROWS; y++) {
          for (let x = 0; x < GRID_COLS; x++) {
            const px = x * TILE;
            const py = TOP_H + y * TILE;
            const even = (x + y) % 2 === 0;
            ctx.fillStyle = even ? "#3f8045" : "#39753f";
            ctx.fillRect(px, py, TILE, TILE);
            ctx.strokeStyle = "rgba(7, 38, 14, 0.18)";
            ctx.lineWidth = 1;
            ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
          }
        }

        for (const tile of pathTiles) {
          const px = tile.x * TILE;
          const py = TOP_H + tile.y * TILE;
          ctx.fillStyle = "#8b6a45";
          ctx.fillRect(px, py, TILE, TILE);
          ctx.strokeStyle = "#5b432b";
          ctx.strokeRect(px + 1, py + 1, TILE - 2, TILE - 2);
        }

        // Draw small Canvas-drawn decorations (grass tufts, small stones)
        for (const d of decorations) {
          const dx = d.col * TILE + TILE / 2;
          const dy = TOP_H + d.row * TILE + TILE / 2;
          ctx.save();
          if (d.tile === 136) {
            // Small stone
            ctx.fillStyle = "#7a8a7a";
            ctx.beginPath();
            ctx.ellipse(dx - 4, dy + 6, 6, 4, 0.3, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#8a9a8a";
            ctx.beginPath();
            ctx.ellipse(dx + 5, dy + 4, 4, 3, -0.2, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }
      }

      function drawTopBar() {
        ctx.fillStyle = "#0d1e39";
        ctx.fillRect(0, 0, canvas.width, TOP_H);
        ctx.textAlign = "left";

        const stripeW = canvas.width / 2;
        ctx.fillStyle = "#0057b8";
        ctx.fillRect(0, 0, stripeW, 8);
        ctx.fillStyle = "#ffd700";
        ctx.fillRect(stripeW, 0, stripeW, 8);

        ctx.fillStyle = "#f4f8ff";
        ctx.font = "700 20px Trebuchet MS";
        ctx.fillText("🇺🇦 Захист України", 30, 28);
        ctx.font = "700 21px Trebuchet MS";
        ctx.fillStyle = "#ffe071";
        ctx.fillText(`🔱 Хвиля ${state.wave}/${MAX_WAVES}${state.waveActive ? "" : " • підготовка"}`, 30, 50);
        ctx.fillStyle = "#ffe071";
        ctx.fillText(`Ресурси: ${state.coins}`, 360, 50);
        ctx.fillStyle = state.lives <= 6 ? "#ff8585" : "#b5f6b5";
        ctx.fillText(`База: ${state.lives}`, 570, 50);
        ctx.fillStyle = "#a8d2ff";
        ctx.font = "600 16px Trebuchet MS";

        if (!state.waveActive && !state.gameOver) {
          ctx.fillText("🇺🇦 Будуй оборону!", 760, 29);
          ctx.fillText(`Наступ ворога через ${Math.ceil(state.intermission)}с`, 760, 50);
        } else if (state.waveActive) {
          ctx.fillText(`Ворогів у наступі: ${state.spawnQueue.length + state.enemies.length}`, 760, 42);
        }
        if (state.paused) {
          ctx.fillStyle = "#ffd700";
          ctx.fillText("Пауза", 1040, 42);
        }
      }

      function drawTower(tower) {
        const { x, y, type } = tower;
        ctx.save();
        ctx.translate(x, y);

        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.beginPath();
        ctx.ellipse(0, 13, 14, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#24324d";
        ctx.fillRect(-13, -10, 26, 22);
        ctx.fillStyle = type.color;
        ctx.fillRect(-8, -5, 16, 12);
        ctx.fillStyle = "#f3f8ff";
        ctx.font = "700 17px 'Segoe UI Emoji', 'Apple Color Emoji', Trebuchet MS";
        ctx.textAlign = "center";
        ctx.fillText(type.icon, 0, 5);
        if (tower.level > 1) {
          ctx.fillStyle = "#ffd700";
          ctx.font = "700 11px Trebuchet MS";
          ctx.fillText(`Lv${tower.level}`, 0, 23);
        }
        if (state.selectedTower === tower) {
          ctx.strokeStyle = "#ffd700";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(0, 0, towerRange(tower), 0, Math.PI * 2);
          ctx.stroke();
        }

        ctx.restore();
      }

      function drawEnemies() {
        ctx.save();
        for (const enemy of state.enemies) {
          const e = enemy.type;
          const yOffset = e.isAir ? -10 : 0;

          ctx.fillStyle = "rgba(0,0,0,0.22)";
          ctx.beginPath();
          ctx.ellipse(enemy.x, enemy.y + 11, e.size * 0.75, 4, 0, 0, Math.PI * 2);
          ctx.fill();

          if (enemy.typeKey === "infantry") {
            ctx.fillStyle = "#3f6928";
            ctx.beginPath();
            ctx.arc(enemy.x, enemy.y + yOffset, 10, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#761f1f";
            ctx.beginPath();
            ctx.arc(enemy.x - 6, enemy.y + yOffset + 1, 4, 0, Math.PI * 2);
            ctx.arc(enemy.x + 6, enemy.y + yOffset + 1, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#f0f0f0";
            ctx.font = "700 13px 'Segoe UI Emoji', 'Apple Color Emoji', Trebuchet MS";
            ctx.textAlign = "center";
            ctx.fillText("👹", enemy.x, enemy.y + yOffset + 4);
          } else if (enemy.typeKey === "apc") {
            ctx.fillStyle = "#7a3434";
            ctx.fillRect(enemy.x - 11, enemy.y + yOffset - 7, 22, 14);
            ctx.fillStyle = "#2b2b2b";
            ctx.fillRect(enemy.x - 6, enemy.y + yOffset - 10, 12, 5);
            ctx.fillStyle = "#1e1e1e";
            ctx.fillRect(enemy.x - 12, enemy.y + yOffset + 5, 24, 3);
          } else if (enemy.typeKey === "tank" || enemy.typeKey === "bossTank") {
            const bodyW = enemy.typeKey === "bossTank" ? 32 : 26;
            const bodyH = enemy.typeKey === "bossTank" ? 18 : 14;
            ctx.fillStyle = enemy.typeKey === "bossTank" ? "#8e1b1b" : "#6f2d2d";
            ctx.fillRect(enemy.x - bodyW / 2, enemy.y + yOffset - bodyH / 2, bodyW, bodyH);
            ctx.fillStyle = "#2f2f2f";
            ctx.fillRect(enemy.x - bodyW / 2 - 2, enemy.y + yOffset + bodyH / 2 - 3, bodyW + 4, 4);
            ctx.fillStyle = "#3d3d3d";
            ctx.fillRect(enemy.x - 5, enemy.y + yOffset - bodyH / 2 - 4, 10, 6);
            ctx.strokeStyle = "#1a1a1a";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(enemy.x + 5, enemy.y + yOffset - bodyH / 2 + 1);
            ctx.lineTo(enemy.x + 17, enemy.y + yOffset - bodyH / 2 - 1);
            ctx.stroke();
          } else if (enemy.typeKey === "helicopter") {
            ctx.fillStyle = "#8f3232";
            ctx.beginPath();
            ctx.moveTo(enemy.x, enemy.y + yOffset - e.size / 2);
            ctx.lineTo(enemy.x + e.size, enemy.y + yOffset);
            ctx.lineTo(enemy.x, enemy.y + yOffset + e.size / 2);
            ctx.lineTo(enemy.x - e.size, enemy.y + yOffset);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = "#1f1f1f";
            ctx.fillRect(enemy.x - e.size - 2, enemy.y + yOffset - 8, e.size * 2 + 4, 3);
            ctx.strokeStyle = "#2e1414";
            ctx.stroke();
          }

          const barW = Math.max(22, e.size * 1.8);
          const hpRatio = Math.max(0, enemy.hp / enemy.maxHp);
          ctx.fillStyle = "rgba(20, 22, 30, 0.8)";
          const labelOffset = enemy.labelLane * 9;
          ctx.fillRect(enemy.x - barW / 2, enemy.y + yOffset - e.size / 2 - 12 - labelOffset, barW, 5);
          ctx.fillStyle = e.isBoss ? "#ff6f6f" : "#67df8b";
          ctx.fillRect(enemy.x - barW / 2, enemy.y + yOffset - e.size / 2 - 12 - labelOffset, barW * hpRatio, 5);

          ctx.textAlign = "center";

          // nickname above unit
          ctx.fillStyle = "rgba(255,220,220,0.9)";
          ctx.font = "600 9px Trebuchet MS";
          if (enemy.labelLane === 0 || enemy.typeKey !== "infantry") {
            ctx.fillText(enemy.nick, enemy.x, enemy.y + yOffset - e.size / 2 - 14 - labelOffset);
          }
        }
        ctx.restore();
      }

      function drawProjectiles() {
        for (const p of state.projectiles) {
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.splash > 0 ? 4 : 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      function drawPanel() {
        ctx.textAlign = "left";
        ctx.fillStyle = "#13233a";
        ctx.fillRect(PANEL_X, TOP_H, PANEL_W, MAP_H);

        ctx.fillStyle = "#0057b8";
        ctx.fillRect(PANEL_X, TOP_H, PANEL_W, 6);
        ctx.fillStyle = "#ffd700";
        ctx.fillRect(PANEL_X, TOP_H + 6, PANEL_W, 6);

        ctx.fillStyle = "#eef6ff";
        ctx.font = "bold 20px Trebuchet MS";
        ctx.fillText("Оборона", PANEL_X + 16, TOP_H + 38);

        const ids = Object.keys(towerTypes);
        ids.forEach((id, i) => {
          const type = towerTypes[id];
          const y = TOP_H + 58 + i * 128;
          const selected = state.selectedTowerId === id;
          const canAfford = state.coins >= type.cost;

          ctx.fillStyle = selected ? "#1f4c84" : "#20304a";
          ctx.fillRect(PANEL_X + 12, y, PANEL_W - 24, 114);
          ctx.strokeStyle = selected ? "#ffd700" : "rgba(255,255,255,0.2)";
          ctx.lineWidth = selected ? 2 : 1;
          ctx.strokeRect(PANEL_X + 12.5, y + 0.5, PANEL_W - 25, 113);

          ctx.fillStyle = type.color;
          ctx.fillRect(PANEL_X + 20, y + 12, 34, 34);
          ctx.fillStyle = "#0f1d30";
          ctx.fillRect(PANEL_X + 23, y + 15, 28, 28);
          ctx.fillStyle = "#ffffff";
          ctx.font = "700 20px 'Segoe UI Emoji', 'Apple Color Emoji', Trebuchet MS";
          ctx.textAlign = "center";
          ctx.fillText(type.icon, PANEL_X + 37, y + 36);
          ctx.textAlign = "left";
          ctx.fillStyle = "#f7fbff";
          ctx.font = "700 15px Trebuchet MS";
          ctx.fillText(type.name, PANEL_X + 60, y + 33);

          ctx.font = "600 14px Trebuchet MS";
          ctx.fillStyle = canAfford ? "#ffe071" : "#ff9999";
          ctx.fillText(`Ціна: ${type.cost}`, PANEL_X + 22, y + 60);

          ctx.fillStyle = "#d3e7ff";
          ctx.fillText(`Шкд ${type.damage}  Рад ${Math.round(type.range / TILE)}`, PANEL_X + 22, y + 82);
          ctx.fillStyle = "#b8d8ff";
          ctx.fillText(type.canHitAir ? "Цілі: Земля + Повітря" : "Цілі: Земля", PANEL_X + 22, y + 102);
        });

        if (state.selectedTower) {
          const t = state.selectedTower;
          ctx.fillStyle = "#0f1d30";
          ctx.fillRect(PANEL_X + 12, canvas.height - 132, PANEL_W - 24, 92);
          ctx.strokeStyle = "rgba(255,215,0,0.5)";
          ctx.strokeRect(PANEL_X + 12.5, canvas.height - 131.5, PANEL_W - 25, 91);
          ctx.fillStyle = "#ffffff";
          ctx.font = "700 14px Trebuchet MS";
          ctx.fillText(`${t.type.name} Lv${t.level}`, PANEL_X + 22, canvas.height - 106);
          ctx.font = "600 13px Trebuchet MS";
          ctx.fillStyle = "#cfe5ff";
          ctx.fillText(`Шкода ${towerDamage(t)}  Радіус ${Math.round(towerRange(t) / TILE)}`, PANEL_X + 22, canvas.height - 86);
          drawPanelButton("upgrade", `Покращити ${towerUpgradeCost(t)}`, PANEL_X + 20, canvas.height - 66);
          drawPanelButton("sell", `Продати +${towerSellValue(t)}`, PANEL_X + 150, canvas.height - 66);
        }

        ctx.fillStyle = "#a7cbf7";
        ctx.font = "600 14px Trebuchet MS";
        ctx.fillText(state.selectedTower ? "Клік по полю зніме вибір" : "Обери башту та клікай по полю", PANEL_X + 16, canvas.height - 18);
        if (state.noticeTimer > 0 && state.notice) {
          ctx.fillStyle = "rgba(8, 18, 34, 0.78)";
          ctx.fillRect(24, canvas.height - 54, 520, 34);
          ctx.fillStyle = "#ffd700";
          ctx.font = "700 15px Trebuchet MS";
          ctx.fillText(state.notice, 42, canvas.height - 32);
        }
      }

      function drawPanelButton(kind, label, x, y) {
        ctx.fillStyle = kind === "upgrade" ? "#0057b8" : "#5f3140";
        ctx.fillRect(x, y, 116, 28);
        ctx.strokeStyle = kind === "upgrade" ? "#ffd700" : "#ff9f9f";
        ctx.strokeRect(x + 0.5, y + 0.5, 115, 27);
        ctx.fillStyle = "#ffffff";
        ctx.font = "700 12px Trebuchet MS";
        ctx.textAlign = "center";
        ctx.fillText(label, x + 58, y + 19);
        ctx.textAlign = "left";
      }

      function panelActionAt(x, y) {
        if (!state.selectedTower) return null;
        const by = canvas.height - 66;
        if (y < by || y > by + 28) return null;
        if (x >= PANEL_X + 20 && x <= PANEL_X + 136) return "upgrade";
        if (x >= PANEL_X + 150 && x <= PANEL_X + 266) return "sell";
        return null;
      }

      function towerAtTile(tx, ty) {
        return state.towers.find((t) => t.tx === tx && t.ty === ty) || null;
      }

      function upgradeSelectedTower() {
        const tower = state.selectedTower;
        if (!tower) return;
        if (tower.level >= 4) { setNotice("Максимальний рівень башти"); return; }
        const cost = towerUpgradeCost(tower);
        if (state.coins < cost) { setNotice("Недостатньо ресурсів для покращення"); return; }
        state.coins -= cost;
        tower.level += 1;
        setNotice(`${tower.type.name} покращено до Lv${tower.level}`);
        haptic("success");
        playSfx("coin", 0.2);
      }

      function sellSelectedTower() {
        const tower = state.selectedTower;
        if (!tower) return;
        state.coins += towerSellValue(tower);
        state.towers = state.towers.filter((t) => t !== tower);
        state.selectedTower = null;
        setNotice("Башту продано, ресурси повернено");
        haptic("impact");
        playSfx("click", 0.35);
      }

      function drawHoverPreview() {
        if (!state.hoverTile || state.gameOver) return;
        const towerType = towerTypes[state.selectedTowerId];
        const { x, y } = state.hoverTile;
        if (x < 0 || y < 0 || x >= GRID_COLS || y >= GRID_ROWS) return;

        const valid = tileValidForTower(x, y);
        const center = pointFromTile(x, y);

        ctx.save();
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = valid ? "#9be7a2" : "#ff8b8b";
        ctx.fillRect(x * TILE, TOP_H + y * TILE, TILE, TILE);

        ctx.globalAlpha = 0.14;
        ctx.beginPath();
        ctx.arc(center.x, center.y, towerType.range, 0, Math.PI * 2);
        ctx.fillStyle = valid ? "#82c4ff" : "#ff7f7f";
        ctx.fill();

        ctx.globalAlpha = 0.45;
        ctx.lineWidth = 2;
        ctx.strokeStyle = valid ? "#93d3ff" : "#ff7b7b";
        ctx.stroke();

        ctx.restore();
      }

      function drawTowers() {
        for (const tower of state.towers) drawTower(tower);
      }

      function drawPathFlow() {
        ctx.save();
        ctx.strokeStyle = "rgba(255, 235, 180, 0.18)";
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(pathPoints[0].x, pathPoints[0].y);
        for (let i = 1; i < pathPoints.length; i++) {
          ctx.lineTo(pathPoints[i].x, pathPoints[i].y);
        }
        ctx.stroke();
        ctx.restore();
      }

      function drawStartEndMarkers() {
        ctx.save();
        const s = pathPoints[0];
        const e = pathPoints[pathPoints.length - 1];

        ctx.fillStyle = "#83d8ff";
        ctx.beginPath();
        ctx.arc(s.x, s.y, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#0a223d";
        ctx.font = "bold 11px Trebuchet MS";
        ctx.textAlign = "center";
        ctx.fillText("ВХІД", s.x, s.y + 4);

        ctx.fillStyle = "#ffc262";
        ctx.beginPath();
        ctx.arc(e.x, e.y, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#4a2a09";
        ctx.fillText("БАЗА", e.x, e.y + 4);
        ctx.restore();
      }

      function drawPulse() {
        if (!state.clickPulse) return;
        const r = 28 + state.clickPulse * 10;
        ctx.save();
        ctx.globalAlpha = 0.24 * state.clickPulse;
        ctx.strokeStyle = "#ffe57b";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(PANEL_X + PANEL_W / 2, TOP_H + 34, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      function drawGameOver() {
        if (!state.gameOver) return;
        ctx.fillStyle = "rgba(8, 14, 25, 0.78)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const boxW = 440;
        const boxH = 250;
        const x = (canvas.width - boxW) / 2;
        const y = (canvas.height - boxH) / 2;

        ctx.fillStyle = "#152843";
        ctx.fillRect(x, y, boxW, boxH);
        ctx.strokeStyle = "#ffd700";
        ctx.lineWidth = 3;
        ctx.strokeRect(x + 1.5, y + 1.5, boxW - 3, boxH - 3);

        ctx.textAlign = "center";
        ctx.fillStyle = state.victory ? "#9fffc3" : "#ff9f9f";
        ctx.font = "700 43px Trebuchet MS";
        ctx.fillText(state.victory ? "ПЕРЕМОГА" : "ПОРАЗКА", canvas.width / 2, y + 76);

        ctx.fillStyle = "#eef6ff";
        ctx.font = "600 22px Trebuchet MS";
        ctx.fillText(`Протримались до хвилі ${state.wave}`, canvas.width / 2, y + 122);
        ctx.fillText(`Рахунок: ${state.score}`, canvas.width / 2, y + 153);

        const btn = restartButtonRect();
        ctx.fillStyle = "#0057b8";
        ctx.fillRect(btn.x, btn.y, btn.w, btn.h);
        ctx.fillStyle = "#ffd700";
        ctx.fillRect(btn.x, btn.y + btn.h - 6, btn.w, 6);
        ctx.strokeStyle = "#9bc8ff";
        ctx.strokeRect(btn.x + 0.5, btn.y + 0.5, btn.w - 1, btn.h - 1);

        ctx.fillStyle = "#ffffff";
        ctx.font = "700 20px Trebuchet MS";
        ctx.fillText("Спробувати ще", canvas.width / 2, btn.y + 32);
      }

      function render() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawTopBar();
        drawGrid();
        drawPathFlow();
        drawStartEndMarkers();
        drawHoverPreview();
        drawTowers();
        drawProjectiles();
        drawEnemies();
        drawPanel();
        drawPulse();
        drawGameOver();
      }

      function panelTowerAt(x, y) {
        if (x < PANEL_X + 12 || x > canvas.width - 12) return null;
        const ids = Object.keys(towerTypes);
        for (let i = 0; i < ids.length; i++) {
          const top = TOP_H + 58 + i * 128;
          if (y >= top && y <= top + 114) return ids[i];
        }
        return null;
      }

      function restartButtonRect() {
        return {
          x: canvas.width / 2 - 92,
          y: canvas.height / 2 + 74,
          w: 184,
          h: 46
        };
      }

      function resetGame() {
        state.wave = 0;
        state.coins = 120;
        state.lives = 20;
        state.towers = [];
        state.enemies = [];
        state.projectiles = [];
        state.selectedTowerId = "soldier";
        state.hoverTile = null;
        state.selectedTower = null;
        state.victory = false;
        state.notice = "";
        state.noticeTimer = 0;
        state.spawnQueue = [];
        state.spawnTimer = 0;
        state.waveActive = false;
        state.intermission = 2.2;
        state.gameOver = false;
        state.score = 0;
        state.clickPulse = 0;
      }

      function eventToCanvasPoint(ev) {
        const rect = canvas.getBoundingClientRect();
        const clientX = ev.clientX ?? ev.touches?.[0]?.clientX ?? 0;
        const clientY = ev.clientY ?? ev.touches?.[0]?.clientY ?? 0;
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        return {
          x: (clientX - rect.left) * scaleX,
          y: (clientY - rect.top) * scaleY
        };
      }

      function updateHoverFromPoint(x, y) {
        if (x < MAP_W && y >= TOP_H && y < TOP_H + MAP_H) {
          state.hoverTile = {
            x: Math.floor(x / TILE),
            y: Math.floor((y - TOP_H) / TILE)
          };
        } else {
          state.hoverTile = null;
        }
      }

      canvas.addEventListener("pointermove", (ev) => {
        const { x, y } = eventToCanvasPoint(ev);
        updateHoverFromPoint(x, y);
      });

      canvas.addEventListener("pointerleave", () => {
        state.hoverTile = null;
      });

      canvas.addEventListener("pointerdown", (ev) => {
        ev.preventDefault();
        canvas.setPointerCapture?.(ev.pointerId);
        // Start music on first interaction
        if (!musicStarted) { bgMusic.play().catch(() => {}); musicStarted = true; }

        const { x, y } = eventToCanvasPoint(ev);
        updateHoverFromPoint(x, y);

        if (!state.started) return;

        if (state.gameOver) {
          const btn = restartButtonRect();
          if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
            startGame();
          }
          return;
        }

        const panelAction = panelActionAt(x, y);
        if (panelAction === "upgrade") { upgradeSelectedTower(); return; }
        if (panelAction === "sell") { sellSelectedTower(); return; }

        const panelChoice = panelTowerAt(x, y);
        if (panelChoice) {
          state.selectedTowerId = panelChoice;
          state.selectedTower = null;
          state.clickPulse = 1;
          haptic("selection");
          return;
        }

        if (x >= MAP_W || y < TOP_H || y >= TOP_H + MAP_H) return;

        const tx = Math.floor(x / TILE);
        const ty = Math.floor((y - TOP_H) / TILE);
        const existingTower = towerAtTile(tx, ty);
        if (existingTower) {
          state.selectedTower = existingTower;
          haptic("selection");
          setNotice(`${existingTower.type.name} вибрано. Можна покращити або продати.`);
          return;
        }

        const type = towerTypes[state.selectedTowerId];

        if (!tileValidForTower(tx, ty)) { state.selectedTower = null; haptic("warning"); setNotice("Тут не можна будувати"); return; }
        if (state.coins < type.cost) { haptic("warning"); setNotice("Недостатньо ресурсів"); return; }

        state.coins -= type.cost;
        state.towers.push(makeTower(tx, ty, type));
        state.selectedTower = state.towers[state.towers.length - 1];
        setNotice(`${type.name} побудовано`);
        haptic("success");
        playSfx("click", 0.4);
      });

      function showOverlay(title, text, actionLabel = "Почати гру") {
        overlayTitle.textContent = title;
        overlayText.textContent = text;
        overlayAction.textContent = actionLabel;
        overlay.classList.add("is-visible");
      }

      function hideOverlay() {
        overlay.classList.remove("is-visible");
      }

      function updateButtons() {
        startButton.textContent = state.started ? "Гра йде" : "Почати";
        startButton.disabled = state.started && !state.gameOver;
        pauseButton.textContent = state.paused ? "Продовжити" : "Пауза";
        pauseButton.disabled = !state.started || state.gameOver;
      }

      function startGame() {
        resetGame();
        state.started = true;
        state.paused = false;
        hideOverlay();
        updateButtons();
        if (!musicStarted) { bgMusic.play().catch(() => {}); musicStarted = true; }
        haptic("success");
      }

      function togglePause() {
        if (!state.started || state.gameOver) return;
        state.paused = !state.paused;
        if (state.paused) showOverlay("Пауза", "Оборона призупинена. Натисни продовжити, щоб повернутись у гру.", "Продовжити");
        else hideOverlay();
        updateButtons();
      }

      startButton.addEventListener("click", startGame);
      restartButton.addEventListener("click", startGame);
      pauseButton.addEventListener("click", togglePause);
      shareButton?.addEventListener("click", shareGame);
      overlayAction.addEventListener("click", () => {
        if (!state.started || state.gameOver) startGame();
        else togglePause();
      });
      window.addEventListener("keydown", (ev) => {
        if (ev.code === "Space") { ev.preventDefault(); togglePause(); }
      });

      let last = performance.now();
      function loop(now) {
        const dt = Math.min(0.033, (now - last) / 1000);
        last = now;
        update(dt);
        render();
        requestAnimationFrame(loop);
      }

      initTelegramMiniApp();
      resetGame();
      state.started = false;
      showOverlay("Готуй оборону", "Став башти на траві, покращуй або продавай їх, стримуй 10 хвиль атак.", "Почати гру");
      updateButtons();
      requestAnimationFrame(loop);
    })();
