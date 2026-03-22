import React, { useState } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  Calendar, 
  Clock, 
  Plus, 
  Edit, 
  Trash2, 
  Eye,
  BookOpen,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useBatchManagement } from '../hooks/useBatchManagement';
import { GlassCard, PrimaryButton, StatusBadge } from '../components/UI';
import { Batch, BatchStatus } from '../types';

export const TeacherBatchesPage: React.FC = () => {
  const navigate = useNavigate();
  const { profile: teacherProfile } = useAuth();
  const courseId = teacherProfile?.assignedCourseId;
  const { batches, loading, error, createBatch, updateBatch, deleteBatch, getBatchStudents } = useBatchManagement(courseId);
  
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    startDate: '',
    endDate: '',
    weekNumber: 1,
    maxStudents: 30,
    schedule: {
      weekdays: ['monday', 'wednesday', 'friday'],
      startTime: '09:00',
      endTime: '11:00'
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingBatch) {
        await updateBatch(editingBatch.id, formData);
        setEditingBatch(null);
      } else {
        await createBatch({
          ...formData,
          courseId: courseId!,
          teacherId: teacherProfile!.uid,
          status: 'active' as BatchStatus
        });
      }
      
      setShowCreateForm(false);
      setFormData({
        name: '',
        description: '',
        startDate: '',
        endDate: '',
        weekNumber: 1,
        maxStudents: 30,
        schedule: {
          weekdays: ['monday', 'wednesday', 'friday'],
          startTime: '09:00',
          endTime: '11:00'
        }
      });
    } catch (err) {
      console.error('Error saving batch:', err);
      alert('Failed to save batch');
    }
  };

  const handleEdit = (batch: Batch) => {
    setEditingBatch(batch);
    setFormData({
      name: batch.name,
      description: batch.description || '',
      startDate: batch.startDate.toDate().toISOString().split('T')[0],
      endDate: batch.endDate?.toDate().toISOString().split('T')[0] || '',
      weekNumber: batch.weekNumber,
      maxStudents: batch.maxStudents || 30,
      schedule: batch.schedule || {
        weekdays: ['monday', 'wednesday', 'friday'],
        startTime: '09:00',
        endTime: '11:00'
      }
    });
    setShowCreateForm(true);
  };

  const handleDelete = async (batchId: string) => {
    if (!window.confirm('Are you sure you want to delete this batch?')) return;
    
    try {
      await deleteBatch(batchId);
    } catch (err) {
      console.error('Error deleting batch:', err);
      alert('Failed to delete batch');
    }
  };

  const getStatusColor = (status: BatchStatus) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'completed': return 'bg-blue-500';
      case 'suspended': return 'bg-red-500';
      case 'upcoming': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = (status: BatchStatus) => {
    switch (status) {
      case 'active': return 'Active';
      case 'completed': return 'Completed';
      case 'suspended': return 'Suspended';
      case 'upcoming': return 'Upcoming';
      default: return 'Unknown';
    }
  };

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
          <AlertCircle className="mx-auto text-red-500 mb-4" size={48} />
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
          <h2 className="text-3xl font-semibold text-black mb-2 tracking-tight">Batch Management</h2>
          <p className="text-slate-400 font-medium">Organize students by cohorts and manage their learning journey.</p>
        </div>
        <PrimaryButton
          onClick={() => setShowCreateForm(true)}
          className="flex items-center gap-2"
        >
          <Plus size={20} />
          Create Batch
        </PrimaryButton>
      </div>

      {/* Create/Edit Form */}
      {showCreateForm && (
        <GlassCard className="p-6 border border-white/5">
          <h3 className="text-xl font-semibold text-black mb-6">
            {editingBatch ? 'Edit Batch' : 'Create New Batch'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Batch Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-black placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#6324eb] focus:border-transparent"
                  placeholder="e.g., Week 1 Cohort"
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
                <label className="block text-sm font-medium text-slate-300 mb-2">Start Date</label>
                <input
                  type="date"
                  required
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-black placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#6324eb] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">End Date (Optional)</label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-black placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#6324eb] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Max Students</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={formData.maxStudents}
                  onChange={(e) => setFormData({ ...formData, maxStudents: parseInt(e.target.value) })}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-black placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#6324eb] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Start Time</label>
                <input
                  type="time"
                  required
                  value={formData.schedule.startTime}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    schedule: { ...formData.schedule, startTime: e.target.value }
                  })}
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
                placeholder="Batch description and objectives..."
              />
            </div>
            <div className="flex items-center gap-4">
              <PrimaryButton type="submit">
                {editingBatch ? 'Update Batch' : 'Create Batch'}
              </PrimaryButton>
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false);
                  setEditingBatch(null);
                }}
                className="px-6 py-3 bg-white/10 text-black rounded-xl hover:bg-white/20 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </GlassCard>
      )}

      {/* Batches Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {batches.map((batch) => (
          <GlassCard key={batch.id} className="p-6 border border-white/5 hover:bg-white/[0.01] transition-colors">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="size-12 rounded-xl bg-[#6324eb]/10 flex items-center justify-center">
                  <Users className="text-[#6324eb]" size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-black">{batch.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`px-2 py-1 text-xs font-semibold text-black rounded-full ${getStatusColor(batch.status)}`}>
                      {getStatusText(batch.status)}
                    </span>
                    <span className="text-xs text-slate-500">Week {batch.weekNumber}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigate(`/teacher/batches/${batch.id}/lessons`)}
                  className="p-2 rounded-lg bg-white/5 text-slate-400 hover:text-black hover:bg-white/10 transition-colors"
                  title="View Lessons"
                >
                  <BookOpen size={16} />
                </button>
                <button
                  onClick={() => handleEdit(batch)}
                  className="p-2 rounded-lg bg-white/5 text-slate-400 hover:text-black hover:bg-white/10 transition-colors"
                  title="Edit Batch"
                >
                  <Edit size={16} />
                </button>
                <button
                  onClick={() => handleDelete(batch.id)}
                  className="p-2 rounded-lg bg-white/5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  title="Delete Batch"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            {batch.description && (
              <p className="text-slate-400 text-sm mb-4 line-clamp-2">{batch.description}</p>
            )}

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-400">
                  <Users size={14} />
                  <span className="text-sm">Students</span>
                </div>
                <span className="text-sm font-semibold text-black">
                  {batch.currentStudents}/{batch.maxStudents || 'âˆž'}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-400">
                  <Calendar size={14} />
                  <span className="text-sm">Started</span>
                </div>
                <span className="text-sm text-gray-700">
                  {batch.startDate.toDate().toLocaleDateString()}
                </span>
              </div>

              {batch.schedule && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Clock size={14} />
                    <span className="text-sm">Schedule</span>
                  </div>
                  <span className="text-sm text-gray-700">
                    {batch.schedule.weekdays.slice(0, 2).join(', ')} {batch.schedule.startTime}
                  </span>
                </div>
              )}
            </div>

            <div className="mt-6 flex items-center gap-3">
              <button
                onClick={() => navigate(`/teacher/batches/${batch.id}/students`)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-white/5 text-black rounded-lg hover:bg-white/10 transition-colors"
              >
                <Eye size={16} />
                View Students
              </button>
              <button
                onClick={() => navigate(`/teacher/batches/${batch.id}/attendance`)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-white/5 text-black rounded-lg hover:bg-white/10 transition-colors"
              >
                <TrendingUp size={16} />
                Attendance
              </button>
            </div>
          </GlassCard>
        ))}
      </div>

      {batches.length === 0 && (
        <div className="text-center py-24 bg-white/[0.02] rounded-3xl border border-dashed border-white/10">
          <Users size={48} className="mx-auto text-slate-500/50 mb-4" />
          <h3 className="text-xl font-semibold text-black mb-2">No Batches Created</h3>
          <p className="text-slate-500 mb-6">Create your first batch to start organizing students by cohorts.</p>
          <PrimaryButton onClick={() => setShowCreateForm(true)}>
            <Plus size={20} className="mr-2" />
            Create First Batch
          </PrimaryButton>
        </div>
      )}
    </motion.div>
  );
};

