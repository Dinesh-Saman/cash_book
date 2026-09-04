import mongoose, { Document, Schema } from 'mongoose';
import { IUser } from './User';

export interface IAuditLog extends Document {
  action: string;
  entityType: 'entry' | 'booking_rule' | 'user' | 'settings' | 'month' | 'year';
  entityId?: string;
  description: string;
  performedBy: IUser['_id'];
  performedAt: Date;
  metadata?: any;
}

const auditLogSchema = new Schema<IAuditLog>({
  action: { type: String, required: true },
  entityType: { type: String, enum: ['entry', 'booking_rule', 'user', 'settings', 'month', 'year'], required: true },
  entityId: { type: String },
  description: { type: String, required: true },
  performedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  performedAt: { type: Date, default: Date.now },
  metadata: { type: Schema.Types.Mixed },
});

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', auditLogSchema);
