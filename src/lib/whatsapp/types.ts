/**
 * Tipe payload webhook WhatsApp Cloud API (Meta Graph API).
 * Hanya field yang dipakai — payload asli punya lebih banyak field.
 * Ref: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-examples
 */

export interface WhatsAppTextMessage {
  body: string;
}

export interface WhatsAppMessage {
  /** wa_id pengirim (nomor WhatsApp tanpa +) */
  from: string;
  /** wamid — ID unik pesan, dipakai dedup webhook retry */
  id: string;
  timestamp: string;
  type: string; // 'text' | 'image' | 'audio' | 'document' | 'sticker' | ...
  text?: WhatsAppTextMessage;
}

export interface WhatsAppContact {
  wa_id: string;
  profile?: {
    name?: string;
  };
}

export interface WhatsAppMetadata {
  display_phone_number: string;
  /** ID nomor bisnis penerima — dipakai lookup channel_integrations.external_account_id */
  phone_number_id: string;
}

export interface WhatsAppWebhookValue {
  messaging_product: string;
  metadata: WhatsAppMetadata;
  contacts?: WhatsAppContact[];
  messages?: WhatsAppMessage[];
  // statuses (delivery report) diabaikan — tidak dipakai Leads Hub
}

export interface WhatsAppWebhookChange {
  field: string; // 'messages'
  value: WhatsAppWebhookValue;
}

export interface WhatsAppWebhookEntry {
  id: string; // WABA ID
  changes?: WhatsAppWebhookChange[];
}

export interface WhatsAppWebhookPayload {
  object: string; // 'whatsapp_business_account'
  entry?: WhatsAppWebhookEntry[];
}
