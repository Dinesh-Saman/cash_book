import mongoose, { Document, Schema } from 'mongoose';

export interface ISettings extends Document {
  openingBalance: number;
  openingBalanceDate?: Date;
  datevAdvisorNumber?: string;
  datevClientNumber?: string;
  datevChartOfAccounts: 'SKR03' | 'SKR04';
  currentYear?: number;
  isYearFinalized: boolean;
  finalizedYears: number[];
  updatedAt: Date;
}

const settingsSchema = new Schema<ISettings>({
  openingBalance: { type: Number, default: 0 },
  openingBalanceDate: { type: Date },
  datevAdvisorNumber: { type: String },
  datevClientNumber: { type: String },
  datevChartOfAccounts: { type: String, enum: ['SKR03', 'SKR04'], default: 'SKR03' },
  currentYear: { type: Number },
  isYearFinalized: { type: Boolean, default: false },
  finalizedYears: { type: [Number], default: [] },
}, { timestamps: true });

export const Settings = mongoose.model<ISettings>('Settings', settingsSchema);
