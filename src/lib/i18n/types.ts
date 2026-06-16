export type Locale = 'id' | 'en';

export interface Translations {
  // Common
  common: {
    loading: string;
    save: string;
    saving: string;
    cancel: string;
    delete: string;
    deleting: string;
    edit: string;
    add: string;
    back: string;
    search: string;
    filter: string;
    all: string;
    active: string;
    inactive: string;
    confirm: string;
    close: string;
    previous: string;
    next: string;
    reset: string;
    export: string;
    exporting: string;
    exportPDF: string;
    exportExcel: string;
    retry: string;
    yes: string;
    no: string;
    or: string;
    from: string;
    to: string;
    total: string;
    date: string;
    amount: string;
    description: string;
    category: string;
    status: string;
    actions: string;
    name: string;
    code: string;
    type: string;
    notes: string;
    optional: string;
    perPage: string;
    noDataFound: string;
    businessNotFound: string;
    setupBusiness: string;
    selectBusinessFirst: string;
  };

  // Navigation & Layout
  nav: {
    dashboard: string;
    transactions: string;
    journalEntry: string;
    viewTransactions: string;
    manageBusiness: string;
    catalog: string;
    pointOfSales: string;
    calendar: string;
    accounting: string;
    chartOfAccounts: string;
    invoice: string;
    generalLedger: string;
    trialBalance: string;
    arAp: string;
    bankReconciliation: string;
    closingEntry: string;
    financialReports: string;
    profitLoss: string;
    balanceSheet: string;
    cashFlow: string;
    changesInEquity: string;
    analytics: string;
    scenarioModeling: string;
    budgetForecast: string;
    marketTracker: string;
    settings: string;
    logout: string;
    quickEntry: string;
    searchPlaceholder: string;
    notFound: string;
    pages: string;
    data: string;
    createNewBusiness: string;
    joinBusiness: string;
    selectBusiness: string;
    expandSidebar: string;
    collapseSidebar: string;
    searchingTransactions: string;
    searchingData: string;
  };

  // Roles
  roles: {
    businessManager: string;
    investor: string;
    superAdmin: string;
    creator: string;
  };

  // Settings Page
  settings: {
    title: string;
    subtitle: string;
    profileInfo: string;
    profilePhoto: string;
    clickToChange: string;
    uploading: string;
    fullName: string;
    fullNamePlaceholder: string;
    email: string;
    emailReadonly: string;
    role: string;
    superadminRoleHint: string;
    roleReadonly: string;
    saveChanges: string;
    photoUploaded: string;
    photoUploadFailed: string;
    profileUpdated: string;
    profileUpdateFailed: string;
    language: string;
    languageHint: string;
    // Telegram Bot card
    telegramTitle: string;
    telegramSubtitle: string;
    telegramLoadingStatus: string;
    telegramConnectedAs: string;
    telegramConnected: string;
    telegramSince: string;
    telegramHowToTitle: string;
    telegramHowToEarn: string;
    telegramHowToExpense: string;
    telegramHowToBalance: string;
    telegramDefaultStatusTitle: string;
    telegramDefaultStatusDesc: string;
    telegramStatusDraft: string;
    telegramStatusPosted: string;
    telegramDisconnect: string;
    telegramTokenValid: string;
    telegramOpenHint: string;
    telegramOpen: string;
    telegramCopyLink: string;
    telegramCopied: string;
    telegramRefreshToken: string;
    telegramConnectHint: string;
    telegramConnect: string;
    telegramInvestorOnly: string;
    // Sidebar visibility card
    sidebarMenuTitle: string;
    sidebarMenuDesc: string;
  };

