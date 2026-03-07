import React from 'react';
import { cn } from '../lib/utils';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  gradient?: boolean;
  onClick?: () => void;
}

export const GlassCard: React.FC<GlassCardProps> = ({ children, className, gradient, onClick }) => {
  return (
    <div
      onClick={onClick}
      className={cn(
        "glass-card p-5 relative overflow-hidden",
        gradient && "before:absolute before:-top-24 before:-right-24 before:size-64 before:bg-[rgba(var(--ui-accent-rgb)/0.20)] before:rounded-full before:blur-3xl",
        className,
        onClick && "cursor-pointer"
      )}
    >
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
};

interface StatusBadgeProps {
  status: string;
  variant?: 'primary' | 'accent' | 'success' | 'warning' | 'error';
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, variant = 'primary', className }) => {
  const variants = {
    primary: "bg-[rgba(var(--ui-accent-rgb)/0.20)] text-[var(--ui-accent)] border-[rgba(var(--ui-accent-rgb)/0.30)]",
    accent: "bg-[#3b82f6]/20 text-[#3b82f6] border-[#3b82f6]/30",
    success: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    warning: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    error: "bg-red-500/20 text-red-400 border-red-500/30",
  };

  return (
    <span className={cn(
      "px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border",
      variants[variant],
      className
    )}>
      {status}
    </span>
  );
};

interface PrimaryButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
  loading?: boolean;
}

export const PrimaryButton: React.FC<PrimaryButtonProps> = ({
  children,
  variant = 'primary',
  loading,
  className,
  ...props
}) => {
  return (
    <button
      className={cn(variant === 'primary' ? 'btn-primary' : 'btn-secondary', className)}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? (
        <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      ) : children}
    </button>
  );
};
