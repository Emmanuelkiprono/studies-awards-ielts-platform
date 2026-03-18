import React, { useState, useEffect } from 'react';
import { GlassCard, PrimaryButton } from '../components/UI';
import { GraduationCap, LogIn, UserPlus, Mail, Lock, User, ArrowLeft, AlertCircle, BookOpen, Shield } from 'lucide-react';
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
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Premium immersive background */}
      <div className="absolute inset-0">
        {/* Background image with world map */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-blue-950/50 to-purple-950/50">
          {/* Simulated world map background */}
          <div className="absolute inset-0 opacity-20">
            {/* World map outlines - subtle geographic patterns */}
            <div className="absolute top-[10%] left-[20%] w-[30%] h-[25%] border border-white/10 rounded-full blur-sm" />
            <div className="absolute top-[15%] right-[25%] w-[25%] h-[20%] border border-white/8 rounded-full blur-sm" />
            <div className="absolute bottom-[20%] left-[15%] w-[35%] h-[30%] border border-white/10 rounded-full blur-sm" />
            <div className="absolute bottom-[25%] right-[20%] w-[28%] h-[22%] border border-white/8 rounded-full blur-sm" />
            
            {/* Flight paths - curved connecting lines */}
            <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="pathGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style={{stopColor: '#3b82f6', stopOpacity: 0.3}} />
                  <stop offset="100%" style={{stopColor: '#8b5cf6', stopOpacity: 0.2}} />
                </linearGradient>
              </defs>
              {/* Curved flight paths */}
              <path d="M 200,150 Q 400,100 600,200" stroke="url(#pathGradient)" strokeWidth="1" fill="none" opacity="0.4" />
              <path d="M 150,300 Q 350,250 550,350" stroke="url(#pathGradient)" strokeWidth="1" fill="none" opacity="0.3" />
              <path d="M 250,200 Q 450,300 650,250" stroke="url(#pathGradient)" strokeWidth="1" fill="none" opacity="0.3" />
            </svg>
          </div>
          
          {/* Ambient lighting overlays */}
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-blue-600/10 via-transparent to-purple-600/10" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1200px] h-[1200px] bg-gradient-to-br from-blue-500/8 via-purple-500/4 to-transparent rounded-full blur-3xl opacity-60" />
        </div>
      </div>
      
      {/* Dark overlay to keep card as main focus */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-black/40" />
      
      {/* Additional dark vignette around card area */}
      <div className="absolute inset-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-br from-transparent via-black/5 to-black/20 rounded-full blur-3xl opacity-80" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-md w-full relative z-10"
      >
        {/* Premium glassmorphism card */}
        <div className="bg-white/8 backdrop-blur-2xl border border-white/8 rounded-3xl shadow-2xl shadow-black/40 p-8 space-y-8 relative overflow-hidden hover:scale-[1.01] transition-all duration-300 ease-out">
          {/* Subtle glass layers */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/6 to-transparent opacity-30 pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-tl from-neutral-900/15 to-transparent opacity-20 pointer-events-none" />
          
          <div className="text-center space-y-8 relative z-10">
            {/* Refined Breemic logo */}
            <div className="relative mx-auto mb-8">
              {/* Subtle glass container */}
              <div className="relative w-14 h-14 bg-white/6 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-lg shadow-black/15">
                {/* Breemic icon - B + orbit + plane */}
                <div className="relative w-10 h-10">
                  {/* B letter center */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-white font-bold text-xl">B</div>
                  </div>
                  {/* Orbit ring */}
                  <div className="absolute inset-0 border-2 border-white/30 rounded-full" />
                  {/* Small plane icon on orbit */}
                  <div className="absolute top-0 right-2 w-2 h-2 bg-white/80 rounded-full" />
                  {/* Subtle glow effect */}
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-400/20 to-purple-400/20 rounded-full blur-md" />
                </div>
              </div>
            </div>
            
            {/* Premium typography */}
            <div className="space-y-5">
              <h1 className="text-3xl font-semibold text-white tracking-tight">Breemic International</h1>
              <p className="text-sm text-neutral-500 leading-relaxed max-w-sm mx-auto">
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
                      className="w-full bg-white/6 border border-white/8 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-white/16 focus:bg-white/10 transition-all duration-300"
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
                      className="w-full bg-white/6 border border-white/8 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-white/16 focus:bg-white/10 transition-all duration-300 appearance-none cursor-pointer"
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
                  className="w-full bg-white/6 border border-white/8 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-white/16 focus:bg-white/10 transition-all duration-300"
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
                    className="w-full bg-white/6 border border-white/8 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-white/16 focus:bg-white/10 transition-all duration-300"
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
                    className="w-full bg-white/6 border border-white/8 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-white/16 focus:bg-white/10 transition-all duration-300"
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
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl py-5 px-6 font-semibold text-base shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/35 hover:scale-[1.02] hover:brightness-105 active:scale-[0.98] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 disabled:hover:scale-100 disabled:hover:brightness-100 disabled:shadow-none flex items-center justify-center gap-3"
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

          <div className="pt-6 border-t border-white/10 text-center relative z-10 space-y-4">
            {/* Security branding */}
            <div className="flex items-center justify-center gap-2 text-xs text-white/40">
              <Shield size={12} />
              <span>Secure login • Powered by Breemic International</span>
            </div>
            
            {/* Auth mode toggle */}
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
