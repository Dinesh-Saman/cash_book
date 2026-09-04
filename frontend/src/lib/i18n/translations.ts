export type Language = 'de' | 'en';

export const translations = {
  de: {
    // Brand & App
    appName: 'Kassenbuch',
    appSubtitle: 'Kassenbuch-Verwaltungssystem',
    appTagline: 'Sichere Cloud-Kassenbuchführung nach GoBD / DATEV',
    
    // Navigation
    navMainMenu: 'Hauptmenü',
    navAdministration: 'Verwaltung',
    navCashBook: 'Kassenbuch',
    navMonthlyReports: 'Monatsberichte',
    navAnnualReport: 'Jahresbericht',
    navSettings: 'Einstellungen',
    navUserManagement: 'Benutzerverwaltung',
    navAuditLog: 'Prüfprotokoll',
    navLogout: 'Abmelden',
    lblLanguage: 'Sprache:',
    lblMonthlyView: 'Monatsansicht',
    bookingSingular: 'Buchung',
    bookingPlural: 'Buchungen',

    // Summary Bar
    summaryCurrentBalance: 'Aktueller Kassenbestand',
    summaryIncome: 'Einnahmen',
    summaryExpense: 'Ausgaben',
    summaryOpeningBalance: 'Anfangsbestand',

    // Cash Book Page
    cashBookTitle: 'Kassenbuch',
    cashBookYearlyView: 'Gesamtjahresansicht',
    btnAddIncome: '+ Einnahme',
    btnAddExpense: '+ Ausgabe',
    btnExport: 'Exportieren',
    btnExporting: 'Exportiert...',
    btnAllMonths: 'Alle Monate',
    exportPdf: 'PDF exportieren',
    exportExcel: 'Excel exportieren',
    exportXml: 'XML exportieren',
    exportDatev: 'DATEV-Format (CSV)',
    noOpeningBalanceTitle: 'Kein Anfangsbestand hinterlegt',
    noOpeningBalanceDesc: 'Legen Sie einen Kassen-Anfangsbestand fest, um die Kassenbuchführung sauber zu starten.',
    btnSetOpeningBalanceNow: 'Anfangsbestand jetzt festlegen',

    // Table Headers & Rows
    thDate: 'Datum',
    thVoucherNo: 'Belegnr.',
    thBookingRule: 'Buchungsregel',
    thBookingText: 'Buchungstext',
    thIncome: 'Einnahme',
    thExpense: 'Ausgabe',
    thVat: 'MwSt.',
    thBalance: 'Kassenbestand',
    thDocument: 'Dokument',
    thActions: 'Aktionen',
    tblOpeningBalance: 'Anfangsbestand',
    tblNoEntries: 'Keine Einträge vorhanden',
    tblNoEntriesDesc: 'Fügen Sie eine neue Einnahme oder Ausgabe hinzu, um Buchungen im Kassenbuch zu verwalten.',
    tblTotals: 'Summen',
    tblBookingsCount: 'Buchungen',
    btnViewDoc: 'Ansehen',
    btnEdit: 'Bearbeiten',
    btnDelete: 'Löschen',
    docAvailable: 'Vorhanden',

    // Entry Form
    formAddIncomeTitle: 'Einnahme erfassen',
    formAddExpenseTitle: 'Ausgabe erfassen',
    formEditIncomeTitle: 'Einnahme bearbeiten',
    formEditExpenseTitle: 'Ausgabe bearbeiten',
    formCurrentBalance: 'Kassenbestand:',
    formHistoricalNotice: 'Historischer Eintrag: Kassenbestände werden automatisch chronologisch neu berechnet.',
    formInsufficientBalance: 'Unzureichender Kassenbestand. Diese Ausgabe kann nicht gespeichert werden, da der Betrag den aktuellen Kassenbestand übersteigt.',
    lblDate: 'Datum',
    btnSelectToday: 'Heute auswählen',
    lblVoucherNo: 'Belegnummer',
    placeholderVoucherNo: 'z.B. RE-2026-001',
    lblBookingRule: 'Buchungsregel',
    selectBookingRulePlaceholder: '-- Buchungsregel auswählen --',
    addNewBookingRuleOption: '+ Neue Regel hinzufügen...',
    placeholderNewRule: 'Neue Buchungsregel eingeben...',
    btnAdd: 'Hinzufügen',
    lblBookingText: 'Buchungstext',
    placeholderBookingText: 'Transaktionsspezifische Details (Rechnungsnummer, Lieferant, Referenz...)',
    lblIncomeAmount: 'Einnahmebetrag (€)',
    lblExpenseAmount: 'Ausgabebetrag (€)',
    lblVat: 'MwSt.',
    lblUploadDoc: 'Beleg / Dokument hochladen (optional)',
    uploadDragDrop: 'Klicken oder Datei hierher ziehen',
    uploadFormats: 'PDF, JPG, PNG (max. 10 MB)',
    uploadSelectNew: '(Neues Dokument wählen)',
    btnCancel: 'Abbrechen',
    btnSave: 'Eintrag speichern',
    btnUpdate: 'Eintrag aktualisieren',
    btnSaving: 'Wird gespeichert...',
    msgVoucherNoRequired: 'Bitte geben Sie eine Belegnummer ein (z. B. BE-2026-001).',
    msgBookingRuleRequired: 'Bitte wählen Sie eine Buchungsregel aus.',
    msgAmountRequired: 'Bitte geben Sie einen gültigen Betrag größer als 0 ein.',

    // Opening Balance Modal
    modalOpeningBalanceTitle: 'Anfangsbestand festlegen',
    modalOpeningBalanceSubtitle: 'Kassenbuch Eröffnungsbuchung',
    modalOpeningBalanceDesc: 'Der Anfangsbestand ist der Ausgangsbetrag in der Kasse vor Erfassung der täglichen Einnahmen und Ausgaben.',
    lblOpeningBalanceAmount: 'Anfangsbestand (€)',

    // Delete Modal
    modalDeleteTitle: 'Eintrag löschen',
    modalDeleteDesc: 'Sind Sie sicher, dass Sie diesen Eintrag aus dem Kassenbuch löschen möchten?',
    modalDeleteWarning: 'Wichtiger Hinweis: Der Kassenbestand wird automatisch für alle chronologisch folgenden Buchungen neu berechnet.',
    btnDeleteConfirm: 'Eintrag löschen',
    btnDeleting: 'Wird gelöscht...',

    // Document Viewer
    docViewerDownload: 'Herunterladen',
    docViewerNoPreview: 'Vorschau für dieses Dateiformat nicht verfügbar.',
    docViewerDownloadFile: 'Datei herunterladen',

    // Monthly Report
    monthlyReportTitle: 'Monatsbericht',
    cardMonthStartBalance: 'Anfangsbestand (Monat)',
    cardTotalIncome: 'Gesamteinnahmen',
    cardTotalExpense: 'Gesamtausgaben',
    cardMonthBalance: 'Monatssaldo',
    cardMonthEndBalance: 'Monats-Endbestand',
    noMonthlyEntries: 'Keine Buchungen für diesen Monat gefunden',

    // Annual Report
    annualReportTitle: 'Jahresbericht',
    annualReportSubtitle: 'Umfassende Jahresauswertung und Monatsanalysen',
    cardYearIncome: 'Jahreseinnahmen',
    cardYearExpense: 'Jahresausgaben',
    cardYearBalance: 'Jahressaldo',
    chartTitle: 'Monatlicher Einnahmen- & Ausgabenverlauf',
    fiscalYear: 'Geschäftsjahr',
    noAnnualEntries: 'Keine Buchungen für das Geschäftsjahr erfasst.',

    // Settings Page
    settingsTitle: 'Systemeinstellungen',
    settingsSubtitle: 'Konfiguration für Kassenbuch, DATEV-Schnittstelle und Buchungsregeln',
    secCashBookSettings: '📋 Kassenbuch Anfangsbestand',
    lblOpeningBalanceDate: 'Datum Anfangsbestand',
    btnSaveOpeningBalance: 'Anfangsbestand speichern',
    secBookingRules: '📑 Buchungsregeln & Kategorien',
    badgeDefaultRule: 'Standard',
    btnAddRule: 'Regel hinzufügen',
    secDatev: '🏢 DATEV-Konfiguration',
    lblAdvisorNum: 'Beraternummer',
    lblClientNum: 'Mandantennummer',
    lblChartOfAccounts: 'Kontenrahmen',
    descSkr04: 'Konto 1000 (Kasse) — Industriekontenrahmen SKR04',
    descSkr03: 'Konto 1600 (Kasse) — Standardkontenrahmen SKR03',
    btnSaveDatev: 'DATEV-Einstellungen speichern',
    secYearFinalization: '🔒 Jahresabschluss (Festschreibung)',
    descYearFinalization: 'Durch den Jahresabschluss wird das ausgewählte Geschäftsjahr schreibgeschützt. Es können keine Buchungen mehr hinzugefügt, bearbeitet oder gelöscht werden.',
    lblSelectYearToFinalize: 'Geschäftsjahr für Abschluss auswählen',
    btnFinalizeYear: 'Jahr abschließen',
    btnUnfinalizeYear: 'Jahr entsperren',
    finalizedYearsList: 'Abgeschlossene Geschäftsjahre:',
    noneFinalized: 'Keine abgeschlossenen Geschäftsjahre.',
    yearFinalizedBadge: 'Geschäftsjahr {year} abgeschlossen (Schreibgeschützt)',
    confirmFinalizeTitle: 'Geschäftsjahr {year} abschließen?',
    confirmFinalizeDesc: 'Sind Sie sicher, dass Sie das Geschäftsjahr {year} festschreiben möchten? Danach sind keine Änderungen an den Buchungen dieses Jahres mehr möglich.',
    confirmUnlockTitle: 'Geschäftsjahr {year} entsperren?',
    confirmUnlockDesc: 'Möchten Sie das Geschäftsjahr {year} wirklich wieder entsperren, um Änderungen zu erlauben?',

    // User Management Page
    userMgmtTitle: 'Benutzerverwaltung',
    userMgmtSubtitle: 'Rollen & Zugriffsrechte verwalten',
    usersCount: 'Benutzer',
    btnAddUser: 'Benutzer hinzufügen',
    thUser: 'Benutzer',
    thEmail: 'E-Mail',
    thRole: 'Rolle',
    thStatus: 'Status',
    roleAdmin: 'Administrator (Verwaltung)',
    roleAccountant: 'Buchhalter',
    roleViewer: 'Betrachter',
    statusActive: 'Aktiv',
    statusInactive: 'Deaktiviert',
    noUsersFound: 'Keine Benutzer im System vorhanden',
    modalAddUserTitle: 'Neuen Benutzer anlegen',
    modalEditUserTitle: 'Benutzer bearbeiten',
    lblName: 'Vollständiger Name',
    lblEmail: 'E-Mail Adresse',
    lblPassword: 'Initiales Passwort',
    lblPasswordOptional: 'Neues Passwort (leer lassen = unverändert)',
    lblUserRole: 'Benutzerrolle',
    btnSaveUser: 'Benutzer speichern',

    // Audit Log Page
    auditLogTitle: 'Prüfprotokoll (Audit Log)',
    auditLogSubtitle: 'Lückenlose Nachvollziehbarkeit aller Kassenbuch- und Systemänderungen',
    auditEntriesCount: 'Einträge',
    thTimestamp: 'Zeitpunkt',
    thAction: 'Aktion',
    thCategory: 'Kategorie',
    thDescription: 'Beschreibung',
    noAuditEntries: 'Keine Protokolleinträge vorhanden',
    actCreate: 'Erstellt',
    actUpdate: 'Bearbeitet',
    actDelete: 'Gelöscht',
    actFinalize: 'Abgeschlossen',
    actLogin: 'Anmeldung',
    catEntry: 'Eintrag',
    catBookingRule: 'Buchungsregel',
    catUser: 'Benutzer',
    catSettings: 'Einstellungen',
    catMonth: 'Monat',
    catYear: 'Jahr',
    pageOf: 'Seite {page} von {total}',
    totalActions: 'Aktionen insgesamt',

    // Login Page
    loginTitle: 'Anmeldung',
    loginSslSecured: 'SSL Gesichert',
    loginEmailLabel: 'E-Mail Adresse',
    loginPasswordLabel: 'Passwort',
    btnLogin: 'Im Kassenbuch anmelden',
    loginAuthenticating: 'Wird authentifiziert...',
    defaultAccess: 'Standard-Zugang:',
    defaultPassword: 'Passwort: Admin@1234',
    accountDisabled: 'Ihr Benutzerkonto wurde von einem Administrator deaktiviert. Bitte wenden Sie sich an die Administration.',

    // Months (Full)
    months: [
      'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
      'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
    ],
    // Months (Short)
    monthsShort: [
      'Jan', 'Feb', 'Mrz', 'Apr', 'Mai', 'Juni',
      'Juli', 'Aug', 'Sept', 'Okt', 'Nov', 'Dez'
    ]
  },

  en: {
    // Brand & App
    appName: 'Cash Book',
    appSubtitle: 'Cash Book Management System',
    appTagline: 'Secure Cloud Cash Book Management compliant with GoBD / DATEV',
    
    // Navigation
    navMainMenu: 'Main Menu',
    navAdministration: 'Administration',
    navCashBook: 'Cash Book',
    navMonthlyReports: 'Monthly Reports',
    navAnnualReport: 'Annual Report',
    navSettings: 'Settings',
    navUserManagement: 'User Management',
    navAuditLog: 'Audit Log',
    navLogout: 'Log Out',
    lblLanguage: 'Language:',
    lblMonthlyView: 'Monthly View',
    bookingSingular: 'Booking',
    bookingPlural: 'Bookings',

    // Summary Bar
    summaryCurrentBalance: 'Current Cash Balance',
    summaryIncome: 'Total Income',
    summaryExpense: 'Total Expenses',
    summaryOpeningBalance: 'Opening Balance',

    // Cash Book Page
    cashBookTitle: 'Cash Book',
    cashBookYearlyView: 'Full Year Overview',
    btnAddIncome: '+ Income',
    btnAddExpense: '+ Expense',
    btnExport: 'Export',
    btnExporting: 'Exporting...',
    btnAllMonths: 'All Months',
    exportPdf: 'Export PDF',
    exportExcel: 'Export Excel',
    exportXml: 'Export XML',
    exportDatev: 'DATEV-Format (CSV)',
    noOpeningBalanceTitle: 'No Opening Balance Set',
    noOpeningBalanceDesc: 'Set an initial cash opening balance to start your cash book accounting accurately.',
    btnSetOpeningBalanceNow: 'Set Opening Balance Now',

    // Table Headers & Rows
    thDate: 'Date',
    thVoucherNo: 'Voucher No.',
    thBookingRule: 'Booking Rule',
    thBookingText: 'Booking Text',
    thIncome: 'Income',
    thExpense: 'Expense',
    thVat: 'VAT',
    thBalance: 'Cash Balance',
    thDocument: 'Document',
    thActions: 'Actions',
    tblOpeningBalance: 'Opening Balance',
    tblNoEntries: 'No Entries Available',
    tblNoEntriesDesc: 'Add a new income or expense transaction to manage entries in the cash book.',
    tblTotals: 'Totals',
    tblBookingsCount: 'Entries',
    btnViewDoc: 'View',
    btnEdit: 'Edit',
    btnDelete: 'Delete',
    docAvailable: 'Attached',

    // Entry Form
    formAddIncomeTitle: 'Record Income',
    formAddExpenseTitle: 'Record Expense',
    formEditIncomeTitle: 'Edit Income',
    formEditExpenseTitle: 'Edit Expense',
    formCurrentBalance: 'Available Balance:',
    formHistoricalNotice: 'Historical Entry: Cash balances will be automatically recalculated in chronological order.',
    formInsufficientBalance: 'Insufficient cash balance. This expense cannot be saved because the available cash balance is lower than the entered expense amount.',
    lblDate: 'Date',
    btnSelectToday: 'Select Today',
    lblVoucherNo: 'Voucher Number',
    placeholderVoucherNo: 'e.g. INV-2026-001',
    lblBookingRule: 'Booking Rule',
    selectBookingRulePlaceholder: '-- Select Booking Rule --',
    addNewBookingRuleOption: '+ Add New Rule...',
    placeholderNewRule: 'Enter new booking rule...',
    btnAdd: 'Add',
    lblBookingText: 'Booking Text',
    placeholderBookingText: 'Transaction details (Invoice number, supplier, reference...)',
    lblIncomeAmount: 'Income Amount (€)',
    lblExpenseAmount: 'Expense Amount (€)',
    lblVat: 'VAT',
    lblUploadDoc: 'Upload Document / Receipt (optional)',
    uploadDragDrop: 'Click or drag file here',
    uploadFormats: 'PDF, JPG, PNG (max. 10 MB)',
    uploadSelectNew: '(Choose new document)',
    btnCancel: 'Cancel',
    btnSave: 'Save Entry',
    btnUpdate: 'Update Entry',
    btnSaving: 'Saving...',
    msgVoucherNoRequired: 'Please enter a voucher number (e.g. INV-2026-001).',
    msgBookingRuleRequired: 'Please select a booking rule.',
    msgAmountRequired: 'Please enter a valid amount greater than 0.',

    // Opening Balance Modal
    modalOpeningBalanceTitle: 'Set Opening Balance',
    modalOpeningBalanceSubtitle: 'Cash Book Opening Entry',
    modalOpeningBalanceDesc: 'The opening balance represents the available cash amount before daily income and expense transactions are recorded.',
    lblOpeningBalanceAmount: 'Opening Balance (€)',

    // Delete Modal
    modalDeleteTitle: 'Delete Entry',
    modalDeleteDesc: 'Are you sure you want to delete this entry from the cash book?',
    modalDeleteWarning: 'Important Notice: Cash balances will be automatically recalculated for all subsequent chronological entries.',
    btnDeleteConfirm: 'Delete Entry',
    btnDeleting: 'Deleting...',

    // Document Viewer
    docViewerDownload: 'Download',
    docViewerNoPreview: 'Preview not available for this file format.',
    docViewerDownloadFile: 'Download File',

    // Monthly Report
    monthlyReportTitle: 'Monthly Report',
    cardMonthStartBalance: 'Opening Balance (Month)',
    cardTotalIncome: 'Total Income',
    cardTotalExpense: 'Total Expenses',
    cardMonthBalance: 'Net Balance',
    cardMonthEndBalance: 'Closing Balance',
    noMonthlyEntries: 'No transactions found for this month',

    // Annual Report
    annualReportTitle: 'Annual Report',
    annualReportSubtitle: 'Comprehensive annual overview and monthly breakdown',
    cardYearIncome: 'Annual Income',
    cardYearExpense: 'Annual Expenses',
    cardYearBalance: 'Annual Net Balance',
    chartTitle: 'Monthly Income vs. Expense Trend',
    fiscalYear: 'Fiscal Year',
    noAnnualEntries: 'No transactions recorded for this fiscal year.',

    // Settings Page
    settingsTitle: 'System Settings',
    settingsSubtitle: 'Configuration for Cash Book, DATEV export, and booking rules',
    secCashBookSettings: '📋 Cash Book Opening Balance',
    lblOpeningBalanceDate: 'Opening Balance Date',
    btnSaveOpeningBalance: 'Save Opening Balance',
    secBookingRules: '📑 Booking Rules & Categories',
    badgeDefaultRule: 'Default',
    btnAddRule: 'Add Rule',
    secDatev: '🏢 DATEV Configuration',
    lblAdvisorNum: 'Advisor Number (Beraternummer)',
    lblClientNum: 'Client Number (Mandantennummer)',
    lblChartOfAccounts: 'Chart of Accounts',
    descSkr04: 'Account 1000 (Cash) — Industrial Chart SKR04',
    descSkr03: 'Account 1600 (Cash) — Standard Chart SKR03',
    btnSaveDatev: 'Save DATEV Settings',
    secYearFinalization: '🔒 Fiscal Year Finalization (Lock)',
    descYearFinalization: 'Finalizing a fiscal year locks all transactions for that year in read-only mode. No entries can be added, edited, or deleted.',
    lblSelectYearToFinalize: 'Select Fiscal Year to Finalize',
    btnFinalizeYear: 'Lock Fiscal Year',
    btnUnfinalizeYear: 'Unlock Fiscal Year',
    finalizedYearsList: 'Finalized Fiscal Years:',
    noneFinalized: 'No fiscal years finalized yet.',
    yearFinalizedBadge: 'Fiscal Year {year} Finalized (Read-Only)',
    confirmFinalizeTitle: 'Finalize Fiscal Year {year}?',
    confirmFinalizeDesc: 'Are you sure you want to lock fiscal year {year}? Once finalized, transactions for this year cannot be modified.',
    confirmUnlockTitle: 'Unlock Fiscal Year {year}?',
    confirmUnlockDesc: 'Are you sure you want to unlock fiscal year {year} to allow modifications?',

    // User Management Page
    userMgmtTitle: 'User Management',
    userMgmtSubtitle: 'Manage roles and system permissions',
    usersCount: 'Users',
    btnAddUser: 'Add User',
    thUser: 'User',
    thEmail: 'Email',
    thRole: 'Role',
    thStatus: 'Status',
    roleAdmin: 'Administrator',
    roleAccountant: 'Accountant',
    roleViewer: 'Viewer',
    statusActive: 'Active',
    statusInactive: 'Disabled',
    noUsersFound: 'No users found in the system',
    modalAddUserTitle: 'Create New User',
    modalEditUserTitle: 'Edit User',
    lblName: 'Full Name',
    lblEmail: 'Email Address',
    lblPassword: 'Initial Password',
    lblPasswordOptional: 'New Password (leave empty to keep unchanged)',
    lblUserRole: 'User Role',
    btnSaveUser: 'Save User',

    // Audit Log Page
    auditLogTitle: 'Audit Log',
    auditLogSubtitle: 'Complete traceability and history of all cash book and system modifications',
    auditEntriesCount: 'Entries',
    thTimestamp: 'Timestamp',
    thAction: 'Action',
    thCategory: 'Category',
    thDescription: 'Description',
    noAuditEntries: 'No audit records found',
    actCreate: 'Created',
    actUpdate: 'Updated',
    actDelete: 'Deleted',
    actFinalize: 'Finalized',
    actLogin: 'Login',
    catEntry: 'Entry',
    catBookingRule: 'Booking Rule',
    catUser: 'User',
    catSettings: 'Settings',
    catMonth: 'Month',
    catYear: 'Year',
    pageOf: 'Page {page} of {total}',
    totalActions: 'Total actions',

    // Login Page
    loginTitle: 'Sign In',
    loginSslSecured: 'SSL Secured',
    loginEmailLabel: 'Email Address',
    loginPasswordLabel: 'Password',
    btnLogin: 'Sign In to Cash Book',
    loginAuthenticating: 'Authenticating...',
    defaultAccess: 'Default Admin:',
    defaultPassword: 'Password: Admin@1234',
    accountDisabled: 'Your account has been disabled by an administrator. Please contact your administrator.',

    // Months (Full)
    months: [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ],
    // Months (Short)
    monthsShort: [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ]
  }
};

