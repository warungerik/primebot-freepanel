import bot from '../lib/bot.js';
import { supabase } from '../lib/supabase.js';
// Impor fungsi-fungsi yang telah dimodifikasi dari actions.js
// import { handleMessage, handleCallbackQuery } from '../lib/actions.js';

export default async (request, response) => {
  if (request.method !== 'POST') {
    return response.status(405).send('Method Not Allowed');
  }

  try {
    const update = request.body;
    
    // Logika yang sebelumnya ada di bot.on('message', ...) dan bot.on('callback_query', ...)
    // akan dipanggil dari sini.
    // Contoh sederhana:
    if (update.message) {
      const msg = update.message;
      const chatId = msg.chat.id;
      // Panggil fungsi yang sesuai dari actions.js
      // await handleMessage(msg, supabase);
      await bot.sendMessage(chatId, 'Webhook received your message!');

    } else if (update.callback_query) {
      const query = update.callback_query;
      const chatId = query.message.chat.id;
      // Panggil fungsi yang sesuai dari actions.js
      // await handleCallbackQuery(query, supabase);
       await bot.sendMessage(chatId, 'Webhook received your callback!');
    }

    response.status(200).send('OK');
  } catch (error) {
    console.error('Error processing webhook:', error);
    response.status(500).send('Internal Server Error');
  }
};