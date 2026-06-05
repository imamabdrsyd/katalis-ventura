'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Contact, Phone, Mail, Plus, Search, Pencil, Trash2, User, Building, Users2, Handshake, UserCog, TrendingUp, ArrowDownLeft, ArrowUpRight, Loader2, X } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { FileUpload } from '@/components/ui/FileUpload';
import { TransactionDetailModal } from '@/components/transactions/TransactionDetailModal';
import * as contactsApi from '@/lib/api/contacts';
import { formatCurrency, formatDate } from '@/lib/utils';
import { CATEGORY_LABELS } from '@/lib/calculations';
import { CATEGORY_BADGE_CLASSES } from '@/lib/categoryColors';
import { isImageType } from '@/lib/storage/attachments';
import type { Contact as ContactType, ContactType as ContactTypeEnum, Transaction, TransactionAttachment } from '@/types';

const CONTACT_TYPE_CONFIG: Record<ContactTypeEnum, { label: string; icon: React.ReactNode; className: string }> = {
  customer: {
    label: 'Customer',
    icon: <User className="w-3.5 h-3.5" />,
    className: 'text-gray-500 dark:text-gray-400',
  },
  vendor: {
    label: 'Vendor',
    icon: <Building className="w-3.5 h-3.5" />,
    className: 'text-gray-500 dark:text-gray-400',
  },
  partner: {
    label: 'Partner',
    icon: <Handshake className="w-3.5 h-3.5" />,
    className: 'text-gray-500 dark:text-gray-400',
  },
  staff: {
    label: 'Staff',
    icon: <UserCog className="w-3.5 h-3.5" />,
    className: 'text-gray-500 dark:text-gray-400',
  },
  investor: {
    label: 'Investor',
    icon: <TrendingUp className="w-3.5 h-3.5" />,
    className: 'text-gray-500 dark:text-gray-400',
  },
  other: {
    label: 'Lainnya',
    icon: <Users2 className="w-3.5 h-3.5" />,
    className: 'text-gray-500 dark:text-gray-400',
  },
};

const CATEGORY_BADGE_COLORS = CATEGORY_BADGE_CLASSES;

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

interface ContactFormData {
  name: string;
  type: ContactTypeEnum;
  phone: string;
  email: string;
  address: string;
  notes: string;
  id_card_attachments: TransactionAttachment[];
}

const EMPTY_FORM: ContactFormData = {
  name: '',
  type: 'other',
  phone: '',
  email: '',
  address: '',
  notes: '',
  id_card_attachments: [],
};

const CONTACT_DETAIL_STORAGE_PREFIX = 'business-contact-detail-panel';

function getContactDetailStorageKey(businessId: string) {
  return `${CONTACT_DETAIL_STORAGE_PREFIX}:${businessId}`;
}

interface ContactListProps {
  businessId: string;
  userId: string;
  canManage: boolean;
}

