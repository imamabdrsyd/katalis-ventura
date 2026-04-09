// Telegram Bot API types (subset yang dipakai)

export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface TelegramChat {
  id: number;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  first_name?: string;
  last_name?: string;
  username?: string;
}

export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
}

// Internal types

export type TransactionCategory = 'EARN' | 'OPEX' | 'VAR' | 'CAPEX' | 'TAX' | 'FIN';

export interface ParsedTransaction {
  name: string;
  amount: number;
  category: TransactionCategory;
  confidence: 'high' | 'medium' | 'low';
  raw: string;
}

export interface TelegramConnection {
  id: string;
  user_id: string;
  telegram_chat_id: number;
  telegram_username: string | null;
  telegram_first_name: string | null;
  default_business_id: string | null;
  pending_transaction: ParsedTransaction | null;
  pending_expires_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TelegramLinkToken {
  id: string;
  user_id: string;
  token: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
}