  // Dashboard Page
  dashboard: {
    yearly: string;
    months: string[];
    revenue: string;
    profitLoss: string;
    roi: string;
    cashBalance: string;
    cashAndBank: string;
    yearToDate: string;
    allTime: string;
    remainingCapitalRoi: string;
    roiPeriodSince: string;
    roiPeriodMonths: string;
    transactionsIn: string;
    ofRevenueUsed: string;
    margin: string;
    vsMonth: string;
    noComparisonData: string;
    financialSummary: string;
    earnings: string;
    opex: string;
    variable: string;
    capex: string;
    taxes: string;
    financing: string;
    records: string;
    financialResults: string;
    recentTransactions: string;
    viewAll: string;
    noTransactions: string;
    noTransactionsDesc: string;
    noTransactionsForBusiness: string;
    addFirstTransaction: string;
    arTrackerTitle: string;
    arTrackerSubtitle: string;
    arTrackerOutstandingLabel: string;
    arTrackerFrom: string;
    arTrackerContactsLabel: string;
    arTrackerEmpty: string;
    arTrackerEmptyDesc: string;
    arTotalOutstanding: string;
    arTopDebtors: string;
  };

  // Transactions
  transactions: {
    manageTransactions: string;
    importExcel: string;
    journalEntry: string;
    allTab: string;
    draft: string;
    posted: string;
    recurring: string;
    selected: string;
    posting: string;
    summary: string;
    cashIn: string;
    cashOut: string;
    difference: string;
    addTransaction: string;
    editTransaction: string;
    createCOGSEntry: string;
    moneyIn: string;
    moneyOut: string;
    fullForm: string;
    noTransactions: string;
    noTransactionsHint: string;
    noTransactionsFiltered: string;
    noTransactionsFilteredHint: string;
    loadingTransactions: string;
    subject: string;
    cashFlowDir: string;
    inToAccount: string;
    outFromAccount: string;
    multiLineJournal: string;
    journalMultiLine: string;
    periodLockedUntil: string;
    // Category labels
    categoryEarn: string;
    categoryOpex: string;
    categoryVar: string;
    categoryCapex: string;
    categoryTax: string;
    categoryFin: string;
    tableNo: string;
    tableCategory: string;
    tableSubject: string;
    tableDescription: string;
    tableDate: string;
    tableAmount: string;
    tableCashFlow: string;
    tableAction: string;
  };

  // Quick Transaction Form
  quickForm: {
    amount: string;
    category: string;
    date: string;
    customer: string;
    vendor: string;
    customerOrVendor: string;
    addNotes: string;
    notesOptional: string;
    searchAccount: string;
    selectCategory: string;
    customerPlaceholder: string;
    vendorPlaceholder: string;
    briefDescription: string;
    amountMustBePositive: string;
    categoryRequired: string;
    dateRequired: string;
    failedConvertStock: string;
  };

  // Accounts Page
  accounts: {
    title: string;
    subtitle: string;
    addAccount: string;
    searchPlaceholder: string;
    showInactive: string;
    noSubAccounts: string;
    addSubAccountIn: string;
    subAccounts: string;
    editAccount: string;
    deactivate: string;
    activate: string;
    systemAccountHint: string;
    createFailed: string;
    updateFailed: string;
    deactivateFailed: string;
    activateFailed: string;
  };

  // Catalog Page
  catalog: {
    title: string;
    subtitle: string;
    addItem: string;
    addFirstItem: string;
    searchPlaceholder: string;
    showInactive: string;
    loading: string;
    emptyAll: string;
    emptyFiltered: string;
    inactiveBadge: string;
    edit: string;
    delete: string;
    formAddTitle: string;
    formEditTitle: string;
    typeLabel: string;
    typeProduct: string;
    typeService: string;
    nameLabelProduct: string;
    nameLabelService: string;
    namePlaceholderProduct: string;
    namePlaceholderService: string;
    priceLabel: string;
    unitLabel: string;
    unitPlaceholder: string;
    revenueAccountLabel: string;
    revenueAccountPlaceholder: string;
    revenueAccountHint: string;
    descriptionLabel: string;
    descriptionPlaceholder: string;
    activeLabel: string;
    cancel: string;
    save: string;
    saving: string;
    create: string;
    errorNameRequired: string;
    errorNameTaken: string;
    errorPriceNegative: string;
    deleteTitle: string;
    deleteBody: string;
    deleting: string;
    toastCreated: string;
    toastUpdated: string;
    toastDeleted: string;
    toastLoadFailed: string;
    toastSaveFailed: string;
    toastDeleteFailed: string;
    pickerTitle: string;
    pickerSearchPlaceholder: string;
    pickerLoading: string;
    pickerEmpty: string;
    pickerCreateLink: string;
    pickerNoMatch: string;
    pickerSelectedItems: string;
    pickerTotal: string;
    pickerApply: string;
    quickPickerLabel: string;
    addFromCatalog: string;
  };

