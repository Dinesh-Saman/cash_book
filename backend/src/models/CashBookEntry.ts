import mongoose, { Document, Schema } from 'mongoose';
import { IBookingRule } from './BookingRule';
import { IUser } from './User';

export interface ICashBookEntry extends Document {
  date: Date;
  voucherNo: string;
  bookingRule: IBookingRule['_id'];
  bookingText: string;
  type: 'income' | 'expense';
  amount: number;
  vatPercentage: 0 | 7 | 19;
  cashBalance: number;
  documentPath?: string;
  documentOriginalName?: string;
  isDeleted: boolean;
  createdBy: IUser['_id'];
  updatedBy?: IUser['_id'];
  year: number;
  month: number;
  createdAt: Date;
  updatedAt: Date;
}

const cashBookEntrySchema = new Schema<ICashBookEntry>({
  date: { type: Date, required: true },
  voucherNo: { type: String, default: '' },
  bookingRule: { type: Schema.Types.ObjectId, ref: 'BookingRule', required: true },
  bookingText: { type: String, required: true },
  type: { type: String, enum: ['income', 'expense'], required: true },
  amount: { type: Number, required: true },
  vatPercentage: { type: Number, enum: [0, 7, 19], required: true },
  cashBalance: { type: Number, required: true },
  documentPath: { type: String },
  documentOriginalName: { type: String },
  isDeleted: { type: Boolean, default: false },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  year: { type: Number, required: true },
  month: { type: Number, required: true },
}, { timestamps: true });

export const CashBookEntry = mongoose.model<ICashBookEntry>('CashBookEntry', cashBookEntrySchema);
