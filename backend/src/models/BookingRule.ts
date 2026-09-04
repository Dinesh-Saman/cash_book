import mongoose, { Document, Schema } from 'mongoose';
import { IUser } from './User';

export interface IBookingRule extends Document {
  name: string;
  isActive: boolean;
  isDefault: boolean;
  defaultVat?: 0 | 7 | 19;
  createdBy?: IUser['_id'];
  createdAt: Date;
  updatedAt: Date;
}

const bookingRuleSchema = new Schema<IBookingRule>({
  name: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  isDefault: { type: Boolean, default: false },
  defaultVat: { type: Number, enum: [0, 7, 19], default: 0 },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

export const BookingRule = mongoose.model<IBookingRule>('BookingRule', bookingRuleSchema);
