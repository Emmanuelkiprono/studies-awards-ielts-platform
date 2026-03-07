import React, { useState } from 'react';
import { GlassCard, PrimaryButton } from '../components/UI';
import { Lock, Key, CheckCircle2, AlertCircle, Mail } from 'lucide-react';
import { updatePassword } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { useAuth } from '../hooks/useAuth';
import { motion } from 'motion/react';

export const ForcePasswordChangePage: React.FC = () => {
  const { user, profile } = useAuth();
  const [email, setEmail] = useState(user?.email || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError('You must be signed in to change your password.');
      return;
    }

    if (email !== user.email) {
      setError('Email does not match the logged-in user.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Update Auth password
      await updatePassword(user, newPassword);

      // Update Firestore profile to remove forcePasswordChange flag
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        forcePasswordChange: false
      });

      setSuccess(true);
    } catch (err: any) {
      console.error('Error updating password:', err);
      if (err.code === 'auth/requires-recent-login') {
        setError('For security, please sign out and sign back in before changing your password.');
      } else {
        setError(err.message || 'Failed to update password.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4">
        <GlassCard className="max-w-md w-full p-8 text-center space-y-6">
          <div className="size-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto text-emerald-400">
            <CheckCircle2 size={40} />
          </div>
          <h2 className="text-2xl font-bold text-white">Password Updated!</h2>
          <p className="text-slate-400">Your password has been changed successfully. You can now access your dashboard.</p>
          <PrimaryButton className="w-full py-3" onClick={() => window.location.reload()}>
            Continue to Dashboard
          </PrimaryButton>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full"
      >
        <GlassCard className="p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="size-16 bg-[#6324eb]/10 rounded-2xl flex items-center justify-center mx-auto text-[#6324eb] mb-4">
              <Lock size={32} />
            </div>
            <h2 className="text-2xl font-bold text-white">Security Update</h2>
            <p className="text-slate-400 text-sm">Please reset your password to secure your account.</p>
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-3">
              <AlertCircle size={18} />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs text-slate-500 uppercase font-bold px-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <input 
                  type="email" 
                  required
                  readOnly={!!user}
                  className="input-field pl-12 py-3 bg-white/5 opacity-80" 
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-500 uppercase font-bold px-1">New Password</label>
              <div className="relative">
                <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <input 
                  type="password" 
                  required
                  className="input-field pl-12 py-3" 
                  placeholder="Min. 8 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-500 uppercase font-bold px-1">Confirm Password</label>
              <div className="relative">
                <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <input 
                  type="password" 
                  required
                  className="input-field pl-12 py-3" 
                  placeholder="Repeat new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>

            <PrimaryButton 
              type="submit" 
              className="w-full py-4 text-lg font-bold" 
              disabled={loading}
            >
              {loading ? 'Updating...' : 'Reset Password'}
            </PrimaryButton>
          </form>
        </GlassCard>
      </motion.div>
    </div>
  );
};
