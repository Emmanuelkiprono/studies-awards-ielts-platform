import { useNavigate, useLocation } from 'react-router-dom';
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
  X,
  Lock
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../hooks/useAuth';
import { NotificationBell } from './NotificationBell';
import { useTheme, type AccentColor, type ThemeMode } from '../hooks/useTheme';
import { useToast } from './Toast';

interface NavItemProps {
  icon: React.ElementType;
  label: string;
  active?: boolean;
  onClick: () => void;
  badge?: boolean;
  disabled?: boolean;
}

const NavItem: React.FC<NavItemProps> = ({ icon: Icon, label, active, onClick, badge, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={cn(
      "flex flex-col items-center gap-1 p-2 transition-colors relative",
      active ? "text-[var(--ui-accent)]" : 
      disabled ? "text-[var(--ui-muted)]/50 cursor-not-allowed" : 
      "text-[var(--ui-muted)] hover:text-[var(--ui-heading)]"
    )}
  >
    <div className="relative">
      <Icon size={24} className={cn(active ? "fill-current" : "", disabled && "opacity-50")} />
      {disabled && (
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-[var(--ui-muted)]/30 rounded-full flex items-center justify-center">
          <Lock size={10} className="text-[var(--ui-muted)]" />
        </div>
      )}
      {badge && !disabled && (
        <span className="absolute -top-1 -right-1 flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--ui-accent)] opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--ui-accent)]"></span>
        </span>
      )}
    </div>
    <span className={cn("text-[10px]", active ? "font-bold" : "font-medium", disabled && "opacity-50")}>{label}</span>
  </button>
);

const AppearanceModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { themeMode, accent, setAccent, setThemeMode } = useTheme();

  // Add escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

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
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <button
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        aria-label="Close appearance settings"
      />
      <div className="relative glass-card rounded-2xl p-4 max-w-xs w-full mx-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Palette size={16} className="text-[var(--ui-muted)]" />
            <h2 className="text-[var(--ui-text)] font-bold text-sm">Theme</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 transition-colors text-red-400 hover:text-red-300 border border-red-500/20"
            aria-label="Close theme settings"
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
                    "flex flex-col items-center gap-1 p-2 rounded-lg border transition-all",
                    themeMode === value
                      ? "border-[var(--ui-accent)] bg-[var(--ui-accent)]/10 text-[var(--ui-accent)]"
                      : "border-[var(--ui-border)] bg-[var(--ui-bg)] hover:bg-[var(--ui-border)] text-[var(--ui-muted)] hover:text-[var(--ui-text)]"
                  )}
                >
                  <Icon size={16} />
                  <span className="text-xs font-medium">{label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-[var(--ui-muted)] mb-1.5">Accent</div>
            <div className="grid grid-cols-3 gap-1.5">
              {accentOptions.map(({ value, label, swatchClass }) => (
                <button
                  key={value}
                  onClick={() => setAccent(value)}
                  className={cn(
                    "flex flex-col items-center gap-1 p-2 rounded-lg border transition-all",
                    accent === value
                      ? "border-[var(--ui-accent)] bg-[var(--ui-accent)]/10"
                      : "border-[var(--ui-border)] bg-[var(--ui-bg)] hover:bg-[var(--ui-border)]"
                  )}
                >
                  <div className={cn("w-4 h-4 rounded-full", swatchClass)} />
                  <span className="text-xs font-medium text-[var(--ui-text)]">{label}</span>
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
  const { showToast } = useToast();
  const isTeacher = role === 'teacher';
  const [hasUpcomingSession, setHasUpcomingSession] = useState(false);

  // Single source of truth for navigation access
  const canAccess = 
    studentData?.onboardingStatus === 'approved' ||
    studentData?.accessUnlocked === true ||
    studentData?.trainingStatus === 'active';

  // Handle navigation with access control
  const handleNavigate = (path: string, requiresApproval = false) => {
    if (isTeacher) {
      navigate(path);
      return;
    }

    // For students, check approval status if required
    if (requiresApproval && !canAccess) {
      // Show toast message
      showToast('Available after approval', 'info', 2000);
      return;
    }

    navigate(path);
  };

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
    return location.pathname.startsWith(path);
  };

  if (isTeacher) {
    return (
      <nav className="fixed bottom-0 left-0 right-0 bg-[var(--ui-bg)] border-t border-[var(--ui-border)] z-50">
        <div className="grid grid-cols-5 max-w-md mx-auto">
          <NavItem
            icon={LayoutDashboard}
            label="Dashboard"
            active={isActive('/teacher')}
            onClick={() => navigate('/teacher')}
          />
          <NavItem
            icon={BookOpen}
            label="Courses"
            active={isActive('/teacher/courses')}
            onClick={() => navigate('/teacher/courses')}
          />
          <NavItem
            icon={Video}
            label="Live"
            active={isActive('/live')}
            onClick={() => navigate('/live')}
            badge={hasUpcomingSession}
          />
          <NavItem
            icon={Users}
            label="Students"
            active={isActive('/teacher/students')}
            onClick={() => navigate('/teacher/students')}
          />
          <NavItem
            icon={ClipboardList}
            label="Tasks"
            active={isActive('/teacher/tasks')}
            onClick={() => navigate('/teacher/tasks')}
          />
        </div>
      </nav>
    );
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-[var(--ui-bg)] border-t border-[var(--ui-border)] z-50">
      <div className="grid grid-cols-5 max-w-md mx-auto">
        <NavItem
          icon={LayoutDashboard}
          label="Dashboard"
          active={isActive('/dashboard')}
          onClick={() => handleNavigate('/dashboard', false)}
        />
        <NavItem
          icon={Video}
          label="Live"
          active={isActive('/live')}
          onClick={() => handleNavigate('/live', true)}
          badge={hasUpcomingSession}
          disabled={!canAccess}
        />
        <NavItem
          icon={ClipboardList}
          label="Tasks"
          active={isActive('/tasks')}
          onClick={() => handleNavigate('/tasks', true)}
          disabled={!canAccess}
        />
        <NavItem
          icon={FolderOpen}
          label="Resources"
          active={isActive('/resources')}
          onClick={() => handleNavigate('/resources', true)}
          disabled={!canAccess}
        />
        <NavItem
          icon={TrendingUp}
          label="Progress"
          active={isActive('/progress')}
          onClick={() => handleNavigate('/progress', true)}
          disabled={!canAccess}
        />
      </div>
    </nav>
  );
};

export const TopBar: React.FC<{ title?: string; subtitle?: string; avatarUrl?: string; onProfileClick?: () => void }> = ({ title, subtitle, avatarUrl, onProfileClick }) => {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const toggleMenu = useCallback(() => setMenuOpen(v => !v), []);
  const toggleAppearance = useCallback(() => setAppearanceOpen(v => !v), []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-50 bg-[var(--ui-bg)]/80 backdrop-blur-xl border-b border-[var(--ui-border)]">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--ui-accent)] to-[var(--ui-accent)]/60 flex items-center justify-center">
            <span className="text-white font-bold text-sm">B</span>
          </div>
          <div>
            <h1 className="font-bold text-[var(--ui-heading)]">{title || 'Breemic Academy'}</h1>
            {subtitle && <p className="text-xs text-[var(--ui-muted)]">{subtitle}</p>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <NotificationBell />
          
          <button
            onClick={toggleAppearance}
            className="p-2 rounded-lg bg-[var(--ui-bg)] border border-[var(--ui-border)] hover:bg-[var(--ui-border)] transition-colors"
            aria-label="Appearance settings"
          >
            <Palette size={16} className="text-[var(--ui-muted)]" />
          </button>

          <div className="relative" ref={menuRef}>
            <button
              onClick={toggleMenu}
              className="flex items-center gap-2 p-1 rounded-lg hover:bg-[var(--ui-border)] transition-colors"
            >
              <img
                src={avatarUrl || `https://picsum.photos/seed/${Math.random()}/40/40`}
                alt="Profile"
                className="w-8 h-8 rounded-full object-cover border-2 border-[var(--ui-border)]"
              />
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-[var(--ui-bg)] border border-[var(--ui-border)] rounded-xl shadow-xl overflow-hidden">
                <div className="p-2 border-b border-[var(--ui-border)]">
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onProfileClick?.();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[var(--ui-border)] transition-colors text-[var(--ui-text)]"
                  >
                    <UserIcon size={16} />
                    <span className="text-sm font-medium">Profile</span>
                  </button>
                </div>
                
                <div className="p-2">
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      signOut();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-red-500/10 transition-colors text-[var(--ui-text)] hover:text-red-400"
                  >
                    <LogOut size={16} />
                    <span className="text-sm font-semibold">Sign out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {appearanceOpen && (
        <AppearanceModal onClose={() => setAppearanceOpen(false)} />
      )}
    </header>
  );
};
