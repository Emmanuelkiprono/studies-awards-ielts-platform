import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { User, Settings, LogOut, ChevronDown } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

export const ProfileDropdown: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [buttonPosition, setButtonPosition] = useState({ top: 0, right: 0 });

  // Update button position when dropdown opens
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setButtonPosition({
        top: rect.bottom + 8, // 8px offset below button
        right: window.innerWidth - rect.right, // Right-align with button
      });
    }
  }, [isOpen]);

  const handleSignOut = async () => {
    try {
      await signOut();
      window.location.replace('/auth'); // Hard redirect
    } catch (error) {
      console.error('Sign out error:', error);
      window.location.replace('/auth');
    }
  };

  const handleViewProfile = () => {
    navigate('/teacher/profile');
    setIsOpen(false);
  };

  const handleEditProfile = () => {
    navigate('/teacher/profile');
    setIsOpen(false);
  };

  const handleBackdropClick = () => {
    setIsOpen(false);
  };

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent backdrop click handler
  };

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer pointer-events-auto"
      >
        <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center">
          <User size={16} className="text-white" />
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-black">{profile?.name}</p>
          <p className="text-xs text-gray-500 capitalize">{profile?.role}</p>
        </div>
        <ChevronDown size={16} className="text-gray-400" />
      </button>

      {isOpen &&
        createPortal(
          <>
            {/* Full-screen backdrop with z-[9998] */}
            <div
              onClick={handleBackdropClick}
              className="fixed inset-0 z-[9998] cursor-default pointer-events-auto"
              aria-hidden="true"
            />

            {/* Dropdown menu with z-[9999] */}
            <div
              onClick={handleMenuClick}
              style={{
                position: 'fixed',
                top: `${buttonPosition.top}px`,
                right: `${buttonPosition.right}px`,
                zIndex: 9999,
              }}
              className="w-48 bg-white border border-gray-200 rounded-lg shadow-lg pointer-events-auto"
            >
              <div className="p-2 border-b border-gray-100">
                <p className="text-sm font-medium text-black">{profile?.name}</p>
                <p className="text-xs text-gray-500 capitalize">{profile?.role}</p>
              </div>

              <div className="p-2 pointer-events-auto">
                <button
                  onClick={handleViewProfile}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer pointer-events-auto"
                >
                  <User size={16} className="text-gray-400" />
                  View Profile
                </button>
                <button
                  onClick={handleEditProfile}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer pointer-events-auto"
                >
                  <Settings size={16} className="text-gray-400" />
                  Edit Profile
                </button>
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer pointer-events-auto"
                >
                  <LogOut size={16} />
                  Sign Out
                </button>
              </div>
            </div>
          </>,
          document.body
        )}
    </>
  );
};

