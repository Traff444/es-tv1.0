#!/usr/bin/env node
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const TOKEN = '8004824610:AAFJQATOO_IJc8l-6yw9ZOzHcufpHSFt4RI';
let offset = 0;

async function sendMessage(chatId, text, parseMode) {
  await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: parseMode })
  });
}

function welcome(from, chatId) {
  const msg = `👋 Добро пожаловать в *ЭлектроСервис!*
\nЭтот бот предназначен для менеджеров и директоров компании.
\n🔗 *Для связи аккаунта:*
1. Войдите в веб-интерфейс системы
2. Перейдите в "Настройки профиля"
3. Введите ваш Telegram ID: \`${from.id}\`
4. Нажмите "Связать аккаунт"
\n📱 *После связки вы будете получать:*
• Уведомления о завершенных задачах
• Фото-отчеты от рабочих
• Возможность принимать/отклонять работы
\n❓ Для справки отправьте /help`;
  return sendMessage(chatId, msg, 'Markdown');
}

function help(chatId) {
  const msg = `�� *Справка по ЭлектроСервис боту*\n\nКоманды:\n/start — приветствие и связка аккаунта\n/help — справка`;
  return sendMessage(chatId, msg, 'Markdown');
}

async function poll() {
  try {
    const res = await fetch(`https://api.telegram.org/bot${TOKEN}/getUpdates?timeout=25&offset=${offset}&allowed_updates=[\"message\"]`);
    const data = await res.json();
    if (!data.ok) return setTimeout(poll, 1000);

    for (const upd of data.result) {
      offset = upd.update_id + 1;
      const msg = upd.message;
      if (!msg || !msg.text) continue;
      const text = msg.text.trim().toLowerCase();
      if (text === '/start') {
        await welcome(msg.from, msg.chat.id);
      } else if (text === '/help') {
        await help(msg.chat.id);
      }
    }
  } catch {}
  setTimeout(poll, 500);
}

console.log('🤖 Manager bot poller started. Waiting for /start ...');
poll();
