import React from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import { Lock, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

export const AccessControlMessage: React.FC = () => {
  const location = useLocation();
  const state = location.state as { 
    reason?: string; 
    message?: string;
    from?: string;
    currentStatus?: string;
  };

  // If no state, redirect to dashboard
  if (!state?.reason) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-md mx-auto px-6 w-full"
      >
        <div className="bg-white/80 dark:bg-white/5 backdrop-blur-md rounded-3xl p-8 border border-slate-200/50 dark:border-white/10 shadow-2xl shadow-slate-200/20 dark:shadow-black/20">
          {/* Icon */}
          <div className="flex items-center justify-center w-16 h-16 bg-gradient-to-br from-orange-500/20 to-amber-500/20 dark:from-orange-500/30 dark:to-amber-500/30 rounded-2xl border border-orange-500/30 dark:border-orange-500/20 backdrop-blur-sm mb-6 mx-auto">
            <Lock className="w-8 h-8 text-orange-600 dark:text-orange-400" />
          </div>
          
          {/* Title */}
          <h2 className="text-2xl font-light text-slate-900 dark:text-white mb-4 text-center">
            Access Locked
          </h2>
          
          {/* Message */}
          <p className="text-slate-600 dark:text-slate-400 text-center mb-6 leading-relaxed">
            {state.message || 'Your course access will unlock after approval.'}
          </p>
          
          {/* Status Info */}
          {state.currentStatus && (
            <div className="bg-slate-100 dark:bg-slate-800/50 rounded-xl p-4 mb-6">
              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                <AlertCircle className="w-4 h-4" />
                <span>Current Status: <strong className="text-slate-900 dark:text-white">{state.currentStatus}</strong></span>
              </div>
            </div>
          )}
          
          {/* CTA Button */}
          <motion.button
            whileHover={{ scale: 1.02, y: -1 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => window.history.back()}
            className="w-full inline-flex items-center justify-center gap-3 px-6 py-3 bg-gradient-to-r from-slate-600 to-slate-700 dark:from-slate-700 dark:to-slate-800 text-white font-medium rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl"
          >
            Go Back
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
};
