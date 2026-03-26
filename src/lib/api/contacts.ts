import { createClient } from '@/lib/supabase';
import type { Contact, ContactType, Transaction } from '@/types';

export interface ContactInsert {
  business_id: string;
  name: string;
  type: ContactType;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  created_by: string;
}

export interface ContactUpdate {
  name?: string;
  type?: ContactType;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
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
    .ilike('name', `%${query}%`)
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
      credit_account:accounts!transactions_credit_account_id_fkey(*)
    `)
    .eq('business_id', businessId)
    .ilike('name', contactName)
    .is('deleted_at', null)
    .order('date', { ascending: false })
    .limit(50);

  if (error) throw new Error(error.message);
  return data as Transaction[];
}

/** Simpan nama dari transaksi sebagai kontak (jika belum ada) */
export async function saveContactFromTransaction(
  businessId: string,
  name: string,
  type: ContactType,
  userId: string
): Promise<Contact | null> {
  const supabase = createClient();

  // Cek apakah sudah ada kontak dengan nama ini
  const { data: existing } = await supabase
    .from('business_contacts')
    .select('id')
    .eq('business_id', businessId)
    .ilike('name', name)
    .limit(1);

  if (existing && existing.length > 0) return null; // Sudah ada

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

  if (error) throw new Error(error.message);
  return data as Contact;
}