  // Hub (Point of Sales / Calendar) — wadah Katalog + Info AI + panel operasional
  hub: {
    posTitle: string;
    posSubtitle: string;
    calendarTitle: string;
    calendarSubtitle: string;
    tabCatalog: string;
    tabAiInfo: string;
    tabKasir: string;
    tabKalender: string;
    kasirComingSoon: string;
    kasirComingSoonDesc: string;
    kalenderComingSoon: string;
    kalenderComingSoonDesc: string;
    aiInfoTitle: string;
    aiInfoDesc: string;
    aiInfoPlaceholder: string;
    aiInfoReadonly: string;
    aiInfoNotesLabel: string;
    editFields: string;
    fieldsModalTitle: string;
    fieldHours: string;
    fieldHoursPlaceholder: string;
    fieldLocation: string;
    fieldLocationPlaceholder: string;
    fieldPolicies: string;
    fieldPoliciesPlaceholder: string;
    fieldFaq: string;
    fieldFaqPlaceholder: string;
    fieldsCancel: string;
    fieldsApply: string;
    save: string;
    saving: string;
    saved: string;
    saveFailed: string;
    loadFailed: string;
  };

  // Businesses Page
  businesses: {
    portfolio: string;
    manageBusiness: string;
    addBusiness: string;
    activeBusiness: string;
    archivedBusiness: string;
    noActiveBusiness: string;
    noArchivedBusiness: string;
    noBusinessJoined: string;
    startByAdding: string;
    archivedAppearHere: string;
    addNewBusiness: string;
    editBusiness: string;
    archiveBusiness: string;
    archiveConfirm: string;
    archiveHint: string;
    archive: string;
    archiving: string;
    hardDeleteBusiness: string;
    hardDeleteConfirm: string;
    hardDeleteHint: string;
    hardDelete: string;
    hardDeleting: string;
    periodLock: string;
    loadingBusinesses: string;
  };

  // Business Form
  businessForm: {
    logo: string;
    businessName: string;
    businessType: string;
    sector: string;
    address: string;
    capitalInvestment: string;
    namePlaceholder: string;
    sectorPlaceholder: string;
    addressPlaceholder: string;
    capitalPlaceholder: string;
    clickToUploadLogo: string;
    logoFormats: string;
    imageOnly: string;
    maxFileSize: string;
    logoUploadFailed: string;
    nameRequired: string;
    sectorRequired: string;
    updateBusiness: string;
    addBusiness: string;
    capitalHint: string;
    sectorCustom: string;
    categoryJasa: string;
    categoryProduk: string;
    categoryDagang: string;
  };

  // Income Statement
  incomeStatement: {
    title: string;
    reportTitle: string;
    grossProfit: string;
    operatingIncome: string;
    interestExpense: string;
    earningsBeforeTax: string;
    netIncome: string;
    grossMargin: string;
    operatingMargin: string;
    netMargin: string;
  };

  // Balance Sheet
  balanceSheetPage: {
    title: string;
    reportTitle: string;
    assets: string;
    currentAssets: string;
    cashAndBank: string;
    inventory: string;
    accountsReceivable: string;
    otherCurrentAssets: string;
    totalCurrentAssets: string;
    fixedAssets: string;
    acquisitionValue: string;
    accumulatedDepreciation: string;
    netFixedAssets: string;
    totalAssets: string;
    liabilitiesAndEquity: string;
    liabilities: string;
    loans: string;
    totalLiabilities: string;
    debtRatio: string;
    debtRatioFormula: string;
    equity: string;
    paidInCapital: string;
    dividends: string;
    retainedEarnings: string;
    totalEquity: string;
    totalLiabilitiesEquity: string;
    balanced: string;
    notBalanced: string;
    asOf: string;
  };

