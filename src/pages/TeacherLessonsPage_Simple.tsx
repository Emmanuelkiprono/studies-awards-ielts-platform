import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { 
  BookOpen, 
  Plus, 
  Edit, 
  Trash2, 
  Play,
  Upload,
  FileText,
  Video,
  Link,
  Calendar,
  Clock,
  Search,
  Filter,
  Layers
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { db } from '../services/firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, serverTimestamp, doc, getDoc, orderBy } from 'firebase/firestore';
import { GlassCard, PrimaryButton } from '../components/UI';

interface Lesson {
  id: string;
  courseId: string;
  batchId: string;
  weekNumber: number;
  title: string;
  description: string;
  materials: LessonMaterial[];
  order: number;
  liveEnabled: boolean;
  status: 'draft' | 'published' | 'archived';
  teacherId: string;
  createdAt: any;
  updatedAt: any;
  scheduledDate?: any;
  duration?: number;
}

interface LessonMaterial {
  id: string;
  name: string;
  type: 'document' | 'video' | 'image' | 'link' | 'assignment';
  url: string;
  uploadedAt: any;
}

interface Batch {
  id: string;
  name: string;
}

export const TeacherLessonsPage_Simple: React.FC = () => {
  const navigate = useNavigate();
  const { profile: teacherProfile } = useAuth();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBatch, setSelectedBatch] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    batchId: '',
    weekNumber: 1,
    order: 1,
    liveEnabled: true,
    duration: 60,
    scheduledDate: ''
  });

  // Fetch batches for this teacher
  useEffect(() => {
    if (!teacherProfile?.uid) return;

    const q = query(
      collection(db, 'batches'),
      where('teacherId', '==', teacherProfile.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const batchesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Batch));
      setBatches(batchesData);
    }, (err) => {
      console.error('Error fetching batches:', err);
    });

    return () => unsubscribe();
  }, [teacherProfile]);

  // Fetch lessons
  useEffect(() => {
    const whereConditions = [where('teacherId', '==', teacherProfile?.uid || '')];
    if (selectedBatch) {
      whereConditions.push(where('batchId', '==', selectedBatch));
    }

    const q = query(
      collection(db, 'lessons'),
      ...whereConditions,
      orderBy('order', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lessonsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Lesson));
      setLessons(lessonsData);
      setLoading(false);
    }, (err) => {
      console.error('Error fetching lessons:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [teacherProfile, selectedBatch]);

  const handleCreateLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const newLesson = {
        title: formData.title,
        description: formData.description,
        courseId: teacherProfile!.assignedCourseId || '',
        batchId: formData.batchId,
        weekNumber: formData.weekNumber,
        order: formData.order,
        liveEnabled: formData.liveEnabled,
        duration: formData.duration,
        status: 'published' as const,
        teacherId: teacherProfile!.uid,
        materials: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        scheduledDate: formData.scheduledDate ? new Date(formData.scheduledDate) : null
      };

      await addDoc(collection(db, 'lessons'), newLesson);
      setShowCreateForm(false);
      setFormData({
        title: '',
        description: '',
        batchId: '',
        weekNumber: 1,
        order: 1,
        liveEnabled: true,
        duration: 60,
        scheduledDate: ''
      });
    } catch (err) {
      console.error('Error creating lesson:', err);
      alert('Failed to create lesson');
    }
  };

  const handleDeleteLesson = async (lessonId: string) => {
    if (!window.confirm('Are you sure you want to delete this lesson?')) return;
    
    try {
      await deleteDoc(doc(db, 'lessons', lessonId));
    } catch (err) {
      console.error('Error deleting lesson:', err);
      alert('Failed to delete lesson');
    }
  };

  const handleStartLiveClass = (lessonId: string) => {
    // Navigate to live session page
    navigate(`/teacher/live-session/${lessonId}`);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published': return 'bg-green-500';
      case 'draft': return 'bg-yellow-500';
      case 'archived': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const getMaterialIcon = (type: string) => {
    switch (type) {
      case 'document': return <FileText size={16} />;
      case 'video': return <Video size={16} />;
      case 'link': return <Link size={16} />;
      default: return <FileText size={16} />;
    }
  };

  const filteredLessons = lessons.filter(lesson =>
    lesson.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#6324eb]"></div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 space-y-8 max-w-7xl mx-auto w-full pb-24"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-white mb-2 tracking-tight">Lesson Management</h2>
          <p className="text-slate-400 font-medium">Create and organize lesson content for your batches.</p>
        </div>
        <PrimaryButton
          onClick={() => setShowCreateForm(true)}
          className="flex items-center gap-2"
        >
          <Plus size={20} />
          Create Lesson
        </PrimaryButton>
      </div>

      {/* Search and Filter */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <input
            type="text"
            placeholder="Search lessons..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field pl-12 py-4 w-full"
          />
        </div>
        <select
          value={selectedBatch}
          onChange={(e) => setSelectedBatch(e.target.value)}
          className="px-4 py-4 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[#6324eb]"
        >
          <option value="">All Batches</option>
          {batches.map(batch => (
            <option key={batch.id} value={batch.id}>{batch.name}</option>
          ))}
        </select>
        <button className="flex items-center gap-2 px-4 py-4 bg-white/5 border border-white/10 rounded-xl text-white hover:bg-white/10 transition-colors">
          <Filter size={18} />
          Filter
        </button>
      </div>

      {/* Create Lesson Form */}
      {showCreateForm && (
        <GlassCard className="p-6 border border-white/5">
          <h3 className="text-xl font-bold text-white mb-6">Create New Lesson</h3>
          <form onSubmit={handleCreateLesson} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Lesson Title</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#6324eb] focus:border-transparent"
                  placeholder="e.g., Introduction to IELTS Speaking"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Batch</label>
                <select
                  required
                  value={formData.batchId}
                  onChange={(e) => setFormData({ ...formData, batchId: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[#6324eb]"
                >
                  <option value="">Select Batch</option>
                  {batches.map(batch => (
                    <option key={batch.id} value={batch.id}>{batch.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Week Number</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={formData.weekNumber}
                  onChange={(e) => setFormData({ ...formData, weekNumber: parseInt(e.target.value) })}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#6324eb] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Duration (minutes)</label>
                <input
                  type="number"
                  required
                  min="15"
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#6324eb] focus:border-transparent"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#6324eb] focus:border-transparent"
                placeholder="Lesson objectives and content overview..."
              />
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-white">
                <input
                  type="checkbox"
                  checked={formData.liveEnabled}
                  onChange={(e) => setFormData({ ...formData, liveEnabled: e.target.checked })}
                  className="w-4 h-4 rounded border-white/10 bg-white/5 text-[#6324eb] focus:ring-[#6324eb]"
                />
                Enable Live Classes
              </label>
            </div>
            <div className="flex items-center gap-4">
              <PrimaryButton type="submit">Create Lesson</PrimaryButton>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-6 py-3 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </GlassCard>
      )}

      {/* Lessons List */}
      <div className="space-y-4">
        {filteredLessons.map((lesson) => (
          <GlassCard key={lesson.id} className="p-6 border border-white/5">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4 flex-1">
                <div className="w-12 h-12 rounded-xl bg-[#6324eb]/10 flex items-center justify-center">
                  <BookOpen className="text-[#6324eb]" size={24} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h4 className="text-lg font-bold text-white">{lesson.title}</h4>
                    <span className={`px-2 py-1 text-xs font-bold text-white rounded-full ${getStatusColor(lesson.status)}`}>
                      {lesson.status.charAt(0).toUpperCase() + lesson.status.slice(1)}
                    </span>
                    {lesson.liveEnabled && (
                      <span className="px-2 py-1 text-xs font-bold text-green-400 bg-green-500/20 rounded-full">
                        Live Enabled
                      </span>
                    )}
                  </div>
                  <p className="text-slate-400 text-sm mb-3">{lesson.description}</p>
                  
                  {lesson.materials && lesson.materials.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {lesson.materials.map((material) => (
                        <div
                          key={material.id}
                          className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-lg text-xs text-slate-300"
                        >
                          {getMaterialIcon(material.type)}
                          <span>{material.name}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-4 text-sm text-slate-400">
                    <div className="flex items-center gap-1">
                      <Calendar size={14} />
                      <span>Week {lesson.weekNumber}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock size={14} />
                      <span>{lesson.duration || 60} min</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Layers size={14} />
                      <span>Order {lesson.order}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2 ml-4">
                {lesson.liveEnabled && (
                  <button
                    onClick={() => handleStartLiveClass(lesson.id)}
                    className="p-2 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors"
                    title="Start Live Class"
                  >
                    <Play size={16} />
                  </button>
                )}
                <button
                  onClick={() => handleDeleteLesson(lesson.id)}
                  className="p-2 rounded-lg bg-white/5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  title="Delete Lesson"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </GlassCard>
        ))}
      </div>

      {filteredLessons.length === 0 && (
        <div className="text-center py-24 bg-white/[0.02] rounded-3xl border border-dashed border-white/10">
          <BookOpen size={48} className="mx-auto text-slate-500/50 mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">No Lessons Created</h3>
          <p className="text-slate-500 mb-6">Create your first lesson to start building the curriculum.</p>
          <PrimaryButton onClick={() => setShowCreateForm(true)}>
            <Plus size={20} className="mr-2" />
            Create First Lesson
          </PrimaryButton>
        </div>
      )}
    </motion.div>
  );
};
