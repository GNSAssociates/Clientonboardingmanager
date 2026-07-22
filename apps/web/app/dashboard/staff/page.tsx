'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';

const ALL_ROLES = ['Admin', 'Partner', 'Manager', 'HR', 'OnboardingStaff', 'Reviewer', 'ComplianceOfficer'];

const ROLE_COLORS: Record<string, string> = {
  Admin: 'bg-red-50 text-red-700 border-red-200',
  Partner: 'bg-purple-50 text-purple-700 border-purple-200',
  Manager: 'bg-blue-50 text-blue-700 border-blue-200',
  HR: 'bg-amber-50 text-amber-700 border-amber-200',
  OnboardingStaff: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Reviewer: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  ComplianceOfficer: 'bg-indigo-50 text-indigo-700 border-indigo-200',
};

interface Staff {
  id: string;
  email: string;
  displayName: string | null;
  status: string;
  roles: string[];
  createdAt: string;
}

export default function StaffManagementPage() {
  const router = useRouter();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRoles, setNewRoles] = useState<string[]>(['OnboardingStaff']);
  const [editRoles, setEditRoles] = useState<string[]>([]);
  const [editPassword, setEditPassword] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/auth/staff');
      if (r.status === 403) { router.push('/dashboard'); return; }
      const data = await r.json();
      setStaff(Array.isArray(data) ? data : []);
    } catch { setMsg({ text: 'Failed to load staff.', ok: false }); }
    setLoading(false);
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    try {
      const r = await fetch('/api/auth/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail, displayName: newName, password: newPassword, roles: newRoles }),
      });
      const j = await r.json();
      if (r.ok) {
        setShowAdd(false);
        setNewEmail(''); setNewName(''); setNewPassword(''); setNewRoles(['OnboardingStaff']);
        setMsg({ text: 'Staff member added successfully.', ok: true });
        load();
      } else {
        setMsg({ text: j.message || 'Failed to add staff.', ok: false });
      }
    } catch { setMsg({ text: 'Network error.', ok: false }); }
  };

  const handleUpdate = async (userId: string) => {
    setMsg(null);
    const body: Record<string, unknown> = { userId };
    if (editRoles.length) body.roles = editRoles;
    if (editPassword) body.password = editPassword;
    try {
      const r = await fetch('/api/auth/staff', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (r.ok) {
        setEditId(null); setEditRoles([]); setEditPassword('');
        setMsg({ text: 'Staff updated.', ok: true });
        load();
      } else {
        const j = await r.json();
        setMsg({ text: j.message || 'Update failed.', ok: false });
      }
    } catch { setMsg({ text: 'Network error.', ok: false }); }
  };

  const handleToggleStatus = async (userId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'disabled' : 'active';
    try {
      await fetch('/api/auth/staff', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, status: newStatus }),
      });
      load();
    } catch {}
  };

  const handleDelete = async (userId: string, name: string) => {
    if (!confirm(`Are you sure you want to remove ${name}? This action cannot be undone.`)) return;
    try {
      await fetch('/api/auth/staff', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      setMsg({ text: 'Staff member removed.', ok: true });
      load();
    } catch { setMsg({ text: 'Failed to remove.', ok: false }); }
  };

  const toggleRole = (role: string, setter: (fn: (prev: string[]) => string[]) => void) => {
    setter((prev) => prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-indigo-50/40">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 transition-colors mr-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </Link>
            <Image src="/logos/gns.png" alt="GNS" width={32} height={32} className="object-contain" />
            <div>
              <p className="text-sm font-bold text-gray-900">Staff Management</p>
              <p className="text-[11px] text-gray-400">Add, edit and manage team access</p>
            </div>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-90 transition-opacity shadow-md shadow-purple-200/50"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Staff Member
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {msg && (
          <div className={`mb-6 p-4 rounded-xl text-sm font-medium ${msg.ok ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {msg.text}
          </div>
        )}

        {/* Add staff form */}
        {showAdd && (
          <div className="mb-8 bg-white rounded-2xl border border-gray-100 shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">Add New Staff Member</h3>
              <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-gray-600">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Full Name</label>
                <input
                  type="text" value={newName} onChange={(e) => setNewName(e.target.value)} required
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                  placeholder="John Smith"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Email</label>
                <input
                  type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                  placeholder="john@gnsassociates.co.uk"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Password</label>
                <input
                  type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                  placeholder="Min 6 characters"
                />
              </div>
              <div className="md:col-span-3">
                <label className="block text-xs font-semibold text-gray-500 mb-2">Roles</label>
                <div className="flex flex-wrap gap-2">
                  {ALL_ROLES.map((role) => (
                    <button
                      key={role} type="button"
                      onClick={() => toggleRole(role, setNewRoles)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                        newRoles.includes(role) ? ROLE_COLORS[role] : 'bg-gray-50 text-gray-400 border-gray-200'
                      }`}
                    >
                      {role}
                    </button>
                  ))}
                </div>
              </div>
              <div className="md:col-span-3 flex justify-end gap-3">
                <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-xl text-sm text-gray-500 hover:bg-gray-100">
                  Cancel
                </button>
                <button type="submit" className="px-6 py-2 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-90">
                  Add Staff Member
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Staff table */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <p className="text-sm font-bold text-gray-900">{staff.length} Staff Member{staff.length !== 1 ? 's' : ''}</p>
            </div>
            <div className="divide-y divide-gray-50">
              {staff.map((s) => (
                <div key={s.id} className="px-6 py-4 hover:bg-gray-50/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                        s.status === 'active' ? 'bg-gradient-to-br from-purple-500 to-indigo-600 text-white' : 'bg-gray-200 text-gray-500'
                      }`}>
                        {(s.displayName || s.email)[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{s.displayName || s.email}</p>
                        <p className="text-xs text-gray-400">{s.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex gap-1.5">
                        {s.roles.map((r) => (
                          <span key={r} className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${ROLE_COLORS[r] || 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                            {r}
                          </span>
                        ))}
                      </div>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                        s.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {s.status}
                      </span>
                      <div className="flex gap-1">
                        <button
                          onClick={() => {
                            if (editId === s.id) { setEditId(null); } else { setEditId(s.id); setEditRoles(s.roles); setEditPassword(''); }
                          }}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-purple-600 hover:bg-purple-50 transition-colors"
                          title="Edit"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleToggleStatus(s.id, s.status)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            s.status === 'active' ? 'text-gray-400 hover:text-amber-600 hover:bg-amber-50' : 'text-gray-400 hover:text-emerald-600 hover:bg-emerald-50'
                          }`}
                          title={s.status === 'active' ? 'Disable' : 'Enable'}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            {s.status === 'active' ? (
                              <><circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" /></>
                            ) : (
                              <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></>
                            )}
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(s.id, s.displayName || s.email)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Remove"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Edit panel */}
                  {editId === s.id && (
                    <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 mb-2">Roles</label>
                          <div className="flex flex-wrap gap-2">
                            {ALL_ROLES.map((role) => (
                              <button
                                key={role} type="button"
                                onClick={() => toggleRole(role, setEditRoles)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                                  editRoles.includes(role) ? ROLE_COLORS[role] : 'bg-white text-gray-400 border-gray-200'
                                }`}
                              >
                                {role}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 mb-2">New Password (optional)</label>
                          <input
                            type="password" value={editPassword} onChange={(e) => setEditPassword(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-purple-400"
                            placeholder="Leave blank to keep current"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-3 mt-4">
                        <button onClick={() => setEditId(null)} className="px-4 py-2 rounded-xl text-sm text-gray-500 hover:bg-white">
                          Cancel
                        </button>
                        <button
                          onClick={() => handleUpdate(s.id)}
                          className="px-6 py-2 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-90"
                        >
                          Save Changes
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {staff.length === 0 && (
                <div className="px-6 py-16 text-center">
                  <p className="text-gray-400 text-sm">No staff members yet. Click &quot;Add Staff Member&quot; to get started.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
