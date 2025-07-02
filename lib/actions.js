import fetch from 'node-fetch';
import { setTimeout as delay } from 'timers/promises';

// ================================================================= //
//                      KONFIGURASI & VARIABEL
// ================================================================= //

const {
    PANEL_DOMAIN,
    PANEL_API_KEY,
    PANEL_EGG_ID,
    PANEL_LOCATION_ID,
    ADMIN_ID,
    OWNER_NAME,
    BOT_NAME,
    BOT_LINK_SALURAN
} = process.env;

const PANEL_EMAIL_DOMAIN = 'warungerik.xyz';
const initialStock = {
    "1gb": 5, "2gb": 5, "3gb": 5, "4gb": 5, "5gb": 5,
    "6gb": 2, "7gb": 2, "8gb": 2, "9gb": 2, "10gb": 2, "unlimited": 1
};

// ================================================================= //
//                      FUNGSI-FUNGSI HELPER
// ================================================================= //

async function sendText(bot, chatId, text, options = {}) {
    try {
        await bot.sendMessage(chatId, text, { parse_mode: 'Markdown', ...options });
        return true;
    } catch (error) {
        console.error(`[!] Error mengirim pesan teks ke ${chatId}: ${error.message}`);
        return false;
    }
}

function getGreeting() {
    const timeZone = 'Asia/Jakarta';
    const localHour = new Date(new Date().toLocaleString("en-US", { timeZone })).getHours();
    if (localHour >= 5 && localHour < 11) return "Pagi";
    if (localHour >= 11 && localHour < 15) return "Siang";
    if (localHour >= 15 && localHour < 18) return "Sore";
    return "Malam";
}

function getCurrentWIBDateTime() {
    const now = new Date();
    const options = {
        timeZone: 'Asia/Jakarta', weekday: 'long', year: 'numeric', month: 'long',
        day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    };
    return new Intl.DateTimeFormat('id-ID', options).format(now).replace(/\./g, ':');
}

// ================================================================= //
//                  FUNGSI-FUNGSI DATABASE (SUPABASE)
// ================================================================= //

// --- User State ---
async function setUserState(supabase, userId, state) {
    const { error } = await supabase.from('user_states').upsert({ user_id: userId, state: state, updated_at: new Date() });
    if (error) console.error('Error setting user state:', error);
}

async function getUserState(supabase, userId) {
    const { data, error } = await supabase.from('user_states').select('state').eq('user_id', userId).single();
    if (error && error.code !== 'PGRST116') {
        console.error('Error getting user state:', error);
        return null;
    }
    return data ? data.state : null;
}

async function clearUserState(supabase, userId) {
    const { error } = await supabase.from('user_states').delete().eq('user_id', userId);
    if (error) console.error('Error clearing user state:', error);
}

// --- Stok ---
async function getStock(supabase) {
    let { data, error } = await supabase.from('stock').select('*').eq('id', 'panel_stock').single();
    if (error && error.code === 'PGRST116') {
        console.log("Stok tidak ditemukan, membuat stok awal...");
        const { data: newData, error: newError } = await supabase.from('stock').insert({
            id: 'panel_stock', variants: initialStock, last_replenished: new Date().toISOString()
        }).select().single();
        if (newError) {
            console.error("Gagal membuat stok awal:", newError);
            return { variants: {}, last_replenished: new Date(0) };
        }
        return newData;
    }
    if (error) {
        console.error("Gagal mengambil stok:", error);
        return { variants: {}, last_replenished: new Date(0) };
    }
    return data;
}

async function updateStock(supabase, newVariants) {
    const { error } = await supabase.from('stock').update({ variants: newVariants }).eq('id', 'panel_stock');
    if (error) console.error("Gagal update stok:", error);
}

async function resetStock(supabase) {
    const { error } = await supabase.from('stock').update({
        variants: initialStock, last_replenished: new Date().toISOString()
    }).eq('id', 'panel_stock');
    if (error) {
        console.error("Gagal mereset stok:", error);
        return false;
    }
    return true;
}

async function checkAndReplenishStock(supabase) {
    const panelStock = await getStock(supabase);
    const now = new Date();
    const lastReplenished = new Date(panelStock.last_replenished);
    const diffHours = (now - lastReplenished) / (1000 * 60 * 60);
    if (diffHours >= 24) {
        console.log('[i] Waktu reset stok tercapai. Mereset stok panel...');
        await resetStock(supabase);
        return true; // Menandakan stok telah direset
    }
    return false;
}

