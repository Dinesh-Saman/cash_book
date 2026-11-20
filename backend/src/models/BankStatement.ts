import mongoose, { Document, Schema } from 'mongoose';
import { IUser } from './User';

export interface IBankTransaction {
  id: string;
  bookingDate: string; // ISO format: YYYY-MM-DD
  rawDate: string; // Original format: e.g. 30.1.2026
  valutaDate?: string;
  transactionType?: string;
  company: string;
  purpose?: string;
  accountNumber: string;
  bic?: string;
  amount: number;
  currency: string;
  extractedInvoices?: string[];
}

export interface IBankStatementMetadata {
  fileName: string;
  fileSize: number;
  uploadedAt: string;
  accountName?: string;
  ownAccountNumber?: string;
  ownIban?: string;
  periodText?: string;
  lastBalance?: number;
  currency?: string;
  totalRecords: number;
}

export interface IBankStatement extends Document {
  fileName: string;
  fileSize: number;
  accountName?: string;
  ownAccountNumber?: string;
  ownIban?: string;
  periodText?: string;
  lastBalance?: number;
  currency?: string;
  totalRecords: number;
  metadata: IBankStatementMetadata;
  transactions: IBankTransaction[];
  uploadedBy?: IUser['_id'];
  createdAt: Date;
  updatedAt: Date;
}

const bankTransactionSchema = new Schema<IBankTransaction>(
  {
    id: { type: String, required: true },
    bookingDate: { type: String, required: true },
    rawDate: { type: String, required: true },
    valutaDate: { type: String },
    transactionType: { type: String },
    company: { type: String, required: true },
    purpose: { type: String },
    accountNumber: { type: String, default: '-' },
    bic: { type: String },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'EUR' },
    extractedInvoices: [{ type: String }],
  },
  { _id: false }
);

const bankStatementSchema = new Schema<IBankStatement>(
  {
    fileName: { type: String, required: true },
    fileSize: { type: Number, required: true },
    accountName: { type: String },
    ownAccountNumber: { type: String },
    ownIban: { type: String },
    periodText: { type: String },
    lastBalance: { type: Number },
    currency: { type: String, default: 'EUR' },
    totalRecords: { type: Number, default: 0 },
    metadata: { type: Schema.Types.Mixed, required: true },
    transactions: [bankTransactionSchema],
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Index to retrieve statements in reverse chronological order
bankStatementSchema.index({ createdAt: -1 });

export const BankStatement = mongoose.model<IBankStatement>('BankStatement', bankStatementSchema);
