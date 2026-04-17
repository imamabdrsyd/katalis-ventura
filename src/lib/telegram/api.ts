// Thin HTTP wrapper untuk Telegram Bot API

const BASE = () => `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

export async function sendMessage(
  chatId: number,
  text: string,
  options?: {
    parse_mode?: 'Markdown' | 'HTML';
    reply_markup?: object;
  }
): Promise<void> {
  try {
    await fetch(`${BASE()}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, ...options }),
    });
  } catch (err) {
    console.error('[telegram/api] sendMessage error:', err);
  }
}

export async function sendDocument(
  chatId: number,
  buffer: Buffer | Uint8Array,
  filename: string,
  caption?: string
): Promise<void> {
  try {
    const form = new FormData();
    form.append('chat_id', String(chatId));
    if (caption) {
      form.append('caption', caption);
      form.append('parse_mode', 'Markdown');
    }
    const blob = new Blob([new Uint8Array(buffer)], { type: 'application/pdf' });
    form.append('document', blob, filename);

    const res = await fetch(`${BASE()}/sendDocument`, {
      method: 'POST',
      body: form,
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error('[telegram/api] sendDocument failed:', errText);
    }
  } catch (err) {
    console.error('[telegram/api] sendDocument error:', err);
  }
}

export async function sendChatAction(chatId: number, action: 'typing' | 'upload_document'): Promise<void> {
  try {
    await fetch(`${BASE()}/sendChatAction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, action }),
    });
  } catch {
    // silent
  }
}