// --- Users ---
async function findUserById(supabase, userId) {
    const { data, error } = await supabase.from('users').select('*').eq('id', userId).single();
    if (error && error.code !== 'PGRST116') {
        console.error('Error finding user by ID:', error);
    }
    return data;
}

async function getRegisteredUsers(supabase) {
    const { data, error } = await supabase.from('users').select('id');
    if (error) {
        console.error('Error fetching registered users:', error);
        return [];
    }
    return data;
}

// --- Premium Users ---
async function getPremiumUsers(supabase) {
    const { data, error } = await supabase.from('premium_users').select('id');
    if (error) {
        console.error('Error fetching premium users:', error);
        return [];
    }
    return data.map(u => String(u.id)); // Kembalikan sebagai array of string
}

// ================================================================= //
//                      DEFINISI TOMBOL MENU
// ================================================================= //

const mainKeyboard = (isAdmin) => {
    const buttons = [
        [{ text: '🖥️ Buat Server Panel', callback_data: 'menu_panel' }, { text: '🗂️ List Server Saya', callback_data: 'list_my_panels' }],
        [{ text: '✅ Daftar Akun', callback_data: 'register_user' }, { text: '👑 Kontak Owner', callback_data: 'contact_owner' }],
        [{ text: '💬 Channel WhatsApp', url: BOT_LINK_SALURAN || 'https://whatsapp.com/channel/0029VbADFlg7dmegvsmBhv3F' }]
    ];
    if (isAdmin) {
        buttons.push([{ text: '⚙️ Menu Admin', callback_data: 'menu_admin' }]);
    }
    return { reply_markup: { inline_keyboard: buttons } };
};

const panelKeyboard = () => ({
    reply_markup: {
        inline_keyboard: [
            [{ text: '1GB', callback_data: 'create_1gb' }, { text: '2GB', callback_data: 'create_2gb' }, { text: '3GB', callback_data: 'create_3gb' }],
            [{ text: '4GB', callback_data: 'create_4gb' }, { text: '5GB', callback_data: 'create_5gb' }, { text: '6GB', callback_data: 'create_6gb' }],
            [{ text: '7GB', callback_data: 'create_7gb' }, { text: '8GB', callback_data: 'create_8gb' }, { text: '9GB', callback_data: 'create_9gb' }],
            [{ text: '10GB', callback_data: 'create_10gb' }, { text: 'UNLIMITED', callback_data: 'create_unlimited' }],
            [{ text: '« Kembali ke Menu Utama', callback_data: 'menu_main' }]
        ]
    }
});

const adminKeyboard = {
    reply_markup: {
        inline_keyboard: [
            [{ text: '🔄 Restok Panel', callback_data: 'admin_restock' }, { text: '👥 List Semua User', callback_data: 'admin_list_users' }],
            [{ text: '📊 Total Pengguna', callback_data: 'admin_total_users' }, { text: '📢 Kirim Broadcast', callback_data: 'admin_broadcast' }],
            [{ text: '➕ Tambah Admin Panel', callback_data: 'admin_create_admin' }, { text: '🗑️ Hapus User Panel', callback_data: 'admin_delete_user' }],
            [{ text: '➕ Tambah Premium', callback_data: 'admin_add_prem' }, { text: '➖ Hapus Premium', callback_data: 'admin_del_prem' }],
            [{ text: '📜 List Premium', callback_data: 'admin_list_prem' }],
            [{ text: '🔥 HAPUS SEMUA USER', callback_data: 'admin_clear_all' }],
            [{ text: '« Kembali ke Menu Utama', callback_data: 'menu_main' }]
        ]
    }
};

// ================================================================= //
//                  FUNGSI-FUNGSI PANEL PTERODACTYL
// ================================================================= //

