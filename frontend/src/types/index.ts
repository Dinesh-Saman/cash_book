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

export interface CashBookEntry {
  _id: string;
  date: string;
  voucherNo: string;
  bookingRule: { _id: string; name: string };
  bookingText: string;
  type: 'income' | 'expense';
  amount: number;
  vatPercentage: 0 | 7 | 19;
  cashBalance: number;
  documentPath?: string;
  documentOriginalName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BookingRule {
  _id: string;
  name: string;
  isDefault: boolean;
  defaultVat?: 0 | 7 | 19;
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
