import { AuditLog } from '../models/AuditLog';

interface AuditLogParams {
  action: string;
  entityType: 'entry' | 'booking_rule' | 'user' | 'settings' | 'month' | 'year';
  entityId?: string;
  description: string;
  performedBy: string;
  metadata?: any;
}

export async function logAction(params: AuditLogParams): Promise<void> {
  await AuditLog.create(params);
}
