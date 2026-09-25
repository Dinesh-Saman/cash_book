import mongoose, { Document, Schema } from 'mongoose';
import { IBookingRule } from './BookingRule';
import { IUser } from './User';

export interface IEntryDocument {
  path: string;
  originalName: string;
  mimeType: string;
}

export interface ICashBookEntry extends Document {
  date: Date;
  voucherNo: string;
  bookingRule: IBookingRule['_id'];
  bookingText: string;
  type: 'income' | 'expense';
  amount: number;
  vatPercentage: 0 | 7 | 19;
  cashBalance: number;
  /** @deprecated use documents[] instead — kept for backward compatibility */
  documentPath?: string;
  /** @deprecated use documents[] instead — kept for backward compatibility */
  documentOriginalName?: string;
  /** All attached documents for this entry */
  documents: IEntryDocument[];
  /** Contra-account / Column H (Gegenkonto Spalte H in DATEV, e.g. 1800, 1200, 8400) */
  contraAccount?: string;
  /** Direct alias for Column H */
  columnH?: string;
  isDeleted: boolean;
  createdBy: IUser['_id'];
  updatedBy?: IUser['_id'];
  year: number;
  month: number;
  createdAt: Date;
  updatedAt: Date;
}

const entryDocumentSchema = new Schema<IEntryDocument>(
  {
    path: { type: String, required: true },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
  },
  { _id: false }
);

const cashBookEntrySchema = new Schema<ICashBookEntry>({
  date: { type: Date, required: true },
  voucherNo: { type: String, default: '' },
  bookingRule: { type: Schema.Types.ObjectId, ref: 'BookingRule', required: true },
  bookingText: { type: String, required: true },
  type: { type: String, enum: ['income', 'expense'], required: true },
  amount: { type: Number, required: true },
  vatPercentage: { type: Number, enum: [0, 7, 19], required: true },
  cashBalance: { type: Number, required: true },
  // Contra-account / Column H (Spalte H)
  contraAccount: { type: String, default: '' },
  columnH: { type: String, default: '' },
  // Legacy single-document fields (preserved for backward compatibility)
  documentPath: { type: String },
  documentOriginalName: { type: String },
  // New multi-document array
  documents: { type: [entryDocumentSchema], default: [] },
  isDeleted: { type: Boolean, default: false },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  year: { type: Number, required: true },
  month: { type: Number, required: true },
}, { timestamps: true });

// Performance indexes for rapid sorting and filtering
cashBookEntrySchema.index({ isDeleted: 1, date: 1, createdAt: 1 });
cashBookEntrySchema.index({ isDeleted: 1, year: 1, month: 1 });
cashBookEntrySchema.index({ isDeleted: 1, voucherNo: 1 });

export const CashBookEntry = mongoose.model<ICashBookEntry>('CashBookEntry', cashBookEntrySchema);
