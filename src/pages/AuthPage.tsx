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
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-black via-neutral-900 to-black">
      {/* Enhanced background with supporting glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Primary radial gradient behind card */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-br from-purple-500/8 via-blue-500/4 to-transparent rounded-full blur-3xl opacity-70" />
        
        {/* Supporting ambient lights */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-gradient-to-br from-blue-500/6 to-purple-500/3 rounded-full blur-[200px] opacity-60" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-gradient-to-br from-purple-500/6 to-blue-500/3 rounded-full blur-[200px] opacity-60" />
        
        {/* Subtle center glow for depth */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-br from-white/3 to-transparent rounded-full blur-[300px] opacity-40" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-md w-full relative z-10"
      >
        {/* Premium auth card with enhanced glass effect */}
        <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-3xl shadow-2xl shadow-black/30 p-8 space-y-8 relative overflow-hidden hover:scale-[1.01] transition-transform duration-300 ease-out">
          {/* Enhanced glass layers */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-60 pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-tl from-neutral-900/20 to-transparent opacity-40 pointer-events-none" />
          
          <div className="text-center space-y-8 relative z-10">
            {/* Refined branding */}
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-white/10 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-black/10">
              <GraduationCap size={32} className="text-white/90" />
            </div>
            
            {/* Enhanced typography hierarchy */}
            <div className="space-y-4">
              <h1 className="text-2xl font-semibold text-white tracking-tight">Breemic International</h1>
              <p className="text-sm text-neutral-400 leading-relaxed max-w-sm mx-auto">
                {mode === 'signin' ? 
                  'Sign in to continue your enrollment and access your courses.' : 
                  mode === 'signup' ? 
                  'Create your account to begin your learning journey.' : 
                  'Enter your email to reset your password.'
                }
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5 relative z-10 mt-8">
            <AnimatePresence mode="wait">
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-red-500/8 border border-red-500/20 rounded-2xl p-4 flex items-center gap-3 text-red-300 text-sm"
                >
                  <AlertCircle size={18} className="flex-shrink-0" />
                  <span className="leading-relaxed">{error}</span>
                </motion.div>
              )}
              {message && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-emerald-500/8 border border-emerald-500/20 rounded-2xl p-4 flex items-center gap-3 text-emerald-300 text-sm"
                >
                  <AlertCircle size={18} className="flex-shrink-0" />
                  <span className="leading-relaxed">{message}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {mode === 'signup' && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white/80">Full Name</label>
                  <div className="relative group">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50 group-focus-within:text-white/70 transition-colors" size={20} />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-white/8 border border-white/12 rounded-2xl py-4 pl-12 pr-4 text-white placeholder-white/40 focus:outline-none focus:border-white/24 focus:bg-white/12 transition-all duration-200"
                      placeholder="John Doe"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-white/80">Select Course</label>
                  <div className="relative group">
                    <BookOpen className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50 group-focus-within:text-white/70 transition-colors" size={20} />
                    <select
                      value={selectedCourseId}
                      onChange={(e) => setSelectedCourseId(e.target.value)}
                      className="w-full bg-white/8 border border-white/12 rounded-2xl py-4 pl-12 pr-4 text-white placeholder-white/40 focus:outline-none focus:border-white/24 focus:bg-white/12 transition-all duration-200 appearance-none cursor-pointer"
                      required
                    >
                      <option value="" disabled className="bg-[#1a1a1a] text-white">Choose a course</option>
                      {courses.map(course => (
                        <option key={course.id} value={course.id} className="bg-[#1a1a1a] text-white">
                          {course.name} - KSh {course.trainingPrice?.toLocaleString()}
                        </option>
                      ))}
                    </select>
                    {/* Custom dropdown arrow */}
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                      <svg className="w-5 h-5 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>
              </>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-white/80">Email Address</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50 group-focus-within:text-white/70 transition-colors" size={20} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white/8 border border-white/12 rounded-2xl py-4 pl-12 pr-4 text-white placeholder-white/40 focus:outline-none focus:border-white/24 focus:bg-white/12 transition-all duration-200"
                  placeholder="name@example.com"
                  required
                />
              </div>
            </div>

            {mode !== 'forgot' && (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium text-white/80">Password</label>
                  {mode === 'signin' && (
                    <button
                      type="button"
                      onClick={() => setMode('forgot')}
                      className="text-sm text-white/60 hover:text-white/80 transition-colors"
                    >
                      Forgot Password?
                    </button>
                  )}
                </div>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50 group-focus-within:text-white/70 transition-colors" size={20} />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-white/8 border border-white/12 rounded-2xl py-4 pl-12 pr-4 text-white placeholder-white/40 focus:outline-none focus:border-white/24 focus:bg-white/12 transition-all duration-200"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>
            )}

            {mode === 'signup' && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-white/80">Confirm Password</label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50 group-focus-within:text-white/70 transition-colors" size={20} />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-white/8 border border-white/12 rounded-2xl py-4 pl-12 pr-4 text-white placeholder-white/40 focus:outline-none focus:border-white/24 focus:bg-white/12 transition-all duration-200"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>
            )}

            {/* Premium primary button */}
            <motion.button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-2xl py-5 px-6 font-semibold text-base shadow-lg hover:shadow-xl hover:scale-[1.02] hover:brightness-110 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 disabled:hover:scale-100 disabled:hover:brightness-100 flex items-center justify-center gap-3"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  {mode === 'signin' && <><LogIn size={20} /> Sign In</>}
                  {mode === 'signup' && <><UserPlus size={20} /> Create Account</>}
                  {mode === 'forgot' && 'Reset Password'}
                </>
              )}
            </motion.button>
          </form>

          <div className="pt-6 border-t border-white/10 text-center relative z-10">
            {mode === 'signin' ? (
              <p className="text-sm text-white/60">
                Don't have an account?{' '}
                <button 
                  onClick={() => setMode('signup')} 
                  className="text-white font-medium hover:text-white/80 transition-colors"
                >
                  Sign Up
                </button>
              </p>
            ) : (
              <button
                onClick={() => setMode('signin')}
                className="text-sm text-white/60 flex items-center justify-center gap-2 mx-auto hover:text-white/80 transition-colors"
              >
                <ArrowLeft size={16} /> Back to Sign In
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};
