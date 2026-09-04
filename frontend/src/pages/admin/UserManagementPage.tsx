import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Edit2, UserX, UserCheck, X, Save, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { usersApi } from '../../lib/api';
import type { User } from '../../types';
import { useTranslation } from '../../store/languageStore';

interface UserForm {
  name: string;
  email: string;
  password: string;
  role: string;
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
  });
  const [isSaving, setIsSaving] = useState(false);
  const { t } = useTranslation();

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
    setForm({ name: '', email: '', password: '', role: 'accountant' });
    setShowModal(true);
  };

  const openEdit = (user: User) => {
    setEditingUser(user);
    setForm({ name: user.name, email: user.email, password: '', role: user.role });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (editingUser) {
        const updateData: Partial<UserForm> = {
          name: form.name,
          email: form.email,
          role: form.role,
        };
        if (form.password) (updateData as any).password = form.password;
        await usersApi.update(editingUser._id, updateData as any);
        toast.success(t('btnUpdate'));
      } else {
        if (!form.password) {
          toast.error(t('lblPassword'));
          setIsSaving(false);
          return;
        }
        await usersApi.create(form);
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
        <table className="w-full text-sm text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-200">
              {[t('thUser'), t('thEmail'), t('thRole'), t('thStatus'), t('thActions')].map((h) => (
                <th
                  key={h}
                  className="px-5 py-3.5 text-xs font-bold text-slate-700 uppercase tracking-wider"
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
                  <td colSpan={5} className="px-5 py-4">
                    <div className="h-5 bg-slate-200/70 rounded-md animate-pulse" />
                  </td>
                </tr>
              ))
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center text-slate-400">
                  {t('noUsersFound')}
                </td>
              </tr>
            ) : (
              users.map((user, idx) => {
                const r = roleInfo(user.role);
                return (
                  <tr
                    key={user._id}
                    className={`hover:bg-brand-50/30 transition-colors ${
                      idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'
                    }`}
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl purple-blue-gradient text-white flex items-center justify-center font-bold text-sm shadow-xs flex-shrink-0">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-bold text-slate-900">{user.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 text-xs font-medium">
                      {user.email}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs ${r.color}`}>
                        {r.label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
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
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => openEdit(user)}
                          className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                          title={t('btnEdit')}
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={() => handleToggleActive(user)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            user.isActive
                              ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                              : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
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

      {/* Add/Edit Modal */}
      {showModal &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-brand-100 bg-brand-50/50">
              <h2 className="font-bold text-slate-900 text-sm sm:text-base">
                {editingUser ? t('modalEditUserTitle') : t('modalAddUserTitle')}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-1.5 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
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
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {editingUser ? t('lblPasswordOptional') : t('lblPassword')}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                    className={`${inputClass} pr-10`}
                    required={!editingUser}
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
                      onClick={() => setForm((p) => ({ ...p, role: r.value }))}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
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
              <div className="flex gap-3 pt-3 border-t border-slate-100">
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
