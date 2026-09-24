import mongoose, { Document, Schema } from 'mongoose';
import { IUser } from './User';

export interface IBookingRule extends Document {
  /** Unique, auto-incremented rule number. Permanent — cannot be changed after assignment. */
  ruleNumber: number;
  name: string;
  isActive: boolean;
  isDefault: boolean;
  defaultVat?: 0 | 7 | 19;
  /** Contra-account (Gegenkonto) for SKR03 (e.g. 1200, 8400, 4930) */
  accountSKR03?: string;
  /** Contra-account (Gegenkonto) for SKR04 (e.g. 1800, 4400, 6815) */
  accountSKR04?: string;
  createdBy?: IUser['_id'];
  createdAt: Date;
  updatedAt: Date;
}

const bookingRuleSchema = new Schema<IBookingRule>({
  ruleNumber: { type: Number, unique: true, sparse: true },
  name: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  isDefault: { type: Boolean, default: false },
  defaultVat: { type: Number, enum: [0, 7, 19], default: 0 },
  accountSKR03: { type: String, default: '' },
  accountSKR04: { type: String, default: '' },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

export const BookingRule = mongoose.model<IBookingRule>('BookingRule', bookingRuleSchema);
