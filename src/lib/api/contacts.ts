import { createClient } from '@/lib/supabase';
import type { Contact, ContactType, Transaction, TransactionAttachment, TransactionCategory } from '@/types';

export interface ContactInsert {
  business_id: string;
  name: string;
  type: ContactType;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  id_card_attachments?: TransactionAttachment[];
  created_by: string;
}

export interface ContactUpdate {
  name?: string;
  type?: ContactType;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  id_card_attachments?: TransactionAttachment[];
}

/**
 * Escape karakter wildcard ILIKE (%, _, \) agar nama kontak dipakai sebagai
 * literal, bukan pattern. Tanpa ini, kontak bernama "Promo 50%" akan match
 * nama lain yang berawalan "Promo 50".
 */
function escapeIlike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

export function resolveContactTypeFromCategory(category: TransactionCategory): ContactType {
  if (category === 'EARN') return 'customer';
  if (category === 'FIN') return 'partner';
  return 'vendor';
}

export function resolveContactTypeFromFlow(direction: 'in' | 'out' | 'neutral' | null | undefined): ContactType {
  if (direction === 'in') return 'customer';
  if (direction === 'out') return 'vendor';
  return 'partner';
}

/** Ambil semua kontak bisnis, sorted by name */
export async function getContacts(businessId: string): Promise<Contact[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('business_contacts')
    .select('*')
    .eq('business_id', businessId)
    .order('name', { ascending: true });

  if (error) throw new Error(error.message);
  return data as Contact[];
}

/** Cari kontak berdasarkan nama (untuk autocomplete) */
export async function searchContacts(businessId: string, query: string): Promise<Contact[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('business_contacts')
    .select('*')
    .eq('business_id', businessId)
    .ilike('name', `%${escapeIlike(query)}%`)
    .order('name', { ascending: true })
    .limit(10);

  if (error) throw new Error(error.message);
  return data as Contact[];
}

/** Buat kontak baru */
export async function createContact(contact: ContactInsert): Promise<Contact> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('business_contacts')
    .insert(contact)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Contact;
}

/** Update kontak */
export async function updateContact(contactId: string, updates: ContactUpdate): Promise<Contact> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('business_contacts')
    .update(updates)
    .eq('id', contactId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Contact;
}

/** Hapus kontak */
export async function deleteContact(contactId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('business_contacts')
    .delete()
    .eq('id', contactId);

  if (error) throw new Error(error.message);
}

/** Ambil transaksi yang terkait dengan nama kontak */
export async function getContactTransactions(businessId: string, contactName: string): Promise<Transaction[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('transactions')
    .select(`
      *,
      debit_account:accounts!transactions_debit_account_id_fkey(*),
      credit_account:accounts!transactions_credit_account_id_fkey(*),
      journal_lines(*, account:accounts(*))
    `)
    .eq('business_id', businessId)
    .ilike('name', escapeIlike(contactName))
    .is('deleted_at', null)
    .order('date', { ascending: false })
    .limit(50);

  if (error) throw new Error(error.message);
  return data as Transaction[];
}

export interface SaveContactResult {
  contact: Contact;
  created: boolean;
}

/**
 * Simpan nama dari transaksi sebagai kontak. Insert-first: duplikat (termasuk
 * race dua panggilan bersamaan) ditangkap lewat unique violation, lalu kontak
 * yang sudah ada di-fetch dan dikembalikan dengan created=false.
 */
export async function saveContactFromTransaction(
  businessId: string,
  name: string,
  type: ContactType,
  userId: string
): Promise<SaveContactResult> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('business_contacts')
    .insert({
      business_id: businessId,
      name,
      type,
      created_by: userId,
    })
    .select()
    .single();

  if (!error) return { contact: data as Contact, created: true };

  // 23505 = unique violation pada idx_business_contacts_unique_name — kontak sudah ada
  if (error.code === '23505') {
    const { data: existing } = await supabase
      .from('business_contacts')
      .select('*')
      .eq('business_id', businessId)
      .ilike('name', escapeIlike(name))
      .limit(1)
      .single();

    if (existing) return { contact: existing as Contact, created: false };
  }

  throw new Error(error.message);
}