export function ContactList({ businessId, userId, canManage }: ContactListProps) {
  const searchParams = useSearchParams();
  const contactParam = searchParams.get('contact');
  const contactSearchParam = searchParams.get('search') ?? '';
  const [contacts, setContacts] = useState<ContactType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<ContactTypeEnum | 'all'>('all');

  // Detail panel state
  const [selectedContact, setSelectedContact] = useState<ContactType | null>(null);
  const [contactTransactions, setContactTransactions] = useState<Transaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingContact, setEditingContact] = useState<ContactType | null>(null);
  const [formData, setFormData] = useState<ContactFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [savingStep, setSavingStep] = useState<'idle' | 'saving' | 'syncing'>('idle');
  const [formError, setFormError] = useState('');

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<ContactType | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Transaction detail modal
  const [detailTransaction, setDetailTransaction] = useState<Transaction | null>(null);

  // Keyboard navigation
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  const loadContactTransactions = useCallback(async (contactName: string) => {
    setLoadingTransactions(true);
    try {
      const txns = await contactsApi.getContactTransactions(businessId, contactName);
      setContactTransactions(txns);
    } catch (err) {
      console.error('Failed to fetch contact transactions:', err);
      setContactTransactions([]);
    } finally {
      setLoadingTransactions(false);
    }
  }, [businessId]);

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await contactsApi.getContacts(businessId);
      setContacts(data);
    } catch (err) {
      console.error('Failed to fetch contacts:', err);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  useEffect(() => {
    if (!contactSearchParam || contactParam) return;
    setSearch(contactSearchParam);
  }, [contactParam, contactSearchParam]);

  useEffect(() => {
    if (loading || contacts.length === 0 || !contactParam) return;

    const contactToShow = contacts.find((contact) => contact.id === contactParam);
    if (!contactToShow || selectedContact?.id === contactToShow.id) return;

    setSelectedContact(contactToShow);
    setSearch('');
    setFilterType('all');
    window.localStorage.setItem(getContactDetailStorageKey(businessId), contactToShow.id);
    loadContactTransactions(contactToShow.name);
  }, [businessId, contactParam, contacts, loadContactTransactions, loading, selectedContact?.id]);

  useEffect(() => {
    if (loading || selectedContact || contacts.length === 0 || contactParam) return;

    const storedContactId = window.localStorage.getItem(getContactDetailStorageKey(businessId));
    const persistedContact = storedContactId
      ? contacts.find((contact) => contact.id === storedContactId)
      : null;
    const contactToShow = persistedContact ?? contacts[0];

    setSelectedContact(contactToShow);
    window.localStorage.setItem(getContactDetailStorageKey(businessId), contactToShow.id);
    loadContactTransactions(contactToShow.name);
  }, [businessId, contactParam, contacts, loadContactTransactions, loading, selectedContact]);

  const filteredContacts = contacts.filter((c) => {
    const matchSearch =
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone?.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === 'all' || c.type === filterType;
    return matchSearch && matchType;
  });

  // Sync focusedIndex ke posisi selectedContact di filteredContacts
  useEffect(() => {
    if (!selectedContact) return;
    const idx = filteredContacts.findIndex(c => c.id === selectedContact.id);
    setFocusedIndex(idx);
  }, [selectedContact?.id, search, filterType]); // eslint-disable-line react-hooks/exhaustive-deps

  const navigateList = useCallback((direction: 'up' | 'down') => {
    if (filteredContacts.length === 0) return;
    setFocusedIndex(prev => {
      const next = direction === 'down'
        ? Math.min(prev + 1, filteredContacts.length - 1)
        : Math.max(prev - 1, 0);
      const contact = filteredContacts[next];
      if (contact) handleSelectContact(contact);
      // Scroll item into view
      setTimeout(() => {
        itemRefs.current[next]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }, 0);
      return next;
    });
  }, [filteredContacts]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectContact = async (contact: ContactType) => {
    if (selectedContact?.id === contact.id) return;

    setSelectedContact(contact);
    window.localStorage.setItem(getContactDetailStorageKey(businessId), contact.id);
    loadContactTransactions(contact.name);
  };

  const openAddForm = () => {
    setEditingContact(null);
    setFormData(EMPTY_FORM);
    setFormError('');
    setShowForm(true);
  };

  const openEditForm = (contact: ContactType) => {
    setEditingContact(contact);
    setFormData({
      name: contact.name,
      type: contact.type,
      phone: contact.phone || '',
      email: contact.email || '',
      address: contact.address || '',
      notes: contact.notes || '',
      id_card_attachments: contact.id_card_attachments || [],
    });
    setFormError('');
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setFormError('Nama kontak wajib diisi');
      return;
    }

    setSaving(true);
    setSavingStep('saving');
    setFormError('');
    try {
      if (editingContact) {
        const oldName = editingContact.name;
        const newName = formData.name.trim();
        const nameChanged = oldName.toLowerCase() !== newName.toLowerCase();

        await contactsApi.updateContact(editingContact.id, {
          name: newName,
          type: formData.type,
          phone: formData.phone.trim() || null,
          email: formData.email.trim() || null,
          address: formData.address.trim() || null,
          notes: formData.notes.trim() || null,
          id_card_attachments: formData.id_card_attachments,
        });

        if (nameChanged) {
          // Fase 2: sync nama ke transaksi
          setSavingStep('syncing');
          await contactsApi.syncContactNameInTransactions(businessId, oldName, newName);
        }

        // Update selectedContact state agar panel tidak stale
        if (selectedContact?.id === editingContact.id) {
          const updatedContact = {
            ...selectedContact,
            name: newName,
            type: formData.type,
            phone: formData.phone.trim() || null,
            email: formData.email.trim() || null,
            address: formData.address.trim() || null,
            notes: formData.notes.trim() || null,
            id_card_attachments: formData.id_card_attachments,
          };
          setSelectedContact(updatedContact);

          if (nameChanged) {
            // Re-fetch transaksi dengan nama baru
            loadContactTransactions(newName);
          }
        }
      } else {
        await contactsApi.createContact({
          business_id: businessId,
          name: formData.name.trim(),
          type: formData.type,
          phone: formData.phone.trim() || undefined,
          email: formData.email.trim() || undefined,
          address: formData.address.trim() || undefined,
          notes: formData.notes.trim() || undefined,
          id_card_attachments: formData.id_card_attachments,
          created_by: userId,
        });
      }
      setShowForm(false);
      fetchContacts();
    } catch (err: any) {
      if (err.message?.includes('idx_business_contacts_unique_name')) {
        setFormError('Kontak dengan nama ini sudah ada');
      } else {
        setFormError(err.message || 'Gagal menyimpan kontak');
      }
    } finally {
      setSaving(false);
      setSavingStep('idle');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await contactsApi.deleteContact(deleteTarget.id);
      setDeleteTarget(null);
      if (selectedContact?.id === deleteTarget.id) {
        setSelectedContact(null);
        setContactTransactions([]);
        window.localStorage.removeItem(getContactDetailStorageKey(businessId));
      }
      fetchContacts();
    } catch (err) {
      console.error('Failed to delete contact:', err);
    } finally {
      setDeleting(false);
    }
  };

  // Determine cash direction: inflow if debit account is cash/bank
  function isCashInflow(txn: Transaction): boolean {
    if (txn.is_double_entry && txn.debit_account) {
      const acc = txn.debit_account;
      if (acc.is_cash_equivalent === true) return true;
      // Legacy fallback untuk akun lama yang belum di-flag
      return acc.account_code === '1100' || acc.account_code === '1200';
    }
    return txn.category === 'EARN';
  }

  // Compute transaction summary for selected contact
  const txnSummary = contactTransactions.reduce(
    (acc, txn) => {
      if (isCashInflow(txn)) {
        acc.totalIn += txn.amount;
      } else {
        acc.totalOut += txn.amount;
      }
      acc.count += 1;
      return acc;
    },
    { totalIn: 0, totalOut: 0, count: 0 }
  );
  const selectedIdCardImage = selectedContact?.id_card_attachments?.find((attachment) => isImageType(attachment.mime_type));

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-4 p-4 rounded-xl bg-white dark:bg-gray-800 animate-pulse border border-gray-200 dark:border-gray-700">
            <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="h-3 w-48 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ============ SPLIT LAYOUT: list left + detail right ============
  return (
    <div className="flex gap-6">
      {/* LEFT: Contact List */}
      <div className={`space-y-4 ${selectedContact ? 'w-1/2 flex-shrink-0' : 'w-full'}`}>
        {/* Search + Filter bar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') { e.preventDefault(); navigateList('down'); }
                else if (e.key === 'ArrowUp') { e.preventDefault(); navigateList('up'); }
                else if (e.key === 'Escape' && search) { e.preventDefault(); setSearch(''); }
              }}
              placeholder="Cari nama, telepon, email..."
              className="input-search pl-9 pr-10 w-full"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:text-gray-200 dark:hover:bg-gray-700 transition-colors"
                aria-label="Batalkan pencarian kontak"
                title="Batalkan pencarian"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as ContactTypeEnum | 'all')}
              className="input-search"
            >
              <option value="all">Semua Tipe</option>
              <option value="customer">Customer</option>
              <option value="vendor">Vendor</option>
              <option value="partner">Partner</option>
              <option value="staff">Staff</option>
              <option value="investor">Investor</option>
              <option value="other">Lainnya</option>
            </select>
            {canManage && (
              <button
                onClick={openAddForm}
                className="btn-primary flex items-center gap-2 whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                Tambah
              </button>
            )}
          </div>
        </div>

        {/* Contact count */}
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {filteredContacts.length} kontak{search || filterType !== 'all' ? ` (dari ${contacts.length} total)` : ''}
        </p>

        {/* Empty state */}
        {contacts.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <Contact className="w-8 h-8 text-gray-400 dark:text-gray-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">Belum ada kontak</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              Simpan customer dan vendor agar mudah digunakan saat input transaksi
            </p>
            {canManage && (
              <button
                onClick={openAddForm}
                className="btn-primary inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Tambah Kontak
              </button>
            )}
          </div>
        ) : filteredContacts.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-gray-400">Tidak ada kontak yang cocok</p>
          </div>
        ) : (
          /* Contact list */
          <div
            ref={listRef}
            className="overflow-y-auto max-h-[calc(100vh-280px)] space-y-2 pr-1 outline-none"
            tabIndex={-1}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); navigateList('down'); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); navigateList('up'); }
            }}
          >
            {filteredContacts.map((contact, idx) => {
              const typeConfig = CONTACT_TYPE_CONFIG[contact.type];
              const showTypeLabel = contact.type !== 'other';
              const isSelected = selectedContact?.id === contact.id;
              return (
                <div
                  key={contact.id}
                  ref={el => { itemRefs.current[idx] = el; }}
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-300 dark:border-indigo-700 ring-1 ring-indigo-200 dark:ring-indigo-800'
                      : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                  onClick={() => handleSelectContact(contact)}
                >
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 bg-gray-100 dark:bg-gray-700/60">
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                      {getInitials(contact.name)}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-semibold truncate ${
                        isSelected
                          ? 'text-indigo-700 dark:text-indigo-300'
                          : 'text-gray-900 dark:text-gray-100'
                      }`}>
                        {contact.name}
                      </p>
                      {showTypeLabel && (
                        <span className={`inline-flex items-center gap-1 text-xs font-medium flex-shrink-0 ${typeConfig.className}`}>
                          {typeConfig.icon}
                          {typeConfig.label}
                        </span>
                      )}
                    </div>
                    {/* Show compact info */}
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {contact.phone && (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {contact.phone}
                        </span>
                      )}
                      {contact.email && (
                        <span className="inline-flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {contact.email}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  {canManage && (
                    <div className="flex items-center gap-0.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => openEditForm(contact)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                        title="Edit kontak"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(contact)}
                        className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                        title="Hapus kontak"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* RIGHT: Transaction Detail Panel */}
      {selectedContact && (
        <div className="w-1/2 flex-shrink-0">
          <div className="sticky top-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Panel Header */}
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-700/60 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                      {getInitials(selectedContact.name)}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">
                        {selectedContact.name}
                      </h3>
                      {selectedContact.type !== 'other' && (
                        <span className={`inline-flex items-center gap-1 text-xs font-medium flex-shrink-0 ${CONTACT_TYPE_CONFIG[selectedContact.type].className}`}>
                          {CONTACT_TYPE_CONFIG[selectedContact.type].icon}
                          {CONTACT_TYPE_CONFIG[selectedContact.type].label}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-x-3 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {selectedContact.phone && (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {selectedContact.phone}
                        </span>
                      )}
                      {selectedContact.email && (
                        <span className="inline-flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {selectedContact.email}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {selectedIdCardImage && (
                <a
                  href={selectedIdCardImage.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block mt-3 aspect-[85.6/54] w-full max-w-md overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={selectedIdCardImage.url}
                    alt={`ID card ${selectedContact.name}`}
                    className="h-full w-full object-cover object-center"
                  />
                </a>
              )}

              {/* Summary row */}
              {!loadingTransactions && contactTransactions.length > 0 && (
                <div className="flex gap-4 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                  <div className="flex-1">
                    <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500">Transaksi</p>
                    <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{txnSummary.count}</p>
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500">Masuk</p>
                    <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(txnSummary.totalIn)}</p>
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500">Keluar</p>
                    <p className="text-sm font-bold text-red-600 dark:text-red-400">{formatCurrency(txnSummary.totalOut)}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Transaction List */}
            <div className="max-h-[calc(100vh-320px)] overflow-y-auto">
              {loadingTransactions ? (
                <div className="flex items-center justify-center py-16 text-gray-400">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  <span className="text-sm">Memuat transaksi...</span>
                </div>
              ) : contactTransactions.length === 0 ? (
                <div className="text-center py-16">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Belum ada transaksi dengan kontak ini</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  {contactTransactions.map((txn) => {
                    const isIncome = isCashInflow(txn);
                    return (
                      <div key={txn.id} onClick={() => setDetailTransaction(txn)} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors cursor-pointer">
                        {/* Direction icon */}
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                          isIncome
                            ? 'bg-emerald-50 dark:bg-emerald-900/30'
                            : 'bg-red-50 dark:bg-red-900/30'
                        }`}>
                          {isIncome ? (
                            <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <ArrowUpRight className="w-3.5 h-3.5 text-red-500" />
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                              {txn.description || txn.name}
                            </p>
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold flex-shrink-0 ${txn.meta?.settlement_of_transaction_id ? CATEGORY_BADGE_COLORS['SETTLE'] : (CATEGORY_BADGE_COLORS[txn.category] || '')}`}>
                              {txn.meta?.settlement_of_transaction_id ? 'SETTLE' : CATEGORY_LABELS[txn.category]}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {formatDate(txn.date)}
                            {txn.debit_account && txn.credit_account && (
                              <span className="ml-1.5 text-gray-400 dark:text-gray-500">
                                {txn.debit_account.account_name} &rarr; {txn.credit_account.account_name}
                              </span>
                            )}
                          </p>
                        </div>

                        {/* Amount */}
                        <p className={`text-sm font-semibold tabular-nums flex-shrink-0 ${
                          isIncome
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}>
                          {isIncome ? '+' : '-'}{formatCurrency(txn.amount)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {renderFormModal()}
      {renderDeleteModal()}

      {/* Transaction Detail Modal */}
      <TransactionDetailModal
        transaction={detailTransaction}
        isOpen={!!detailTransaction}
        onClose={() => setDetailTransaction(null)}
      />
    </div>
  );

  // ============ SHARED MODALS ============
  function renderFormModal() {
    return (
      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title={editingContact ? 'Edit Kontak' : 'Tambah Kontak'}
      >
        <div className="space-y-4">
          <div>
            <label className="label">Nama *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              className="input"
              placeholder="Nama customer/vendor"
              autoFocus
            />
          </div>

          <div>
            <label className="label">Tipe</label>
            <div className="flex gap-2 overflow-x-auto overflow-y-hidden pb-1">
              {(['customer', 'vendor', 'partner', 'staff', 'investor', 'other'] as ContactTypeEnum[]).map((t) => {
                const config = CONTACT_TYPE_CONFIG[t];
                const isActive = formData.type === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, type: t }))}
                    className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      isActive
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                        : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    {config.icon}
                    {config.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="label">Telepon</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
              className="input"
              placeholder="08xxxxxxxxxx"
            />
          </div>

          <div>
            <label className="label">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
              className="input"
              placeholder="email@example.com"
            />
          </div>

          <div>
            <label className="label">Alamat</label>
            <textarea
              value={formData.address}
              onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
              className="input"
              rows={2}
              placeholder="Alamat lengkap"
            />
          </div>

          <div>
            <label className="label">Foto ID Card</label>
            <FileUpload
              businessId={businessId}
              value={formData.id_card_attachments}
              onChange={(atts) => setFormData((prev) => ({ ...prev, id_card_attachments: atts }))}
              disabled={saving}
            />
          </div>

          <div>
            <label className="label">Catatan</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
              className="input"
              rows={2}
              placeholder="Catatan tambahan (opsional)"
            />
          </div>

          {formError && (
            <p className="text-sm text-red-500 dark:text-red-400">{formError}</p>
          )}

          {/* Progress indicator saat saving */}
          {saving && (
            <div className="flex items-center gap-3 px-3 py-2.5 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
              <Loader2 className="w-4 h-4 text-indigo-500 animate-spin flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-indigo-700 dark:text-indigo-300">
                  {savingStep === 'syncing'
                    ? 'Menyinkronkan ke transaksi...'
                    : 'Menyimpan kontak...'}
                </p>
                {savingStep === 'syncing' && (
                  <p className="text-[10px] text-indigo-500 dark:text-indigo-400 mt-0.5">
                    Memperbarui nama di semua transaksi terkait
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center gap-4 pt-2">
            <button
              onClick={() => setShowForm(false)}
              className="px-2 py-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 font-medium transition-colors disabled:opacity-50"
              disabled={saving}
            >
              Batal
            </button>
            <button
              onClick={handleSave}
              className="btn-primary-glow flex-1 flex items-center justify-center gap-2"
              disabled={saving}
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving
                ? savingStep === 'syncing' ? 'Menyinkronkan...' : 'Menyimpan...'
                : editingContact ? 'Simpan' : 'Tambah'}
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  function renderDeleteModal() {
    return (
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Hapus Kontak"
      >
        <div className="space-y-4">
          <p className="text-gray-600 dark:text-gray-300">
            Apakah Anda yakin ingin menghapus kontak <strong>{deleteTarget?.name}</strong>?
          </p>
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setDeleteTarget(null)}
              className="btn-secondary flex-1"
              disabled={deleting}
            >
              Batal
            </button>
            <button
              onClick={handleDelete}
              className="btn-danger flex-1"
              disabled={deleting}
            >
              {deleting ? 'Menghapus...' : 'Hapus'}
            </button>
          </div>
        </div>
      </Modal>
    );
  }
}
