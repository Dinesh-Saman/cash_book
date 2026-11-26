import mongoose, { Document, Schema } from 'mongoose';

export interface IEnabledModules {
  cashBook: boolean;
  monthlyReports: boolean;
  annualReport: boolean;
  bank: boolean;
  invoices: boolean;
  settings: boolean;
}

export interface ISettings extends Document {
  openingBalance: number;
  openingBalanceDate?: Date;
  cashAccount?: string;
  datevAdvisorNumber?: string;
  datevClientNumber?: string;
  datevChartOfAccounts: 'SKR03' | 'SKR04';
  currentYear?: number;
  isYearFinalized: boolean;
  finalizedYears: number[];
  lockedMonths: string[];
  unlockedMonths: string[];
  enabledModules?: IEnabledModules;
  updatedAt: Date;
}

const settingsSchema = new Schema<ISettings>({
  openingBalance: { type: Number, default: 0 },
  openingBalanceDate: { type: Date },
  cashAccount: { type: String, default: '1000' },
  datevAdvisorNumber: { type: String },
  datevClientNumber: { type: String },
  datevChartOfAccounts: { type: String, enum: ['SKR03', 'SKR04'], default: 'SKR03' },
  currentYear: { type: Number },
  isYearFinalized: { type: Boolean, default: false },
  finalizedYears: { type: [Number], default: [] },
  lockedMonths: { type: [String], default: [] },
  unlockedMonths: { type: [String], default: [] },
  enabledModules: {
    cashBook: { type: Boolean, default: true },
    monthlyReports: { type: Boolean, default: true },
    annualReport: { type: Boolean, default: true },
    bank: { type: Boolean, default: true },
    invoices: { type: Boolean, default: true },
    settings: { type: Boolean, default: true },
  },
}, { timestamps: true });

export const Settings = mongoose.model<ISettings>('Settings', settingsSchema);