  // Statement of Changes in Equity
  changesInEquityPage: {
    title: string;
    reportTitle: string;
    noActiveBusiness: string;
    selectBusinessFirst: string;
    statusTieOut: string;
    reconciledWithBalanceSheet: string;
    notReconciledWithBalanceSheet: string;
    endingEquityBalance: string;
    detailsTitle: string;
    component: string;
    openingBalance: string;
    additions: string;
    deductions: string;
    closingBalance: string;
    capitalBadgeLabel: string;
    capitalShareTitle: string;
    retainedEarnings: string;
    totalEquity: string;
    dividendReconciliation: string;
    dividendReconciliationDesc: string;
    owner: string;
    entitlementPct: string;
    dividendEntitlement: string;
    actual: string;
    difference: string;
    noOwnerCapitalAccounts: string;
    varianceNote: string;
    settledBadge: string;
    declaredBadge: string;
  };

  // Cash Flow
  cashFlowPage: {
    title: string;
    reportTitle: string;
    summary: string;
    beginningBalance: string;
    operating: string;
    investing: string;
    financingLabel: string;
    endingCash: string;
    operatingActivities: string;
    netCashOperations: string;
    investingActivities: string;
    capitalExpenditure: string;
    financingActivities: string;
    financeInterestLoans: string;
    totalOperating: string;
    totalInvesting: string;
    totalFinancing: string;
    netCashFlow: string;
    operatingInvestingFinancing: string;
    closingBalance: string;
    openingPlusNet: string;
    transactionsCount: string;
    noTransactions: string;
    openingBalanceTooltipTitle: string;
    openingBalanceTooltipDesc: string;
    transactionsCalculated: string;
    capitalInjection: string;
    ownerWithdrawal: string;
  };

  // General Ledger
  generalLedger: {
    title: string;
    subtitle: string;
    allTime: string;
    thisMonth: string;
    thisQuarter: string;
    thisYear: string;
    custom: string;
    allTypes: string;
    asset: string;
    liability: string;
    equityLabel: string;
    revenueLabel: string;
    expense: string;
    noAccountsFound: string;
    selectAccountHint: string;
    counterAccount: string;
    debit: string;
    credit: string;
    balance: string;
    totalDebit: string;
    totalCredit: string;
    closingBalance: string;
    openingBalance: string;
    entries: string;
    legacyNotice: string;
  };

  // Trial Balance
  trialBalance: {
    title: string;
    reportTitle: string;
    accountName: string;
    noTransactions: string;
    balanced: string;
    notBalanced: string;
    totalDebitEquals: string;
    differenceAmount: string;
  };

  // Scenario Modeling
  scenario: {
    title: string;
    subtitle: string;
    baselinePeriod: string;
    comparisonTab: string;
    customTab: string;
    baseline: string;
    optimistic: string;
    pessimistic: string;
    customScenario: string;
    revenueGrowth: string;
    cogsGrowth: string;
    opexGrowth: string;
    taxRate: string;
    interestGrowth: string;
    revenue: string;
    cogs: string;
    grossProfit: string;
    opexLabel: string;
    depreciation: string;
    operatingIncome: string;
    interest: string;
    tax: string;
    netIncome: string;
    grossMargin: string;
    operatingMargin: string;
    netMargin: string;
    assumptionsOptimistic: string;
    assumptionsPessimistic: string;
    customAssumptions: string;
    financialProjection: string;
    months3: string;
    months6: string;
    months12: string;
    projectionDesc: string;
    projectionSummary: string;
    totalRevenueProjection: string;
    cumulativeNetIncome: string;
    avgMonthlyRevenue: string;
    avgMonthlyNetIncome: string;
    comparisonTable: string;
    metric: string;
  };

  // Invoices
  invoices: {
    title: string;
    settings: string;
    createInvoice: string;
    createFromTransaction: string;
    editInvoice: string;
    deleteInvoice: string;
    deleteConfirm: string;
    deleteHint: string;
    allTab: string;
    draftTab: string;
    unpaid: string;
    paid: string;
    overdue: string;
  };

  // AR/AP
  arAp: {
    title: string;
    subtitle: string;
    receivables: string;
    payables: string;
    netPosition: string;
    overdueLabel: string;
    contacts: string;
    moreReceived: string;
    morePaid: string;
    contactName: string;
    current: string;
    days1to30: string;
    days31to60: string;
    days61to90: string;
    daysOver90: string;
    customerType: string;
    vendorType: string;
    otherType: string;
    arTab: string;
    apTab: string;
    paymentHistory: string;
    noOutstanding: string;
    allSettled: string;
    noPaymentHistory: string;
    paymentHistoryHint: string;
    totalPaid: string;
    payDebt: string;
    receivePayment: string;
    settlementBadge: string;
  };

