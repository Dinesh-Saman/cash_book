import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUserPermissions {
  canAddIncome: boolean;
  canAddExpense: boolean;
  canEditEntry: boolean;
  canDeleteEntry: boolean;
  canExportReports: boolean;
  canManageSettings: boolean;
}

export function getDefaultPermissions(role: string): IUserPermissions {
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

export interface IUser extends Document {
  name: string;
  email: string;
  password?: string;
  role: 'admin' | 'accountant' | 'viewer';
  isActive: boolean;
  permissions: IUserPermissions;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'accountant', 'viewer'], default: 'viewer' },
  isActive: { type: Boolean, default: true },
  permissions: {
    canAddIncome: { type: Boolean, default: true },
    canAddExpense: { type: Boolean, default: true },
    canEditEntry: { type: Boolean, default: true },
    canDeleteEntry: { type: Boolean, default: true },
    canExportReports: { type: Boolean, default: true },
    canManageSettings: { type: Boolean, default: false },
  },
}, { timestamps: true });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

export const User = mongoose.model<IUser>('User', userSchema);
