'use client';

import { useState, useEffect, useCallback } from 'react';
import { Contact, Phone, Mail, MapPin, Plus, Search, Pencil, Trash2, User, Building, Users2, ArrowLeft, ArrowDownLeft, ArrowUpRight, Loader2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import * as contactsApi from '@/lib/api/contacts';
import { formatCurrency, formatDate } from '@/lib/utils';
import { CATEGORY_LABELS } from '@/lib/calculations';
import type { Contact as ContactType, ContactType as ContactTypeEnum, Transaction } from '@/types';

const CONTACT_TYPE_CONFIG: Record<ContactTypeEnum, { label: string; icon: React.ReactNode; className: string }> = {
  customer: {
    label: 'Customer',
    icon: <User className="w-3.5 h-3.5" />,
    className: 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400',
  },
  vendor: {
    label: 'Vendor',
    icon: <Building className="w-3.5 h-3.5" />,
    className: 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
  },
  other: {
    label: 'Lainnya',
    icon: <Users2 className="w-3.5 h-3.5" />,
    className: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400',
  },
};

const CATEGORY_BADGE_COLORS: Record<string, string> = {
  EARN: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
  OPEX: 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400',
  VAR: 'bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
  CAPEX: 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
  TAX: 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
  FIN: 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
};

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
}

const EMPTY_FORM: ContactFormData = {
  name: '',
  type: 'other',
  phone: '',
  email: '',
  address: '',
  notes: '',
};

interface ContactListProps {
  businessId: string;
  userId: string;
  canManage: boolean;
}