export type TranslationKey = keyof typeof translations.de;

/**
 * Bilingual translator for the 14 standard booking rules
 */
export const DEFAULT_BOOKING_RULES_TRANSLATIONS: Record<string, { de: string; en: string }> = {
  'Cash from Bank (Deposit)': { de: 'Bargeld von Bank (Einzahlung in Kasse)', en: 'Cash from Bank (Cash In / Inflow)' },
  'Cash from Bank (Cash In / Inflow)': { de: 'Bargeld von Bank (Einzahlung in Kasse)', en: 'Cash from Bank (Cash In / Inflow)' },
  'Cash to Bank (Withdrawal)': { de: 'Bargeld an Bank (Auszahlung aus Kasse)', en: 'Cash to Bank (Cash Out / Outflow)' },
  'Cash to Bank (Cash Out / Outflow)': { de: 'Bargeld an Bank (Auszahlung aus Kasse)', en: 'Cash to Bank (Cash Out / Outflow)' },
  'Cash Customer Invoice Receipt': { de: 'Barverkauf / Kundenrechnung', en: 'Cash Customer Invoice Receipt' },
  'Supplier Invoice Payment': { de: 'Lieferantenrechnung Barzahlung', en: 'Supplier Invoice Payment' },
  'Postage / Stamps': { de: 'Post / Briefmarken', en: 'Postage / Stamps' },
  'Shipping / Freight 19%': { de: 'Fracht / Versand 19%', en: 'Shipping / Freight 19%' },
  'Office Materials 19%': { de: 'Büromaterial 19%', en: 'Office Materials 19%' },
  'Office Materials 7%': { de: 'Büromaterial 7%', en: 'Office Materials 7%' },
  'Other Costs 19%': { de: 'Sonstige Kosten 19%', en: 'Other Costs 19%' },
  'Other Costs 7%': { de: 'Sonstige Kosten 7%', en: 'Other Costs 7%' },
  'Hospitality 19%': { de: 'Bewirtung 19%', en: 'Hospitality 19%' },
  'Vehicle (Fuel, Washing) 19%': { de: 'KFZ (Benzin, Wäsche) 19%', en: 'Vehicle (Fuel, Washing) 19%' },
  'Travel Expenses 19%': { de: 'Reisekosten 19%', en: 'Travel Expenses 19%' },
  'Lottery Cash Deposit': { de: 'Lotto-Bareinzahlung', en: 'Lottery Cash Deposit' }
};

export function translateBookingRuleName(name: string, lang: Language): string {
  if (!name) return '';
  const match = DEFAULT_BOOKING_RULES_TRANSLATIONS[name];
  if (match) return match[lang] || name;
  for (const entry of Object.values(DEFAULT_BOOKING_RULES_TRANSLATIONS)) {
    if (entry.de.toLowerCase() === name.toLowerCase() || entry.en.toLowerCase() === name.toLowerCase()) {
      return entry[lang] || name;
    }
  }
  return name;
}
