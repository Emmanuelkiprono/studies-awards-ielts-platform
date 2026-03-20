import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Mail, Phone, Briefcase, Save, ArrowLeft } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { GlassCard } from '../components/UI';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

interface TeacherProfileData {
  name: string;
  email: string;
  phone: string;
  title: string;
  bio: string;
  avatarUrl?: string;
}

export const TeacherProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState<TeacherProfileData>({
    name: '',
    email: '',
    phone: '',
    title: '',
    bio: '',
    avatarUrl: ''
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        name: profile.name || '',
        email: profile.email || '',
        phone: profile.phone || '',
        title: profile.title || '',
        bio: profile.bio || '',
        avatarUrl: profile.avatarUrl || ''
      });
      setLoading(false);
    }
  }, [profile]);

  const handleInputChange = (field: keyof TeacherProfileData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    setSuccess(false);
  };

  const handleSave = async () => {
    if (!user || !profile) return;

    setSaving(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        name: formData.name,
        phone: formData.phone,
        title: formData.title,
        bio: formData.bio,
        avatarUrl: formData.avatarUrl,
        updatedAt: new Date()
      });

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error('Error updating profile:', error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#6324eb]"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => navigate('/teacher/dashboard')}
          className="p-2 rounded-lg bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-3xl font-black text-white mb-2 tracking-tight">Profile Settings</h1>
          <p className="text-slate-400 font-medium">Manage your teacher profile information</p>
        </div>
      </div>

      {/* Success Message */}
      {success && (
        <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
          <p className="text-green-400 font-medium">Profile updated successfully!</p>
        </div>
      )}

      <GlassCard className="p-8 border border-white/5">
        <div className="space-y-8">
          {/* Profile Picture */}
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 bg-purple-600 rounded-full flex items-center justify-center">
              <User size={40} className="text-white" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-white mb-2">Profile Picture</h3>
              <p className="text-slate-400 mb-4">Upload a professional headshot</p>
              <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
                Change Photo
              </button>
            </div>
          </div>

          {/* Basic Information */}
          <div>
            <h3 className="text-xl font-semibold text-white mb-6">Basic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-slate-400 mb-2">
                  <User size={16} />
                  Full Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:bg-white/10 transition-colors"
                  placeholder="Enter your full name"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-slate-400 mb-2">
                  <Mail size={16} />
                  Email Address
                </label>
                <input
                  type="email"
                  value={formData.email}
                  disabled
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-slate-500 placeholder-slate-600 cursor-not-allowed"
                  placeholder="Email cannot be changed"
                />
                <p className="text-xs text-slate-500 mt-2">Email cannot be changed. Contact admin if needed.</p>
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-slate-400 mb-2">
                  <Phone size={16} />
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:bg-white/10 transition-colors"
                  placeholder="+1 (555) 123-4567"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-slate-400 mb-2">
                  <Briefcase size={16} />
                  Professional Title
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:bg-white/10 transition-colors"
                  placeholder="e.g. Senior English Teacher"
                />
              </div>
            </div>
          </div>

          {/* Bio */}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">
              Professional Bio
            </label>
            <textarea
              value={formData.bio}
              onChange={(e) => handleInputChange('bio', e.target.value)}
              rows={4}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:bg-white/10 transition-colors resize-none"
              placeholder="Tell us about your teaching experience, expertise, and approach..."
            />
          </div>

          {/* Account Information */}
          <div>
            <h3 className="text-xl font-semibold text-white mb-6">Account Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-slate-400 mb-2">
                  <User size={16} />
                  Role
                </label>
                <input
                  type="text"
                  value={profile?.role || ''}
                  disabled
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-slate-500 cursor-not-allowed capitalize"
                />
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-slate-400 mb-2">
                  <Mail size={16} />
                  User ID
                </label>
                <input
                  type="text"
                  value={profile?.uid || ''}
                  disabled
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-slate-500 cursor-not-allowed font-mono text-sm"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-6 border-t border-white/10">
            <div className="text-sm text-slate-400">
              Last updated: {profile?.updatedAt ? new Date(profile.updatedAt).toLocaleDateString() : 'Never'}
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/teacher/dashboard')}
                className="px-6 py-3 bg-white/5 text-white rounded-lg hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save size={20} />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      </GlassCard>
    </div>
  );
};
