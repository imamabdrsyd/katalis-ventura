/**
 * Wrapper Instagram Graph API — kirim DM keluar.
 *
 * Beda dari WhatsApp: token bukan dari env global, tapi per-bisnis (hasil
 * OAuth, disimpan terenkripsi di channel_integrations.config). Caller harus
 * men-decrypt token dulu (getDecryptedToken) lalu mengoper ke sini.
 */

const IG_GRAPH_VERSION = 'v21.0';

export interface SendMessageResult {
  ok: boolean;
  /** message id terkirim — disimpan ke lead_messages.external_message_id */
  messageId?: string;
  error?: string;
}

/**
 * Fetch nama/username pengirim dari Graph API.
 * Return null kalau gagal (permission denied, token expired, dll) — caller
 * harus fallback ke "@senderId".
 */
export async function getInstagramSenderName(
  accessToken: string,
  senderId: string
): Promise<string | null> {
  if (!accessToken) return null;
  try {
    const res = await fetch(
      `https://graph.instagram.com/${IG_GRAPH_VERSION}/${senderId}?fields=name,username&access_token=${accessToken}`
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { name?: string; username?: string };
    return json.username ? `@${json.username}` : (json.name ?? null);
  } catch {
    return null;
  }
}

export async function sendInstagramMessage(
  accessToken: string,
  recipientId: string,
  text: string
): Promise<SendMessageResult> {
  if (!accessToken) {
    return { ok: false, error: 'Instagram access token kosong' };
  }

  try {
    const res = await fetch(`https://graph.instagram.com/${IG_GRAPH_VERSION}/me/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text },
      }),
    });

    if (!res.ok) {
      // 24-jam window habis / token expired / akun invalid — log saja,
      // jangan crash webhook.
      const detail = await res.text();
      console.warn('[instagram/api] send failed:', res.status, detail);
      return { ok: false, error: `Graph API ${res.status}` };
    }

    const json = (await res.json()) as { message_id?: string };
    return { ok: true, messageId: json.message_id };
  } catch (err) {
    console.warn('[instagram/api] send error:', err);
    return { ok: false, error: 'Network error' };
  }
}
