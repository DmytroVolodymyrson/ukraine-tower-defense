import fs from 'node:fs';
import assert from 'node:assert/strict';

const vercel = JSON.parse(fs.readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
assert.equal(vercel.crons?.[0]?.path, '/api/telegram?event=random');
assert.equal(vercel.crons?.[0]?.schedule, '0 17 * * 0');

const telegram = fs.readFileSync(new URL('../api/telegram.js', import.meta.url), 'utf8');
assert(!telegram.includes('Math.random() < 0.08'), 'group chat message lottery must stay disabled');
assert(!/!text\.startsWith\('\/'\).*sendWave\(chat\.id\)/s.test(telegram), 'ordinary group messages must not trigger waves');

console.log('smoke ok: random waves are weekly cron-only');
