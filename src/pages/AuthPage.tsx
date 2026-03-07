import React, { useState, useEffect } from 'react';
import { GlassCard, PrimaryButton } from '../components/UI';
import { GraduationCap, LogIn, UserPlus, Mail, Lock, User, ArrowLeft, AlertCircle, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../hooks/useAuth';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Course } from '../types';

type AuthMode = 'signin' | 'signup' | 'forgot';

export const AuthPage: React.FC = () => {
  const { signIn, signUp, resetPassword } = useAuth();
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchCourses = async () => {
      const q = query(collection(db, 'courses'), where('active', '==', true));
      const snapshot = await getDocs(q);
      const fetchedCourses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course));
      setCourses(fetchedCourses);
      if (fetchedCourses.length > 0) {
        setSelectedCourseId(fetchedCourses[0].id);
      }
    };
    fetchCourses();
  }, []);

  const validate = () => {
    if (!email.includes('@')) return 'Invalid email address';
    if (mode === 'signup') {
      if (name.length < 2) return 'Name is too short';
      if (password.length < 8) return 'Password must be at least 8 characters';
      if (password !== confirmPassword) return 'Passwords do not match';
      if (!selectedCourseId) return 'Please select a course';
    } else if (mode === 'signin') {
      if (password.length < 1) return 'Password is required';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      if (mode === 'signin') {
        await signIn(email, password);
      } else if (mode === 'signup') {
        await signUp(email, password, name, selectedCourseId);
      } else if (mode === 'forgot') {
        await resetPassword(email);
        setMessage('Password reset email sent! Check your inbox.');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#050505]">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#6324eb]/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#3b82f6]/10 rounded-full blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full relative z-10"
      >
        <GlassCard className="p-8 space-y-8">
          <div className="text-center space-y-2">
            <div className="bg-[#6324eb] size-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-[#6324eb]/30">
              <GraduationCap size={32} className="text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white">IELTS Academy</h1>
            <p className="text-slate-400">
              {mode === 'signin' ? 'Welcome back! Sign in to continue.' : 
               mode === 'signup' ? 'Create your account to start training.' : 
               'Enter your email to reset password.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <AnimatePresence mode="wait">
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-center gap-2 text-red-400 text-sm"
                >
                  <AlertCircle size={16} />
                  {error}
                </motion.div>
              )}
              {message && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 flex items-center gap-2 text-emerald-400 text-sm"
                >
                  <AlertCircle size={16} />
                  {message}
                </motion.div>
              )}
            </AnimatePresence>

            {mode === 'signup' && (
              <>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-[#6324eb] transition-colors"
                      placeholder="John Doe"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Select Course</label>
                  <div className="relative">
                    <BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                    <select
                      value={selectedCourseId}
                      onChange={(e) => setSelectedCourseId(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-[#6324eb] transition-colors appearance-none"
                      required
                    >
                      <option value="" disabled className="bg-[#050505]">Choose a course</option>
                      {courses.map(course => (
                        <option key={course.id} value={course.id} className="bg-[#050505]">
                          {course.name} - KSh {course.trainingPrice?.toLocaleString()}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </>
            )}

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-[#6324eb] transition-colors"
                  placeholder="name@example.com"
                  required
                />
              </div>
            </div>

            {mode !== 'forgot' && (
              <div className="space-y-1">
                <div className="flex justify-between items-center ml-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Password</label>
                  {mode === 'signin' && (
                    <button
                      type="button"
                      onClick={() => setMode('forgot')}
                      className="text-[10px] text-[#6324eb] font-bold hover:underline"
                    >
                      Forgot Password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-[#6324eb] transition-colors"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>
            )}

            {mode === 'signup' && (
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-[#6324eb] transition-colors"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>
            )}

            <PrimaryButton className="w-full py-4" loading={loading} type="submit">
              {mode === 'signin' ? <><LogIn size={20} /> Sign In</> : 
               mode === 'signup' ? <><UserPlus size={20} /> Create Account</> : 
               'Reset Password'}
            </PrimaryButton>
          </form>

          <div className="pt-4 border-t border-white/5 text-center">
            {mode === 'signin' ? (
              <p className="text-sm text-slate-400">
                Don't have an account?{' '}
                <button onClick={() => setMode('signup')} className="text-[#6324eb] font-bold hover:underline">
                  Sign Up
                </button>
              </p>
            ) : (
              <button
                onClick={() => setMode('signin')}
                className="text-sm text-slate-400 flex items-center justify-center gap-2 mx-auto hover:text-white transition-colors"
              >
                <ArrowLeft size={16} /> Back to Sign In
              </button>
            )}
          </div>
        </GlassCard>
      </motion.div>
    </div>
  );
};
