import React, { useState } from 'react';
import { motion } from 'motion/react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  BookOpen, 
  Plus, 
  Edit, 
  Trash2, 
  Play, 
  Upload,
  FileText,
  Video,
  Image,
  Link,
  Clock,
  Users,
  Calendar,
  GripVertical
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useLessonManagement } from '../hooks/useLessonManagement';
import { useBatchManagement } from '../hooks/useBatchManagement';
import { GlassCard, PrimaryButton, StatusBadge } from '../components/UI';
import { Lesson, LessonStatus, Batch } from '../types';

export const TeacherBatchLessonsPage: React.FC = () => {
  const navigate = useNavigate();
  const { batchId } = useParams<{ batchId: string }>();
  const { profile: teacherProfile } = useAuth();
  const { lessons, loading, error, createLesson, updateLesson, deleteLesson, addMaterial, removeMaterial, reorderLessons } = useLessonManagement(batchId);
  const { getBatch } = useBatchManagement();
  
  const [batch, setBatch] = useState<Batch | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [draggedLesson, setDraggedLesson] = useState<Lesson | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    weekNumber: 1,
    order: 1,
    liveEnabled: true,
    duration: 60,
    scheduledDate: ''
  });

  // Fetch batch info
  React.useEffect(() => {
    if (batchId) {
      getBatch(batchId).then(setBatch).catch(console.error);
    }
  }, [batchId, getBatch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingLesson) {
        await updateLesson(editingLesson.id, formData);
        setEditingLesson(null);
      } else {
        await createLesson({
          ...formData,
          courseId: batch!.courseId,
          batchId: batchId!,
          teacherId: teacherProfile!.uid,
          status: 'published' as LessonStatus,
          materials: [],
          moduleId: '',
          durationMinutes: formData.duration
        });
      }
      
      setShowCreateForm(false);
      setFormData({
        title: '',
        description: '',
        weekNumber: 1,
        order: 1,
        liveEnabled: true,
        duration: 60,
        scheduledDate: ''
      });
    } catch (err) {
      console.error('Error saving lesson:', err);
      alert('Failed to save lesson');
    }
  };

  const handleEdit = (lesson: Lesson) => {
    setEditingLesson(lesson);
    setFormData({
      title: lesson.title,
      description: lesson.description,
      weekNumber: lesson.weekNumber,
      order: lesson.order,
      liveEnabled: lesson.liveEnabled,
      duration: lesson.duration || 60,
      scheduledDate: lesson.scheduledDate?.toDate().toISOString().split('T')[0] || ''
    });
    setShowCreateForm(true);
  };

  const handleDelete = async (lessonId: string) => {
    if (!window.confirm('Are you sure you want to delete this lesson?')) return;
    
    try {
      await deleteLesson(lessonId);
    } catch (err) {
      console.error('Error deleting lesson:', err);
      alert('Failed to delete lesson');
    }
  };

  const handleStartLiveClass = (lessonId: string) => {
    navigate(`/teacher/batches/${batchId}/lessons/${lessonId}/live`);
  };

  const handleDragStart = (lesson: Lesson) => {
    setDraggedLesson(lesson);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, targetLesson: Lesson) => {
    e.preventDefault();
    if (!draggedLesson || draggedLesson.id === targetLesson.id) return;

    try {
      const newOrder = [...lessons];
      const draggedIndex = newOrder.findIndex(l => l.id === draggedLesson.id);
      const targetIndex = newOrder.findIndex(l => l.id === targetLesson.id);
      
      newOrder.splice(draggedIndex, 1);
      newOrder.splice(targetIndex, 0, draggedLesson);
      
      const lessonIds = newOrder.map(l => l.id);
      await reorderLessons(lessonIds);
    } catch (err) {
      console.error('Error reordering lessons:', err);
      alert('Failed to reorder lessons');
    }
    
    setDraggedLesson(null);
  };

  const getMaterialIcon = (type: string) => {
    switch (type) {
      case 'document': return <FileText size={16} />;
      case 'video': return <Video size={16} />;
      case 'image': return <Image size={16} />;
      case 'link': return <Link size={16} />;
      default: return <FileText size={16} />;
    }
  };

  const getStatusColor = (status: LessonStatus) => {
    switch (status) {
      case 'published': return 'bg-green-500';
      case 'draft': return 'bg-yellow-500';
      case 'archived': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = (status: LessonStatus) => {
    switch (status) {
      case 'published': return 'Published';
      case 'draft': return 'Draft';
      case 'archived': return 'Archived';
      default: return 'Unknown';
    }
  };

  // Group lessons by week
  const lessonsByWeek = lessons.reduce((acc, lesson) => {
    if (!acc[lesson.weekNumber]) {
      acc[lesson.weekNumber] = [];
    }
    acc[lesson.weekNumber].push(lesson);
    return acc;
  }, {} as Record<number, Lesson[]>);

  const weekNumbers = Object.keys(lessonsByWeek).map(Number).sort((a, b) => a - b);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#6324eb]"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-red-500">{error}</p>
        </div>
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
          <h2 className="text-3xl font-semibold text-black mb-2 tracking-tight">
            {batch?.name || 'Batch'} - Lessons
          </h2>
          <p className="text-slate-400 font-medium">Create and manage lessons for this batch.</p>
        </div>
        <PrimaryButton
          onClick={() => setShowCreateForm(true)}
          className="flex items-center gap-2"
        >
          <Plus size={20} />
          Create Lesson
        </PrimaryButton>
      </div>

      {/* Create/Edit Form */}
      {showCreateForm && (
        <GlassCard className="p-6 border border-white/5">
          <h3 className="text-xl font-semibold text-black mb-6">
            {editingLesson ? 'Edit Lesson' : 'Create New Lesson'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Lesson Title</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-black placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#6324eb] focus:border-transparent"
                  placeholder="e.g., Introduction to IELTS Speaking"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Week Number</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={formData.weekNumber}
                  onChange={(e) => setFormData({ ...formData, weekNumber: parseInt(e.target.value) })}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-black placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#6324eb] focus:border-transparent"
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
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-black placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#6324eb] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Scheduled Date</label>
                <input
                  type="date"
                  value={formData.scheduledDate}
                  onChange={(e) => setFormData({ ...formData, scheduledDate: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-black placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#6324eb] focus:border-transparent"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-black placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#6324eb] focus:border-transparent"
                placeholder="Lesson objectives and content overview..."
              />
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-black">
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
              <PrimaryButton type="submit">
                {editingLesson ? 'Update Lesson' : 'Create Lesson'}
              </PrimaryButton>
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false);
                  setEditingLesson(null);
                }}
                className="px-6 py-3 bg-white/10 text-black rounded-xl hover:bg-white/20 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </GlassCard>
      )}

      {/* Lessons by Week */}
      {weekNumbers.map((weekNumber) => (
        <div key={weekNumber} className="space-y-4">
          <h3 className="text-xl font-semibold text-black flex items-center gap-2">
            <Calendar size={24} />
            Week {weekNumber}
          </h3>
          <div className="space-y-3">
            {lessonsByWeek[weekNumber].map((lesson) => (
              <div
                key={lesson.id}
                draggable
                onDragStart={() => handleDragStart(lesson)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, lesson)}
              >
              <GlassCard
                className="p-6 border border-white/5 hover:bg-white/[0.01] transition-colors cursor-move"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="mt-1 text-slate-500">
                      <GripVertical size={20} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="text-lg font-semibold text-black">{lesson.title}</h4>
                        <span className={`px-2 py-1 text-xs font-semibold text-black rounded-full ${getStatusColor(lesson.status)}`}>
                          {getStatusText(lesson.status)}
                        </span>
                        {lesson.liveEnabled && (
                          <span className="px-2 py-1 text-xs font-bold text-green-400 bg-green-500/20 rounded-full">
                            Live Enabled
                          </span>
                        )}
                      </div>
                      <p className="text-slate-400 text-sm mb-3">{lesson.description}</p>
                      
                      {lesson.materials.length > 0 && (
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
                          <Clock size={14} />
                          <span>{lesson.duration || 60} min</span>
                        </div>
                        {lesson.scheduledDate && (
                          <div className="flex items-center gap-1">
                            <Calendar size={14} />
                            <span>{lesson.scheduledDate.toDate().toLocaleDateString()}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <BookOpen size={14} />
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
                      onClick={() => navigate(`/teacher/batches/${batchId}/lessons/${lesson.id}/materials`)}
                      className="p-2 rounded-lg bg-white/5 text-slate-400 hover:text-black hover:bg-white/10 transition-colors"
                      title="Manage Materials"
                    >
                      <Upload size={16} />
                    </button>
                    <button
                      onClick={() => handleEdit(lesson)}
                      className="p-2 rounded-lg bg-white/5 text-slate-400 hover:text-black hover:bg-white/10 transition-colors"
                      title="Edit Lesson"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(lesson.id)}
                      className="p-2 rounded-lg bg-white/5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Delete Lesson"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </GlassCard>
              </div>
            ))}
          </div>
        </div>
      ))}

      {lessons.length === 0 && !loading && !error && (
        <div className="text-center py-24 bg-white/[0.02] rounded-3xl border border-dashed border-white/10">
          <BookOpen size={48} className="mx-auto text-slate-500/50 mb-4" />
          <h3 className="text-xl font-semibold text-black mb-2">No lessons created for this batch yet</h3>
          <p className="text-slate-500 mb-6">Create your first lesson to start building the curriculum for {batch?.name || 'this batch'}.</p>
          <PrimaryButton onClick={() => setShowCreateForm(true)}>
            <Plus size={20} className="mr-2" />
            Create Lesson
          </PrimaryButton>
        </div>
      )}

      {error && (
        <div className="text-center py-24 bg-red-500/10 rounded-3xl border border-red-500/30">
          <h3 className="text-xl font-semibold text-black mb-2">Failed to load lessons</h3>
          <p className="text-slate-400 mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors"
          >
            Try Again
          </button>
        </div>
      )}
    </motion.div>
  );
};