export function ContactList({ businessId, userId, canManage }: ContactListProps) {
  const [contacts, setContacts] = useState<ContactType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<ContactTypeEnum | 'all'>('all');

  // Detail view state
  const [selectedContact, setSelectedContact] = useState<ContactType | null>(null);
  const [contactTransactions, setContactTransactions] = useState<Transaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingContact, setEditingContact] = useState<ContactType | null>(null);
  const [formData, setFormData] = useState<ContactFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<ContactType | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  const filteredContacts = contacts.filter((c) => {
    const matchSearch =
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone?.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === 'all' || c.type === filterType;
    return matchSearch && matchType;
  });

  const handleSelectContact = async (contact: ContactType) => {
    setSelectedContact(contact);
    setLoadingTransactions(true);
    try {
      const txns = await contactsApi.getContactTransactions(businessId, contact.name);
      setContactTransactions(txns);
    } catch (err) {
      console.error('Failed to fetch contact transactions:', err);
      setContactTransactions([]);
    } finally {
      setLoadingTransactions(false);
    }
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
    setFormError('');
    try {
      if (editingContact) {
        await contactsApi.updateContact(editingContact.id, {
          name: formData.name.trim(),
          type: formData.type,
          phone: formData.phone.trim() || null,
          email: formData.email.trim() || null,
          address: formData.address.trim() || null,
          notes: formData.notes.trim() || null,
        });
      } else {
        await contactsApi.createContact({
          business_id: businessId,
          name: formData.name.trim(),
          type: formData.type,
          phone: formData.phone.trim() || undefined,
          email: formData.email.trim() || undefined,
          address: formData.address.trim() || undefined,
          notes: formData.notes.trim() || undefined,
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
      }
      fetchContacts();
    } catch (err) {
      console.error('Failed to delete contact:', err);
    } finally {
      setDeleting(false);
    }
  };

  // Compute transaction summary for selected contact
  const txnSummary = contactTransactions.reduce(
    (acc, txn) => {
      if (txn.category === 'EARN') {
        acc.totalIn += txn.amount;
      } else {
        acc.totalOut += txn.amount;
      }
      acc.count += 1;
      return acc;
    },
    { totalIn: 0, totalOut: 0, count: 0 }
  );

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

  // ============ DETAIL VIEW ============
  if (selectedContact) {
    const typeConfig = CONTACT_TYPE_CONFIG[selectedContact.type];
    return (
      <div className="space-y-6">
        {/* Back + Header */}
        <div>
          <button
            onClick={() => setSelectedContact(null)}
            className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Kembali ke daftar kontak
          </button>

          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center flex-shrink-0">
              <span className="text-base font-bold text-indigo-500 dark:text-indigo-400">
                {getInitials(selectedContact.name)}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 truncate">
                  {selectedContact.name}
                </h2>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${typeConfig.className}`}>
                  {typeConfig.icon}
                  {typeConfig.label}
                </span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
                {selectedContact.phone && (
                  <span className="inline-flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5" />
                    {selectedContact.phone}
                  </span>
                )}
                {selectedContact.email && (
                  <span className="inline-flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5" />
                    {selectedContact.email}
                  </span>
                )}
                {selectedContact.address && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    {selectedContact.address}
                  </span>
                )}
              </div>
              {selectedContact.notes && (
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">{selectedContact.notes}</p>
              )}
            </div>
            {canManage && (
              <div className="flex gap-1 flex-shrink-0">
                <button
                  onClick={() => openEditForm(selectedContact)}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  title="Edit kontak"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setDeleteTarget(selectedContact)}
                  className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                  title="Hapus kontak"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Summary Cards */}
        {!loadingTransactions && contactTransactions.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total Transaksi</p>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{txnSummary.count}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Pemasukan</p>
              <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(txnSummary.totalIn)}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Pengeluaran</p>
              <p className="text-lg font-bold text-red-600 dark:text-red-400">{formatCurrency(txnSummary.totalOut)}</p>
            </div>
          </div>
        )}

        {/* Transaction History */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            Riwayat Transaksi
          </h3>

          {loadingTransactions ? (
            <div className="flex items-center justify-center py-12 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Memuat transaksi...
            </div>
          ) : contactTransactions.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-gray-500 dark:text-gray-400 text-sm">Belum ada transaksi dengan kontak ini</p>
            </div>
          ) : (
            <div className="space-y-2">
              {contactTransactions.map((txn) => {
                const isIncome = txn.category === 'EARN';
                return (
                  <div
                    key={txn.id}
                    className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
                  >
                    {/* Direction icon */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      isIncome
                        ? 'bg-emerald-50 dark:bg-emerald-900/30'
                        : 'bg-red-50 dark:bg-red-900/30'
                    }`}>
                      {isIncome ? (
                        <ArrowDownLeft className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4 text-red-500" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {txn.description || txn.name}
                        </p>
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${CATEGORY_BADGE_COLORS[txn.category] || ''}`}>
                          {CATEGORY_LABELS[txn.category]}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {formatDate(txn.date)}
                        {txn.debit_account && txn.credit_account && (
                          <span className="ml-2 text-gray-400 dark:text-gray-500">
                            {txn.debit_account.account_name} → {txn.credit_account.account_name}
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

        {/* Modals (shared with list view) */}
        {renderFormModal()}
        {renderDeleteModal()}
      </div>
    );
  }

  // ============ LIST VIEW ============
  return (
    <div className="space-y-4">
      {/* Search + Filter bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama, telepon, email..."
            className="input pl-9 w-full"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as ContactTypeEnum | 'all')}
            className="input text-sm"
          >
            <option value="all">Semua Tipe</option>
            <option value="customer">Customer</option>
            <option value="vendor">Vendor</option>
            <option value="other">Lainnya</option>
          </select>
          {canManage && (
            <button
              onClick={openAddForm}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl transition-colors font-medium text-sm shadow-sm whitespace-nowrap"
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
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl transition-colors font-medium text-sm"
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
        <div className="space-y-3">
          {filteredContacts.map((contact) => {
            const typeConfig = CONTACT_TYPE_CONFIG[contact.type];
            return (
              <div
                key={contact.id}
                className="flex items-start gap-4 p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
              >
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-semibold text-indigo-500 dark:text-indigo-400">
                    {getInitials(contact.name)}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <button
                      onClick={() => handleSelectContact(contact)}
                      className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:underline truncate transition-colors text-left"
                    >
                      {contact.name}
                    </button>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${typeConfig.className}`}>
                      {typeConfig.icon}
                      {typeConfig.label}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
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
                    {contact.address && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {contact.address}
                      </span>
                    )}
                  </div>
                  {contact.notes && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 line-clamp-1">{contact.notes}</p>
                  )}
                </div>

                {/* Actions */}
                {canManage && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => openEditForm(contact)}
                      className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                      title="Edit kontak"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(contact)}
                      className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                      title="Hapus kontak"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {renderFormModal()}
      {renderDeleteModal()}
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
            <div className="flex gap-2">
              {(['customer', 'vendor', 'other'] as ContactTypeEnum[]).map((t) => {
                const config = CONTACT_TYPE_CONFIG[t];
                const isActive = formData.type === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, type: t }))}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
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

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setShowForm(false)}
              className="btn-secondary flex-1"
              disabled={saving}
            >
              Batal
            </button>
            <button
              onClick={handleSave}
              className="btn-primary flex-1"
              disabled={saving}
            >
              {saving ? 'Menyimpan...' : editingContact ? 'Simpan' : 'Tambah'}
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
