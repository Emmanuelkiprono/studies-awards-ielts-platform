import { useNavigate, useLocation } from 'react-router-dom';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import {
  LayoutDashboard,
  Video,
  ClipboardList,
  FolderOpen,
  TrendingUp,
  Bell,
  User as UserIcon,
  Users,
  BookOpen,
  Calendar,
  LogOut,
  Settings,
  Sun,
  Moon,
  Monitor,
  Palette,
  X
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../hooks/useAuth';
import { NotificationBell } from './NotificationBell';
import { useTheme, type AccentColor, type ThemeMode } from '../hooks/useTheme';

interface NavItemProps {
  icon: React.ElementType;
  label: string;
  active?: boolean;
  onClick: () => void;
  badge?: boolean;
}

const NavItem: React.FC<NavItemProps> = ({ icon: Icon, label, active, onClick, badge }) => (
  <button
    onClick={onClick}
    className={cn(
      "flex flex-col items-center gap-1 p-2 transition-colors relative",
      active ? "text-[var(--ui-accent)]" : "text-[var(--ui-muted)] hover:text-[var(--ui-heading)]"
    )}
  >
    <div className="relative">
      <Icon size={24} className={active ? "fill-current" : ""} />
      {badge && (
        <span className="absolute -top-1 -right-1 flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--ui-accent)] opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--ui-accent)]"></span>
        </span>
      )}
    </div>
    <span className={cn("text-[10px]", active ? "font-bold" : "font-medium")}>{label}</span>
  </button>
);

const AppearanceModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { themeMode, accent, setAccent, setThemeMode } = useTheme();

  const themeOptions: Array<{ value: ThemeMode; label: string; icon: React.ElementType }> = useMemo(
    () => [
      { value: 'system', label: 'System', icon: Monitor },
      { value: 'dark', label: 'Dark', icon: Moon },
      { value: 'light', label: 'Light', icon: Sun },
    ],
    []
  );

  const accentOptions: Array<{ value: AccentColor; label: string; swatchClass: string }> = useMemo(
    () => [
      { value: 'purple', label: 'Purple', swatchClass: 'bg-[#6324eb]' },
      { value: 'blue', label: 'Blue', swatchClass: 'bg-[#3b82f6]' },
      { value: 'green', label: 'Green', swatchClass: 'bg-[#22c55e]' },
    ],
    []
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center !items-center !justify-center">
      <button
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        aria-label="Close appearance settings"
      />
      <div className="relative glass-card rounded-2xl p-4 max-w-xs w-full mx-4 !fixed !top-1/2 !left-1/2 !transform !-translate-x-1/2 !-translate-y-1/2">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Palette size={16} className="text-[var(--ui-muted)]" />
            <h2 className="text-[var(--ui-text)] font-bold text-sm">Theme</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/5 transition-colors text-[var(--ui-muted)] hover:text-[var(--ui-heading)]"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-[var(--ui-muted)] mb-1.5">Mode</div>
            <div className="grid grid-cols-3 gap-1.5">
              {themeOptions.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => setThemeMode(value)}
                  className={cn(
                    'px-2 py-2 rounded-lg border transition-all flex flex-col items-center justify-center gap-1',
                    themeMode === value
                      ? 'border-[rgba(var(--ui-accent-rgb)/0.45)] bg-[rgba(var(--ui-accent-rgb)/0.12)] text-[var(--ui-heading)]'
                      : 'border-[var(--ui-border)] bg-[var(--ui-card)] text-[var(--ui-body)] hover:bg-white/10'
                  )}
                >
                  <Icon size={14} />
                  <span className="text-xs font-bold">{label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-[var(--ui-muted)] mb-1.5">Color</div>
            <div className="grid grid-cols-3 gap-1.5">
              {accentOptions.map(({ value, label, swatchClass }) => (
                <button
                  key={value}
                  onClick={() => setAccent(value)}
                  className={cn(
                    'px-2 py-2 rounded-lg border transition-all flex flex-col items-center justify-center gap-1',
                    accent === value
                      ? 'border-[rgba(var(--ui-accent-rgb)/0.45)] bg-[rgba(var(--ui-accent-rgb)/0.12)] text-[var(--ui-heading)]'
                      : 'border-[var(--ui-border)] bg-[var(--ui-card)] text-[var(--ui-body)] hover:bg-white/10'
                  )}
                >
                  <span className={cn('size-4 rounded-full', swatchClass)} />
                  <span className="text-xs font-bold">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const BottomNav: React.FC<{ role?: string }> = ({ role = 'student' }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { studentData } = useAuth();
  const isTeacher = role === 'teacher';
  const [hasUpcomingSession, setHasUpcomingSession] = useState(false);

  useEffect(() => {
    if (isTeacher || !studentData?.courseId) return;
    const now = new Date().toISOString();
    getDocs(query(
      collection(db, 'liveSessions'),
      where('courseId', '==', studentData.courseId)
    )).then(snap => {
      const upcoming = snap.docs.some(d => (d.data().startTime as string) >= now);
      setHasUpcomingSession(upcoming);
    }).catch(() => {});
  }, [studentData?.courseId, isTeacher]);

  const isActive = (path: string) => {
    if (path === '/dashboard' && location.pathname === '/dashboard') return true;
    if (path === '/teacher' && location.pathname === '/teacher') return true;
    if (path !== '/' && location.pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 glass-panel pb-6 pt-2 px-2 z-50">
      <div className="flex items-center justify-around max-w-lg mx-auto h-16">
        <NavItem
          icon={LayoutDashboard}
          label="Dashboard"
          active={isTeacher ? isActive('/teacher') : isActive('/dashboard')}
          onClick={() => navigate(isTeacher ? '/teacher' : '/dashboard')}
        />

        {isTeacher ? (
          <>
            <NavItem
              icon={Video}
              label="Live"
              active={isActive('/live')}
              onClick={() => navigate('/live')}
            />
            <NavItem
              icon={Users}
              label="Students"
              active={isActive('/teacher/students')}
              onClick={() => navigate('/teacher/students')}
            />
            <NavItem
              icon={BookOpen}
              label="Lessons"
              active={isActive('/teacher/lessons')}
              onClick={() => navigate('/teacher/lessons')}
            />
            <NavItem
              icon={ClipboardList}
              label="Tasks"
              active={isActive('/teacher/tasks')}
              onClick={() => navigate('/teacher/tasks')}
            />
            <NavItem
              icon={Calendar}
              label="Exams"
              active={isActive('/teacher/exams')}
              onClick={() => navigate('/teacher/exams')}
            />
          </>
        ) : (
          <>
            <NavItem
              icon={Video}
              label="Live"
              active={isActive('/live')}
              onClick={() => navigate('/live')}
              badge={hasUpcomingSession}
            />
            <NavItem
              icon={ClipboardList}
              label="Tasks"
              active={isActive('/tasks')}
              onClick={() => navigate('/tasks')}
            />
            <NavItem
              icon={FolderOpen}
              label="Resources"
              active={isActive('/resources')}
              onClick={() => navigate('/resources')}
            />
            <NavItem
              icon={TrendingUp}
              label="Progress"
              active={isActive('/progress')}
              onClick={() => navigate('/progress')}
            />
          </>
        )}
      </div>
    </nav>
  );
};

export const TopBar: React.FC<{ title?: string; subtitle?: string; avatarUrl?: string; onProfileClick?: () => void }> = ({ title, subtitle, avatarUrl, onProfileClick }) => {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (menuRef.current && !menuRef.current.contains(target)) setMenuOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  return (
    <header className="flex items-center justify-between p-4 bg-[rgba(255,255,255,0.02)] backdrop-blur-md sticky top-0 z-50 border-b border-[var(--ui-border-soft)]">
      <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}
      >
        <div className="bg-[var(--ui-accent)] rounded-lg p-1.5 flex items-center justify-center">
          <FolderOpen size={20} className="text-white" />
        </div>
        <div className="flex flex-col">
          <h1 className="text-[var(--ui-text)] text-sm font-bold leading-tight uppercase tracking-wider">Studies & Awards</h1>
          <span className="bg-[rgba(var(--ui-accent-rgb)/0.20)] text-[var(--ui-accent)] text-[10px] font-black px-1.5 rounded w-fit border border-[rgba(var(--ui-accent-rgb)/0.30)]">IELTS</span>
        </div>
      </div>
      
      {/* Center Theme Button */}
      <div className="flex items-center justify-center absolute left-1/2 transform -translate-x-1/2">
        <button
          onClick={() => setAppearanceOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--ui-card)] border border-[var(--ui-border)] hover:bg-white/10 transition-all text-[var(--ui-text)]"
        >
          <Palette size={16} className="text-[var(--ui-muted)]" />
          <span className="text-sm font-semibold">Theme</span>
        </button>
      </div>
      
      <div className="flex items-center gap-3">
        <NotificationBell />
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(v => !v)}
            className="size-10 rounded-full border-2 border-[rgba(var(--ui-accent-rgb)/0.50)] overflow-hidden bg-slate-800 flex items-center justify-center hover:scale-105 transition-transform"
            aria-label="Open profile menu"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <UserIcon size={20} className="text-slate-400" />
            )}
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-3 w-56 glass-card p-2 rounded-2xl">
              <button
                onClick={() => {
                  setMenuOpen(false);
                  navigate('/profile');
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-white/5 transition-colors text-[var(--ui-heading)]"
              >
                <UserIcon size={16} className="text-[var(--ui-muted)]" />
                <span className="text-sm font-semibold">Profile</span>
              </button>
              <div className="h-px bg-white/5 my-1" />
              <button
                onClick={() => {
                  setMenuOpen(false);
                  signOut();
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-red-500/10 transition-colors text-[var(--ui-body)] hover:text-red-400"
              >
                <LogOut size={16} />
                <span className="text-sm font-semibold">Sign out</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {appearanceOpen && (
        <AppearanceModal onClose={() => setAppearanceOpen(false)} />
      )}
    </header>
  );
};
