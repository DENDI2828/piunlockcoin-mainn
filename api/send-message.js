api/send-message.js
api/send-message.js
export default async function handler(req, res) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    return res.status(500).json({ ok: false, error: "Missing env vars" });
  }

  // Pesan bisa dikirim via query ?text=..., kalau kosong pakai default
  const text =
    (req.query.text && String(req.query.text)) ||
    "Halo! Pesan test dari website 🚀";

  try {
    const resp = await fetch(
      https://api.telegram.org/bot${token}/sendMessage,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text }),
      }
    );

    const data = await resp.json();
    return res.status(200).json({ ok: true, data });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}
