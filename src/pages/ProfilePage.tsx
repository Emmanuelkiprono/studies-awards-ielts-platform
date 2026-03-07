import React, { useEffect, useState } from 'react';
import { GlassCard, PrimaryButton, StatusBadge } from '../components/UI';
import {
  User,
  Mail,
  Phone,
  Shield,
  Bell,
  LogOut,
  ChevronRight,
  Edit3,
  CheckCircle2,
  X,
  CreditCard,
  HelpCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../hooks/useAuth';
import { db } from '../services/firebase';
import { doc, updateDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { Assignment, Submission } from '../types';

export const ProfilePage: React.FC = () => {
  const { user, profile, studentData, signOut } = useAuth();

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);

  // Edit modal
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', phone: '', avatarUrl: '' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!user || !studentData?.courseId) return;
    Promise.all([
      getDocs(query(collection(db, 'assignments'), where('courseId', '==', studentData.courseId))),
      getDocs(query(collection(db, 'submissions'), where('studentId', '==', user.uid))),
    ]).then(([aSnap, sSnap]) => {
      setAssignments(aSnap.docs.map(d => ({ id: d.id, ...d.data() } as Assignment)));
      setSubmissions(sSnap.docs.map(d => ({ id: d.id, ...d.data() } as Submission)));
    });
  }, [user, studentData?.courseId]);

  const gradedSubs = submissions.filter(s => s.status === 'graded' && s.bandScore != null);
  const avgBand = gradedSubs.length
    ? (gradedSubs.reduce((sum, s) => sum + (s.bandScore ?? 0), 0) / gradedSubs.length).toFixed(1)
    : '—';
  const submittedCount = submissions.length;
  const pendingCount = assignments.filter(a => !submissions.find(s => s.assignmentId === a.id)).length;

  const displayName = profile?.name || 'User';
  const displayEmail = profile?.email || '';
  const displayRole = profile?.role || 'student';
  const avatarUrl = profile?.avatarUrl || `https://picsum.photos/seed/${user?.uid ?? 'user'}/200/200`;

  const openEdit = () => {
    setEditForm({
      name: profile?.name ?? '',
      phone: profile?.phone ?? '',
      avatarUrl: profile?.avatarUrl ?? '',
    });
    setSaved(false);
    setShowEdit(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        name: editForm.name,
        phone: editForm.phone || null,
        avatarUrl: editForm.avatarUrl || null,
      });
      setSaved(true);
      setTimeout(() => setShowEdit(false), 900);
    } catch (err) {
      console.error('Profile update error:', err);
      alert('Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    try { await signOut(); } catch (err) { console.error(err); }
  };

  const menuItems = [
    { icon: Shield, label: 'Security', sub: 'Password, 2FA, login history' },
    { icon: Bell, label: 'Notifications', sub: 'Push, email, and SMS alerts' },
    { icon: CreditCard, label: 'Payments & Billing', sub: 'Invoices, saved cards' },
    { icon: HelpCircle, label: 'Help & Support', sub: 'FAQs, contact support' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 space-y-6 max-w-2xl mx-auto w-full pb-24"
    >
      {/* Profile Header */}
      <div className="flex flex-col items-center text-center space-y-4 pt-4">
        <div className="relative">
          <div className="size-28 rounded-3xl border-4 border-[#6324eb]/30 overflow-hidden shadow-2xl shadow-[#6324eb]/20">
            <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          </div>
          <button onClick={openEdit} className="absolute -bottom-2 -right-2 bg-[#6324eb] text-white p-2 rounded-xl shadow-lg hover:scale-110 transition-transform border-2 border-[#0b0814]">
            <Edit3 size={16} />
          </button>
        </div>

        <div>
          <h2 className="text-2xl font-bold text-[var(--ui-heading)]">{displayName}</h2>
          {profile?.phone && <p className="text-[var(--ui-muted)] text-xs mt-0.5">{profile.phone}</p>}
          <div className="flex items-center justify-center gap-2 mt-2">
            <StatusBadge status={displayRole} variant="primary" className="text-[10px] uppercase tracking-widest" />
          </div>
        </div>

        <button onClick={openEdit} className="text-xs font-bold text-[var(--ui-accent)] hover:opacity-80 transition-opacity flex items-center gap-1.5">
          <Edit3 size={13} /> Edit Profile
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white/5 border border-white/5 rounded-2xl p-3 text-center">
          <p className="text-lg font-bold text-[var(--ui-heading)]">{avgBand}</p>
          <p className="text-[10px] text-[var(--ui-muted)] uppercase font-bold">Avg Score</p>
        </div>
        <div className="bg-white/5 border border-white/5 rounded-2xl p-3 text-center">
          <p className="text-lg font-bold text-[var(--ui-heading)]">{submittedCount}</p>
          <p className="text-[10px] text-[var(--ui-muted)] uppercase font-bold">Submitted</p>
        </div>
        <div className="bg-white/5 border border-white/5 rounded-2xl p-3 text-center">
          <p className="text-lg font-bold text-[var(--ui-heading)]">{pendingCount}</p>
          <p className="text-[10px] text-[var(--ui-muted)] uppercase font-bold">Pending</p>
        </div>
      </div>

      {/* Account Info */}
      <GlassCard className="p-4 space-y-3">
        <h3 className="text-xs font-bold text-[var(--ui-muted)] uppercase tracking-widest mb-1">Account Info</h3>
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-xl bg-white/5 flex items-center justify-center text-[var(--ui-muted)]"><Mail size={16} /></div>
          <div>
            <p className="text-[10px] font-bold text-[var(--ui-muted)] uppercase tracking-wider">Email</p>
            <p className="text-sm font-semibold text-[var(--ui-heading)]">{displayEmail}</p>
          </div>
        </div>
        {profile?.phone && (
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-white/5 flex items-center justify-center text-[var(--ui-muted)]"><Phone size={16} /></div>
            <div>
              <p className="text-[10px] font-bold text-[var(--ui-muted)] uppercase tracking-wider">Phone</p>
              <p className="text-sm font-semibold text-[var(--ui-heading)]">{profile.phone}</p>
            </div>
          </div>
        )}
      </GlassCard>

      {/* Menu */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-[var(--ui-muted)] uppercase tracking-widest px-2">Settings</h3>
        <GlassCard className="p-0 overflow-hidden divide-y divide-white/5">
          {menuItems.map((item, i) => (
            <button key={i} className="w-full flex items-center gap-4 p-4 hover:bg-white/5 transition-colors group text-left">
              <div className="size-10 rounded-xl bg-slate-800/50 flex items-center justify-center text-[var(--ui-muted)] group-hover:text-[var(--ui-accent)] group-hover:bg-[var(--ui-accent)]/10 transition-all">
                <item.icon size={20} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-[var(--ui-heading)]">{item.label}</p>
                <p className="text-xs text-[var(--ui-muted)]">{item.sub}</p>
              </div>
              <ChevronRight size={18} className="text-[var(--ui-muted)] group-hover:text-[var(--ui-heading)] transition-colors" />
            </button>
          ))}
        </GlassCard>
      </div>

      {/* Sign Out */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-[var(--ui-muted)] uppercase tracking-widest px-2">Session</h3>
        <PrimaryButton variant="secondary" className="w-full py-4 border-red-500/20 hover:bg-red-500/10 hover:text-red-500 group" onClick={handleSignOut}>
          <LogOut size={20} className="group-hover:scale-110 transition-transform" /> Sign Out
        </PrimaryButton>
      </div>

      <p className="text-center text-[10px] text-slate-600 font-medium uppercase tracking-widest">
        Studies & Awards IELTS Platform • v1.0.4
      </p>

      {/* Edit Profile Modal */}
      <AnimatePresence>
        {showEdit && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]" onClick={() => setShowEdit(false)} />
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="fixed inset-0 z-[70] flex items-center justify-center p-4 pointer-events-none">
              <div className="bg-[var(--ui-bg)] border border-[var(--ui-border)] rounded-3xl p-8 shadow-2xl max-w-sm w-full pointer-events-auto">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold text-[var(--ui-heading)]">Edit Profile</h3>
                  <button onClick={() => setShowEdit(false)} className="text-[var(--ui-muted)] hover:text-[var(--ui-heading)] transition-colors"><X size={22} /></button>
                </div>
                <form onSubmit={handleSave} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[var(--ui-muted)] uppercase tracking-wider">Full Name</label>
                    <input required value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} className="input-field w-full" placeholder="Your name" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[var(--ui-muted)] uppercase tracking-wider">Phone <span className="font-normal normal-case">(optional)</span></label>
                    <input type="tel" value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} className="input-field w-full" placeholder="+1 234 567 890" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[var(--ui-muted)] uppercase tracking-wider">Avatar URL <span className="font-normal normal-case">(optional)</span></label>
                    <input type="url" value={editForm.avatarUrl} onChange={e => setEditForm(f => ({ ...f, avatarUrl: e.target.value }))} className="input-field w-full" placeholder="https://..." />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button type="button" onClick={() => setShowEdit(false)} className="flex-1 py-3 rounded-2xl bg-white/5 text-[var(--ui-body)] font-bold hover:bg-white/10 transition-all">Cancel</button>
                    <PrimaryButton type="submit" loading={saving} className="flex-1 py-3">
                      {saved ? <><CheckCircle2 size={16} /> Saved</> : <><User size={16} /> Save</>}
                    </PrimaryButton>
                  </div>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
