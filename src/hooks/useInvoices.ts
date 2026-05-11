'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useBusinessContext } from '@/context/BusinessContext';
import * as invoicesApi from '@/lib/api/invoices';
import type { Invoice, InvoiceFormData, InvoicePaymentStatus, InvoiceSettings } from '@/types';

export function useInvoices() {
  const { user, activeBusiness, activeBusinessId: businessId, loading: businessLoading, error: businessError, userRole } = useBusinessContext();
  const canManageInvoices = userRole === 'business_manager' || userRole === 'both';

  // Invoice state
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Filter state
  const [statusFilter, setStatusFilter] = useState<'' | InvoicePaymentStatus>('');

  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editInvoice, setEditInvoice] = useState<Invoice | null>(null);
  const [deleteInvoiceTarget, setDeleteInvoiceTarget] = useState<Invoice | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Invoice settings & next number
  const [invoiceSettings, setInvoiceSettings] = useState<InvoiceSettings | null>(null);
  const [nextInvoiceNumber, setNextInvoiceNumber] = useState('');

  // Filtered invoices
  const filteredInvoices = useMemo(
    () => statusFilter ? invoices.filter(inv => inv.payment_status === statusFilter) : invoices,
    [invoices, statusFilter]
  );

  // Status counts for badges
  const statusCounts = useMemo(() => {
    const counts = { draft: 0, unpaid: 0, paid: 0, overdue: 0 };
    invoices.forEach(inv => {
      if (inv.payment_status in counts) {
        counts[inv.payment_status as keyof typeof counts]++;
      }
    });
    return counts;
  }, [invoices]);

  // Fetch invoices
  const fetchInvoices = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await invoicesApi.getInvoices(businessId);
      setInvoices(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal memuat invoice';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  // Fetch settings & next number
  const fetchSettings = useCallback(async () => {
    if (!businessId) return;
    try {
      const settings = await invoicesApi.getInvoiceSettings(businessId);
      setInvoiceSettings(settings);
      const prefix = settings?.prefix || 'INV';
      const nextNum = await invoicesApi.getNextInvoiceNumber(businessId, prefix);
      setNextInvoiceNumber(nextNum);
    } catch (err) {
      console.error('Failed to fetch invoice settings:', err);
    }
  }, [businessId]);

  useEffect(() => {
    if (businessId) {
      fetchInvoices();
      fetchSettings();
    }
  }, [businessId, fetchInvoices, fetchSettings]);

  // Create invoice
  const handleCreateInvoice = useCallback(async (data: InvoiceFormData) => {
    if (!businessId || !user) return;
    setSaving(true);
    try {
      await invoicesApi.createInvoice(businessId, user.id, data);
      setShowAddModal(false);
      fetchInvoices();
      fetchSettings();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal membuat invoice';
      alert(message);
    } finally {
      setSaving(false);
    }
  }, [businessId, user, fetchInvoices, fetchSettings]);

  // Update invoice
  const handleUpdateInvoice = useCallback(async (data: InvoiceFormData) => {
    if (!editInvoice || !user) return;
    setSaving(true);
    try {
      await invoicesApi.updateInvoice(editInvoice.id, user.id, data);
      setEditInvoice(null);
      fetchInvoices();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal mengupdate invoice';
      alert(message);
    } finally {
      setSaving(false);
    }
  }, [editInvoice, user, fetchInvoices]);

  // Delete invoice
  const handleDeleteInvoice = useCallback(async () => {
    if (!deleteInvoiceTarget || !user) return;
    setSaving(true);
    try {
      await invoicesApi.deleteInvoice(deleteInvoiceTarget.id, user.id);
      setDeleteInvoiceTarget(null);
      fetchInvoices();
      fetchSettings();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal menghapus invoice';
      alert(message);
    } finally {
      setSaving(false);
    }
  }, [deleteInvoiceTarget, user, fetchInvoices, fetchSettings]);

  // Download PDF
  const handleDownloadPDF = useCallback(async (invoice: Invoice) => {
    const { exportInvoiceToPDF } = await import('@/lib/invoicePDF');
    exportInvoiceToPDF({
      invoice,
      business: {
        business_name: activeBusiness?.business_name || '',
        property_address: activeBusiness?.property_address,
        business_type: activeBusiness?.business_type,
        logo_url: activeBusiness?.logo_url,
      },
      paymentDetails: invoiceSettings ? {
        bank_name: invoiceSettings.bank_name,
        bank_account_number: invoiceSettings.bank_account_number,
        bank_account_holder: invoiceSettings.bank_account_holder,
        contact_number: invoiceSettings.contact_number,
      } : null,
      issuerName: user?.user_metadata?.full_name || user?.email || '',
    });
  }, [activeBusiness, invoiceSettings, user]);

  // Mark as paid
  const handleMarkAsPaid = useCallback(async (invoiceId: string) => {
    setSaving(true);
    try {
      await invoicesApi.updateInvoiceStatus(invoiceId, 'paid');
      fetchInvoices();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal mengupdate status';
      alert(message);
    } finally {
      setSaving(false);
    }
  }, [fetchInvoices]);

  // Mark as unpaid (send)
  const handleMarkAsUnpaid = useCallback(async (invoiceId: string) => {
    setSaving(true);
    try {
      await invoicesApi.updateInvoiceStatus(invoiceId, 'unpaid');
      fetchInvoices();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal mengupdate status';
      alert(message);
    } finally {
      setSaving(false);
    }
  }, [fetchInvoices]);

  // Save settings
  const handleSaveSettings = useCallback(async (settings: InvoiceSettings) => {
    if (!businessId) return;
    try {
      await invoicesApi.updateInvoiceSettings(businessId, settings);
      setInvoiceSettings(settings);
      setShowSettingsModal(false);
      const nextNum = await invoicesApi.getNextInvoiceNumber(businessId, settings.prefix);
      setNextInvoiceNumber(nextNum);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal menyimpan pengaturan';
      alert(message);
    }
  }, [businessId]);

  return {
    // Data
    invoices,
    filteredInvoices,
    loading,
    saving,
    error,
    statusCounts,
    // Business
    user,
    activeBusiness,
    businessLoading,
    businessError,
    canManageInvoices,
    // Modals
    showAddModal, setShowAddModal,
    editInvoice, setEditInvoice,
    deleteInvoiceTarget, setDeleteInvoiceTarget,
    showSettingsModal, setShowSettingsModal,
    // Settings
    invoiceSettings,
    nextInvoiceNumber,
    // Filters
    statusFilter, setStatusFilter,
    // Actions
    handleCreateInvoice,
    handleUpdateInvoice,
    handleDeleteInvoice,
    handleDownloadPDF,
    handleMarkAsPaid,
    handleMarkAsUnpaid,
    handleSaveSettings,
    fetchInvoices,
  };
}
