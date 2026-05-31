'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useReportData } from './useReportData';
import { calculateStatementOfChangesInEquity } from '@/lib/calculations';
import * as accountsApi from '@/lib/api/accounts';
import * as contactsApi from '@/lib/api/contacts';
import type { Account, Contact, SCEData } from '@/types';

export interface UseSCEReturn extends ReturnType<typeof useReportData> {
  sce: SCEData;
  handleExportPDF: () => Promise<void>;
  handleExportExcel: () => Promise<void>;
}

export function useStatementOfChangesInEquity(): UseSCEReturn {
  const base = useReportData();
  const { activeBusiness, transactions, startDate, endDate, setShowExportMenu } = base;

  // Fetch accounts (untuk profit_share_pct, owner_stock_account_id) + contacts (nama pemilik)
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  useEffect(() => {
    if (!activeBusiness) return;
    accountsApi
      .getAccounts(activeBusiness.id, false)
      .then(setAccounts)
      .catch((err) => console.error('[useSCE] Failed to load accounts:', err));
    contactsApi
      .getContacts(activeBusiness.id)
      .then(setContacts)
      .catch((err) => console.error('[useSCE] Failed to load contacts:', err));
  }, [activeBusiness]);

  // Hydrate contact relation pada akun (getAccounts pakai select('*'), tanpa join)
  const hydratedAccounts = useMemo(() => {
    if (contacts.length === 0) return accounts;
    const byId = new Map(contacts.map((c) => [c.id, c]));
    return accounts.map((a) =>
      a.contact_id ? { ...a, contact: byId.get(a.contact_id) } : a
    );
  }, [accounts, contacts]);

  const capital = activeBusiness?.capital_investment ?? 0;

  const sce = useMemo(
    () =>
      calculateStatementOfChangesInEquity(
        transactions,
        startDate,
        endDate,
        capital,
        hydratedAccounts
      ),
    [transactions, startDate, endDate, capital, hydratedAccounts]
  );

  const periodLabel = useMemo(() => {
    if (!startDate || !endDate) return '';
    const fmt = (d: string) =>
      new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    return `${fmt(startDate)} – ${fmt(endDate)}`;
  }, [startDate, endDate]);

  const handleExportPDF = useCallback(async () => {
    if (!activeBusiness) return;
    const { exportSCEToPDF } = await import('@/lib/export');
    exportSCEToPDF(activeBusiness.business_name, periodLabel, sce);
    setShowExportMenu(false);
  }, [activeBusiness, periodLabel, sce, setShowExportMenu]);

  const handleExportExcel = useCallback(async () => {
    if (!activeBusiness) return;
    const { exportSCEToExcel } = await import('@/lib/export');
    exportSCEToExcel(activeBusiness.business_name, periodLabel, sce);
    setShowExportMenu(false);
  }, [activeBusiness, periodLabel, sce, setShowExportMenu]);

  return {
    ...base,
    sce,
    handleExportPDF,
    handleExportExcel,
  };
}
