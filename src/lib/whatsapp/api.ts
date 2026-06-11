/**
 * Wrapper WhatsApp Cloud API (Meta Graph API) — kirim pesan keluar.
 * Env: WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN.
 */

const GRAPH_API_VERSION = 'v21.0';

export interface SendMessageResult {
  ok: boolean;
  /** wamid pesan terkirim — disimpan ke lead_messages.external_message_id */
  messageId?: string;
  error?: string;
}

export async function sendWhatsAppMessage(to: string, text: string): Promise<SendMessageResult> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    console.warn('[whatsapp/api] WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_ACCESS_TOKEN belum di-set');
    return { ok: false, error: 'WhatsApp credentials not configured' };
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body: text },
        }),
      }
    );

    if (!res.ok) {
      // 24-hour window habis / nomor tidak valid / token expired — log saja,
      // jangan crash webhook.
      const detail = await res.text();
      console.warn('[whatsapp/api] send failed:', res.status, detail);
      return { ok: false, error: `Graph API ${res.status}` };
    }

    const json = (await res.json()) as { messages?: Array<{ id: string }> };
    return { ok: true, messageId: json.messages?.[0]?.id };
  } catch (err) {
    console.warn('[whatsapp/api] send error:', err);
    return { ok: false, error: 'Network error' };
  }
}
