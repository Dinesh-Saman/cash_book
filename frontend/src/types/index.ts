export interface UserPermissions {
  canAddIncome: boolean;
  canAddExpense: boolean;
  canEditEntry: boolean;
  canDeleteEntry: boolean;
  canExportReports: boolean;
  canManageSettings: boolean;
}

export function getDefaultPermissions(role: string): UserPermissions {
  switch (role) {
    case 'admin':
      return {
        canAddIncome: true,
        canAddExpense: true,
        canEditEntry: true,
        canDeleteEntry: true,
        canExportReports: true,
        canManageSettings: true,
      };
    case 'accountant':
      return {
        canAddIncome: true,
        canAddExpense: true,
        canEditEntry: true,
        canDeleteEntry: true,
        canExportReports: true,
        canManageSettings: false,
      };
    case 'viewer':
    default:
      return {
        canAddIncome: false,
        canAddExpense: false,
        canEditEntry: false,
        canDeleteEntry: false,
        canExportReports: true,
        canManageSettings: false,
      };
  }
}

export interface User {
  _id: string;
  name: string;
  email: string;
  role: 'admin' | 'accountant' | 'viewer';
  isActive: boolean;
  permissions?: UserPermissions;
}

export interface EntryDocument {
  path: string;
  originalName: string;
  mimeType: string;
}

export interface CashBookEntry {
  _id: string;
  date: string;
  voucherNo: string;
  bookingRule: {
    _id: string;
    name: string;
    accountSKR03?: string;
    accountSKR04?: string;
    ruleNumber?: number;
  };
  bookingText: string;
  type: 'income' | 'expense';
  amount: number;
  vatPercentage: 0 | 7 | 19;
  cashBalance: number;
  /** Contra-account / Column H (Gegenkonto Spalte H in DATEV, e.g. 1800, 1200, 8400) */
  contraAccount?: string;
  /** Direct alias for Column H */
  columnH?: string;
  /** @deprecated use documents[] */
  documentPath?: string;
  /** @deprecated use documents[] */
  documentOriginalName?: string;
  /** All attached documents */
  documents?: EntryDocument[];
  createdAt: string;
  updatedAt: string;
}

export interface BookingRule {
  _id: string;
  /** Unique, permanent rule number — auto-assigned, never changes */
  ruleNumber?: number;
  name: string;
  isDefault: boolean;
  defaultVat?: 0 | 7 | 19;
  /** Contra-account (Gegenkonto) for SKR03 (e.g. 1200, 8400, 4930) */
  accountSKR03?: string;
  /** Contra-account (Gegenkonto) for SKR04 (e.g. 1800, 4400, 6815) */
  accountSKR04?: string;
}

export interface Settings {
  _id: string;
  openingBalance: number;
  openingBalanceDate: string;
  datevAdvisorNumber: string;
  datevClientNumber: string;
  datevChartOfAccounts: 'SKR03' | 'SKR04';
  isYearFinalized: boolean;
  finalizedYears: number[];
}

export interface Summary {
  currentBalance: number;
  totalIncome: number;
  totalExpense: number;
  openingBalance: number;
}

export interface AuditLog {
  _id: string;
  action: string;
  entityType: string;
  description: string;
  performedBy: { name: string; email: string };
  performedAt: string;
  metadata: Record<string, unknown>;
}
