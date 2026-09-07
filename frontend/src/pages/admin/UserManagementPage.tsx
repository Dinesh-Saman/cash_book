import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus,
  Edit2,
  UserX,
  UserCheck,
  X,
  Save,
  Eye,
  EyeOff,
  Shield,
  Check,
  RotateCcw,
  FileDown,
  Settings,
  PlusCircle,
  MinusCircle,
  FileEdit,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { usersApi } from '../../lib/api';
import { getDefaultPermissions, type User, type UserPermissions } from '../../types';
import { useTranslation } from '../../store/languageStore';
import { useAuthStore } from '../../store/authStore';

interface UserForm {
  name: string;
  email: string;
  password: string;
  role: string;
  permissions: UserPermissions;
}

interface PermissionItem {
  key: keyof UserPermissions;
  labelKey: string;
  descKey: string;
  shortLabelKey: string;
  icon: LucideIcon;
  color: string;
  activeBg: string;
  activeText: string;
  activeBorder: string;
}

export default function UserManagementPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState<UserForm>({
    name: '',
    email: '',
    password: '',
    role: 'accountant',
    permissions: getDefaultPermissions('accountant'),
  });
  const [isSaving, setIsSaving] = useState(false);
  const { t } = useTranslation();

  const PERMISSION_CONFIG: PermissionItem[] = [
    {
      key: 'canAddIncome',
      labelKey: 'permAddIncome',
      descKey: 'permAddIncomeDesc',
      shortLabelKey: 'permShortIncome',
      icon: PlusCircle,
      color: 'emerald',
      activeBg: 'bg-emerald-50 text-emerald-700',
      activeText: 'text-emerald-700',
      activeBorder: 'border-emerald-300',
    },
    {
      key: 'canAddExpense',
      labelKey: 'permAddExpense',
      descKey: 'permAddExpenseDesc',
      shortLabelKey: 'permShortExpense',
      icon: MinusCircle,
      color: 'rose',
      activeBg: 'bg-rose-50 text-rose-700',
      activeText: 'text-rose-700',
      activeBorder: 'border-rose-300',
    },
    {
      key: 'canEditEntry',
      labelKey: 'permEditEntry',
      descKey: 'permEditEntryDesc',
      shortLabelKey: 'permShortEdit',
      icon: FileEdit,
      color: 'blue',
      activeBg: 'bg-blue-50 text-blue-700',
      activeText: 'text-blue-700',
      activeBorder: 'border-blue-300',
    },
    {
      key: 'canDeleteEntry',
      labelKey: 'permDeleteEntry',
      descKey: 'permDeleteEntryDesc',
      shortLabelKey: 'permShortDelete',
      icon: Trash2,
      color: 'amber',
      activeBg: 'bg-amber-50 text-amber-700',
      activeText: 'text-amber-700',
      activeBorder: 'border-amber-300',
    },
    {
      key: 'canExportReports',
      labelKey: 'permExportReports',
      descKey: 'permExportReportsDesc',
      shortLabelKey: 'permShortExport',
      icon: FileDown,
      color: 'indigo',
      activeBg: 'bg-indigo-50 text-indigo-700',
      activeText: 'text-indigo-700',
      activeBorder: 'border-indigo-300',
    },
    {
      key: 'canManageSettings',
      labelKey: 'permManageSettings',
      descKey: 'permManageSettingsDesc',
      shortLabelKey: 'permShortSettings',
      icon: Settings,
      color: 'purple',
      activeBg: 'bg-purple-50 text-purple-700',
      activeText: 'text-purple-700',
      activeBorder: 'border-purple-300',
    },
  ];

  const ROLES: { value: string; label: string; color: string }[] = [
    {
      value: 'admin',
      label: t('roleAdmin'),
      color: 'bg-purple-50 text-purple-700 border border-purple-200/80 font-bold',
    },
    {
      value: 'accountant',
      label: t('roleAccountant'),
      color: 'bg-brand-50 text-brand-700 border border-brand-200/80 font-bold',
    },
    {
      value: 'viewer',
      label: t('roleViewer'),
      color: 'bg-slate-100 text-slate-700 border border-slate-200 font-semibold',
    },
  ];

  const roleInfo = (role: string) => ROLES.find((r) => r.value === role) || ROLES[2];

  const fetchUsers = () => {
    setIsLoading(true);
    usersApi
      .getAll()
      .then((res) => setUsers(res.data.data))
      .catch(() => toast.error('Fehler beim Laden / Error loading'))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const openAdd = () => {
    setEditingUser(null);
    setForm({
      name: '',
      email: '',
      password: '',
      role: 'accountant',
      permissions: getDefaultPermissions('accountant'),
    });
    setShowPassword(false);
    setShowModal(true);
  };

  const openEdit = (user: User) => {
    setEditingUser(user);
    const userPerms = user.permissions
      ? { ...getDefaultPermissions(user.role), ...user.permissions }
      : getDefaultPermissions(user.role);

    setForm({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      permissions: userPerms,
    });
    setShowPassword(false);
    setShowModal(true);
  };

  const handleRoleChange = (newRole: string) => {
    setForm((prev) => ({
      ...prev,
      role: newRole,
      permissions: getDefaultPermissions(newRole),
    }));
  };

  const handleTogglePermission = (key: keyof UserPermissions) => {
    setForm((prev) => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [key]: !prev.permissions[key],
      },
    }));
  };

  const handleSelectAll = () => {
    setForm((prev) => ({
      ...prev,
      permissions: {
        canAddIncome: true,
        canAddExpense: true,
        canEditEntry: true,
        canDeleteEntry: true,
        canExportReports: true,
        canManageSettings: true,
      },
    }));
  };

  const handleDeselectAll = () => {
    setForm((prev) => ({
      ...prev,
      permissions: {
        canAddIncome: false,
        canAddExpense: false,
        canEditEntry: false,
        canDeleteEntry: false,
        canExportReports: false,
        canManageSettings: false,
      },
    }));
  };

  const handleResetDefaults = () => {
    setForm((prev) => ({
      ...prev,
      permissions: getDefaultPermissions(prev.role),
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (editingUser) {
        const updateData: any = {
          name: form.name,
          email: form.email,
          role: form.role,
          permissions: form.permissions,
        };
        if (form.password) updateData.password = form.password;
        const res = await usersApi.update(editingUser._id, updateData);

        // Update local auth store if editing current logged-in user
        const currentUser = useAuthStore.getState().user;
        if (currentUser && currentUser._id === editingUser._id) {
          useAuthStore.getState().setUser(res.data.data);
        }

        toast.success(t('btnUpdate'));
      } else {
        if (!form.password) {
          toast.error(t('lblPassword'));
          setIsSaving(false);
          return;
        }
        await usersApi.create(form as any);
        toast.success(t('btnSaveUser'));
      }
      fetchUsers();
      setShowModal(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Fehler beim Speichern');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (user: User) => {
    try {
      await usersApi.update(user._id, { isActive: !user.isActive } as any);
      fetchUsers();
      toast.success(user.isActive ? t('statusInactive') : t('statusActive'));
    } catch {
      toast.error('Fehler / Error');
    }
  };

  const inputClass =
    'w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600 placeholder-slate-400 shadow-xs';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {t('userMgmtTitle')}
          </h1>
          <p className="text-slate-500 text-sm mt-0.5 font-medium">
            {t('userMgmtSubtitle')} ({users.length} {t('usersCount')})
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white rounded-xl text-sm font-bold shadow-brand transition-all"
        >
          <Plus size={16} className="stroke-[2.5]" />
          {t('btnAddUser')}
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse min-w-[820px]">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200">
                {[
                  t('thUser'),
                  t('thEmail'),
                  t('thRole'),
                  t('thPermissions'),
                  t('thStatus'),
                  t('thActions'),
                ].map((h) => (
                  <th
                    key={h}
                    className="px-5 py-3.5 text-xs font-bold text-slate-700 uppercase tracking-wider whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={6} className="px-5 py-4">
                      <div className="h-5 bg-slate-200/70 rounded-md animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-400">
                    {t('noUsersFound')}
                  </td>
                </tr>
              ) : (
                users.map((user, idx) => {
                  const r = roleInfo(user.role);
                  const userPerms = user.permissions
                    ? { ...getDefaultPermissions(user.role), ...user.permissions }
                    : getDefaultPermissions(user.role);

                  const activeKeys = PERMISSION_CONFIG.filter((p) => userPerms[p.key]);
                  const activeCount = activeKeys.length;

                  return (
                    <tr
                      key={user._id}
                      className={`hover:bg-brand-50/30 transition-colors ${
                        idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'
                      }`}
                    >
                      {/* User Info */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl purple-blue-gradient text-white flex items-center justify-center font-bold text-sm shadow-xs flex-shrink-0">
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-bold text-slate-900">{user.name}</span>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="px-5 py-3.5 text-slate-600 text-xs font-medium whitespace-nowrap">
                        {user.email}
                      </td>

                      {/* Role */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs ${r.color}`}>
                          {r.label}
                        </span>
                      </td>

                      {/* Permissions Display */}
                      <td className="px-5 py-3.5">
                        {activeCount === 0 ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-500 border border-slate-200 rounded-lg text-xs font-semibold">
                            {t('badgeReadOnly')} (0/6)
                          </span>
                        ) : (
                          <div className="grid grid-cols-3 gap-1.5 w-[312px]">
                            {activeKeys.map((p) => (
                              <span
                                key={p.key}
                                className={`w-[100px] inline-flex items-center justify-center gap-1 px-1 py-1 rounded-lg text-[10.5px] font-semibold border text-center whitespace-nowrap shadow-2xs ${p.activeBg} ${p.activeBorder}`}
                              >
                                {t(p.shortLabelKey as any)}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            user.isActive
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {user.isActive ? t('statusActive') : t('statusInactive')}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => openEdit(user)}
                            className="p-1.5 text-slate-500 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors border border-transparent hover:border-brand-200"
                            title={t('btnEdit')}
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            onClick={() => handleToggleActive(user)}
                            className={`p-1.5 rounded-lg transition-colors border border-transparent ${
                              user.isActive
                                ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200'
                                : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 hover:border-emerald-200'
                            }`}
                            title={user.isActive ? t('statusInactive') : t('statusActive')}
                          >
                            {user.isActive ? <UserX size={15} /> : <UserCheck size={15} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto max-h-[92vh] flex flex-col">
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-brand-100 bg-brand-50/60 flex-shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-brand-600 text-white flex items-center justify-center shadow-xs">
                    <Shield size={16} />
                  </div>
                  <div>
                    <h2 className="font-bold text-slate-900 text-sm sm:text-base">
                      {editingUser ? t('modalEditUserTitle') : t('modalAddUserTitle')}
                    </h2>
                    {editingUser && (
                      <p className="text-xs text-brand-700 font-medium">
                        {editingUser.email}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-1.5 rounded-lg transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Form */}
              <form onSubmit={handleSave} className="p-6 space-y-5 overflow-y-auto flex-1">
                {/* Name & Email Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {t('lblName')} <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                      className={inputClass}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {t('lblEmail')} <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                      className={inputClass}
                      required
                    />
                  </div>
                </div>

                {/* Password & Role Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {editingUser ? t('lblPasswordOptional') : t('lblPassword')}{' '}
                      {!editingUser && <span className="text-rose-500">*</span>}
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={form.password}
                        onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                        className={`${inputClass} pr-10`}
                        required={!editingUser}
                        placeholder={editingUser ? '••••••••' : ''}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((p) => !p)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {t('lblUserRole')} <span className="text-rose-500">*</span>
                    </label>
                    <div className="flex gap-2">
                      {ROLES.map((r) => (
                        <button
                          key={r.value}
                          type="button"
                          onClick={() => handleRoleChange(r.value)}
                          className={`flex-1 py-2 px-1 rounded-xl text-xs font-bold border transition-all truncate ${
                            form.role === r.value
                              ? 'bg-brand-600 border-brand-600 text-white shadow-brand'
                              : 'bg-white border-slate-200 text-slate-700 hover:border-brand-400 hover:text-brand-600'
                          }`}
                        >
                          {r.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Customizable Permissions Section */}
                <div className="pt-2 border-t border-slate-100">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Shield size={16} className="text-brand-600" />
                        <h3 className="text-sm font-bold text-slate-900">
                          {t('lblPermissions')}
                        </h3>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {t('lblPermissionsDesc')}
                      </p>
                    </div>

                    {/* Quick Action Buttons */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={handleSelectAll}
                        className="px-2.5 py-1 text-[11px] font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200 rounded-lg transition-colors"
                      >
                        {t('btnSelectAll')}
                      </button>
                      <button
                        type="button"
                        onClick={handleDeselectAll}
                        className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors"
                      >
                        {t('btnDeselectAll')}
                      </button>
                      <button
                        type="button"
                        onClick={handleResetDefaults}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors"
                        title={t('btnResetDefaults')}
                      >
                        <RotateCcw size={11} />
                        {t('btnResetDefaults')}
                      </button>
                    </div>
                  </div>

                  {/* 6 Permission Checkboxes Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {PERMISSION_CONFIG.map((p) => {
                      const isChecked = !!form.permissions[p.key];
                      const IconComponent = p.icon;

                      return (
                        <div
                          key={p.key}
                          onClick={() => handleTogglePermission(p.key)}
                          className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer select-none transition-all ${
                            isChecked
                              ? 'bg-brand-50/40 border-brand-300 shadow-2xs'
                              : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                          }`}
                        >
                          {/* Custom Checkbox */}
                          <div className="pt-0.5 flex-shrink-0">
                            <div
                              className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                                isChecked
                                  ? 'bg-brand-600 border-brand-600 text-white'
                                  : 'bg-white border-slate-300'
                              }`}
                            >
                              {isChecked && <Check size={14} className="stroke-[3]" />}
                            </div>
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <IconComponent size={14} className={isChecked ? p.activeText : 'text-slate-400'} />
                              <span
                                className={`text-xs font-bold leading-none ${
                                  isChecked ? 'text-slate-900' : 'text-slate-600'
                                }`}
                              >
                                {t(p.labelKey as any)}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                              {t(p.descKey as any)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex gap-3 pt-3 border-t border-slate-100 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold transition-colors"
                  >
                    {t('btnCancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex-1 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold shadow-brand flex items-center justify-center gap-2 transition-colors"
                  >
                    <Save size={15} />
                    {isSaving ? t('btnSaving') : t('btnSaveUser')}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
