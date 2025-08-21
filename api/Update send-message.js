 api/insertdata.js
// Endpoint aman untuk kirim pesan Telegram dengan rate-limit + retry

// ------- util -------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Telegram (umumnya) aman di ~1 pesan / 1-2 detik per chat.
const MIN_DELAY_MS = 1500;

// rate limit per IP: maksimal 5 request / menit
const WINDOW_MS = 60_000;
const MAX_REQ_PER_WINDOW = 5;

// penyimpanan sementara di memori (per instansi function)
const ipHits = new Map();

async function sendTelegram({ token, chatId, text }) {
  // potong teks sesuai limit Telegram (4096 char)
  const safeText = String(text || "").slice(0, 4096);

  const url = https://api.telegram.org/bot${token}/sendMessage;

  let attempt = 0;
  while (attempt < 4) {
    attempt += 1;

    const resp = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: safeText }),
    });

    // sukses langsung keluar
    if (resp.ok) {
      return resp.json();
    }

    // kalau 429: hormati retry_after dari Telegram
    if (resp.status === 429) {
      const data = await resp.json().catch(() => ({}));
      const waitSec =
        (data?.parameters?.retry_after ?? 3) + attempt; // tambah sedikit buffer
      await sleep(waitSec * 1000);
      continue; // coba lagi
    }

    // error lain → baca body untuk debug lalu lempar
    const errBody = await resp.text().catch(() => "");
    throw new Error(`TG error ${resp.status}: ${errBody}`);
  }

  throw new Error("Gagal kirim setelah beberapa kali retry.");
}

function checkRateLimit(req) {
  const ip =
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.headers["x-real-ip"] ||
    req.socket?.remoteAddress ||
    "unknown";

  const now = Date.now();
  const rec = ipHits.get(ip) || { count: 0, start: now };

  // reset jendela 1 menit
  if (now - rec.start > WINDOW_MS) {
    rec.count = 0;
    rec.start = now;
  }

  rec.count += 1;
  ipHits.set(ip, rec);

  return rec.count <= MAX_REQ_PER_WINDOW;
}

let lastSentAt = 0; // agar ada jeda antar pesan

export default async function handler(req, res) {
  try {
    // hanya izinkan GET/POST sederhana
    if (req.method !== "GET" && req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }

    // rate-limit per IP
    if (!checkRateLimit(req)) {
      return res.status(429).json({ ok: false, error: "Too Many Requests" });
    }

    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) {
      return res
        .status(500)
        .json({ ok: false, error: "Missing env TELEGRAM_BOT_TOKEN/CHAT_ID" });
    }

    // ambil teks dari query (GET) atau body (POST)
    let text = "";
    if (req.method === "GET") {
      text = req.query.text || "";
    } else {
      // asumsikan JSON { text: "..." }
      if (!req.body) {
        try {
          const raw = await new Response(req).text();
          req.body = JSON.parse(raw || "{}");
        } catch (_) {
          req.body = {};
        }
      }
      text = req.body?.text || "";
    }

    // default text bila kosong
    if (!text) text = "Halo! Pesan test dari website.";

    // pastikan jeda minimal antar kirim
    const now = Date.now();
    const wait = Math.max(0, MIN_DELAY_MS - (now - lastSentAt));
    if (wait > 0) await sleep(wait);
    lastSentAt = Date.now();

    const data = await sendTelegram({ token, chatId, text });

    return res.status(200).json({ ok: true, data });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
