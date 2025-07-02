import TelegramBot from 'node-telegram-bot-api';
import 'dotenv/config';

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  throw new Error('Telegram Bot Token is required!');
}

const bot = new TelegramBot(token);

// URL webhook akan diatur saat deploy
const vercelUrl = process.env.VERCEL_URL;
if (vercelUrl) {
    const webhookUrl = `https://${vercelUrl}/api/webhook`;
    bot.setWebHook(webhookUrl);
    console.log(`Webhook is set to ${webhookUrl}`);
}


export default bot;