// Thin HTTP wrapper untuk Telegram Bot API

import type { InlineKeyboardMarkup } from './types';

const BASE = () => `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;
const FILE_BASE = () => `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}`;

export async function sendMessage(
  chatId: number,
  text: string,
  options?: {
    parse_mode?: 'Markdown' | 'HTML';
    reply_markup?: InlineKeyboardMarkup | object;
  }
): Promise<{ message_id: number } | null> {
  try {
    const res = await fetch(`${BASE()}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, ...options }),
    });
    const json = await res.json();
    return json?.result ?? null;
  } catch (err) {
    console.error('[telegram/api] sendMessage error:', err);
    return null;
  }
}

/**
 * Edit teks + keyboard pesan yang sudah dikirim. Dipakai untuk update inline keyboard
 * setelah user klik tombol (mis. "Simpan" → ubah pesan jadi "✅ Tersimpan").
 */
export async function editMessageText(
  chatId: number,
  messageId: number,
  text: string,
  options?: {
    parse_mode?: 'Markdown' | 'HTML';
    reply_markup?: InlineKeyboardMarkup | object;
  }
): Promise<void> {
  try {
    await fetch(`${BASE()}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text,
        ...options,
      }),
    });
  } catch (err) {
    console.error('[telegram/api] editMessageText error:', err);
  }
}

/**
 * Acknowledge callback query (wajib supaya tombol gak loading terus di sisi user).
 */
export async function answerCallbackQuery(
  callbackQueryId: string,
  text?: string
): Promise<void> {
  try {
    await fetch(`${BASE()}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        ...(text ? { text } : {}),
      }),
    });
  } catch (err) {
    console.error('[telegram/api] answerCallbackQuery error:', err);
  }
}

/**
 * Get file_path dari file_id (Telegram menyimpan file sementara di server mereka).
 */
export async function getFile(fileId: string): Promise<string | null> {
  try {
    const res = await fetch(`${BASE()}/getFile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_id: fileId }),
    });
    const json = await res.json();
    return json?.result?.file_path ?? null;
  } catch (err) {
    console.error('[telegram/api] getFile error:', err);
    return null;
  }
}

/**
 * Download file dari Telegram server pakai file_path hasil getFile().
 * Returns Buffer atau null kalau gagal.
 */
export async function downloadFile(filePath: string): Promise<Buffer | null> {
  try {
    const res = await fetch(`${FILE_BASE()}/${filePath}`);
    if (!res.ok) {
      console.error('[telegram/api] downloadFile HTTP', res.status);
      return null;
    }
    const buf = await res.arrayBuffer();
    return Buffer.from(buf);
  } catch (err) {
    console.error('[telegram/api] downloadFile error:', err);
    return null;
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
