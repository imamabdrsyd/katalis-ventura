'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useReportData } from './useReportData';
import { useLanguage } from '@/context/LanguageContext';
import { calculateStatementOfChangesInEquity } from '@/lib/calculations';
import * as accountsApi from '@/lib/api/accounts';
import * as contactsApi from '@/lib/api/contacts';
import type { Account, Contact, SCEData } from '@/types';

export interface UseSCEReturn extends ReturnType<typeof useReportData> {
  sce: SCEData;
  periodLabel: string;
  periodDisplayLabel: string;
  handleExportPDF: () => Promise<void>;
  handleExportExcel: () => Promise<void>;
}

export function useStatementOfChangesInEquity(): UseSCEReturn {
  const base = useReportData();
  const { activeBusiness, transactions, startDate, endDate, setShowExportMenu } = base;
  const { locale, t } = useLanguage();

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
    const fmt = (value: string) => {
      const [year, month, day] = value.split('-').map(Number);
      if (!year || !month || !day) return value;

      return new Date(year, month - 1, day).toLocaleDateString(
        locale === 'id' ? 'id-ID' : 'en-US',
        { day: 'numeric', month: 'long', year: 'numeric' }
      );
    };
    return `${fmt(startDate)} – ${fmt(endDate)}`;
  }, [endDate, locale, startDate]);

  const periodDisplayLabel = useMemo(() => {
    if (!startDate || !endDate) return '';

    const parseDate = (value: string) => {
      const [year, month, day] = value.split('-').map(Number);
      return { year, month, day };
    };
    const start = parseDate(startDate);
    const end = parseDate(endDate);
    if (!start.year || !start.month || !end.year || !end.month) return '';

    const monthName = ({ month }: { year: number; month: number }) =>
      t.dashboard.months[month - 1] ?? '';

    if (start.year === end.year && start.month === end.month) {
      return `${monthName(start)} ${start.year}`;
    }

    if (start.year === end.year) {
      return `${monthName(start)} - ${monthName(end)} ${start.year}`;
    }

    return `${monthName(start)} ${start.year} - ${monthName(end)} ${end.year}`;
  }, [endDate, startDate, t.dashboard.months]);

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
    periodLabel,
    periodDisplayLabel,
    handleExportPDF,
    handleExportExcel,
  };
}
