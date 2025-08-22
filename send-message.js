export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { text } = req.body;

  if (!text) {
    return res.status(400).json({ error: "Text is required" });
  }

  try {
    // Ganti token & chat_id sesuai bot Telegram kamu
    const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN; 
    const CHAT_ID = process.env.CHAT_ID;

    const response = await fetch(
      https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: CHAT_ID,
          text: text,
        }),
      }
    );

    const data = await response.json();
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