  // Reconciliation
  reconciliation: {
    title: string;
    subtitle: string;
    bookBalance: string;
    bankBalance: string;
    difference: string;
    cashBankTransactions: string;
    fromBankStatement: string;
    enterBankBalance: string;
    enterBankBalancePlaceholder: string;
    balanceMatched: string;
    bankMinusBook: string;
    unreconciled: string;
    reconciled: string;
    reconcileButton: string;
    selectAll: string;
    deselectAll: string;
    noReconciled: string;
    allReconciled: string;
    cancelReconciliation: string;
    loadingData: string;
    importMutasi: string;
    importMutasiTitle: string;
    importMutasiDesc: string;
    importMutasiBankAccount: string;
    importMutasiBank: string;
    importMutasiFile: string;
    importMutasiDropFile: string;
    importMutasiParseButton: string;
    importMutasiParsing: string;
    importMutasiPreviewTitle: string;
    importMutasiPreviewRows: string;
    importMutasiSummary: string;
    importMutasiOpeningBalance: string;
    importMutasiClosingBalance: string;
    importMutasiTotalCredit: string;
    importMutasiTotalDebit: string;
    importMutasiWarnings: string;
    importMutasiBackButton: string;
    importMutasiCommitButton: string;
    importMutasiCommitting: string;
    importMutasiCommitSuccess: string;
    importMutasiInsertedRows: string;
    importMutasiSkippedDuplicates: string;
    importMutasiErrorNoAccount: string;
    importMutasiErrorNoFile: string;
    modeMatch: string;
    modeBalance: string;
    sideBySideBankLines: string;
    sideBySideLedgerLines: string;
    sideBySideEmpty: string;
    sideBySideEmptyHint: string;
    sideBySidePickBank: string;
    sideBySidePickedBank: string;
    sideBySidePickLedger: string;
    sideBySideReadyMatch: string;
    sideBySideMatchButton: string;
    sideBySideMatchedSection: string;
    sideBySideUnmatchedCount: string;
    sideBySideUnreconciledCount: string;
  };

  // Closing Entry
  closingEntry: {
    title: string;
    subtitle: string;
    period: string;
    startDate: string;
    endDate: string;
    preview: string;
    calculating: string;
    success: string;
    successDesc: string;
    retainedEarningsNotFound: string;
    retainedEarningsHint: string;
    retainedEarningsGoToCoa: string;
    totalRevenue: string;
    totalExpense: string;
    netIncomeToRetained: string;
    accountsCount: string;
    profitLabel: string;
    lossLabel: string;
    periodLabel: string;
    revenueClosing: string;
    revenueClosingDesc: string;
    expenseClosing: string;
    expenseClosingDesc: string;
    accountName: string;
    accountCode: string;
    accountAmount: string;
    executeButton: string;
    processing: string;
    executeConfirm: string;
    noAccountsToClose: string;
    noAccountsToCloseDesc: string;
    selectPeriodHint: string;
    selectPeriodDesc: string;
    retainedEarningsAlert: string;
    executeFailed: string;
    loadingData: string;
  };

  // Budget & Forecast
  budget: {
    title: string;
    createBudget: string;
    noBudget: string;
    noBudgetDesc: string;
    createFirstBudget: string;
    overview: string;
    inputBudget: string;
    varianceAnalysis: string;
    projection: string;
    editBudget: string;
    deleteBudget: string;
    deleteConfirm: string;
    deleteHint: string;
    budgetVsActual: string;
    trendProjection: string;
    overBudget: string;
    underBudget: string;
    noOverBudget: string;
    totalProjection: string;
    totalBudgetTarget: string;
    avgPerMonth: string;
    projectionPeriod: string;
    variancePerAccount: string;
    financialTrendProjection: string;
  };

