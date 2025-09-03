#!/usr/bin/env node

// Простой тест менеджерского бота без webhook
const MANAGER_BOT_TOKEN = "8004824610:AAFJQATOO_IJc8l-6yw9ZOzHcufpHSFt4RI";
const TEST_CHAT_ID = "481890";

async function testManagerBot() {
  console.log("🤖 Тестируем менеджерский бот @ElectroServiceManagerBot");
  console.log("=".repeat(55));
  
  try {
    // 1. Проверяем информацию о боте
    console.log("1️⃣ Проверяем информацию о боте...");
    const botInfoResponse = await fetch(`https://api.telegram.org/bot${MANAGER_BOT_TOKEN}/getMe`);
    const botInfo = await botInfoResponse.json();
    
    if (botInfo.ok) {
      console.log(`   ✅ @${botInfo.result.username} - ${botInfo.result.first_name}`);
    } else {
      console.log("   ❌ Ошибка получения информации о боте");
      return;
    }

    // 2. Отправляем приветственное сообщение
    console.log("\n2️⃣ Отправляем приветственное сообщение...");
    const welcomeMessage = `👋 *Добро пожаловать в ЭлектроСервис!*

🤖 *Менеджерский бот* для управления командой

🔗 *Ваш Telegram ID:* \`${TEST_CHAT_ID}\`

📋 *Доступные функции:*
• 📊 Дашборд с аналитикой  
• 📋 Управление задачами
• ✅ Приёмка выполненных работ
• 👥 Мониторинг команды
• 🔔 Уведомления о задачах

🚀 *Для доступа к панели:*
Нажмите Menu → "🔧 ЭлектроСервис MANAGER"

❓ *Команды:* /help`;

    const messageResponse = await fetch(`https://api.telegram.org/bot${MANAGER_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TEST_CHAT_ID,
        text: welcomeMessage,
        parse_mode: 'Markdown'
      })
    });

    const messageResult = await messageResponse.json();
    
    if (messageResult.ok) {
      console.log(`   ✅ Сообщение отправлено! Message ID: ${messageResult.result.message_id}`);
    } else {
      console.log(`   ❌ Ошибка отправки: ${messageResult.description}`);
      
      if (messageResult.error_code === 403) {
        console.log("\n🔧 ИНСТРУКЦИЯ ПО ИСПРАВЛЕНИЮ:");
        console.log("1. Откройте Telegram");
        console.log("2. Найдите @ElectroServiceManagerBot");  
        console.log("3. Нажмите 'Разблокировать' или 'Start'");
        console.log("4. Попробуйте снова");
        return;
      }
    }

    // 3. Проверяем меню
    console.log("\n3️⃣ Проверяем меню бота...");
    const menuResponse = await fetch(`https://api.telegram.org/bot${MANAGER_BOT_TOKEN}/getChatMenuButton?chat_id=${TEST_CHAT_ID}`);
    const menuResult = await menuResponse.json();
    
    if (menuResult.ok && menuResult.result.menu_button) {
      const menu = menuResult.result.menu_button;
      console.log(`   ✅ Меню: "${menu.text}"`);
      console.log(`   🔗 URL: ${menu.web_app?.url || 'Не установлен'}`);
    } else {
      console.log("   ⚠️ Меню не настроено или недоступно");
    }

    console.log("\n🎉 Тест завершен!");
    console.log("\n📱 Что проверить в Telegram:");
    console.log("• Найдите @ElectroServiceManagerBot");
    console.log("• Убедитесь что бот разблокирован");
    console.log("• Отправьте /start");
    console.log("• Нажмите Menu → 'ЭлектроСервис MANAGER'");

  } catch (error) {
    console.error("❌ Ошибка тестирования:", error.message);
  }
}

testManagerBot();
