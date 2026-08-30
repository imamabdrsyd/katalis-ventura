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
    decrease: string;
    increase: string;
    export: string;
    exporting: string;
    exportPDF: string;
    exportExcel: string;
    exportSheets: string;
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
    unsavedTitle: string;
    unsavedMessage: string;
    keepEditing: string;
    discardChanges: string;
    noActiveBusiness: string;
    selectOrCreateBusiness: string;
    noTransactions: string;
  };

  // Label 6 kategori transaksi (+ SETTLE untuk pelunasan)
  categories: {
    EARN: string;
    OPEX: string;
    VAR: string;
    CAPEX: string;
    TAX: string;
    FIN: string;
    SETTLE: string;
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
    assetConsole: string;
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
    openMenu: string;
    closeMenu: string;
    language: string;
    leads: string;
    agenticWorkspace: string;
    searchingTransactions: string;
    searchingData: string;
    /** Pengumuman jumlah hasil untuk screen reader (aria-live). */
    searchResultsCount: (n: number) => string;
    /** Label grup hasil pencarian data (per sumber tabel). */
    searchSources: {
      business: string;
      transaction: string;
      account: string;
      contact: string;
      invoice: string;
      budget: string;
      recurring: string;
      template: string;
      import_batch: string;
      knowledge: string;
    };
  };

  // Nav hub pages (landing grid Akuntansi / Laporan Keuangan / Analitik)
  navHub: {
    accountingTitle: string;
    accountingSubtitle: string;
    financialReportsTitle: string;
    financialReportsSubtitle: string;
    analyticsTitle: string;
    analyticsSubtitle: string;
    desc: {
      chartOfAccounts: string;
      generalLedger: string;
      trialBalance: string;
      arAp: string;
      invoice: string;
      bankReconciliation: string;
      profitLoss: string;
      balanceSheet: string;
      cashFlow: string;
      changesInEquity: string;
      scenarioModeling: string;
      budgetForecast: string;
      marketTracker: string;
    };
  };

  // Roles
  auth: {
    loginTitle: string;
    loginSubtitle: string;
    emailLabel: string;
    passwordLabel: string;
    rememberMe: string;
    forgotPassword: string;
    signInButton: string;
    signingIn: string;
    continueWithGoogle: string;
    noAccountYet: string;
    createAccountLink: string;
    errGoogleSignIn: string;
    errSignIn: string;
    signupTitle: string;
    signupEnter: string;
    fullNameLabel: string;
    registerAsLabel: string;
    roleManagerDesc: string;
    roleInvestorDesc: string;
    createAccountButton: string;
    creatingAccount: string;
    signUpWithGoogle: string;
    haveAccount: string;
    signInLink: string;
    errGoogleSignUp: string;
    errSignUp: string;
  };

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
    // Pemilih tema
    appearance: string;
    themeLight: string;
    themeDark: string;
    themeMidnight: string;
    // Preferensi tampilan — FAB AI Chat
    aiFabTitle: string;
    aiFabSubtitle: string;
    aiFabLabel: string;
    aiFabHint: string;
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
    // Google Sheets card
    googleSheetsTitle: string;
    googleSheetsSubtitle: string;
    googleSheetsLoadingStatus: string;
    googleSheetsConnected: string;
    googleSheetsConnectedAs: string;
    googleSheetsSince: string;
    googleSheetsPlaygroundNote: string;
    googleSheetsConnect: string;
    googleSheetsConnectHint: string;
    googleSheetsDisconnect: string;
    googleSheetsDisconnectTitle: string;
    googleSheetsDisconnectConfirm: string;
    googleSheetsDisconnecting: string;
    googleSheetsReconnect: string;
    googleSheetsRevokedHint: string;
    googleSheetsInvestorOnly: string;
    googleSheetsScopeNote: string;
    // Telegram — toast & konfirmasi
    telegramTokenFailed: string;
    telegramDisconnectConfirm: string;
    telegramDisconnectFailed: string;
    telegramPrefsSaved: string;
    telegramPrefsFailed: string;
    // Integrasi Database (GCP)
    gcpTitle: string;
    gcpSubtitle: string;
    gcpInitConfirm: string;
    gcpInitButton: string;
    gcpInitProcessing: string;
    gcpInitHint: string;
    gcpInitSuccess: string;
    gcpInitFailed: string;
  };

  // Dashboard Page
  dashboard: {
    unnamed: string;
    viewTransactionDetail: string;
    remainingCapitalRoiTooltip: string;
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
    arTotalOutstanding: string;
    arTopDebtors: string;
  };

  // Transactions
  transactions: {
    transactionListTitle: string;
    createInvoiceFromSelected: string;
    createInvoice: string;
    exportToPdf: string;
    multiItemJournal: string;
    updateJournal: string;
    pdfSelectedCount: string;   // "{n} transaksi terpilih akan diekspor ke PDF."
    pdfTitleLabel: string;
    pdfSubtitleLabel: string;
    pdfSubtitlePlaceholder: string;
    pdfProcessing: string;
    pdfExportButton: string;
    unknownAccount: string;
    hasAttachment: string;
    columnResizeHint: string;
    selectRow: string;
    alreadyInvoiced: string;
    selectMany: string;
    viewDetail: string;
    manageTransactions: string;
    importExcel: string;
    journalEntry: string;
    allTab: string;
    draft: string;
    posted: string;
    unsettled: string;
    recurring: string;
    selected: string;
    posting: string;
    summary: string;
    cashIn: string;
    cashOut: string;
    difference: string;
    addTransaction: string;
    editTransaction: string;
    duplicateTransaction: string;
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
    filterStock: string;
    tableSubject: string;
    tableDescription: string;
    tableDate: string;
    tableAmount: string;
    tableCashFlow: string;
    tableAction: string;
  };

  // Quick Transaction Form
  transactionForm: {
    ocrHint: string;
    ocrScanLabel: string;
    useTemplate: string;
    deleteTemplate: string;
    saveAsTemplate: string;
    templateNamePlaceholder: string;
    salesChannelLabel: string;
    nameCustomer: string;
    nameVendor: string;
    nameGeneric: string;
    namePlaceholderCustomer: string;
    namePlaceholderVendor: string;
    namePlaceholderGeneric: string;
    descriptionLabel: string;
    descriptionPlaceholder: string;
    descriptionPlaceholderAuto: string;
    inflowTo: string;
    selectDestinationAccount: string;
    sourceFrom: string;
    selectRevenueSource: string;
    payFrom: string;
    selectSourceAccount: string;
    expenseFor: string;
    selectExpenseType: string;
    accountSectionTitle: string;
    accountSectionHint: string;
    debitLabel: string;
    creditLabel: string;
    selectDebitAccount: string;
    selectCreditAccount: string;
    linkToCatalog: string;
    removeCatalogItem: string;
    accountLabel: string;
    accountPlaceholder: string;
    makeRecurring: string;
    frequency: string;
    weekly: string;
    monthly: string;
    yearly: string;
    every: string;
    unitWeek: string;
    unitMonth: string;
    unitYear: string;
    until: string;
    noEndDate: string;
    uploadingAttachments: string;
    updateTransaction: string;
    errDateRequired: string;
    errNameRequired: string;
    errDescriptionRequired: string;
    errAmountPositive: string;
    errFxRatePositive: string;
    errDebitRequired: string;
    errCreditRequired: string;
    errDebitCreditSame: string;
    errAccountRequired: string;
    errUploadAttachment: string;
  };

  importModal: {
    title: string;
    tabSmart: string;
    tabFull: string;
    tabChannel: string;
    tabExport: string;
    exportTitle: string;
    exportHint: string;
    exportPeriod: string;
    exportPeriodAll: string;
    exportPeriodRange: string;
    exportDateFrom: string;
    exportDateTo: string;
    exportRangeInverted: string;
    exportStatus: string;
    exportStatusAll: string;
    exportStatusPosted: string;
    exportStatusDraft: string;
    exportCounting: string;
    exportCount: string;        // "{n} transaksi akan diekspor"
    exportCountUnknown: string;
    exportEmpty: string;
    exportExcel: string;
    exportCsv: string;
    exportCsvNote: string;
    templateSmartTitle: string;
    templateFullTitle: string;
    templateSmartHint: string;
    templateFullHint: string;
    downloadTemplate: string;
    dropzone: string;
    dropzoneFormat: string;
    errorHeading: string;
    confidenceHigh: string;
    confidenceMedium: string;
    confidenceLow: string;
    edited: string;
    aiAssistedCategory: string;
    statTotalRows: string;
    statAutoDetected: string;
    statNeedsReview: string;
    filterAll: (n: number) => string;
    filterReview: (n: number) => string;
    invalidRowsSkipped: (n: number) => string;
    colCategory: string;
    colDebit: string;
    colCredit: string;
    colDate: string;
    colName: string;
    colDescription: string;
    colAmount: string;
    colAccount: string;
    noRowsToReview: string;
    statValidRows: string;
    statErrors: string;
    rowsHaveErrors: (n: number) => string;
    downloadErrors: string;
    previewFirstRows: string;
    smartFooter: (n: number) => string;
    importing: string;
    importButton: (n: number) => string;
    msgChooseFile: string;
    msgValidating: string;
    msgInvalidFile: string;
    msgReadingFile: string;
    msgNoData: string;
    msgParseFailed: string;
    msgImporting: string;
    msgImportFailed: string;
  };

  quickForm: {
    fxRateMustBePositive: string;
    accountRequired: string;
    dividendModeRequired: string;
    uploadAttachmentFailed: string;
    draftFallbackName: string;
    amountLabel: string;
    searchAccountPlaceholder: string;
    noMatchingAccounts: string;
    declareDividend: string;
    change: string;
    selectedLabel: string;
    removeCatalogItem: string;
    dateLabel: string;
    relatedParty: string;
    searchContact: string;
    tablistAria: string;
    addNote: string;
    attach: string;
    noteAria: string;
    uploadingAttachments: string;
    savingLabel: string;
    saveTransaction: string;
    saveDraftTooltip: string;
    saveDraft: string;
    accountTypeLabels: Record<'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE', string>;
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
    badgeShare: string;
    badgeFixedAsset: string;
    systemAccountTooltip: string;
    inactiveBadge: string;
    editAccountMenu: string;
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
  accountForm: {
    titleEdit: string;
    titleCreate: string;
    editWarnSystem: string;
    editWarnNormal: string;
    parentLabel: string;
    errParentRequired: string;
    guideTitle: string;
    guideCurrentAssets: string;
    guideCurrentAssetsNote: string;
    guideInventory: string;
    guideReceivable: string;
    guidePrepaid: string;
    guideFixedAssets: string;
    guideFixedAssetsNote: string;
    guideFixedAssetsItems: string;
    guideAutoDetect: string;
    codeLabel: string;
    codeGenerating: string;
    codeAutoHint: string;
    codeValid: string;
    codeTakenLive: string;
    codeFormat: string;
    typeLabel: string;
    typeFromParent: string;
    nameLabel: string;
    namePlaceholder: string;
    descriptionLabel: string;
    descriptionPlaceholder: string;
    defaultCategoryLabel: string;
    defaultCategorySystemTooltip: string;
    defaultCategoryAuto: string;
    defaultCategoryHint: string;
    optEarn: string;
    optOpex: string;
    optVar: string;
    optCapex: string;
    optTax: string;
    optFin: string;
    depreciationTitle: string;
    depreciationBadge: string;
    depreciationHint: string;
    acquisitionDate: string;
    usefulLifeMonths: string;
    usefulLifePlaceholder: string;
    residualValue: string;
    flagStockTitle: string;
    flagStockHint: string;
    profitSharePlaceholder: string;
    linkOwnerContact: string;
    flagCashTitle: string;
    flagCashHint: string;
    flagSystemLocked: string;
    flagReceivableTitle: string;
    flagReceivableHint: string;
    flagDividendTitle: string;
    flagDividendHint: string;
    dividendOwnerLabel: string;
    dividendOwnerEmpty: string;
    flagDividendPayableTitle: string;
    flagDividendPayableHint: string;
    dividendPayableMoveNote: string;
    flagPayableTitle: string;
    flagPayableHint: string;
    wordOperating: string;
    submitCreate: string;
    submitUpdate: string;
    errCodeGenerate: string;
    errCodeFormat: string;
    errNameRequired: string;
    errNameMin: string;
    errNameMax: string;
    errCodeMissing: string;
    errCodeTaken: string;
  };

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
    // Kategori layanan akomodasi (migr 124)
    serviceRoleLabel: string;
    serviceRoleMain: string;
    serviceRoleMainHint: string;
    serviceRoleAddon: string;
    serviceRoleAddonHint: string;
    rateKindLabel: string;
    rateKindWeekday: string;
    rateKindWeekend: string;
    rateKindMonthly: string;
    priceLabelPerNight: string;
    priceLabelPerMonth: string;
    revenueAccountLabel: string;
    revenueAccountHint: string;
    descriptionLabel: string;
    descriptionPlaceholder: string;
    activeLabel: string;
    cancel: string;
    save: string;
    saving: string;
    create: string;
    errorNameRequired: string;
    errorPriceNegative: string;
    optional: string;
    skuLabel: string;
    skuPlaceholder: string;
    errorSkuTaken: string;
    errorRateKindTaken: string;
    trackStockLabel: string;
    trackStockHint: string;
    stockQtyLabel: string;
    stockQtyHintEdit: string;
    costPriceLabel: string;
    costPriceHint: string;
    costPriceNoInventoryHint: string;
    marginLabel: string;
    marginNegative: string;
    // Asset Console (migr 125) — tandai item katalog sebagai instrumen investasi
    assetClassLabel: string;
    assetClassHint: string;
    assetClassNone: string;
    assetLotSizeLabel: string;
    assetLotSizeHint: string;
    assetCryptoUnitLabel: string;
    assetCryptoUnitHint: string;
    stockLabel: string;
    stockOut: string;
    addStockTitle: string;
    addStockCurrent: string;
    addStockQtyLabel: string;
    addStockSubmit: string;
    addStockSuccess: string;
    addStockFailed: string;
    stockLogTitle: string;
    stockLogEmpty: string;
    stockLogRefresh: string;
    stockLogSaleChip: string;
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
    pickerCreateNew: string;
    pickerCreating: string;
    pickerCreateFailed: string;
    quickPickerLabel: string;
    stockPickerLabel: string;
    addFromCatalog: string;
  };

  // Hub (Point of Sales / Calendar) — wadah Katalog + Info AI + panel operasional
  cashier: {
    launcherTitle: string;
    launcherDesc: string;
    launcherButton: string;
    launcherManagerOnly: string;
    errNoCatalogItems: string;
    errLoadFailed: string;
    screenTitle: string;
    exitCashier: string;
    searchPlaceholder: string;
    tabAll: string;
    unitService: string;
    unitProduct: string;
    noMatchingProducts: string;
    customerPlaceholder: string;
    decrease: string;
    increase: string;
    removeItem: string;
    emptyCart: string;
    subtotalItems: (n: number) => string;
    total: string;
    paymentMethod: string;
    methodCash: string;
    methodQris: string;
    clearCart: string;
    payButton: string;
    saleRecorded: string;
    saleFailed: string;
    contactSaveFailed: string;
    titleQris: string;
    titleCash: string;
    billTotal: string;
    qrisScanHint: string;
    qrisEmptyHint: string;
    qrisUploadButton: string;
    qrisSaved: string;
    qrisUploadFailed: string;
    cloudinaryUploadFailed: string;
    cashReceived: string;
    exactAmount: string;
    change: string;
    cashShort: string;
    confirmPay: string;
  };

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
    aiInfoTitle: string;
    imageTitlePlaceholder: string;
    cloudinaryUploadFailed: string;
    imageUploaded: string;
    imageUploadFailed: string;
    aiInfoDesc: string;
    aiInfoPlaceholder: string;
    aiInfoReadonly: string;
    aiInfoNotesLabel: string;
    editFields: string;
    collapsePanel: string;
    expandPanel: string;
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
    fieldImages: string;
    fieldImageTitle: string;
    fieldImageSelect: string;
    fieldImageUpload: string;
    fieldNoImageSelected: string;
    errorImageTitleRequired: string;
    errorMaxImages: string;
    // Services tab (calendar/accommodation hub — POS keeps "Catalog")
    tabServices: string;
    servicesSubtitle: string;
  };

  // Calendar / booking hub (accommodation) — VISIBLE PAGE ONLY (modals belum di-i18n)
  calendar: {
    // KPI strip
    kpiAdr: string;
    kpiAdrHint: string; // {n} malam terjual
    kpiOccupancy: string;
    kpiOccupancyHint: string; // {booked}/{available} malam
    kpiRevpar: string;
    kpiRevparHint: string;
    kpiBookings: string;
    kpiBookingsHintPer: string; // {amount} / booking
    kpiBookingsHintNone: string;
    kpiRoomRevenue: string;
    // Toolbar / board
    today: string;
    prevMonth: string;
    nextMonth: string;
    pickMonthYear: string;
    prevYear: string;
    nextYear: string;
    connectWebsite: string;
    connectWebsiteTitle: string;
    bookingPriceTitle: string;
    setPriceCellTitle: string;
    basePrice: string; // legend
    weekdays: string[]; // Mon..Sun
    monthsShort: string[]; // Jan..Dec (picker)
    // Booking bar states (legend + bar)
    stateConfirmed: string;
    statePaid: string;
    stateInquiry: string; // was Tentatif → Inquiry/Pertanyaan
    stateExternal: string;
    defaultBooking: string;
    // Unit toolbar
    manageUnit: string;
    needsFollowUp: string;
    needsFollowUpTitle: string;
    // Guards / states
    accessRestricted: string;
    accessRestrictedDesc: string;
    accommodationOnly: string;
    accommodationOnlyDesc: string;
    noUnits: string;
    noUnitsDesc: string;
    addFirstUnit: string;
    // Reconcile banner
    reconcileBanner: string; // {n}
    pullToCalendar: string;
    reconcileFailed: string;
    reconcileSuccess: string; // {n}
    reconcilePendingSuffix: string; // {n}
    loadFailed: string;
    // No rate source card
    noRateSource: string; // {unit}
    manageUnitCta: string;
    // ── Modals (BookingModal / HoldingPanel / UnitManagerModal / IcalSyncModal / RateEditorPanel) ──
    // BookingModal
    bmTitleDetail: string;
    bmTitleExternal: string;
    bmForUnit: string;
    bmVia: string;
    bmRecordedInBooks: string;
    bmExternalNote: string; // {channel}
    bmPaidNote: string;
    bmCheckIn: string;
    bmCheckOut: string;
    bmConflictTitle: string;
    bmGuest: string;
    bmGuestPlaceholder: string;
    bmGuestCount: string;
    bmPricePerNight: string;
    bmAvgAuto: string;
    bmChannel: string;
    bmAutoFromCalendar: string;
    bmNightsTimes: string; // {nights} {price}
    bmStatus: string;
    bmNotes: string;
    bmNotesPlaceholder: string;
    bmReceivePayment: string;
    bmReceivePaymentDesc: string;
    bmLedgerLinked: string;
    bmLedgerLinkedDesc: string;
    bmCash: string;
    bmQris: string;
    bmPaymentMethod: string;
    bmMarkPaid: string; // {total}
    bmCancelBooking: string;
    bmClose: string;
    bmSaveChanges: string;
    bmEdit: string;
    bmDefaultBooking: string;
    bmToastDatesInvalid: string;
    bmToastConflict: string;
    bmToastTotalPositive: string;
    bmToastUpdated: string;
    bmToastSaveFailed: string;
    bmToastStatusUpdated: string;
    bmToastStatusFailed: string;
    bmToastMarkedPaid: string;
    bmToastMarkPaidFailed: string;
    bmToastCancelled: string;
    bmToastCancelFailed: string;
    bmToastDeleted: string;
    bmToastDeleteFailed: string;
    bmDelete: string;
    // HoldingPanel
    hpTitle: string;
    hpIntro: string;
    hpSearchGuest: string;
    hpEmpty: string;
    hpNoMatch: string; // {query}
    hpGuest: string;
    hpSave: string;
    hpToastFillDates: string;
    hpToastCheckoutAfter: string;
    hpToastFilled: string;
    hpToastSaveFailed: string;
    // UnitManagerModal
    umTitle: string;
    umIntro: string;
    umNewPlaceholder: string;
    umAdd: string;
    umActive: string;
    umDeleteTitle: string;
    umSelectTitle: string; // {name}
    umToastNameRequired: string;
    umToastCreated: string; // {name}
    umToastCreateFailed: string;
    umToastRenameFailed: string;
    umToastStatusFailed: string;
    umToastCannotDeleteLast: string;
    umToastDeleted: string; // {name}
    umToastDeleteFailed: string;
    // IcalSyncModal
    icTitle: string;
    icIntro: string;
    icImportLabel: string;
    icExportLabel: string;
    icCopy: string;
    icClose: string;
    icSyncNow: string;
    icLoading: string;
    icToastCopyFailed: string;
    icToastSaveFailed: string;
    icToastSyncDone: string; // {blocks} {removed}
    icToastSyncFailed: string;
    // RateEditorPanel
    reTitle: string; // {range} {count}
    reNights: string;
    reCancel: string;
    reDayFilterHint: string;
    rePlaceholder: string; // {price}
    reApply: string;
    reReset: string;
    reResetTitle: string;
    reToastPriceValid: string;
    reToastNoDates: string;
    reToastApplied: string; // {count} {price}
    reToastReset: string; // {count}
    reToastSaveFailed: string;
    reDayChips: string[]; // Sen..Min (7)
    // Booking status + channel labels (bilingual)
    statusTentative: string; // = Inquiry
    statusConfirmed: string;
    statusCheckedIn: string;
    statusCompleted: string;
    statusCancelled: string;
    channelManual: string;
    channelWebsite: string;
    channelOther: string;
  };

  // Businesses Page
  /** Modul Event Registration ("Book Your Spot") — hub /calendar sektor creative_agency. */
  events: {
    hubTitle: string;
    hubSubtitle: string;
    sectorOnly: string;
    sectorOnlyDesc: string;
    listTitle: string;
    newEvent: string;
    emptyTitle: string;
    emptyDesc: string;
    emptyCta: string;
    statusDraft: string;
    statusOpen: string;
    statusClosed: string;
    statusCancelled: string;
    formCreateTitle: string;
    formEditTitle: string;
    fieldTitle: string;
    fieldTitlePlaceholder: string;
    fieldDescription: string;
    fieldEyebrowText: string;
    eyebrowTextPlaceholder: string;
    eyebrowTextHint: string;
    fieldLocation: string;
    fieldLocationPlaceholder: string;
    fieldStartTime: string;
    fieldEndTime: string;
    scheduleHint: string;
    fieldDescriptionPlaceholder: string;
    fieldTeamCount: string;
    fieldPlayersPerTeam: string;
    fieldContactMethod: string;
    contactWhatsapp: string;
    contactInstagram: string;
    contactMethodHint: string;
    fieldTeams: string;
    teamsHint: string;
    teamColorReset: string;
    teamTextColorToggle: string;
    brandColorTitle: string;
    brandColorHint: string;
    brandColorSave: string;
    toastBrandSaved: string;
    linkAfterPublish: string;
    capacityHint: string;
    detailFormat: string;
    detailSlotsPerDate: string;
    publicLink: string;
    copyLink: string;
    linkCopied: string;
    noPublicPage: string;
    publish: string;
    closeRegistration: string;
    reopen: string;
    deleteConfirm: string;
    datesTitle: string;
    datesHint: string;
    addDate: string;
    noDates: string;
    noDatesDesc: string;
    dateFull: string;
    dateWinner: string;
    dateDiscarded: string;
    slotsTaken: string;
    markWinner: string;
    markWinnerConfirm: string;
    removeDate: string;
    removeDateConfirm: string;
    gridTitle: string;
    gridHint: string;
    teamLabel: string;
    playerLabel: string;
    emptySlot: string;
    registeredAt: string;
    cancelSlot: string;
    cancelSlotConfirm: string;
    openInInbox: string;
    toastCreated: string;
    toastUpdated: string;
    toastDeleted: string;
    toastDateAdded: string;
    toastDateRemoved: string;
    toastWinner: string;
    toastSlotCancelled: string;
    loadFailed: string;
    saveFailed: string;
  };

  contacts: {
    typeCustomer: string;
    typeVendor: string;
    typePartner: string;
    typeStaff: string;
    typeInvestor: string;
    typeOther: string;
    loadErrorTitle: string;
    loadErrorHint: string;
    searchPlaceholder: string;
    clearSearch: string;
    clearSearchTitle: string;
    filterAllTypes: string;
    countLabel: (shown: number) => string;
    countOfTotal: (total: number) => string;
    emptyTitle: string;
    emptyHint: string;
    addContact: string;
    noMatch: string;
    chatWhatsApp: string;
    editContact: string;
    deleteContact: string;
    statTransactions: string;
    statIn: string;
    statOut: string;
    loadingTransactions: string;
    noTransactionsYet: string;
    modalTitleEdit: string;
    modalTitleAdd: string;
    nameLabel: string;
    namePlaceholder: string;
    typeLabel: string;
    phoneLabel: string;
    phonePlaceholder: string;
    emailLabel: string;
    emailPlaceholder: string;
    addressLabel: string;
    addressPlaceholder: string;
    idCardLabel: string;
    notesLabel: string;
    notesPlaceholder: string;
    savingContact: string;
    submitAdd: string;
    deleteTitle: string;
    errNameRequired: string;
    errDuplicateName: string;
    errSaveFailed: string;
  };

  businesses: {
    createFailed: string;
    updateFailed: string;
    deleteFailed: string;
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
    businessCapital: string;
    createdBy: string;
    unknownCreator: string;
    menuLabel: string;
    restore: string;
    invite: string;
    locked: string;
    lockedUntil: string;
    lockedUntilShort: string;
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
    sectorCustomLabel: string;
    logoFitFull: string;
    logoFitContain: string;
    showOnLanding: string;
    showOnLandingHint: string;
    city: string;
    cityPlaceholder: string;
  };

  // Omni-Channel — konfigurasi halaman publik (admin-side)
  omniChannel: {
    publicPageOn: string;
    publicPageOff: string;
    logoLabel: string;
    clickToUploadPhoto: string;
    photoFormats: string;
    pageUrl: string;
    slugPlaceholder: string;
    slugTry: string;
    slugFormat: string;
    slugReserved: string;
    slugInvalid: string;
    slugTaken: string;
    titleLabel: string;
    titlePlaceholder: string;
    taglineLabel: string;
    taglinePlaceholder: string;
    bioLabel: string;
    bioPlaceholder: string;
    bannerLabel: string;
    bannerEmpty: string;
    bannerDragHint: string;
    bannerFormats: string;
    layoutTitle: string;
    layoutHint: string;
    layoutClassic: string;
    layoutModern: string;
    layoutClean: string;
    buttonColorLabel: string;
    buttonColorHint: string;
    saveChanges: string;
    createPage: string;
    removeLogo: string;
    imageOnly: string;
    maxFileSize: string;
    uploadPhotoFailed: string;
    uploadBannerFailed: string;
    saveFailed: string;
  };

  // Omni-Channel — modal tambah/edit link
  omniLink: {
    addTitle: string;
    editTitle: string;
    channelType: string;
    categorySocial: string;
    categoryEcommerce: string;
    categoryMessaging: string;
    categoryCustom: string;
    customChannel: string;
    labelField: string;
    labelCustomPlaceholder: string;
    labelCustomHint: string;
    subtitleField: string;
    subtitlePlaceholder: string;
    subtitleHint: string;
    urlField: string;
    urlRequired: string;
    labelRequired: string;
    iconField: string;
    iconPick: string;
    iconUploadHint: string;
    iconSaveFirst: string;
    iconUploadFailed: string;
    iconPickerTitle: string;
    iconSearchPlaceholder: string;
    iconNoMatch: string;
    iconClear: string;
    displayIconOnly: string;
    displayIconOnlyHint: string;
    activeToggle: string;
    saveFailed: string;
    imageOnly: string;
    maxFileSize: string;
    icons: Record<string, string>;
  };

  // Invoice — form & editor baris item
  invoiceForm: {
    sectionInvoice: string;
    sectionCustomer: string;
    sectionDescription: string;
    sectionTax: string;
    sectionSummary: string;
    sectionNotes: string;
    invoiceNumber: string;
    invoiceDate: string;
    dueDate: string;
    customerName: string;
    customerNamePlaceholder: string;
    customerPhone: string;
    customerId: string;
    customerIdPlaceholder: string;
    descriptionPlaceholder: string;
    columnLabel: string;
    taxType: string;
    taxRate: string;
    taxNone: string;
    taxIncluded: string;
    taxExcluded: string;
    subtotal: string;
    vat: string;
    vatIncluded: string;
    total: string;
    notesPlaceholder: string;
    saveInvoice: string;
    updateInvoice: string;
    errNumberRequired: string;
    errDateRequired: string;
    errCustomerRequired: string;
    errLineItems: string;
    qty: string;
    unitPrice: string;
    lineTotal: string;
    removeItem: string;
    addItem: string;
    itemNamePlaceholder: string;
  };

  // Preview hasil OCR struk
  ocrPreview: {
    railTitle: string;
    title: string;
    subtitle: string;
    expand: string;
    collapse: string;
    close: string;
    total: string;
    vendor: string;
    date: string;
    items: string;
    charges: string;
    chargeTax: string;
    chargeService: string;
    chargeDiscount: string;
    chargeOther: string;
    noItems: string;
    noItemsWithTotal: string;
    multiLine: string;
    singleForm: string;
    multiLineDisabled: string;
    accountsNotReady: string;
    tooFewItems: string;
    copy: string;
    copied: string;
    copyText: string;
  };

  // Modal konfigurasi klasifikasi beban di Income Statement
  incomeStatementConfig: {
    title: string;
    subtitle: string;
    override: string;
    overrideTooltip: string;
    noAccounts: string;
    accountCount: string;
    detailTitle: string;
    detailHint: string;
    accountCode: string;
    accountName: string;
    defaultClassification: string;
    currentClassification: string;
    description: string;
    pickAccount: string;
    moveToCogs: string;
    moveToOpex: string;
    resetDefault: string;
    unsaved: string;
    noChanges: string;
    saveFailed: string;
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
    pageTitle: string;
    summary: string;
    profit: string;
    loss: string;
    breakEven: string;
    statementTitle: string;
    configureTooltip: string;
    revenue: string;
    totalRevenue: string;
    costOfRevenue: string;
    totalCostOfRevenue: string;
    opex: string;
    opexShort: string;
    totalOpex: string;
    ebitda: string;
    depreciation: string;
    depreciationLine: string;
    totalDepreciation: string;
    operatingIncomeShort: string;
    operatingIncomeTooltip: string;
    financingCosts: string;
    financing: string;
    totalFinancingCosts: string;
    ebt: string;
    ebtTooltip: string;
    taxExpense: string;
    tax: string;
    totalTax: string;
    formulaLabel: string;
    formulaGrossProfit: string;
    formulaEbitda: string;
    formulaOperatingIncomeWithDep: string;
    formulaOperatingIncome: string;
    formulaEbt: string;
    formulaNetIncome: string;
    netIncomeTooltipTitle: string;
    transactionsCount: (n: number) => string;
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
    debtToAssetRatio: string;
    debtToEquityRatio: string;
    debtToEquityFormula: string;
    viewChangesInEquity: string;
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
    transactionsCount: (n: number) => string;
    noTransactions: string;
    openingBalanceTooltipTitle: string;
    openingBalanceTooltipDesc: string;
    transactionsCalculated: string;
    capitalInjection: string;
    ownerWithdrawal: string;
    openingBalance: string;
    openingBalanceDesc: string;
    closingBalanceLabel: string;
    fallbackHint: string;   // "... fallback ke {capital} ..."
    initialCapital: string;
  };

  // General Ledger
  generalLedger: {
    selectBusinessHint: string;
    hideTransactions: string;
    viewTransactions: string;
    noEntriesForPeriod: string;
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
    sortNewest: string;
    sortOldest: string;
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
    marginGross: string;
    marginOperating: string;
    marginNet: string;
    noProjectionData: string;
    periodMonth: string;
    periodQuarter: string;
    periodYear: string;
    periodCustom: string;
    startDate: string;
    endDate: string;
    revShort: string;
    netShort: string;
  };

  // Invoices
  invoices: {
    pickFromReceivablesTooltip: string;
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
    bankGeneric: string;
    parseFailed: string;
    commitFailed: string;
    noCashAccounts: string;
    colCounterparty: string;
    periodLabel: string;
    colTransaction: string;
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
    noUnderBudget: string;
    monthsUnit: string;
    noBudgetData: string;
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
    historyTitle: string;
    noCodes: string;
    closeNotification: string;
    genericError: string;
    loadFailed: string;
    minUses: string;
    minDays: string;
    createSuccess: string;
    createFailed: string;
    copied: string;
    deactivateSuccess: string;
    deactivateFailed: string;
    deleteSuccess: string;
    deleteFailed: string;
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
    unknownUser: string;
    memberOptions: string;
    addToContact: string;
    removeMember: string;
    removeConfirm: string;
    removeAction: string;
    removeFailed: string;
    removeFailedRetry: string;
    contactExists: string;
    contactAdded: string;
    contactFailed: string;
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
    // Panel chat mengambang (AIChatPanel)
    panel: {
      suggestionsAnalyst: string[];
      suggestionsTax: string[];
      suggestionsEntry: string[];
      smallTalkThanks: string;
      smallTalkGreeting: string;
      smallTalkDefault: string;
      noResponse: string;
      genericError: string;
      failedContactAI: string;
      failedContactAgent: string;
      failedProcessTransaction: string;
      failedSaveTransaction: string;
      failedSave: string;
      failedImport: string;
      failedProcessFile: string;
      failedReadFile: string;
      failedProcessImage: string;
      llmFileFailed: string;
      ocrFailed: string;
      sessionExpired: string;
      invalidFile: string;
      emptyFile: string;
      noValidRows: string;
      noImportableRows: string;
      importFound: (n: number) => string;
      receiptNoAmount: string;
      receiptNoAccount: string;
      receiptTransaction: string;
      chatFallback: string;
      askAmount: string;
      askAmountFor: (name: string) => string;
      draftIntro: string;
      memorized: string;
      memorizeFailed: string;
      memorizeTitle: string;
      resetTitle: string;
      closeTitle: string;
      pickModel: string;
      autoModelDesc: string;
      vertexMissing: string;
      claudeNotConfigured: string;
      inputRecordPlaceholder: string;
      inputAskPlaceholder: string;
      attachTitle: string;
      hintRecord: string;
      hintAsk: string;
      examplesLabel: string;
      trySomething: string;
      thinkingStreaming: string;
      thinkingDone: string;
      openPage: string;
      needsCheck: string;
      cancelled: string;
      saved: string;
      importing: string;
      readyCount: string;
      errorCount: string;
      lowConfidenceHint: (n: number) => string;
      importCta: (n: number) => string;
      importDone: (inserted: number, failed: number) => string;
      pageLabels: Record<string, string>;
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
      toolImportCsv: string;
      toolContacts: string;
      toolBusinessInfo: string;
      toolNavigate: string;
      // Workspace UI
      accessDeniedTitle: string;
      accessDeniedDesc: string;
      memoryVault: string;
      memoryVaultDesc: string;
      memoryVaultEmpty: string;
      memoryVaultEmptyHint: string;
      systemSource: string;
      contextBusiness: string;
      contextGeneral: string;
      channelUnsupportedPlaceholder: string;
      instructionPrefix: (example: string) => string;
      askBusinessPlaceholder: string;
      askGeneralPlaceholder: string;
      callBianca: string;
      send: string;
      hintImport: string;
      hintChat: string;
      sessionHistory: string;
      newSession: string;
      noSessions: string;
      emptyConversation: string;
      deleteHistory: string;
      deleteSessionConfirm: string;
      deleteSessionFailed: string;
      sources: string;
      thinkingStreaming: string;
      thinkingDone: string;
      biancaRunning: string;
      biancaStopped: string;
      biancaDone: string;
      importProgress: string;
      resultImported: string;
      resultSkipped: string;
      resultDuplicate: string;
      resultFailed: string;
      channelHintAirbnb: string;
      channelHintTiktok: string;
      channelHintUnsupported: string;
      instructionExampleAirbnb: string;
      instructionExampleTiktok: string;
      channelDescAirbnb: string;
      channelDescTiktok: string;
      channelDescShopee: string;
      uploadFailed: string;
      uploadDocFailed: (msg: string) => string;
      serverContactFailed: string;
      genericError: string;
      noResponse: string;
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
    // Pelunasan hutang (AP)
    ofTotalPaid: string; // "dari total {amount}" — cicilan pokok + bunga
    payableSettled: string;
    payableSettledDesc: string;
    payableOutstanding: string;
    payableOutstandingDesc: string;
    payDebtFull: string;
    payDebtPartial: string;
    confirmFullDebtPayment: string;
    yesPay: string;
    debtRemaining: string;
    mustBeLessThanDebt: string;
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
    /** Label kolom di riwayat perubahan, dikunci nama kolom DB (mis. `debit_account_id`). */
    auditField: Record<string, string>;
    auditEmpty: string;
    auditYes: string;
    auditNo: string;
    auditStructured: string;
    // Dividen (declare → bayar)
    dividendPaidInFull: string;
    dividendPaidInFullDesc: string;
    dividendDeclared: string;
    dividendDeclaredDesc: string;
    payDividendFull: string;
    payDividendPartial: string;
    confirmFullDividendPayment: string;
    dividendRemaining: string;      // "Sisa dividen yang perlu dibayar: {amount}"
    dividendMustBeLessThan: string; // "Jumlah harus kurang dari {amount}"
    paymentAmountLabel: string;
    totalPaidShort: string;
    partialPaymentGeneric: string;
    paymentFallbackName: string;
    // Header & baris atas
    manageContacts: string;
    prevTransaction: string;
    nextTransaction: string;
    printLoanReceipt: string;
    alreadyInvoiced: string;
    removeTag: string;              // "Hapus tag {tag}"
    addTag: string;
    // Preview lampiran
    zoomOut: string;
    resetZoom: string;
    zoomIn: string;
    downloadFile: string;
    prevAttachment: string;
    nextAttachment: string;
    prevAttachmentAria: string;
    nextAttachmentAria: string;
    previewOf: string;              // "Preview {filename}"
    viewOf: string;                 // "Lihat {filename}"
    downloadOf: string;             // "Unduh {filename}"
    enlargePreview: string;
    enlargePreviewOf: string;       // "Perbesar preview {filename}"
    loadingImage: string;
    loadingPdf: string;
    loadingGeneric: string;
    // Warning panel
    cogsAmountHint: string;
    createCogsEntry: string;
    closeAria: string;
    // Action buttons
    postBtn: string;
    editBtn: string;
    deleteBtn: string;
    duplicateBtn: string;
  };

  // Business Config Page (tabs)
  backup: {
    title: string;
    subtitle: string;
    description: string;
    credentialNote: string;
    downloadJson: string;
    downloadExcel: string;
    preparing: string;
    lastResult: string;      // "{rows} baris dari {tables} tabel"
    investorOnly: string;
  };
  businessConfig: {
    tabMembers: string;
    tabContacts: string;
    tabOmnichannel: string;
    tabIntegrations: string;
    tabData: string;
    inviteMember: string;
    notSet: string;
    saveFailed: string;
    changeField: string;   // "Ubah {label}"
    fillField: string;     // "Isi {label}"
    selectPlaceholder: string;
    done: string;
    optionsMenu: string;
    optionsMenuAria: string;
    editInfo: string;
    legalIdentity: string;
    legalName: string;
    legalEntityType: string;
    financeAndLocation: string;
    businessCapital: string;
    operationalLocation: string;
    registeredAddress: string;
    timeline: string;
    createdAt: string;
    operationsStart: string;
    operationsStartHint: string;
    leaveBusiness: string;
    leaveFailed: string;
    backToBusiness: string;
    addContact: string;
    joinRequests: string;
    leaveConfirm: string;      // "Apakah Anda yakin ingin keluar dari bisnis {name}?"
    leaveConfirmHint: string;
    leaving: string;
    leave: string;
    legalEntityTypes: Record<string, string>;
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
    tokenExpired: string;
    tokenExpiringSoon: string;
    tokenExpiredHint: string;
    tokenExpiringSoonHint: string;
    reconnect: string;
    backfillNames: string;
    backfillNamesRunning: string;
    backfillNamesDone: string;
    backfillNamesNone: string;
    backfillNamesFailed: string;
    backfillNamesHint: string;
    backfillNamesPartial: string;
    backfillNamesAllFailed: string;
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
  assetConsole: {
    title: string;
    subtitle: string;
    classStock: string;
    classCrypto: string;
    classProperty: string;
    classGold: string;
    classVenture: string;
    filterAll: string;
    kpiInvested: string;
    kpiMarketValue: string;
    kpiUnrealized: string;
    kpiRealized: string;
    kpiInvestedHint: string;
    kpiMarketValueHint: string;
    kpiUnrealizedHint: string;
    kpiRealizedHint: string;
    showAmount: string;
    hideAmount: string;
    colSymbol: string;
    colClass: string;
    colBalance: string;
    colCapitalUnit: string;
    colAvgPrice: string;
    colLastPrice: string;
    colMarketValue: string;
    colInvested: string;
    colPl: string;
    colPct: string;
    colCustodian: string;
    colCostBasis: string;
    colDate: string;
    colEvent: string;
    colQty: string;
    colAmount: string;
    eventBuy: string;
    eventSell: string;
    eventDividend: string;
    eventAdjustment: string;
    breakdownTitle: string;
    breakdownSubtitle: string;
    historyTitle: string;
    historySubtitle: string;
    historyEmpty: string;
    updatePrice: string;
    updatePriceTitle: string;
    updatePriceLabel: string;
    updatePriceHint: string;
    updatePriceSave: string;
    priceNeverUpdated: string;
    priceUpdatedAt: string;
    noPriceWarning: string;
    unknownQtyWarning: string;
    derivedQty: string;
    emptyTitle: string;
    emptyDesc: string;
    emptyAction: string;
    noPositionTitle: string;
    noPositionDesc: string;
    backToConsole: string;
    viewTransaction: string;
    sourceNote: string;
    closedPosition: string;
    // Kelas 'venture' — tautan ke bisnis lain
    connectVenture: string;
    connectVentureTitle: string;
    connectVentureDesc: string;
    ventureBusinessLabel: string;
    ventureBusinessPlaceholder: string;
    ventureAccountLabel: string;
    ventureAccountPlaceholder: string;
    ventureAccountHint: string;
    ventureAccountLinked: string;
    ventureNoBusiness: string;
    ventureNoAccounts: string;
    ventureSubmit: string;
    ventureDisconnect: string;
    ventureDisconnectConfirm: string;
    ventureUnresolved: string;
    ventureOwnership: string;
    ventureValuation: string;
    ventureDividendShare: string;
    ventureDividendReceived: string;
    ventureValuationHint: string;
    ventureSourceNote: string;
    ventureNoHistory: string;
    ventureHistorySubtitle: string;
    ventureValuationPerPct: string;
    ventureValuationFormula: string;
    ventureValuationFormulaHint: string;
    ventureEventCapitalIn: string;
    ventureEventCapitalOut: string;
  };
  onboarding: {
    // Header
    title: string;
    subtitle: string;
    stepLabel: string; // "Langkah {current} dari {total}"
    // Langkah 1 — identitas
    step1Title: string;
    step1Desc: string;
    businessName: string;
    businessNameHint: string;
    businessCategory: string;
    businessCategoryHint: string;
    sector: string;
    customSector: string;
    customSectorHint: string;
    // Langkah 2 — modal & lokasi
    step2Title: string;
    step2Desc: string;
    capital: string;
    capitalHint: string;
    capitalSkipHint: string;
    address: string;
    addressHint: string;
    optional: string;
    // Navigasi
    back: string;
    next: string;
    createBusiness: string;
    creating: string;
    createFailed: string;
    // Layar ringkasan
    doneTitle: string;
    doneSubtitle: string;
    doneAccounts: string;
    doneAccountsDesc: string;
    doneAccountsCount: string; // "{count} akun siap pakai"
    doneCapital: string;
    doneCapitalDesc: string;
    doneNoCapital: string;
    doneNoCapitalDesc: string;
    goToDashboard: string;
    recordTransaction: string;
    recordFirstTransaction: string;
  };

  journalEntry: {
    /** Panel jenis transaksi: tombol + modal "tambah jenis ke panel". */
    addEntryType: string;
    entryTypePickerTitle: string;
    entryTypePickerHint: string;
    entryTypePickerEmpty: string;
    entryTypeShown: string;
    entryTypes: Record<JournalEntryTypeKey, JournalEntryTypeStrings>;
    /** Form jurnal: header, field, mode multi-baris, template, berulang, error. */
    form: {
      backToTransactions: string;
      createInvoice: string;
      useTemplate: string;
      templateLines: (n: number) => string;
      deleteTemplate: string;
      amountRp: string;
      debitAccount: string;
      selectDebitAccount: string;
      creditAccount: string;
      selectCreditAccount: string;
      debit: string;
      credit: string;
      addLine: string;
      journalLines: string;
      debitMustEqualCredit: string;
      colAccount: string;
      colDebitRp: string;
      colCreditRp: string;
      selectAccount: string;
      optionalPlaceholder: string;
      deleteLine: string;
      balanced: string;
      difference: (amount: string) => string;
      cancelMultiLine: string;
      exitMultiLineConfirm: string;
      categoryLabel: string;
      categoryLocked: string;
      categoryAuto: string;
      descriptionLabel: string;
      optionalSuffix: string;
      descriptionPlaceholder: string;
      attachmentsLabel: string;
      saveAsTemplate: string;
      templateNamePlaceholder: string;
      makeRecurring: string;
      frequency: string;
      weekly: string;
      monthly: string;
      yearly: string;
      every: string;
      weeksUnit: string;
      monthsUnit: string;
      yearsUnit: string;
      untilOptional: string;
      noLimit: string;
      saveTransaction: string;
      savedToast: string;
      errNameRequired: string;
      errDateRequired: string;
      errSelectAccount: string;
      errEnterDebitOrCredit: string;
      errAmountZero: string;
      errUnbalanced: (amount: string) => string;
      errAmountPositive: string;
      errDebitRequired: string;
      errCreditRequired: string;
      errSameAccount: string;
      errNoCogsAccount: string;
      errSaveFailed: string;
      // Form jurnal multi-baris berdiri sendiri (MultiLineJournalForm)
      dateRequiredLabel: string;
      categoryRequiredLabel: string;
      salesChannel: string;
      noChannel: string;
      nameRefRequired: string;
      descriptionRequiredLabel: string;
      descriptionShortPlaceholder: string;
      journalLinesRequired: string;
      mustBalance: string;
      loadingAccounts: string;
      colLineDescription: string;
      balancedShort: string;
      differenceShort: (amount: string) => string;
      notesOptional: string;
      notesPlaceholder: string;
      attachmentsOptional: string;
      saveJournal: string;
      errDescriptionRequired: string;
      salesReceiptLine: string;
      catalogItemsSummary: (n: number) => string;
    };
    entitlement: {
      title: string;      // "Hak Bagi Hasil {year}"
      subtitle: string;   // "Laba tahun berjalan {netIncome}"
      owner: string;
      share: string;
      entitled: string;
      taken: string;
      remaining: string;
      pctFromCapital: string;
      stillPayable: string;   // "{amount} belum dibayar"
      overdrawn: string;      // "Lebih {amount}"
      noProfitWarning: string;
      footnote: string;
    };
    picker: {
      manualEntry: string;
      searchPlaceholder: string;
      noResults: string;
      remaining: string;
      installmentCount: string; // "{count}× cicilan"
      untitled: string;
      // Hutang (AP)
      payableTitle: string;
      payableSubtitle: string;
      payFull: string;
      payPartial: string;
      paidFullSuccess: string;
      paidPartialSuccess: string;
      // Piutang (AR) — usaha & talangan
      receivableTitle: string;
      receivableSubtitle: string;
      tabTrade: string;
      tabAdvance: string;
      receiveFull: string;
      receivePartial: string;
      receivedFullSuccess: string;
      receivedPartialSuccess: string;
      // Dividen yang sudah di-declare
      dividendTitle: string;
      dividendSubtitle: string;
      dividendFullSuccess: string;
      dividendPartialSuccess: string;
      // Input cicilan
      amountLabel: string;
      recordPayment: string;
      cancel: string;
      processing: string;
      enterAmount: string;
      mustBeLessThan: string; // "Jumlah harus kurang dari {amount}"
      failed: string;
      // Katalog (jenis transaksi Penjualan)
      catalogTitle: string;
      catalogSubtitle: string;
      catalogSearchPlaceholder: string;
      catalogNoResults: string;
      catalogSelect: string;
      catalogStock: string;
      catalogOutOfStock: string;
      decreaseQty: string;
      increaseQty: string;
      fromCatalog: string;
      changeItem: string;
    };
  };
}

export type JournalEntryTypeKey =
  | 'penjualan'
  | 'pengeluaran'
  | 'pinjaman'
  | 'bayar_hutang'
  | 'suntik_modal'
  | 'tarik_dividen'
  | 'beban_terutang'
  | 'realisasi_pendapatan_dimuka'
  | 'reklasifikasi_hutang'
  | 'pendapatan_dimuka'
  | 'catat_talangan'
  | 'terima_pelunasan';

export interface JournalEntryTypeStrings {
  label: string;
  description: string;
  /** Label field nama pihak lawan (pelanggan/vendor/kreditur/…) */
  nameLabel: string;
  namePlaceholder: string;
}
