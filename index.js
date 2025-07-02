// SCRIPT BY WARUNGERIK - VERSI TELEGRAM
// ORDER ATAU TANYA TANYA BISA KE 
// WHATSAPP : 085183129647
// TELEGRAM : @WARUNGERIK
// --- VERSI FINAL - MODIFIKASI OLEH GEMINI (23/06/2025) ---

import TelegramBot from 'node-telegram-bot-api';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import archiver from 'archiver';
import config from './config.js';
import { setTimeout as delay } from 'timers/promises';

// ================================================================= //
//                      KONFIGURASI & VARIABEL GLOBAL
// ================================================================= //

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Inisialisasi Bot Telegram
if (!config.botToken || config.botToken === 'MASUKKAN_TOKEN_BOT_TELEGRAM_ANDA_DI_SINI') {
    console.error("[!] KESALAHAN: Token bot belum diatur di config.js. Silakan isi `botToken`.");
    process.exit(1);
}
const bot = new TelegramBot(config.botToken, { polling: true });

// Variabel Global dari Config
global.domain = config.domain;
global.apikey = config.apikey;
global.eggsnya = config.eggsnya;
global.location = config.location;
global.namasaluran = "WARUNGERIK";
global.linksaluran = "https://whatsapp.com/channel/0029VbADFlg7dmegvsmBhv3F";

const ADMIN_ID = String(config.adminNumber);
const STARTUP_NOTIFICATION_ID = String(config.startupNotificationNumber);
const OWNER_NAME = config.ownerName;
const BOT_NAME = config.botName;
const BOT_VERSION = config.botVersion;
const PANEL_EMAIL_DOMAIN = 'warungerik.xyz';

// Path File
const PREMIUM_USERS_FILE = path.join(__dirname, 'json/premium.json');
const REGISTERED_USERS_FILE = path.join(__dirname, 'json/users.json');
const STOCK_FILE = path.join(__dirname, 'json/stock.json');
const THUMBNAIL_IMAGE_PATH = path.join(__dirname, 'img/menu.jpg');

// Variabel State
let premiumUsers = [];
let registeredUsers = [];
let panelStock = {};
let autoDeletionTaskStarted = false;
const userState = new Map();

// Pastikan folder json ada
if (!fs.existsSync(path.join(__dirname, 'json'))) {
    fs.mkdirSync(path.join(__dirname, 'json'), { recursive: true });
}

const initialStock = {
    "1gb": 5, "2gb": 5, "3gb": 5, "4gb": 5, "5gb": 5,
    "6gb": 2, "7gb": 2, "8gb": 2, "9gb": 2, "10gb": 2, "unlimited": 1
};


// ================================================================= //
//                      FUNGSI-FUNGSI UTILITAS
// ================================================================= //

function saveStock() {
    fs.writeFileSync(STOCK_FILE, JSON.stringify(panelStock, null, 2));
}

function loadStock() {
    try {
        if (fs.existsSync(STOCK_FILE)) {
            panelStock = JSON.parse(fs.readFileSync(STOCK_FILE, 'utf-8'));
            console.log('[i] Berhasil memuat data stok panel.');
        } else {
            panelStock = { lastReplenished: new Date().toISOString(), variants: { ...initialStock } };
            saveStock();
            console.log('[i] File stock.json dibuat dengan stok awal.');
        }
    } catch (e) {
        console.error('[!] Gagal memuat atau membuat stock.json:', e);
        panelStock = { lastReplenished: new Date().toISOString(), variants: { ...initialStock } };
    }
}

async function checkAndReplenishStock() {
    const now = new Date();
    const lastReplenished = new Date(panelStock.lastReplenished);
    const diffHours = (now - lastReplenished) / (1000 * 60 * 60);
    if (diffHours >= 24) {
        console.log('[i] Waktu reset stok tercapai. Mereset stok panel...');
        panelStock.lastReplenished = now.toISOString();
        panelStock.variants = { ...initialStock };
        saveStock();
        if (STARTUP_NOTIFICATION_ID) {
            try {
                await sendText(STARTUP_NOTIFICATION_ID, '✅ *Informasi:* Stok panel telah berhasil direset secara otomatis.');
            } catch (e) {
                console.error('[!] Gagal mengirim notifikasi reset stok:', e);
            }
        }
    }
}