async function checkUserHasServer(username) {
    const userEmail = `${username.toLowerCase()}@${PANEL_EMAIL_DOMAIN}`;
    try {
        const response = await fetch(`${PANEL_DOMAIN}/api/application/users?filter[email]=${encodeURIComponent(userEmail)}&include=servers`, { headers: { 'Authorization': `Bearer ${PANEL_API_KEY}`, 'Accept': 'application/json' } });
        if (!response.ok) {
            console.warn(`[!] Peringatan saat mengecek server pengguna: API Error ${response.status}`);
            return false;
        }
        const { data } = await response.json();
        if (!data || data.length === 0) return false;
        const servers = data[0].attributes.relationships.servers.data;
        return servers.length > 0;
    } catch (error) {
        console.error('[!] Error di checkUserHasServer:', error);
        return false;
    }
}

async function createPanelUserAndServer(bot, chatId, username, resources) {
    if (!PANEL_DOMAIN || !PANEL_API_KEY) {
        return sendText(bot, chatId, '❌ *Konfigurasi Panel Belum Diisi oleh Admin!*');
    }
    await sendText(bot, chatId, `⏳ Memulai pembuatan akun panel untuk *${username}*...`);
    const userEmail = `${username}@${PANEL_EMAIL_DOMAIN}`;
    const password = `${username}${Math.floor(Math.random() * 9000) + 1000}`;
    const serverName = `${username} Server`;
    const startupCommand = `if [[ -d .git ]] && [[ {{AUTO_UPDATE}} == "1" ]]; then git pull; fi; if [[ ! -z \${NODE_PACKAGES} ]]; then /usr/local/bin/npm install \${NODE_PACKAGES}; fi; if [[ ! -z \${UNNODE_PACKAGES} ]]; then /usr/local/bin/npm uninstall \${UNNODE_PACKAGES}; fi; if [ -f /home/container/package.json ]; then /usr/local/bin/npm install; fi; /usr/local/bin/node /home/container/{{CMD_RUN}}`;
    let userId;

    try {
        await sendText(bot, chatId, `[1/3] Membuat atau mencari user di panel...`);
        let userCreationResponse = await fetch(`${PANEL_DOMAIN}/api/application/users`, { method: 'POST', headers: { 'Authorization': `Bearer ${PANEL_API_KEY}`, 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify({ 'username': username, 'email': userEmail, 'first_name': username, 'last_name': 'User', 'password': password, 'language': 'en' }) });
        let userData = await userCreationResponse.json();

        if (userData.errors) {
            const errorDetail = userData.errors[0].detail;
            if (errorDetail && (errorDetail.includes('taken') || errorDetail.includes('exists'))) {
                await sendText(bot, chatId, `⚠️ User *${username}* sudah ada. Mencoba mengambil data...`);
                const usersListResponse = await fetch(`${PANEL_DOMAIN}/api/application/users?filter[email]=${encodeURIComponent(userEmail)}`, { headers: { 'Authorization': `Bearer ${PANEL_API_KEY}`, 'Accept': 'application/json' } });
                const usersListData = await usersListResponse.json();
                if (usersListData.data && usersListData.data.length > 0) {
                    userId = usersListData.data[0].attributes.id;
                    await sendText(bot, chatId, `✅ User ditemukan. Melanjutkan pembuatan server...`);
                } else { throw new Error(`Gagal menemukan user yang sudah ada: ${userEmail}`); }
            } else { throw new Error(`API Error (User): ${errorDetail}`); }
        } else {
            userId = userData.attributes.id;
        }

        const ramDisplay = resources.ram === 0 ? 'Unlimited' : `${resources.ram} MB`;
        const cpuDisplay = resources.cpu === 0 ? 'Unlimited' : `${resources.cpu} %`;
        const diskDisplay = resources.disk === 0 ? 'Unlimited' : `${resources.disk} MB`;
        await sendText(bot, chatId, `[2/3] Membuat server dengan resource:\n- RAM: ${ramDisplay}\n- CPU: ${cpuDisplay}\n- DISK: ${diskDisplay}`);
        const serverCreationResponse = await fetch(`${PANEL_DOMAIN}/api/application/servers`, { method: 'POST', headers: { 'Authorization': `Bearer ${PANEL_API_KEY}`, 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify({ "name": serverName, "user": userId, "egg": parseInt(PANEL_EGG_ID), "docker_image": "ghcr.io/parkervcp/yolks:nodejs_21", "startup": startupCommand, "environment": { "CMD_RUN": "index.js" }, "limits": { "memory": resources.ram, "swap": 0, "disk": resources.disk, "io": 500, "cpu": resources.cpu }, "feature_limits": { "databases": 5, "allocations": 1, "backups": 5 }, "deploy": { "locations": [parseInt(PANEL_LOCATION_ID)], "dedicated_ip": false, "port_range": [] } }) });
        const serverData = await serverCreationResponse.json();
        if (serverData.errors) { throw new Error(`API Error (Server): ${serverData.errors[0].detail}`); }

        await sendText(bot, chatId, `[3/3] Mengirim detail akun...`);
        const detailMessage = `*『 AKUN PANEL ANDA BERHASIL DIBUAT 』*\n\nBerikut adalah detail akun Anda:\n\n*👤 USERNAME:* \`${username}\`\n*🔐 PASSWORD:* \`${password}\`\n*🌐 LOGIN PANEL:* ${PANEL_DOMAIN}\n\n*📊 DETAIL SERVER:*\n- SERVER ID: \`${serverData.attributes.id}\`\n- RAM: ${ramDisplay}\n- DISK: ${diskDisplay}\n- CPU: ${cpuDisplay}\n\n*NOTE:*\n1. Server ini akan expired setelah 3 hari.\n2. Gunakan dengan sebaik mungkin panel ini.\n\nTerima kasih, semoga bermanfaat.`;
        await sendText(bot, chatId, detailMessage, { disable_web_page_preview: true });
        return true;
    } catch (error) {
        console.error('[!] Gagal membuat akun panel:', error);
        await sendText(bot, chatId, `❌ *PROSES GAGAL!*\n\nTerjadi kesalahan: ${error.message}`);
        return false;
    }
}

// --- (Fungsi-fungsi panel lainnya seperti list, delete, dll, bisa ditambahkan di sini dengan pola yang sama) ---

// ================================================================= //
//                      HANDLER UTAMA UNTUK WEBHOOK
// ================================================================= //

export async function handleMessage(bot, supabase, msg) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = (msg.text || msg.caption || '').trim();

    if (msg.from.is_bot) return;

    // --- Penanganan Perintah /start ---
    if (text.startsWith('/start')) {
        const isAdmin = String(userId) === ADMIN_ID;
        const greeting = getGreeting();
        const menuText = `Halo *${msg.from.first_name}* 👋\nSelamat ${greeting}, ${BOT_NAME} siap membantu!\n\nSilakan pilih menu di bawah ini:`;
        return sendText(bot, chatId, menuText, mainKeyboard(isAdmin));
    }

    // --- Penanganan State Percakapan ---
    const userState = await getUserState(supabase, userId);
    if (userState) {
        await clearUserState(supabase, userId); // Hapus state setelah diproses

        switch (userState.action) {
            case 'await_name':
                const name = text.replace(/[^a-zA-Z0-9 ]/g, '').trim();
                if (!name) return sendText(bot, chatId, "❌ Nama tidak valid. Silakan coba lagi.");

                const { error } = await supabase.from('users').insert({ id: userId, name: name });
                if (error) {
                    if (error.code === '23505') { // unique violation
                        await sendText(bot, chatId, `✅ Anda sudah terdaftar sebelumnya.`);
                    } else {
                        console.error("Gagal mendaftar:", error);
                        await sendText(bot, chatId, `❌ Terjadi kesalahan saat mendaftar.`);
                    }
                } else {
                    await sendText(bot, chatId, `✅ *Pendaftaran Berhasil, ${name}!*`);
                }
                break;

            case 'await_username':
                const username = text.toLowerCase().replace(/[^a-z0-9_]/g, '');
                if (!username) return sendText(bot, chatId, "❌ Username tidak valid. Hanya boleh huruf kecil, angka, dan underscore (_).");

                const type = userState.type;
                const user = await findUserById(supabase, userId);
                const premiumUsers = await getPremiumUsers(supabase);
                const isAuthorizedBypass = String(userId) === ADMIN_ID || premiumUsers.includes(String(userId));

                if (!isAuthorizedBypass) {
                    if (!user) return sendText(bot, chatId, `Anda belum terdaftar. Silakan klik tombol "Daftar Akun" di menu utama.`);
                    if (user.last_panel_creation) {
                        const diffHours = (new Date() - new Date(user.last_panel_creation)) / (1000 * 60 * 60);
                        if (diffHours < 72) return sendText(bot, chatId, `🕒 *Cooldown Aktif!*\nAnda hanya bisa membuat server setiap 3 hari sekali.`);
                    }
                    const stock = await getStock(supabase);
                    if (stock.variants[type] <= 0) return sendText(bot, chatId, `❌ *Stok Habis!*\nMaaf, stok untuk panel *${type.toUpperCase()}* telah habis.`);
                }

                if (await checkUserHasServer(username)) {
                    return sendText(bot, chatId, `❌ *Gagal!* Username panel \`${username}\` sudah memiliki server aktif.`);
                }

                const resources = {
                    "1gb": { ram: 1024, disk: 2048, cpu: 30 }, "2gb": { ram: 2048, disk: 4096, cpu: 50 },
                    "3gb": { ram: 3072, disk: 6144, cpu: 70 }, "4gb": { ram: 4096, disk: 8192, cpu: 90 },
                    "5gb": { ram: 5120, disk: 10240, cpu: 110 }, "6gb": { ram: 6144, disk: 12288, cpu: 130 },
                    "7gb": { ram: 7168, disk: 14336, cpu: 150 }, "8gb": { ram: 8192, disk: 16384, cpu: 170 },
                    "9gb": { ram: 9216, disk: 18432, cpu: 190 }, "10gb": { ram: 10240, disk: 20480, cpu: 210 },
                    "unlimited": { ram: 0, disk: 0, cpu: 0 }
                }[type];

                const isSuccess = await createPanelUserAndServer(bot, chatId, username, resources);
                if (isSuccess) {
                    if (!isAuthorizedBypass) {
                        const stock = await getStock(supabase);
                        stock.variants[type]--;
                        await updateStock(supabase, stock.variants);
                    }
                    await supabase.from('users').update({
                        last_panel_creation: new Date().toISOString(), panel_username: username
                    }).eq('id', userId);

                    const adminNotificationMessage = `🔔 Pengguna *${msg.from.first_name}* (\`${userId}\`) telah membuat server:\n- Tipe: *${type.toUpperCase()}*\n- Username: \`${username}\``;
                    await sendText(bot, ADMIN_ID, adminNotificationMessage);
                }
                break;
            
            // ... (State-state lainnya dari admin) ...
        }
    }
}

export async function handleCallbackQuery(bot, supabase, callbackQuery) {
    const msg = callbackQuery.message;
    const chatId = msg.chat.id;
    const userId = callbackQuery.from.id;
    const data = callbackQuery.data;
    const isAdmin = String(userId) === ADMIN_ID;

    bot.answerCallbackQuery(callbackQuery.id);

    if (data.startsWith('create_')) {
        const type = data.split('_')[1];
        await setUserState(supabase, userId, { action: 'await_username', type: type });
        await sendText(bot, chatId, `Anda memilih server *${type.toUpperCase()}*.\nSilakan ketik username yang Anda inginkan untuk panel:`);
        return;
    }

    switch (data) {
        case 'menu_main':
            const greeting = getGreeting();
            const menuText = `Halo *${callbackQuery.from.first_name}* 👋\nSelamat ${greeting}\n\nSilakan pilih menu di bawah ini:`;
            try {
                await bot.editMessageText(menuText, {
                    chat_id: chatId, message_id: msg.message_id,
                    parse_mode: 'Markdown', ...mainKeyboard(isAdmin)
                });
            } catch (e) { /* Ignore error if message is not modified */ }
            break;

        case 'menu_panel':
            await checkAndReplenishStock(supabase);
            const stockData = await getStock(supabase);
            let panelMenuText = '*Silakan Pilih Tipe Server Panel*\n\n';
            if (stockData && stockData.variants) {
                Object.keys(initialStock).forEach(p => {
                    panelMenuText += `Stok *${p.toUpperCase()}*: ${stockData.variants[p] || 0}\n`;
                });
            } else {
                panelMenuText = "Maaf, gagal memuat data stok.";
            }
            try {
                await bot.editMessageText(panelMenuText, {
                    chat_id: chatId, message_id: msg.message_id,
                    parse_mode: 'Markdown', ...panelKeyboard()
                });
            } catch (e) { /* Ignore error */ }
            break;

        case 'register_user':
            const user = await findUserById(supabase, userId);
            if (user) {
                return sendText(bot, chatId, `✅ Anda sudah terdaftar dengan nama *${user.name}*.`);
            }
            await setUserState(supabase, userId, { action: 'await_name' });
            await sendText(bot, chatId, '📝 Silakan ketik nama yang ingin Anda daftarkan:');
            break;
        
        case 'contact_owner':
            await sendText(bot, chatId, `Ini adalah kontak owner saya, *${OWNER_NAME}*!`);
            // Anda perlu memasukkan nomor telepon owner secara manual atau dari env
            // bot.sendContact(chatId, '628xxxxxxxxxx', OWNER_NAME);
            break;

        case 'menu_admin':
            if (!isAdmin) return;
            const adminMenuText = `*⚙️ Menu Administrasi*\n\nSelamat datang, Admin. Silakan pilih aksi di bawah.`;
             try {
                await bot.editMessageText(adminMenuText, {
                    chat_id: chatId, message_id: msg.message_id,
                    parse_mode: 'Markdown', ...adminKeyboard
                });
            } catch (e) { /* Ignore error */ }
            break;

        case 'admin_restock':
            if (!isAdmin) return;
            if (await resetStock(supabase)) {
                await sendText(bot, chatId, '✅ *Stok Berhasil Direset Manual!*');
            } else {
                await sendText(bot, chatId, '❌ Gagal mereset stok.');
            }
            break;
        
        // ... (Handler untuk semua callback data admin lainnya) ...
    }
}

// ================================================================= //
//                      FUNGSI UNTUK CRON JOB
// ================================================================= //

export async function runAutoDeletionCheck(bot, supabase) {
    console.log('[CRON] Menjalankan pengecekan penghapusan panel otomatis...');
    if (!PANEL_DOMAIN || !PANEL_API_KEY) {
        console.log('[CRON] Konfigurasi panel belum diisi. Pengecekan dibatalkan.');
        return;
    }

    try {
        const response = await fetch(`${PANEL_DOMAIN}/api/application/servers?include=user`, {
            headers: { 'Authorization': `Bearer ${PANEL_API_KEY}`, 'Accept': 'application/json' }
        });
        if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
        const { data } = await response.json();
        if (!data) return;

        for (const server of data) {
            const serverAttr = server.attributes;
            if (!serverAttr.relationships || !serverAttr.relationships.user) continue;
            const userAttr = serverAttr.relationships.user.attributes;

            if (userAttr.root_admin) continue;

            const serverCreationDate = new Date(serverAttr.created_at);
            const now = new Date();
            const ageInDays = (now - serverCreationDate) / (1000 * 60 * 60 * 24);

            if (ageInDays >= 3) {
                const serverId = serverAttr.id;
                const userId = userAttr.id;
                console.log(`[CRON] Server ${serverAttr.name} (${serverId}) berumur ${ageInDays.toFixed(1)} hari, akan dihapus.`);

                // Hapus server
                const deleteServerRes = await fetch(`${PANEL_DOMAIN}/api/application/servers/${serverId}/force`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${PANEL_API_KEY}` } });
                if (deleteServerRes.status !== 204) {
                     console.error(`[CRON] Gagal menghapus server ID: ${serverId}.`);
                     continue; // Lanjut ke server berikutnya
                }
                
                await delay(1000); // Jeda sebelum hapus user

                // Hapus user
                const deleteUserRes = await fetch(`${PANEL_DOMAIN}/api/application/users/${userId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${PANEL_API_KEY}` } });

                const reportMsg = `♻️ *Pembersihan Otomatis* ♻️\nServer *${serverAttr.name}* milik *${userAttr.username}* telah dihapus karena melebihi batas 3 hari.`;
                await sendText(bot, ADMIN_ID, reportMsg);

                // Cari user di DB bot dan kirim notif (jika ada)
                const {data: botUser} = await supabase.from('users').select('id').eq('panel_username', userAttr.username).single();
                if(botUser) {
                    await sendText(bot, botUser.id, `PEMBERITAHUAN: Server panel Anda *(${serverAttr.name})* telah dihapus secara otomatis karena telah melewati batas waktu 3 hari.`);
                }
            }
        }
    } catch (e) {
        console.error('[CRON] Gagal total saat menjalankan pengecekan:', e);
        await sendText(bot, ADMIN_ID, `❌ Cron Job Gagal: ${e.message}`);
    }
    console.log('[CRON] Pengecekan selesai.');
}
