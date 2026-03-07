import React, { useState } from 'react';
import { GlassCard, PrimaryButton } from '../components/UI';
import { 
  Type as TypeIcon, 
  FileText, 
  Calendar, 
  Plus, 
  ArrowLeft,
  ChevronDown,
  Upload,
  CheckCircle2,
  Users,
  Volume2,
  BookOpen,
  PlayCircle
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { db } from '../services/firebase';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import { NotificationService } from '../services/notificationService';
import { FileUpload } from '../components/FileUpload';

interface CreateAssignmentPageProps {
  onBack: () => void;
  onSuccess: () => void;
}

export const CreateAssignmentPage: React.FC<CreateAssignmentPageProps> = ({ onBack, onSuccess }) => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'writing',
    dueDate: '',
  });
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [attachmentName, setAttachmentName] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const courseId = profile?.assignedCourseId;
      if (!courseId) {
        alert('No course assigned to your profile.');
        setLoading(false);
        return;
      }

      await addDoc(collection(db, 'assignments'), {
        ...formData,
        courseId,
        createdBy: profile?.uid,
        createdAt: new Date().toISOString(),
        attachmentUrl: attachmentUrl || null,
        attachmentName: attachmentName || null,
      });

      // Notify enrolled students
      const enrollSnap = await getDocs(query(
        collection(db, 'enrollments'),
        where('courseId', '==', courseId)
      ));
      await Promise.all(enrollSnap.docs.map(d =>
        NotificationService.create(
          d.data().userId,
          'New Assignment Posted',
          `"${formData.title}" has been assigned. Due: ${formData.dueDate ? new Date(formData.dueDate).toLocaleDateString() : 'TBD'}.`,
          'info',
          '/tasks'
        )
      ));

      setLoading(false);
      onSuccess();
    } catch (error) {
      console.error("Error creating assignment:", error);
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="p-4 space-y-6 max-w-2xl mx-auto w-full pb-24"
    >
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button 
          onClick={onBack}
          className="flex items-center justify-center size-10 rounded-full bg-slate-800/50 hover:bg-slate-700/50 transition-colors border border-white/10"
        >
          <ArrowLeft size={20} className="text-slate-100" />
        </button>
        <div className="flex flex-col">
          <h1 className="text-sm font-semibold tracking-wider text-[#3b82f6] uppercase">Instructor Portal</h1>
          <p className="text-xs text-slate-400">Studies & Awards IELTS Academy</p>
        </div>
      </div>

      {/* Form Container */}
      <GlassCard className="p-8 shadow-2xl relative overflow-hidden bg-[#161b33]/70">
        {/* Decorative Blue Glow */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#6324eb]/20 blur-[80px] rounded-full"></div>
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-[#3b82f6]/10 blur-[80px] rounded-full"></div>
        
        <div className="mb-8 relative z-10">
          <h2 className="text-3xl font-bold text-white mb-2">Create Assignment</h2>
          <p className="text-slate-400">Design a new task for your IELTS students</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
          {/* Title Input */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-300 px-1">Assignment Title</label>
            <div className="relative">
              <input 
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="input-field pr-12" 
                placeholder="e.g. Academic Writing Task 1: Line Graph" 
                type="text"
              />
              <FileText size={20} className="absolute right-4 top-3.5 text-slate-500" />
            </div>
          </div>

          {/* Description Textarea */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-300 px-1">Description & Instructions</label>
            <textarea 
              required
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="input-field min-h-[120px] resize-none" 
              placeholder="Provide detailed instructions, word count requirements, and scoring criteria..." 
              rows={4}
            />
          </div>

          {/* Assignment Type Selection */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-slate-300 px-1">Assignment Type</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { id: 'writing', label: 'Writing', icon: FileText },
                { id: 'listening', label: 'Listening', icon: Volume2 },
                { id: 'reading', label: 'Reading', icon: BookOpen },
                { id: 'speaking', label: 'Speaking', icon: PlayCircle },
                { id: 'vocabulary', label: 'Vocabulary', icon: TypeIcon },
              ].map((type) => {
                const Icon = type.icon;
                const isSelected = formData.type === type.id;
                return (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setFormData({ ...formData, type: type.id })}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-xl border transition-all text-left",
                      isSelected 
                        ? "bg-[#6324eb]/20 border-[#6324eb] text-white shadow-lg shadow-[#6324eb]/10" 
                        : "bg-white/5 border-white/5 text-slate-400 hover:bg-white/10 hover:border-white/10"
                    )}
                  >
                    <div className={cn(
                      "p-2 rounded-lg",
                      isSelected ? "bg-[#6324eb] text-white" : "bg-white/5 text-slate-500"
                    )}>
                      <Icon size={16} />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider">{type.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Due Date */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-300 px-1">Due Date</label>
            <div className="relative">
              <input 
                required
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                className="input-field [color-scheme:dark]" 
                type="date"
              />
              <Calendar size={20} className="absolute right-4 top-3.5 text-slate-500 pointer-events-none" />
            </div>
          </div>

          {/* File Upload */}
          <FileUpload
            folder="assignments"
            label="Upload Resource / Template (optional)"
            value={attachmentUrl}
            fileName={attachmentName}
            onUploaded={(url, name) => { setAttachmentUrl(url); setAttachmentName(name); }}
            onClear={() => { setAttachmentUrl(''); setAttachmentName(''); }}
          />

          {/* Submit Button */}
          <div className="pt-4">
            <PrimaryButton 
              type="submit"
              loading={loading}
              className="w-full py-4 text-lg"
            >
              <Plus size={20} /> Create Assignment
            </PrimaryButton>
          </div>
        </form>
      </GlassCard>

      {/* Footer Info */}
      <div className="flex flex-wrap items-center justify-center gap-8 text-slate-500 text-sm mt-8">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={16} className="text-[#3b82f6]" />
          <span>AI-Powered Grading Enabled</span>
        </div>
        <div className="flex items-center gap-2">
          <Users size={16} className="text-[#3b82f6]" />
          <span>Shared with 24 Students</span>
        </div>
      </div>
    </motion.div>
  );
};