  // Invite Code Manager
  inviteCode: {
    title: string;
    generateNew: string;
    role: string;
    maxUses: string;
    validDays: string;
    generate: string;
    generating: string;
    activeCodes: string;
    noCodes: string;
    copyCode: string;
    expired: string;
    deactivated: string;
    createdAt: string;
    deactivateBtn: string;
    deleteBtn: string;
    deleteConfirm: string;
  };

  // Member List
  members: {
    noMembers: string;
    inviteMembers: string;
    joinedAt: string;
  };

  // AI Chat
  aiChat: {
    ask: string;
    entry: string;
    // Persona spesialis (nama TIDAK diterjemahkan; role/greeting/tagline diterjemahkan)
    persona: {
      analystRole: string;
      analystGreeting: string;
      analystTagline: string;
      taxRole: string;
      taxGreeting: string;
      taxTagline: string;
      bookkeeperRole: string;
      bookkeeperGreeting: string;
      bookkeeperTagline: string;
      // Deskripsi singkat di dropdown
      analystDesc: string;
      taxDesc: string;
    };
    // Halaman /agent (rumah orchestrator)
    agentPage: {
      capabilitiesChip: string;
      orchestratorTitle: string;
      orchestratorSubtitle: string;
      toolsSectionTitle: string;
      // Sub-agent: peran + deskripsi + akses (nama TIDAK diterjemahkan)
      analystRole: string;
      analystDesc: string;
      taxRole: string;
      taxDesc: string;
      bookkeeperRole: string;
      bookkeeperDesc: string;
      conciergeRole: string;
      conciergeDesc: string;
      accessAsk: string;
      accessEntry: string;
      accessLeads: string;
      // Label ramah tools (nama fungsi TIDAK diterjemahkan)
      toolQueryTransactions: string;
      toolFinancialSummary: string;
      toolContacts: string;
      toolBusinessInfo: string;
      toolNavigate: string;
    };
  };

  // Reports
  reports: {
    title: string;
    underConstruction: string;
    underConstructionDesc: string;
  };

  // Period filters (shared)
  period: {
    thisMonth: string;
    quarter: string;
    thisYear: string;
    custom: string;
    startDate: string;
    endDate: string;
    period: string;
    previousMonth: string;
    nextMonth: string;
    selectReportMonth: string;
    selectReportQuarter: string;
  };

  // Transaction Detail Modal
  transactionDetail: {
    title: string;
    doubleEntry: string;
    singleEntry: string;
    debitAccount: string;
    creditAccount: string;
    legacyAccount: string;
    // Badges & labels
    stock: string;
    draft: string;
    posted: string;
    // Name labels per category
    nameLabelCustomer: string;
    nameLabelVendor: string;
    nameLabelTaxAuthority: string;
    nameLabelRelatedParty: string;
    nameLabelDefault: string;
    // Fields
    keterangan: string;
    tanggal: string;
    debit: string;
    credit: string;
    chartOfAccount: string;
    incomingTo: string;
    outgoingFrom: string;
    // Unit breakdown
    pricePerUnit: string;
    quantity: string;
    // Journal lines
    journalLines: string;
    account: string;
    total: string;
    // Attachment / Sold stock
    attachment: string;
    soldInventory: string;
    // Receivable settlement
    paidInFull: string;
    paidInFullDesc: string;
    partiallyPaid: string;
    remaining: string;
    paymentHistory: string;
    partialPayment: string;
    finalSettlement: string;
    totalPaid: string;
    settleFull: string;
    settlePartial: string;
    settleShort: string;
    settlePartialShort: string;
    invoiceShort: string;
    confirmFullSettlement: string;
    processing: string;
    yesSettle: string;
    cancel: string;
    partialRemaining: string;
    partialAmountLabel: string;
    enterPaymentAmount: string;
    mustBeLessThan: string;
    failedRecordPayment: string;
    recordPayment: string;
    // Related transactions
    relatedInfo: string;
    settlementFrom: string;
    settledBy: string;
    // Metadata
    additionalInfo: string;
    txId: string;
    status: string;
    createdBy: string;
    createdAt: string;
    lastUpdated: string;
    updatedBy: string;
    loadingName: string;
    // Audit history
    changeHistory: string;
    loadingHistory: string;
    noHistory: string;
    opCreated: string;
    opUpdated: string;
    opDeleted: string;
    by: string;
    before: string;
    after: string;
    // Warning panel
    cogsAmountHint: string;
    createCogsEntry: string;
    closeAria: string;
    // Action buttons
    postBtn: string;
    editBtn: string;
    deleteBtn: string;
  };

