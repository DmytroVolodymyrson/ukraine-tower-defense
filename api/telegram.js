const APP_URL = process.env.APP_URL || 'https://tower-defense-blond.vercel.app';
const BOT_USERNAME = 'orkodavtd_bot';

function token() {
  if (!process.env.TELEGRAM_BOT_TOKEN) throw new Error('Missing TELEGRAM_BOT_TOKEN');
  return process.env.TELEGRAM_BOT_TOKEN;
}

async function tg(method, body) {
  const r = await fetch(`https://api.telegram.org/bot${token()}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || data.ok === false) console.error('Telegram API error', method, data);
  return data;
}

function appUrl(chatId) {
  const url = new URL(APP_URL);
  url.searchParams.set('source', 'telegram');
  url.searchParams.set('event', 'wave');
  if (chatId) url.searchParams.set('chat', String(chatId));
  return url.toString();
}

function gameKeyboard(chatId) {
  return {
    inline_keyboard: [[
      { text: '🚌 Стрибнути в бусик', url: appUrl(chatId) },
    ]],
  };
}

function randomWaveText() {
  const events = [
    '🚨 <b>Рандомна тривога.</b> Орда лізе на посадку. Захищайте родину, стрибайте в бусик і тримайте напрямок.',
    '⚠️ <b>Хвиля почалась.</b> Орки вирішили, що їм тут раді. Поясніть через бусик, що ні.',
    '🚌 <b>Бусик підʼїхав без попередження.</b> Хто в чаті не спить, той сьогодні обороняє сектор.',
    '🔥 <b>Терміновий виїзд.</b> На горизонті зелена навала. Добровольці, в бусик.',
  ];
  return events[Math.floor(Math.random() * events.length)];
}

async function sendWave(chatId) {
  const caption = `${randomWaveText()}\n\nТисни кнопку, відкривай гру і заходь в екіпаж.`;
  const animation = `${APP_URL}/assets/busik.gif`;
  const sent = await tg('sendAnimation', {
    chat_id: chatId,
    animation,
    caption,
    parse_mode: 'HTML',
    reply_markup: gameKeyboard(chatId),
  });
  if (!sent.ok) {
    return tg('sendMessage', {
      chat_id: chatId,
      text: caption,
      parse_mode: 'HTML',
      reply_markup: gameKeyboard(chatId),
    });
  }
  return sent;
}

async function handleMessage(message) {
  const chat = message.chat;
  const text = message.text || '';
  const isGroup = chat.type === 'group' || chat.type === 'supergroup';

  if (text.startsWith('/chatid')) {
    return tg('sendMessage', {
      chat_id: chat.id,
      text: `chat_id: <code>${chat.id}</code>\nchat_type: <code>${chat.type}</code>`,
      parse_mode: 'HTML',
    });
  }

  if (text.startsWith('/start') || text.startsWith('/help')) {
    if (chat.type === 'private') {
      return tg('sendMessage', {
        chat_id: chat.id,
        text: '🚌 Оркодав TD запускає хвилі в групових чатах. Додай бота в чат, а гра стартує з рандомної тривоги.',
        reply_markup: {
          inline_keyboard: [[
            { text: '➕ Додати в чат', url: `https://t.me/${BOT_USERNAME}?startgroup=bus` },
          ]],
        },
      });
    }
    return tg('sendMessage', {
      chat_id: chat.id,
      text: '🚌 Бот на місці. Гра не стартує по команді. Чекайте рандомну тривогу.',
    });
  }

  if (isGroup && (text.startsWith('/bus') || text.startsWith('/raid') || text.startsWith('/startgame'))) {
    return tg('sendMessage', {
      chat_id: chat.id,
      text: '🚌 Бусик не працює по виклику. Хвиля починається тільки рандомною тривогою.',
    });
  }

  if (isGroup && text && !text.startsWith('/') && Math.random() < 0.08) {
    return sendWave(chat.id);
  }

  return null;
}

async function handleRandomEvent(req) {
  const secret = process.env.CRON_SECRET || process.env.RANDOM_EVENT_SECRET;
  const authHeader = req.headers?.authorization;
  const provided = req.query?.key || req.headers?.['x-random-event-secret'];
  const authorized = secret && (provided === secret || authHeader === `Bearer ${secret}`);
  if (!authorized) return { ok: false, error: 'random_event_disabled' };

  const chatId = req.query?.chat_id || req.body?.chat_id || process.env.RANDOM_EVENT_CHAT_ID;
  if (!chatId) return { ok: false, error: 'missing_chat_id' };
  console.log('random event target', String(chatId).replace(/\d(?=\d{3})/g, '*'));
  return sendWave(chatId);
}

module.exports = async function handler(req, res) {
  if (req.method === 'GET' && req.query?.event !== 'random') {
    return res.status(200).json({ ok: true, service: 'orkodav-telegram-bot' });
  }
  if (req.method !== 'POST' && req.query?.event !== 'random') {
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  try {
    if (req.query?.event === 'random') {
      const result = await handleRandomEvent(req);
      return res.status(200).json(result);
    }

    const update = req.body || {};
    if (update.message) await handleMessage(update.message);
    if (update.my_chat_member && update.my_chat_member.new_chat_member?.status === 'member') {
      console.log('bot added to chat', {
        id: update.my_chat_member.chat.id,
        type: update.my_chat_member.chat.type,
        title: update.my_chat_member.chat.title,
      });
      await tg('sendMessage', {
        chat_id: update.my_chat_member.chat.id,
        text: '🚌 Оркодав TD у чаті. Тихо сидимо, поки не прилетить рандомна тривога.',
      });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(200).json({ ok: false });
  }
};