async function runAutoDeletionCheck() {
    console.log('[AUTO-DELETE] Menjalankan pengecekan penghapusan panel otomatis...');
    if (global.domain === 'https://panel.example.com' || global.apikey === 'ptla_xxxxxxxxxxxx' || global.domain === '-') {
        console.log('[AUTO-DELETE] Konfigurasi panel belum diisi. Pengecekan dibatalkan.');
        return;
    }
    try {
        const response = await fetch(`${global.domain}/api/application/servers?include=user`, { headers: { 'Authorization': `Bearer ${global.apikey}`, 'Accept': 'application/json' } });
        if (!response.ok) { throw new Error(`API Error: ${response.statusText}`); }
        const { data } = await response.json();
        for (const server of data) {
            const serverAttr = server.attributes;
            const userAttr = serverAttr.relationships.user.attributes;
            if (userAttr.root_admin) { continue; }
            const serverCreationDate = new Date(serverAttr.created_at);
            const now = new Date();
            const ageInDays = (now - serverCreationDate) / (1000 * 60 * 60 * 24);
            if (ageInDays >= 3) {
                const serverId = serverAttr.id;
                const userId = userAttr.id;
                const serverName = serverAttr.name;
                const userName = userAttr.username;
                console.log(`[AUTO-DELETE] Server ${serverName} (${serverId}) berumur ${ageInDays.toFixed(1)} hari, melebihi 3 hari. Memulai penghapusan.`);
                try {
                    const deleteServerRes = await fetch(`${global.domain}/api/application/servers/${serverId}/force`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${global.apikey}` } });
                    if (deleteServerRes.status === 204) {
                        console.log(`[AUTO-DELETE] Berhasil menghapus server ID: ${serverId}`);
                        let userStatus = "Gagal Dihapus";
                        try {
                            await delay(1000);
                            const deleteUserRes = await fetch(`${global.domain}/api/application/users/${userId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${global.apikey}` } });
                            if (deleteUserRes.status === 204) { userStatus = "Berhasil Dihapus"; console.log(`[AUTO-DELETE] Berhasil menghapus user ID: ${userId}`); } else { userStatus = `Gagal Dihapus (Status: ${deleteUserRes.status})`; console.warn(`[AUTO-DELETE] Gagal menghapus user ID: ${userId}. ${userStatus}`); }
                        } catch (userError) {
                            userStatus = "Error saat mencoba menghapus";
                            console.error(`[AUTO-DELETE] Error saat proses hapus user ID ${userId}:`, userError);
                        }
                        const notifMessage = `*PEMBERITAHUAN PENGHAPUSAN OTOMATIS* ♻️\n\nSistem telah menghapus server yang kedaluwarsa:\n\n*🖥️ Server Dihapus:*\n- Nama: *${serverName}*\n- ID: \`${serverId}\`\n- Umur: *${ageInDays.toFixed(1)} hari*\n\n*👤 User Terkait:*\n- Username: *${userName}*\n- ID: \`${userId}\`\n- Status: *${userStatus}*`;
                        await sendText(ADMIN_ID, notifMessage);
                    } else {
                        console.error(`[AUTO-DELETE] Gagal menghapus server ID: ${serverId}. Status: ${deleteServerRes.status}`);
                    }
                } catch (e) {
                    console.error(`[AUTO-DELETE] Terjadi error saat proses hapus untuk server ID ${serverId}:`, e);
                }
                await delay(2000);
            }
        }
    } catch (e) { console.error('[AUTO-DELETE] Gagal total saat menjalankan pengecekan:', e); }
    console.log('[AUTO-DELETE] Pengecekan selesai.');
}

function loadPremiumUsers() {
    try {
        if (fs.existsSync(PREMIUM_USERS_FILE)) {
            const data = fs.readFileSync(PREMIUM_USERS_FILE, 'utf-8');
            premiumUsers = JSON.parse(data);
            console.log(`[i] Memuat ${premiumUsers.length} pengguna premium.`);
        } else {
            fs.writeFileSync(PREMIUM_USERS_FILE, JSON.stringify([], null, 2));
            console.log('[i] File premium.json dibuat.');
        }
    } catch (e) {
        console.error('[!] Gagal memuat premium.json:', e);
        premiumUsers = [];
    }
}

function savePremiumUsers() {
    fs.writeFileSync(PREMIUM_USERS_FILE, JSON.stringify(premiumUsers, null, 2));
}

function loadRegisteredUsers() {
    try {
        if (fs.existsSync(REGISTERED_USERS_FILE)) {
            const data = fs.readFileSync(REGISTERED_USERS_FILE, 'utf-8');
            registeredUsers = JSON.parse(data);
            console.log(`[i] Memuat ${registeredUsers.length} pengguna terdaftar.`);
        } else {
            fs.writeFileSync(REGISTERED_USERS_FILE, JSON.stringify([], null, 2));
            console.log('[i] File users.json dibuat.');
        }
    } catch (e) {
        console.error('[!] Gagal memuat users.json:', e);
        registeredUsers = [];
    }
}

function saveRegisteredUsers() {
    fs.writeFileSync(REGISTERED_USERS_FILE, JSON.stringify(registeredUsers, null, 2));
}

async function sendText(chatId, text, options = {}) {
    try {
        await bot.sendMessage(chatId, text, {
            parse_mode: 'Markdown',
            ...options
        });
        return true;
    } catch (error) {
        console.log(`[!] Error mengirim pesan teks ke ${chatId}: ${error.message}`);
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
        timeZone: 'Asia/Jakarta',
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    };
    return new Intl.DateTimeFormat('id-ID', options).format(now).replace(/\./g, ':');
}

async function createScriptBackup(chatId) {
    const zipFilePath = path.join(__dirname, 'backup.zip');
    try {
        await new Promise((resolve, reject) => {
            const output = fs.createWriteStream(zipFilePath);
            const archive = archiver('zip', { zlib: { level: 9 } });
            output.on('close', () => {
                console.log(`[i] Backup script berhasil dibuat: ${archive.pointer()} total bytes`);
                resolve();
            });
            archive.on('warning', (err) => err.code === 'ENOENT' ? console.warn('[!] Peringatan archiver:', err) : reject(err));
            archive.on('error', (err) => reject(err));
            archive.pipe(output);
            archive.glob('**/*', {
                cwd: __dirname,
                ignore: ['node_modules/**', 'backup.zip', 'sesi/**', '.env', '.log', '.npm', 'json/**']
            });
            archive.finalize();
        });
        return zipFilePath;
    } catch (error) {
        console.error('[!] Gagal membuat backup script:', error);
        await sendText(chatId, `❌ Gagal total saat membuat file backup: ${error.message}`);
        return null;
    }
}

async function checkUserHasServer(username) {
    const userEmail = `${username.toLowerCase()}@${PANEL_EMAIL_DOMAIN}`;
    try {
        const response = await fetch(`${global.domain}/api/application/users?filter[email]=${encodeURIComponent(userEmail)}&include=servers`, { headers: { 'Authorization': `Bearer ${global.apikey}`, 'Accept': 'application/json' } });
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

async function createPanelUserAndServer(chatId, username, resources) {
    if (global.domain === 'https://panel.example.com' || global.apikey === 'ptla_xxxxxxxxxxxx' || global.domain === '-') {
        await sendText(chatId, '❌ *Konfigurasi Panel Belum Diisi!*\n\nHarap edit file `config.js` dan isi variabel `domain` dan `apikey`.');
        return false;
    }
    await sendText(chatId, `⏳ Memulai pembuatan akun panel untuk *${username}*...`);
    const userEmail = `${username}@${PANEL_EMAIL_DOMAIN}`;
    const now = new Date();
    const options = { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'long', year: 'numeric' };
    const creationDate = new Intl.DateTimeFormat('id-ID', options).format(now);
    const serverDescription = `${creationDate}.`;
    const password = `${username}${Math.floor(Math.random() * 9000) + 1000}`;
    const serverName = `${username} Server`;
    const startupCommand = `if [[ -d .git ]] && [[ {{AUTO_UPDATE}} == "1" ]]; then git pull; fi; if [[ ! -z \${NODE_PACKAGES} ]]; then /usr/local/bin/npm install \${NODE_PACKAGES}; fi; if [[ ! -z \${UNNODE_PACKAGES} ]]; then /usr/local/bin/npm uninstall \${UNNODE_PACKAGES}; fi; if [ -f /home/container/package.json ]; then /usr/local/bin/npm install; fi; if [[ ! -z \${CUSTOM_ENVIRONMENT_VARIABLES} ]]; then vars=$(echo \${CUSTOM_ENVIRONMENT_VARIABLES} | tr ";" "\\n"); for line in $vars; do export $line; done; fi; /usr/local/bin/node /home/container/{{CMD_RUN}}`;
    let userId;
    try {
        await sendText(chatId, `[1/3] Membuat atau mencari user di panel...`);
        let userCreationResponse = await fetch(`${global.domain}/api/application/users`, { method: 'POST', headers: { 'Authorization': `Bearer ${global.apikey}`, 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify({ 'username': username, 'email': userEmail, 'first_name': username, 'last_name': 'User', 'password': password, 'language': 'en' }) });
        let userData = await userCreationResponse.json();
        if (userData.errors) {
            const errorDetail = userData.errors[0].detail;
            if (errorDetail && (errorDetail.includes('taken') || errorDetail.includes('exists'))) {
                await sendText(chatId, `⚠️ User *${username}* sudah ada. Mencoba mengambil data user yang ada...`);
                const usersListResponse = await fetch(`${global.domain}/api/application/users?filter[email]=${encodeURIComponent(userEmail)}`, { headers: { 'Authorization': `Bearer ${global.apikey}`, 'Accept': 'application/json' } });
                const usersListData = await usersListResponse.json();
                if (usersListData.data && usersListData.data.length > 0) {
                    userId = usersListData.data[0].attributes.id;
                    await sendText(chatId, `✅ User ditemukan dengan ID: ${userId}. Melanjutkan pembuatan server...`);
                } else {
                    throw new Error(`Gagal menemukan user yang sudah ada dengan email: ${userEmail}`);
                }
            } else {
                throw new Error(`API Error (User): ${errorDetail}`);
            }
        } else {
            userId = userData.attributes.id;
        }
        const ramDisplay = resources.ram === 0 ? 'Unlimited' : `${resources.ram} MB`;
        const cpuDisplay = resources.cpu === 0 ? 'Unlimited' : `${resources.cpu} %`;
        const diskDisplay = resources.disk === 0 ? 'Unlimited' : `${resources.disk} MB`;
        await sendText(chatId, `[2/3] Membuat server dengan resource:\n- RAM: ${ramDisplay}\n- CPU: ${cpuDisplay}\n- DISK: ${diskDisplay}`);
        const serverCreationResponse = await fetch(`${global.domain}/api/application/servers`, { method: 'POST', headers: { 'Authorization': `Bearer ${global.apikey}`, 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify({ "name": serverName, "description": serverDescription, "user": userId, "egg": parseInt(global.eggsnya), "docker_image": "ghcr.io/parkervcp/yolks:nodejs_21", "startup": startupCommand, "environment": { "CMD_RUN": "index.js" }, "limits": { "memory": resources.ram, "swap": 0, "disk": resources.disk, "io": 500, "cpu": resources.cpu }, "feature_limits": { "databases": 5, "allocations": 1, "backups": 5 }, "deploy": { "locations": [parseInt(global.location)], "dedicated_ip": false, "port_range": [] } }) });
        const serverData = await serverCreationResponse.json();
        if (serverData.errors) {
            throw new Error(`API Error (Server): ${serverData.errors[0].detail}`);
        }
        await sendText(chatId, `[3/3] Mengirim detail akun...`);
        const detailMessage = `*『 AKUN PANEL ANDA BERHASIL DIBUAT 』*\n\n` +
            `Berikut adalah detail akun Anda:\n\n` +
            `*👤 USERNAME:* \`${username}\`\n` +
            `*🔐 PASSWORD:* \`${password}\`\n` +
            `*🌐 LOGIN PANEL:* https://sfl.gl/MUvi2\n\n` +
            `*📊 DETAIL SERVER:*\n` +
            `*- DESKRIPSI:* ${serverDescription}\n` +
            `*- SERVER ID:* \`${serverData.attributes.id}\`\n` +
            `*- RAM:* ${ramDisplay}\n` +
            `*- DISK:* ${diskDisplay}\n` +
            `*- CPU:* ${cpuDisplay}\n\n` +
            `*NOTE:*\n` +
            `1. Server ini akan expired setelah 3 hari.\n` +
            `2. Gunakan dengan sebaik mungkin panel ini.\n\n` +
            `Terima kasih, semoga bermanfaat panelnya.\n` +
            `Jangan lupa follow saluran *WARUNGERIK*`;
        await sendText(chatId, detailMessage, { disable_web_page_preview: true });
        await sendText(chatId, `✅ *SUKSES!*\n\nAkun panel *${username}* telah berhasil dibuat.`);
        return true;
    } catch (error) {
        console.error('[!] Gagal membuat akun panel:', error);
        await sendText(chatId, `❌ *PROSES GAGAL!*\n\nTerjadi kesalahan: ${error.message}`);
        return false;
    }
}

async function createAdminPanelUserAndServer(chatId, username) {
    if (global.domain === 'https://panel.example.com' || global.apikey === 'ptla_xxxxxxxxxxxx' || global.domain === '-') {
        await sendText(chatId, '❌ *Konfigurasi Panel Belum Diisi!*\n\nHarap edit file `config.js` dan isi variabel `domain` dan `apikey`.');
        return false;
    }
    await sendText(chatId, `⏳ Memulai pembuatan akun ROOT ADMIN untuk *${username}*...`);
    const userEmail = `${username}@${PANEL_EMAIL_DOMAIN}`;
    const now = new Date();
    const options = { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'long', year: 'numeric' };
    const creationDate = new Intl.DateTimeFormat('id-ID', options).format(now);
    const serverDescription = `Admin Creation - ${creationDate}.`;
    const password = `${username}${Math.floor(Math.random() * 9000) + 1000}`;
    const serverName = `${username} Admin Server`;
    const startupCommand = `if [[ -d .git ]] && [[ {{AUTO_UPDATE}} == "1" ]]; then git pull; fi; if [[ ! -z \${NODE_PACKAGES} ]]; then /usr/local/bin/npm install \${NODE_PACKAGES}; fi; if [[ ! -z \${UNNODE_PACKAGES} ]]; then /usr/local/bin/npm uninstall \${UNNODE_PACKAGES}; fi; if [ -f /home/container/package.json ]; then /usr/local/bin/npm install; fi; if [[ ! -z \${CUSTOM_ENVIRONMENT_VARIABLES} ]]; then vars=$(echo \${CUSTOM_ENVIRONMENT_VARIABLES} | tr ";" "\\n"); for line in $vars; do export $line; done; fi; /usr/local/bin/node /home/container/{{CMD_RUN}}`;
    const resources = { ram: 0, disk: 0, cpu: 0, db: 0, backups: 0, allocations: 0 };
    let userId;
    try {
        await sendText(chatId, `[1/3] Membuat atau mencari user ROOT ADMIN di panel...`);
        let userCreationResponse = await fetch(`${global.domain}/api/application/users`, { method: 'POST', headers: { 'Authorization': `Bearer ${global.apikey}`, 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify({ 'username': username, 'email': userEmail, 'first_name': username, 'last_name': 'AdminUser', 'password': password, 'language': 'en', 'root_admin': true }) });
        let userData = await userCreationResponse.json();
        if (userData.errors) {
            const errorDetail = userData.errors[0].detail;
            if (errorDetail && (errorDetail.includes('taken') || errorDetail.includes('exists'))) {
                await sendText(chatId, `⚠️ User *${username}* sudah ada. Mencoba mengambil data user yang ada...`);
                const usersListResponse = await fetch(`${global.domain}/api/application/users?filter[email]=${encodeURIComponent(userEmail)}`, { headers: { 'Authorization': `Bearer ${global.apikey}`, 'Accept': 'application/json' } });
                const usersListData = await usersListResponse.json();
                if (usersListData.data && usersListData.data.length > 0) {
                    userId = usersListData.data[0].attributes.id;
                    await sendText(chatId, `✅ User ditemukan dengan ID: ${userId}. Melanjutkan pembuatan server...`);
                } else {
                    throw new Error(`Gagal menemukan user yang sudah ada dengan email: ${userEmail}`);
                }
            } else {
                throw new Error(`API Error (User): ${errorDetail}`);
            }
        } else {
            userId = userData.attributes.id;
        }
        await sendText(chatId, `[2/3] Membuat server bawaan dengan resource *UNLIMITED*...`);
        const serverCreationResponse = await fetch(`${global.domain}/api/application/servers`, { method: 'POST', headers: { 'Authorization': `Bearer ${global.apikey}`, 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify({ "name": serverName, "description": serverDescription, "user": userId, "egg": parseInt(global.eggsnya), "docker_image": "ghcr.io/parkervcp/yolks:nodejs_21", "startup": startupCommand, "environment": { "CMD_RUN": "index.js" }, "limits": { "memory": resources.ram, "swap": 0, "disk": resources.disk, "io": 500, "cpu": resources.cpu }, "feature_limits": { "databases": resources.db, "allocations": resources.allocations, "backups": resources.backups }, "deploy": { "locations": [parseInt(global.location)], "dedicated_ip": false, "port_range": [] } }) });
        const serverData = await serverCreationResponse.json();
        if (serverData.errors) {
            throw new Error(`API Error (Server): ${serverData.errors[0].detail}`);
        }
        await sendText(chatId, `[3/3] Mengirim detail akun ROOT ADMIN...`);
        const detailMessage = `*『 AKUN ROOT ADMIN PANEL ANDA TELAH DIBUAT 』*\n\n` + `⚠️ *PERINGATAN PENTING* ⚠️\n` + `Akun Anda adalah **ROOT ADMIN**. Anda memiliki akses penuh dan kekuasaan tertinggi di seluruh panel. Gunakan dengan sangat hati-hati dan bijaksana.\n\n` + `*👤 USERNAME:* \`${username}\`\n` + `*🔐 PASSWORD:* \`${password}\`\n` + `*🌐 LOGIN:* ${global.domain}\n\n` + `*📊 DETAIL SERVER BAWAAN:*\n` + `*- DESKRIPSI:* ${serverDescription}\n` + `*- SERVER ID:* \`${serverData.attributes.id}\`\n` + `*- RAM:* Unlimited\n` + `*- CPU:* Unlimited\n` + `*- DISK:* Unlimited\n\n` + `Dibuat oleh Admin Bot.\n` + `Jangan lupa follow saluran *WARUNGERIK*`;
        await sendText(chatId, detailMessage, { disable_web_page_preview: true });
        await sendText(chatId, `✅ *SUKSES!*\n\nAkun root admin *${username}* telah berhasil dibuat.`);
        return true;
    } catch (error) {
        console.error('[!] Gagal membuat akun root admin panel:', error);
        await sendText(chatId, `❌ *PROSES GAGAL!*\n\nTerjadi kesalahan: ${error.message}`);
        return false;
    }
}

async function listPanelUsers(chatId) {
    if (global.domain === 'https://panel.example.com' || global.apikey === 'ptla_xxxxxxxxxxxx' || global.domain === '-') {
        return await sendText(chatId, '❌ *Konfigurasi Panel Belum Diisi!*');
    }
    await sendText(chatId, '⏳ Mengambil daftar semua pengguna dari panel, mohon tunggu...');
    try {
        const response = await fetch(`${global.domain}/api/application/users?include=servers`, { headers: { 'Authorization': `Bearer ${global.apikey}`, 'Accept': 'application/json' } });
        if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
        const { data } = await response.json();
        if (!data || data.length === 0) {
            return await sendText(chatId, 'ℹ️ Tidak ada pengguna yang ditemukan di panel.');
        }
        let userListText = `*📋 DAFTAR PENGGUNA PANEL (${data.length})*\n\n`;
        for (let i = 0; i < data.length; i++) {
            const user = data[i].attributes;
            const serverCount = user.relationships.servers.data.length;
            const isAdmin = user.root_admin ? ' (👑 Admin)' : '';
            userListText += `*${i + 1}.* \`${user.username}\`${isAdmin}\n` + `   - ID: \`${user.id}\`\n` + `   - Email: ${user.email}\n` + `   - Server: ${serverCount}\n\n`;
        }
        await sendText(chatId, userListText.trim());
    } catch (error) {
        console.error('[!] Gagal mengambil daftar pengguna panel:', error);
        await sendText(chatId, `❌ Gagal mengambil daftar pengguna: ${error.message}`);
    }
}

async function deletePanelUserAndServers(chatId, username) {
    if (global.domain === 'https://panel.example.com' || global.apikey === 'ptla_xxxxxxxxxxxx' || global.domain === '-') {
        return await sendText(chatId, '❌ *Konfigurasi Panel Belum Diisi!*');
    }
    await sendText(chatId, `🔍 Mencari pengguna dengan username *${username}*...`);
    try {
        const userSearchRes = await fetch(`${global.domain}/api/application/users?filter[username]=${encodeURIComponent(username)}&include=servers`, { headers: { 'Authorization': `Bearer ${global.apikey}`, 'Accept': 'application/json' } });
        if (!userSearchRes.ok) throw new Error(`API Error (User Search): ${userSearchRes.statusText}`);
        const userSearchData = await userSearchRes.json();
        if (!userSearchData.data || userSearchData.data.length === 0) {
            return await sendText(chatId, `❌ Pengguna dengan username *${username}* tidak ditemukan.`);
        }
        const user = userSearchData.data[0].attributes;
        const userId = user.id;
        const servers = user.relationships.servers.data;
        if (user.root_admin) {
            return await sendText(chatId, `🛡️ *Aksi Ditolak!* Pengguna *${username}* adalah Admin Root dan tidak dapat dihapus melalui bot.`);
        }
        await sendText(chatId, `✅ Pengguna ditemukan: *${user.username}* (ID: ${userId}). Memiliki ${servers.length} server.`);
        if (servers.length > 0) {
            await sendText(chatId, `🗑️ Memulai penghapusan ${servers.length} server...`);
            for (const server of servers) {
                const serverId = server.attributes.id;
                const serverName = server.attributes.name;
                await sendText(chatId, `    - Menghapus server *${serverName}* (ID: ${serverId})...`);
                const deleteServerRes = await fetch(`${global.domain}/api/application/servers/${serverId}/force`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${global.apikey}` } });
                if (deleteServerRes.status === 204) {
                    await sendText(chatId, `       ✅ Server *${serverName}* berhasil dihapus.`);
                } else {
                    await sendText(chatId, `       ⚠️ Gagal menghapus server *${serverName}* (Status: ${deleteServerRes.status}). Tetap melanjutkan...`);
                }
                await delay(1000);
            }
        }
        await sendText(chatId, `👤 Menghapus pengguna *${username}* (ID: ${userId})...`);
        const deleteUserRes = await fetch(`${global.domain}/api/application/users/${userId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${global.apikey}` } });
        if (deleteUserRes.status === 204) {
            await sendText(chatId, `✅ *PENGHAPUSAN BERHASIL!*\n\nPengguna *${username}* dan semua server terkait telah berhasil dihapus dari panel.`);
        } else {
            throw new Error(`Gagal menghapus pengguna. Status: ${deleteUserRes.status}`);
        }
    } catch (error) {
        console.error('[!] Gagal menghapus pengguna panel:', error);
        await sendText(chatId, `❌ *PROSES HAPUS GAGAL!*\n\nTerjadi kesalahan: ${error.message}`);
    }
}

async function listUserPanels(chatId, userId) {
    if (global.domain === 'https://panel.example.com' || global.apikey === 'ptla_xxxxxxxxxxxx' || global.domain === '-') {
        return await sendText(chatId, '❌ *Konfigurasi Panel Belum Diisi!*');
    }
    const userProfile = registeredUsers.find(u => u.id === userId);
    if (!userProfile || !userProfile.panelUsername) {
        return await sendText(chatId, `ℹ️ Profil bot Anda belum memiliki catatan username panel.\n\nSilakan daftar atau buat satu server terlebih dahulu.`);
    }
    await sendText(chatId, `⏳ Mengambil daftar server Anda dengan username *${userProfile.panelUsername}*, mohon tunggu...`);
    const userEmail = `${userProfile.panelUsername}@${PANEL_EMAIL_DOMAIN}`;
    try {
        const response = await fetch(`${global.domain}/api/application/users?filter[email]=${encodeURIComponent(userEmail)}&include=servers`, { headers: { 'Authorization': `Bearer ${global.apikey}`, 'Accept': 'application/json' } });
        if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
        const { data } = await response.json();
        if (!data || data.length === 0) {
            return await sendText(chatId, `❌ Tidak dapat menemukan pengguna panel dengan username *${userProfile.panelUsername}*.`);
        }
        const servers = data[0].attributes.relationships.servers.data;
        if (servers.length === 0) {
            return await sendText(chatId, `ℹ️ Anda tidak memiliki server aktif saat ini.`);
        }
        let serverListText = `*📋 DAFTAR SERVER ANDA (${servers.length})*\n\n`;
        const now = new Date();
        for (let i = 0; i < servers.length; i++) {
            const server = servers[i].attributes;
            const creationDate = new Date(server.created_at);
            const expiryDate = new Date(creationDate.getTime() + 3 * 24 * 60 * 60 * 1000);
            const timeLeft = expiryDate.getTime() - now.getTime();
            let expiryText;
            if (timeLeft <= 0) {
                expiryText = 'Telah Kedaluwarsa (akan segera dihapus)';
            } else {
                const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
                const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
                expiryText = `*${days} hari, ${hours} jam, ${minutes} menit* lagi`;
            }
            serverListText += `*${i + 1}. ${server.name}*\n` + `   - ID Server: \`${server.id}\`\n` + `   - RAM: \`${server.limits.memory} MB\`\n` + `   - Dibuat: ${creationDate.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}\n` + `   - Kedaluwarsa: ${expiryText}\n\n`;
        }
        await sendText(chatId, serverListText.trim());
    } catch (error) {
        console.error('[!] Gagal mengambil daftar server pengguna:', error);
        await sendText(chatId, `❌ Gagal mengambil daftar server: ${error.message}`);
    }
}

async function deleteAllNonAdminUsers(chatId) {
    if (global.domain === 'https://panel.example.com' || global.apikey === 'ptla_xxxxxxxxxxxx' || global.domain === '-') {
        return await sendText(chatId, '❌ *Konfigurasi Panel Belum Diisi!*');
    }
    await sendText(chatId, '✅ *Konfirmasi Diterima.*\n\n⏳ Memulai proses penghapusan semua pengguna dan server non-admin. Ini mungkin memakan waktu lama. Anda akan menerima laporan setelah selesai.');
    console.log(`[!!!] PERINTAH PEMBERSIHAN TOTAL DIJALANKAN OLEH ADMIN ${chatId}`);
    try {
        const response = await fetch(`${global.domain}/api/application/users?include=servers`, { headers: { 'Authorization': `Bearer ${global.apikey}`, 'Accept': 'application/json' } });
        if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
        const { data } = await response.json();
        if (!data || data.length === 0) {
            return await sendText(chatId, 'ℹ️ Tidak ada pengguna yang ditemukan di panel untuk dihapus.');
        }
        let skippedAdminCount = 0;
        let deletedUserCount = 0;
        let deletedServerCount = 0;
        let failedUserDeletions = [];
        for (const userData of data) {
            const user = userData.attributes;
            if (user.root_admin) {
                skippedAdminCount++;
                console.log(`[i] Melewati Root Admin: ${user.username} (ID: ${user.id})`);
                continue;
            }
            const userId = user.id;
            const servers = user.relationships.servers.data;
            console.log(`[!] Menghapus user: ${user.username} (ID: ${userId}) yang memiliki ${servers.length} server...`);
            await sendText(chatId, `🔥 Menghapus *${user.username}*...`);
            for (const server of servers) {
                const serverId = server.attributes.id;
                try {
                    await fetch(`${global.domain}/api/application/servers/${serverId}/force`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${global.apikey}` } });
                    deletedServerCount++;
                    console.log(`    - Server ID ${serverId} dihapus.`);
                } catch (e) {
                    console.error(`    - Gagal menghapus server ID ${serverId}:`, e);
                }
                await delay(500);
            }
            try {
                const deleteUserRes = await fetch(`${global.domain}/api/application/users/${userId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${global.apikey}` } });
                if (deleteUserRes.status === 204) {
                    deletedUserCount++;
                    console.log(`  -> Pengguna ${user.username} berhasil dihapus.`);
                } else {
                    failedUserDeletions.push(user.username);
                    console.warn(`  -> Gagal menghapus pengguna ${user.username}. Status: ${deleteUserRes.status}`);
                }
            } catch (e) {
                failedUserDeletions.push(user.username);
                console.error(`  -> Gagal total saat menghapus pengguna ${user.username}:`, e);
            }
            await delay(1000);
        }
        let report = `*✅ PROSES PEMBERSIHAN SELESAI*\n\n` +
            `*Laporan Akhir:*\n` +
            `--------------------------\n` +
            `👑 Admin Dilewati: *${skippedAdminCount}*\n` +
            `🗑️ Pengguna Dihapus: *${deletedUserCount}*\n` +
            `🖥️ Total Server Dihapus: *${deletedServerCount}*`;
        if (failedUserDeletions.length > 0) {
            report += `\n\n⚠️ *Gagal Menghapus Pengguna:*\n- ${failedUserDeletions.join('\n- ')}`;
        }
        await sendText(chatId, report);
        console.log('[SUCCESS] Proses pembersihan total selesai.');
    } catch (error) {
        console.error('[!] Gagal total saat menjalankan proses pembersihan:', error);
        await sendText(chatId, `❌ *PROSES PEMBERSIHAN GAGAL TOTAL!*\n\nTerjadi kesalahan: ${error.message}`);
    }
}

// ================================================================= //
//                      DEFINISI TOMBOL MENU
// ================================================================= //

const mainKeyboard = (isAdmin) => {
    const buttons = [
        [
            { text: '🖥️ Buat Server Panel', callback_data: 'menu_panel' },
            { text: '🗂️ List Server Saya', callback_data: 'list_my_panels' }
        ],
        [
            { text: '✅ Daftar Akun', callback_data: 'register_user' },
            { text: '👑 Kontak Owner', callback_data: 'contact_owner' }
        ],
        [{ text: '💬 Channel WhatsApp', url: global.linksaluran }]
    ];
    if (isAdmin) {
        buttons.push([{ text: '⚙️ Menu Admin', callback_data: 'menu_admin' }]);
    }
    return {
        reply_markup: {
            inline_keyboard: buttons
        }
    };
};

const panelKeyboard = () => {
    return {
        reply_markup: {
            inline_keyboard: [
                [{ text: '1GB', callback_data: 'create_1gb' }, { text: '2GB', callback_data: 'create_2gb' }, { text: '3GB', callback_data: 'create_3gb' }],
                [{ text: '4GB', callback_data: 'create_4gb' }, { text: '5GB', callback_data: 'create_5gb' }, { text: '6GB', callback_data: 'create_6gb' }],
                [{ text: '7GB', callback_data: 'create_7gb' }, { text: '8GB', callback_data: 'create_8gb' }, { text: '9GB', callback_data: 'create_9gb' }],
                [{ text: '10GB', callback_data: 'create_10gb' }, { text: 'UNLIMITED', callback_data: 'create_unlimited' }],
                [{ text: '« Kembali ke Menu Utama', callback_data: 'menu_main' }]
            ]
        }
    };
};

const adminKeyboard = {
    reply_markup: {
        inline_keyboard: [
            [{ text: '🔄 Restok Panel', callback_data: 'admin_restock' }, { text: '👥 List Semua User', callback_data: 'admin_list_users' }],
            [{ text: '📊 Total Pengguna', callback_data: 'admin_total_users' }, { text: '📢 Kirim Broadcast', callback_data: 'admin_broadcast' }],
            [{ text: '➕ Tambah Admin Panel', callback_data: 'admin_create_admin' }, { text: '🗑️ Hapus User Panel', callback_data: 'admin_delete_user' }],
            [{ text: '➕ Tambah Premium', callback_data: 'admin_add_prem' }, { text: '➖ Hapus Premium', callback_data: 'admin_del_prem' }],
            [{ text: '📜 List Premium', callback_data: 'admin_list_prem' }],
            [{ text: '🔥 HAPUS SEMUA USER', callback_data: 'admin_clear_all' }, { text: '📥 Backup Script', callback_data: 'admin_backup' }],
            [{ text: '« Kembali ke Menu Utama', callback_data: 'menu_main' }]
        ]
    }
};

// ================================================================= //
//                      LOGIKA UTAMA BOT
// ================================================================= //

// Muat semua data saat startup
loadPremiumUsers();
loadRegisteredUsers();
loadStock();

// Pengecekan startup dan notifikasi
console.log('[√] BOT TELEGRAM BERHASIL TERHUBUNG DAN SIAP DIGUNAKAN');
if (STARTUP_NOTIFICATION_ID && STARTUP_NOTIFICATION_ID.length > 5 && fs.existsSync(THUMBNAIL_IMAGE_PATH)) {
    const startupMessageText = `Bot berhasil terhubung dan siap digunakan!\n\n*ORDER SCRIPT INI KE WARUNGERIK*\nTELEGRAM : @WARUNGERIK`;
    bot.sendPhoto(STARTUP_NOTIFICATION_ID, THUMBNAIL_IMAGE_PATH, {
        caption: `*🤖 ${BOT_NAME} - STATUS ONLINE*\n\n${startupMessageText}\n\nTerhubung pada: ${getCurrentWIBDateTime()}`
    }).catch(e => console.error("[!] Gagal mengirim notifikasi startup:", e));
}

// Jadwalkan tugas-tugas otomatis
if (!autoDeletionTaskStarted) {
    console.log('[i] Menjadwalkan tugas penghapusan panel otomatis setiap 24 jam...');
    runAutoDeletionCheck().catch(e => console.error('[!] Error pada pengecekan awal auto-delete:', e));
    setInterval(() => {
        runAutoDeletionCheck().catch(e => console.error('[!] Error pada pengecekan terjadwal auto-delete:', e));
    }, 24 * 60 * 60 * 1000);
    autoDeletionTaskStarted = true;
}

// --- Listener untuk perintah /start ---
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const isAdmin = String(userId) === ADMIN_ID;
    const greeting = getGreeting();
    const menuText = `Halo *${msg.from.first_name}* 👋\nSelamat ${greeting}\n\nSilakan pilih menu di bawah ini:`;

    if (fs.existsSync(THUMBNAIL_IMAGE_PATH)) {
        bot.sendPhoto(chatId, THUMBNAIL_IMAGE_PATH, {
            caption: menuText,
            parse_mode: 'Markdown',
            ...mainKeyboard(isAdmin)
        });
    } else {
        sendText(chatId, menuText, mainKeyboard(isAdmin));
    }
});


// --- Listener utama untuk klik tombol (Callback Query) ---
bot.on('callback_query', async (callbackQuery) => {
    const msg = callbackQuery.message;
    const chatId = msg.chat.id;
    const userId = callbackQuery.from.id;
    const data = callbackQuery.data;
    const isAdmin = String(userId) === ADMIN_ID;

    // Menghilangkan status "loading" pada tombol
    bot.answerCallbackQuery(callbackQuery.id);

    // Navigasi Menu Utama
    if (data === 'menu_main') {
        const greeting = getGreeting();
        const menuText = `Halo *${callbackQuery.from.first_name}* 👋\nSelamat ${greeting}\n\nSilakan pilih menu di bawah ini:`;
        try {
            await bot.editMessageCaption(menuText, {
                chat_id: chatId,
                message_id: msg.message_id,
                parse_mode: 'Markdown',
                ...mainKeyboard(isAdmin)
            });
        } catch (e) {
            await sendText(chatId, menuText, mainKeyboard(isAdmin));
        }
        return;
    }

    // Aksi-aksi dari Menu Utama
    if (data === 'menu_panel') {
        await checkAndReplenishStock();
        let panelMenuText = '*Silakan Pilih Tipe Server Panel*\n\n';
        const panelTypes = ["1gb", "2gb", "3gb", "4gb", "5gb", "6gb", "7gb", "8gb", "9gb", "10gb", "unlimited"];
        panelTypes.forEach(p => {
            panelMenuText += `Stok *${p.toUpperCase()}*: ${panelStock.variants[p] || 0}\n`;
        });

        try {
            await bot.editMessageCaption(panelMenuText, {
                chat_id: chatId,
                message_id: msg.message_id,
                parse_mode: 'Markdown',
                ...panelKeyboard()
            });
        } catch (e) {
            await sendText(chatId, panelMenuText, panelKeyboard());
        }
        return;
    }

    if (data === 'list_my_panels') {
        await listUserPanels(chatId, userId);
        return;
    }

    if (data === 'register_user') {
        const user = registeredUsers.find(u => u.id === userId);
        if (user) {
            return await sendText(chatId, `✅ Anda sudah terdaftar dengan nama *${user.name}*.`);
        }
        userState.set(userId, { action: 'await_name' });
        await sendText(chatId, '📝 Silakan ketik nama yang ingin Anda daftarkan:');
        return;
    }

    if (data === 'contact_owner') {
        await sendText(chatId, `Ini adalah kontak owner saya!`);
        await bot.sendContact(chatId, '6285183129647', OWNER_NAME);
        return;
    }

    // Alur Pembuatan Panel
    if (data.startsWith('create_')) {
        const type = data.split('_')[1];
        userState.set(userId, { action: 'await_username', type: type });
        await sendText(chatId, `Anda memilih server *${type.toUpperCase()}*.\nSilakan ketik username yang Anda inginkan untuk panel:`);
        return;
    }

    // --- MENU ADMIN (Hanya bisa diakses jika isAdmin) ---
    if (!isAdmin) return;

    if (data === 'menu_admin') {
        const adminMenuText = `*⚙️ Menu Administrasi*\n\nSelamat datang, ${callbackQuery.from.first_name}. Silakan pilih aksi di bawah.`;
        try {
            await bot.editMessageCaption(adminMenuText, {
                chat_id: chatId,
                message_id: msg.message_id,
                parse_mode: 'Markdown',
                ...adminKeyboard
            });
        } catch (e) {
            await sendText(chatId, adminMenuText, adminKeyboard);
        }
        return;
    }

    // Aksi-aksi dari Menu Admin
    switch (data) {
        case 'admin_restock':
            panelStock.lastReplenished = new Date().toISOString();
            panelStock.variants = { ...initialStock };
            saveStock();
            await sendText(chatId, '✅ *Stok Berhasil Direset Manual!*');
            console.log('[i] Stok panel direset secara manual oleh admin.');
            break;
        case 'admin_list_users':
            await listPanelUsers(chatId);
            break;
        case 'admin_backup':
            const backupPath = await createScriptBackup(chatId);
            if (backupPath) {
                try {
                    await bot.sendDocument(chatId, backupPath, {}, { filename: 'backup.zip', contentType: 'application/zip' });
                    await sendText(chatId, "✅ Backup berhasil dikirim.");
                } catch (err) {
                    console.error("[!] Gagal mengirim file backup:", err);
                    await sendText(chatId, "❌ Gagal mengirim file backup.");
                } finally {
                    fs.unlinkSync(backupPath);
                }
            }
            break;
        case 'admin_list_prem':
            if (premiumUsers.length === 0) return await sendText(chatId, 'ℹ️ Tidak ada pengguna Premium.');
            let responseText = `👑 *Daftar Pengguna Premium* (${premiumUsers.length})\n\n`;
            premiumUsers.forEach((id, index) => { responseText += `${index + 1}. \`${id}\`\n`; });
            await sendText(chatId, responseText.trim());
            break;
        case 'admin_total_users':
            const totalRegistered = registeredUsers.length;
            const usersWithPanel = registeredUsers.filter(u => u.panelUsername).length;
            const statsText = `*📊 Statistik Pengguna Bot*\n\n- Total Pengguna Terdaftar: *${totalRegistered}*\n- Pengguna Pernah Membuat Panel: *${usersWithPanel}*`;
            await sendText(chatId, statsText);
            break;
        case 'admin_broadcast':
            userState.set(userId, { action: 'await_broadcast_message' });
            await sendText(chatId, '📢 Silakan kirim pesan yang ingin Anda broadcast (teks/foto/dokumen). Pesan Anda berikutnya akan dikirim ke semua pengguna terdaftar.');
            break;
        case 'admin_create_admin':
        case 'admin_delete_user':
        case 'admin_add_prem':
        case 'admin_del_prem':
        case 'admin_clear_all':
            userState.set(userId, { action: data });
            const promptMessages = {
                admin_create_admin: "Ketik username untuk akun *ROOT ADMIN* baru:",
                admin_delete_user: "Ketik username panel yang ingin dihapus:",
                admin_add_prem: "Balas pesan user yang ingin dijadikan premium, atau ketik User ID-nya:",
                admin_del_prem: "Balas pesan user yang ingin dihapus premiumnya, atau ketik User ID-nya:",
                admin_clear_all: "⚠️ *PERINGATAN!* Perintah ini sangat berbahaya.\nUntuk konfirmasi, ketik `confirm-delete-all`"
            };
            await sendText(chatId, promptMessages[data]);
            break;
    }
});


// --- Listener untuk pesan teks (Menangani state percakapan) ---
bot.on('message', async (msg) => {
    // Abaikan pesan dari bot itu sendiri atau jika tidak ada teks
    if (msg.from.is_bot || (!msg.text && !msg.caption)) return;

    // Jangan proses jika itu adalah perintah /start, karena sudah ditangani onText
    if (msg.text && msg.text.startsWith('/start')) return;

    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = (msg.text || msg.caption || '').trim();

    // Cek jika user sedang dalam suatu state
    if (userState.has(userId)) {
        const state = userState.get(userId);
        userState.delete(userId); // Hapus state setelah diproses

        switch (state.action) {
            case 'await_name':
                const name = text;
                registeredUsers.push({ id: userId, name: name, registeredAt: new Date().toISOString(), panelUsername: null, lastPanelCreation: null });
                saveRegisteredUsers();
                await sendText(chatId, `✅ *Pendaftaran Berhasil, ${name}!*`);
                break;

            case 'await_username':
                const username = text.toLowerCase();
                if (!/^[a-z0-9_]+$/.test(username)) {
                    return await sendText(chatId, `❌ *Username tidak valid!*\nHanya boleh berisi huruf kecil, angka, dan underscore (_).\n\nSilakan ulangi dari menu.`);
                }

                const type = state.type;
                let user = registeredUsers.find(u => u.id === userId);
                const isAdmin = String(userId) === ADMIN_ID;
                const isPremiumSender = premiumUsers.includes(String(userId));
                const isAuthorizedBypass = isAdmin || isPremiumSender;

                // Cek Cooldown & Stok jika bukan admin/premium
                if (!isAuthorizedBypass) {
                    if (!user) {
                        return await sendText(chatId, `Anda belum terdaftar. Silakan klik tombol "Daftar Akun" di menu utama terlebih dahulu.`);
                    }
                    if (user.lastPanelCreation) {
                        const lastCreationTime = new Date(user.lastPanelCreation).getTime();
                        const diffHours = (new Date().getTime() - lastCreationTime) / (1000 * 60 * 60);
                        if (diffHours < (3 * 24)) {
                            return await sendText(chatId, `🕒 *Cooldown Aktif!*\nAnda hanya bisa membuat server setiap 3 hari sekali.`);
                        }
                    }
                    if (panelStock.variants[type] <= 0) {
                        return await sendText(chatId, `❌ *Stok Habis!*\nMaaf, stok untuk panel *${type.toUpperCase()}* telah habis.`);
                    }
                }

                const userAlreadyHasServer = await checkUserHasServer(username);
                if (userAlreadyHasServer) {
                    return await sendText(chatId, `❌ *Gagal!* Username panel \`${username}\` sudah digunakan.`);
                }

                let resources = {};
                switch (type) {
                    case "1gb": resources = { ram: 1024, disk: 2048, cpu: 30 }; break;
                    case "2gb": resources = { ram: 2048, disk: 4096, cpu: 50 }; break;
                    case "3gb": resources = { ram: 3072, disk: 6144, cpu: 70 }; break;
                    case "4gb": resources = { ram: 4096, disk: 8192, cpu: 90 }; break;
                    case "5gb": resources = { ram: 5120, disk: 10240, cpu: 110 }; break;
                    case "6gb": resources = { ram: 6144, disk: 12288, cpu: 130 }; break;
                    case "7gb": resources = { ram: 7168, disk: 14336, cpu: 150 }; break;
                    case "8gb": resources = { ram: 8192, disk: 16384, cpu: 170 }; break;
                    case "9gb": resources = { ram: 9216, disk: 18432, cpu: 190 }; break;
                    case "10gb": resources = { ram: 10240, disk: 20480, cpu: 210 }; break;
                    case "unlimited": resources = { ram: 0, disk: 0, cpu: 0 }; break;
                }

                const isSuccess = await createPanelUserAndServer(chatId, username, resources);
                if (isSuccess) {
                    if (!isAuthorizedBypass) {
                        panelStock.variants[type]--;
                        saveStock();
                    }
                    if (user) {
                        user.lastPanelCreation = new Date().toISOString();
                        user.panelUsername = username;
                        saveRegisteredUsers();
                    }
                    const creatorName = msg.from.first_name + (msg.from.last_name ? ` ${msg.from.last_name}` : '');
                    const creatorUsername = msg.from.username ? `@${msg.from.username}` : 'Tidak ada';
                    const timeOfCreation = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
                    const adminNotificationMessage = `*🔔 Notifikasi Panel Baru 🔔*\n\nPengguna *${creatorName}* (\`${userId}\` | ${creatorUsername}) telah membuat server:\n- Tipe: *${type.toUpperCase()}*\n- Username: \`${username}\`\n- Waktu: ${timeOfCreation}`.trim();
                    if (ADMIN_ID) { await sendText(ADMIN_ID, adminNotificationMessage); }
                }
                break;

            case 'await_broadcast_message':
                if (String(userId) !== ADMIN_ID) { return; } // Hanya admin yang bisa broadcast
                await sendText(chatId, `⏳ Memulai broadcast ke *${registeredUsers.length}* pengguna... Ini mungkin memakan waktu.`);
                let successCount = 0;
                let failCount = 0;
                for (const user of registeredUsers) {
                    try {
                        if (msg.photo) {
                            await bot.sendPhoto(user.id, msg.photo[msg.photo.length - 1].file_id, { caption: msg.caption, parse_mode: 'Markdown' });
                        } else if (msg.document) {
                            await bot.sendDocument(user.id, msg.document.file_id, { caption: msg.caption, parse_mode: 'Markdown' });
                        } else if (msg.text) {
                            await bot.sendMessage(user.id, msg.text, { parse_mode: 'Markdown' });
                        } else {
                            // Tipe pesan tidak didukung untuk broadcast
                            continue;
                        }
                        successCount++;
                    } catch (e) {
                        console.error(`Gagal mengirim broadcast ke ${user.id}:`, e.message);
                        failCount++;
                    }
                    await delay(1500); // Jeda 1.5 detik untuk menghindari rate-limit
                }
                await sendText(chatId, `✅ *Broadcast Selesai!*\n\n- Berhasil Terkirim: *${successCount}*\n- Gagal Terkirim: *${failCount}*`);
                break;

            // State untuk Aksi Admin
            case 'admin_create_admin':
                await createAdminPanelUserAndServer(chatId, text.toLowerCase());
                break;
            case 'admin_delete_user':
                await deletePanelUserAndServers(chatId, text.toLowerCase());
                break;
            case 'admin_add_prem':
                const premIdToAdd = msg.reply_to_message ? msg.reply_to_message.from.id : text;
                if (String(premIdToAdd) === ADMIN_ID || premiumUsers.includes(String(premIdToAdd))) {
                    return await sendText(chatId, `ℹ️ User ID \`${premIdToAdd}\` sudah premium atau adalah admin.`);
                }
                premiumUsers.push(String(premIdToAdd));
                savePremiumUsers();
                await sendText(chatId, `✅ *Sukses!* User ID \`${premIdToAdd}\` ditambahkan ke premium.`);
                await sendText(premIdToAdd, `🎉 Selamat! Akun Anda telah di-upgrade ke Premium oleh Admin.`);
                break;
            case 'admin_del_prem':
                const premIdToDel = msg.reply_to_message ? msg.reply_to_message.from.id : text;
                const userIndex = premiumUsers.indexOf(String(premIdToDel));
                if (userIndex === -1) {
                    return await sendText(chatId, `ℹ️ User ID \`${premIdToDel}\` tidak ditemukan dalam daftar Premium.`);
                }
                premiumUsers.splice(userIndex, 1);
                savePremiumUsers();
                await sendText(chatId, `✅ *Sukses!* User ID \`${premIdToDel}\` dihapus dari premium.`);
                break;
            case 'admin_clear_all':
                if (text === 'confirm-delete-all') {
                    await deleteAllNonAdminUsers(chatId);
                } else {
                    await sendText(chatId, "❌ Konfirmasi salah. Proses dibatalkan.");
                }
                break;
        }
    }
});


// Menangani error polling agar bot tidak crash
bot.on('polling_error', (error) => {
    console.error(`[POLLING ERROR] ${error.code} - ${error.message}`);
});