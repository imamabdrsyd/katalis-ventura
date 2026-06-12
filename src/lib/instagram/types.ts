/**
 * Tipe payload webhook Instagram Messaging (gaya Messenger).
 * Hanya field yang dipakai — payload asli punya lebih banyak field.
 * Ref: https://developers.facebook.com/docs/instagram-platform/webhooks
 */

export interface InstagramMessage {
  /** message id (mid) — dipakai dedup webhook retry */
  mid: string;
  text?: string;
  /** true = pesan yang DIKIRIM oleh akun bisnis (echo) — harus di-skip */
  is_echo?: boolean;
}

export interface InstagramMessaging {
  /** IGSID pengirim (customer) */
  sender: { id: string };
  /** IGSID akun bisnis penerima — dipakai lookup channel_integrations.external_account_id */
  recipient: { id: string };
  timestamp: number;
  message?: InstagramMessage;
}

export interface InstagramWebhookEntry {
  /** ID akun Instagram bisnis */
  id: string;
  time: number;
  messaging?: InstagramMessaging[];
}

export interface InstagramWebhookPayload {
  object: string; // 'instagram'
  entry?: InstagramWebhookEntry[];
}
