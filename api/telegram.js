const APP_URL = process.env.APP_URL || 'https://tower-defense-blond.vercel.app';
const ROLES = [
  { id: 'commander', emoji: '🧭', title: 'Командир', power: 4 },
  { id: 'drone', emoji: '🛩️', title: 'Дронщик', power: 5 },
  { id: 'arty', emoji: '💥', title: 'Артилерист', power: 5 },
  { id: 'engineer', emoji: '🔧', title: 'Інженер', power: 3 },
  { id: 'sniper', emoji: '🎯', title: 'Снайпер', power: 4 },
];
function token() {
  if (!process.env.TELEGRAM_BOT_TOKEN) throw new Error('Missing TELEGRAM_BOT_TOKEN');
  return process.env.TELEGRAM_BOT_TOKEN;
}
async function tg(method, body) {
  const r = await fetch(`https://api.telegram.org/bot${token()}/${method}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || data.ok === false) console.error('Telegram API error', method, data);
  return data;
}
function safeName(user) {
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username || `user${user.id}`;
  return name.replace(/[<>]/g, '').slice(0, 28);
}
function raidId(chatId) { return `${Math.abs(Number(chatId)) || Date.now()}-${Date.now().toString(36).slice(-5)}`; }
function encodeState(state) { return Buffer.from(JSON.stringify(state), 'utf8').toString('base64url'); }
function decodeState(text) {
  const m = String(text || '').match(/\n\n🧾 ([A-Za-z0-9_-]+)$/);
  if (!m) return null;
  try { return JSON.parse(Buffer.from(m[1], 'base64url').toString('utf8')); } catch { return null; }
}
function chooseRole(players) { const used = new Set(players.map((p) => p.role)); return ROLES.find((r) => !used.has(r.id)) || null; }
function roleById(id) { return ROLES.find((r) => r.id === id) || ROLES[0]; }
function renderRaid(state, extra = '') {
  const count = state.players.length;
  const roster = state.players.length ? state.players.map((p, i) => {
    const role = roleById(p.role); return `${i + 1}. ${role.emoji} ${role.title}: ${p.name}`;
  }).join('\n') : 'Поки нікого. Бусик чекає екіпаж.';
  const need = Math.max(0, 3 - count);
  const status = count >= 3 ? '✅ Мінімальний екіпаж є. Можна запускати хвилю.' : `🔒 Соло не канає. Потрібно ще ${need} ${need === 1 ? 'людина' : 'людини'}.`;
  const result = extra ? `\n\n${extra}` : '';
  return `🚌 <b>Бусик прибув у чат</b>\n\nНовий бус привозить добровольців на фронт. Тисни кнопку, отримуй одну роль і сідай в екіпаж.\n\n<b>Екіпаж бусика (${count}/5):</b>\n${roster}\n\n${status}${result}\n\n🧾 ${encodeState(state)}`;
}
function keyboard(state) {
  return { inline_keyboard: [
    [{ text: '🚌 Зайти в бусик', callback_data: `join:${state.id}` }],
    [{ text: '⚔️ Запустити хвилю', callback_data: `wave:${state.id}` }],
    [{ text: '🎮 Відкрити Mini App', web_app: { url: `${APP_URL}?raid=${encodeURIComponent(state.id)}` } }],
    [{ text: '📣 Покликати друзів', url: `https://t.me/share/url?url=${encodeURIComponent('https://t.me/orkodavtd_bot?startgroup=bus')}&text=${encodeURIComponent('Закинь Оркодав TD в чат і збери бусик на фронт 🚌')}` }],
  ] };
}
async function answerCallback(id, text, alert = false) { return tg('answerCallbackQuery', { callback_query_id: id, text, show_alert: alert }); }
async function startRaid(chatId) {
  const state = { id: raidId(chatId), chatId, wave: 0, players: [], wins: 0, losses: 0 };
  const text = renderRaid(state);
  const animation = `${APP_URL}/assets/busik.gif`;
  const sent = await tg('sendAnimation', { chat_id: chatId, animation, caption: text, parse_mode: 'HTML', reply_markup: keyboard(state) });
  if (!sent.ok) return tg('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', reply_markup: keyboard(state) });
  return sent;
}
async function handleMessage(message) {
  const chat = message.chat; const text = message.text || '';
  if (text.startsWith('/bus') || text.startsWith('/raid') || text.startsWith('/startgame')) {
    if (chat.type === 'private') return tg('sendMessage', { chat_id: chat.id, text: 'Оркодав TD працює найкраще в групі. Додай мене в чат і напиши /bus — бусик збере екіпаж.', reply_markup: { inline_keyboard: [[{ text: '➕ Додати в чат', url: 'https://t.me/orkodavtd_bot?startgroup=bus' }], [{ text: '🎮 Грати соло', web_app: { url: APP_URL } }]] } });
    return startRaid(chat.id);
  }
  if (text.startsWith('/start') || text.startsWith('/help')) return tg('sendMessage', { chat_id: chat.id, text: chat.type === 'private' ? '🚌 Оркодав TD — чатова кооперативна оборона. Додай бота в групу, напиши /bus, збери мінімум 3 ролі й запускай хвилі.' : 'Напиши /bus, щоб викликати бусик і зібрати екіпаж оборони.', reply_markup: chat.type === 'private' ? { inline_keyboard: [[{ text: '➕ Додати в чат', url: 'https://t.me/orkodavtd_bot?startgroup=bus' }], [{ text: '🎮 Відкрити Mini App', web_app: { url: APP_URL } }]] } : undefined });
  return null;
}
function stateFromCallbackMessage(message) { return decodeState(message.caption || message.text || '') || { id: 'missing', chatId: message.chat?.id, wave: 0, players: [], wins: 0, losses: 0 }; }
async function editRaidMessage(message, state, extra) {
  const text = renderRaid(state, extra);
  const payload = { chat_id: message.chat.id, message_id: message.message_id, parse_mode: 'HTML', reply_markup: keyboard(state) };
  if (message.caption !== undefined) return tg('editMessageCaption', { ...payload, caption: text });
  return tg('editMessageText', { ...payload, text });
}
async function handleCallback(q) {
  const [action, id] = String(q.data || '').split(':'); const message = q.message; const state = stateFromCallbackMessage(message);
  if (!state || state.id !== id) return answerCallback(q.id, 'Цей бусик вже поїхав. Виклич /bus ще раз.', true);
  if (action === 'join') {
    if (state.players.some((p) => p.id === q.from.id)) return answerCallback(q.id, 'Ти вже в бусику. Одна людина — одна роль.');
    if (state.players.length >= 5) return answerCallback(q.id, 'Бусик забитий під завʼязку. Викличте новий /bus.', true);
    const role = chooseRole(state.players); if (!role) return answerCallback(q.id, 'Усі ролі зайняті. Викличте новий бусик.', true);
    state.players.push({ id: q.from.id, name: safeName(q.from), role: role.id });
    await answerCallback(q.id, `${role.emoji} Тебе бусифікувало як: ${role.title}`);
    return editRaidMessage(message, state, `🚌 ${safeName(q.from)} застрибнув у бусик як <b>${role.title}</b>.`);
  }
  if (action === 'wave') {
    if (!state.players.some((p) => p.id === q.from.id)) return answerCallback(q.id, 'Спочатку зайди в бусик. Диванні генерали хвилю не запускають.', true);
    if (state.players.length < 3) return answerCallback(q.id, 'Сам не потягнеш. Потрібно мінімум 3 людини в екіпажі.', true);
    state.wave = (state.wave || 0) + 1;
    const power = state.players.reduce((sum, p) => sum + roleById(p.role).power, 0);
    const seed = state.players.reduce((sum, p) => sum + (p.id % 97), state.wave * 13);
    const roll = (seed % 7) - 3; const difficulty = 9 + state.wave * 3;
    const success = power + roll >= difficulty; const killed = Math.max(18, power * 7 + state.wave * 11 + (success ? 18 : 0));
    let extra;
    if (success) { state.wins = (state.wins || 0) + 1; extra = `✅ <b>Хвиля ${state.wave} відбита.</b> Екіпаж мінуснув ${killed} орків. Чат тримає рубіж: ${state.wins} перемог.`; }
    else { state.losses = (state.losses || 0) + 1; extra = `💀 <b>Хвиля ${state.wave} прорвалася.</b> Не вистачило людей або ролей. Мінуснули ${killed} орків, але база просіла. Кличте ще друзів.`; }
    await answerCallback(q.id, success ? 'Хвиля відбита.' : 'Потрібен більший екіпаж.');
    return editRaidMessage(message, state, extra);
  }
  return answerCallback(q.id, 'Невідома кнопка.');
}
module.exports = async function handler(req, res) {
  if (req.method === 'GET') return res.status(200).json({ ok: true, service: 'orkodav-telegram-bot' });
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  try {
    const update = req.body || {};
    if (update.message) await handleMessage(update.message);
    if (update.callback_query) await handleCallback(update.callback_query);
    if (update.my_chat_member && update.my_chat_member.new_chat_member?.status === 'member') await tg('sendMessage', { chat_id: update.my_chat_member.chat.id, text: '🚌 Оркодав TD у чаті. Напиши /bus, щоб викликати бусик.' });
    return res.status(200).json({ ok: true });
  } catch (err) { console.error(err); return res.status(200).json({ ok: false }); }
}
