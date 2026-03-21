import React, { useState, useRef, useEffect } from 'react';
import { User, Settings, LogOut, ChevronDown } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

export const ProfileDropdown: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut();
      // Let onAuthStateChanged listener handle redirect to /auth
    } catch (error) {
      console.error('Sign out error:', error);
    }
    setIsOpen(false);
  };

  const handleViewProfile = () => {
    navigate('/teacher/profile');
    setIsOpen(false);
  };

  const handleEditProfile = () => {
    navigate('/teacher/profile');
    setIsOpen(false);
  };

  return (
    <div className="relative pointer-events-auto" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer pointer-events-auto"
      >
        <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center">
          <User size={16} className="text-white" />
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-gray-900">{profile?.name}</p>
          <p className="text-xs text-gray-500 capitalize">{profile?.role}</p>
        </div>
        <ChevronDown size={16} className="text-gray-400" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-[9999] pointer-events-auto">
          <div className="p-2 border-b border-gray-100">
            <p className="text-sm font-medium text-gray-900">{profile?.name}</p>
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
      )}
    </div>
  );
};