  // Business Config Page (tabs)
  businessConfig: {
    tabMembers: string;
    tabContacts: string;
    tabOmnichannel: string;
    tabIntegrations: string;
    inviteMember: string;
  };

  // Channel Integration (Pesan & Sosial)
  channelIntegration: {
    sectionTitle: string;
    sectionDesc: string;
    otaSectionTitle: string;
    otaSectionDesc: string;
    connected: string;
    connect: string;
    disconnect: string;
    disconnectConfirmInstagram: string;
    disconnectConfirmWhatsApp: string;
    disconnectedInstagram: string;
    disconnectedWhatsApp: string;
    disconnectFailed: string;
    instagramConnected: string;
    instagramDesc: string;
    whatsAppDesc: string;
    howItWorksTitle: string;
    howItWorksStep1: string;
    howItWorksStep2: string;
    howItWorksStep3: string;
    aiReplyTitle: string;
    aiReplyDesc: string;
    replyMode: string;
    modeDraftLabel: string;
    modeAutoLabel: string;
    modeDraftDesc: string;
    modeAutoDesc: string;
    personaLabel: string;
    personaPlaceholder: string;
    saveSettings: string;
    savingSettings: string;
    settingsSaved: string;
    settingsFailed: string;
    updateToken: string;
    modalTitleConnect: string;
    modalTitleUpdate: string;
    modalDesc: string;
    phoneNumberIdLabel: string;
    accessTokenLabel: string;
    cancel: string;
    verify: string;
    verifying: string;
    update: string;
    connectFailed: string;
    tokenUpdated: string;
    waConnected: string;
    loadFailed: string;
    instagramConnectedToast: string;
    otaTitle: string;
    otaDesc: string;
    otaActivate: string;
    otaActivating: string;
    otaActive: string;
    otaActivatedToast: string;
    otaActivateFailed: string;
    otaDeactivateConfirm: string;
    otaDeactivated: string;
    otaDeactivateFailed: string;
    otaDeactivate: string;
    otaHowItWorksStep1: string;
    otaHowItWorksStep2: string;
    otaHowItWorksStep3: string;
    otaDocsLink: string;
    otaDraftOnlyNotice: string;
  };

  // E-Commerce Integration
  ecommerceIntegration: {
    sectionTitle: string;
    sectionDesc: string;
    connected: string;
    connect: string;
    disconnect: string;
    disconnectConfirm: string;
    disconnected: string;
    disconnectFailed: string;
    connectFailed: string;
    comingSoon: string;
    howItWorksTitle: string;
    howItWorksStep1Title: string;
    howItWorksStep1Desc: string;
    howItWorksStep2Title: string;
    howItWorksStep2Desc: string;
    howItWorksStep3Title: string;
    howItWorksStep3Desc: string;
    syncNow: string;
    syncing: string;
    lastSync: string;
    neverSynced: string;
    syncSuccess: string;
    syncAllSynced: string;
    syncNoNew: string;
    syncFailed: string;
    syncError: string;
    shopeeConnected: string;
    disconnectShopeeConfirm: string;
    disconnectShopeeSuccess: string;
    statusSuccess: string;
    statusPartial: string;
    statusFailed: string;
    statusRunning: string;
    justNow: string;
    minutesAgo: string;
    hoursAgo: string;
    daysAgo: string;
    syncHistoryTitle: string;
    syncColTime: string;
    syncColType: string;
    syncColOrders: string;
    syncColTransactions: string;
    syncColStatus: string;
    syncTypeManual: string;
    syncTypeAuto: string;
    syncTypeWebhook: string;
    totalSync: string;
    ordersCollected: string;
    transactionsCreated: string;
    viewAllTransactions: string;
    comingSoonDesc: string;
    valuePropTitle: string;
    valuePropDesc: string;
    shopeeDesc: string;
    tokopediaDesc: string;
    tiktokDesc: string;
  };
}
