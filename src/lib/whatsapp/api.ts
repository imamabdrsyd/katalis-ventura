/**
 * Wrapper WhatsApp Cloud API (Meta Graph API) — kirim pesan keluar.
 *
 * Kredensial per-bisnis (channel_integrations.config, terenkripsi) dioper
 * lewat parameter `creds`; kalau tidak ada, fallback ke env global
 * (WHATSAPP_PHONE_NUMBER_ID + WHATSAPP_ACCESS_TOKEN — model lama).
 */

const GRAPH_API_VERSION = 'v21.0';

export interface WhatsAppCredentials {
  phoneNumberId: string;
  accessToken: string;
}

export interface SendMessageResult {
  ok: boolean;
  /** wamid pesan terkirim — disimpan ke lead_messages.external_message_id */
  messageId?: string;
  error?: string;
}

export async function sendWhatsAppMessage(
  to: string,
  text: string,
  creds?: WhatsAppCredentials
): Promise<SendMessageResult> {
  const phoneNumberId = creds?.phoneNumberId ?? process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = creds?.accessToken ?? process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    console.warn('[whatsapp/api] kredensial tidak tersedia (config bisnis maupun env)');
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

/**
 * Verifikasi kredensial dengan memanggil Graph API metadata nomor.
 * Return info nomor kalau valid, null kalau token/nomor salah.
 */
export async function verifyWhatsAppCredentials(
  creds: WhatsAppCredentials
): Promise<{ displayPhoneNumber: string | null; verifiedName: string | null } | null> {
  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${creds.phoneNumberId}?fields=display_phone_number,verified_name`,
      { headers: { Authorization: `Bearer ${creds.accessToken}` } }
    );
    if (!res.ok) {
      console.warn('[whatsapp/api] verifikasi kredensial gagal:', res.status, await res.text());
      return null;
    }
    const json = (await res.json()) as { display_phone_number?: string; verified_name?: string };
    return {
      displayPhoneNumber: json.display_phone_number ?? null,
      verifiedName: json.verified_name ?? null,
    };
  } catch (err) {
    console.warn('[whatsapp/api] verifikasi kredensial error:', err);
    return null;
  }
}
