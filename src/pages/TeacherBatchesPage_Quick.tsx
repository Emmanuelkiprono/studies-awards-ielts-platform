import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  Plus, 
  Edit, 
  Trash2, 
  Eye,
  Calendar,
  Clock,
  Layers,
  Search,
  Filter
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { db } from '../services/firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, serverTimestamp, doc, getDocs } from 'firebase/firestore';
import { GlassCard, PrimaryButton } from '../components/UI';

interface Batch {
  id: string;
  name: string;
  courseId: string;
  teacherId: string;
  startDate: any;
  weekNumber: number;
  status: 'active' | 'completed' | 'suspended' | 'upcoming';
  createdAt: any;
  currentStudents: number;
  maxStudents?: number;
}

export const TeacherBatchesPage_Quick: React.FC = () => {
  const navigate = useNavigate();
  const { profile: teacherProfile } = useAuth();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    courseId: teacherProfile?.assignedCourseId || '',
    weekNumber: 1,
    maxStudents: 30,
    status: 'active' as const,
    startDate: new Date().toISOString().split('T')[0]
  });

  // Load batches from Firestore with real-time student counts
  useEffect(() => {
    if (!teacherProfile?.uid) return;

    setLoading(true);
    const q = query(
      collection(db, 'batches'),
      where('teacherId', '==', teacherProfile.uid)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const batchesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Batch));

      // Calculate real student count for each batch
      const batchesWithCounts = await Promise.all(
        batchesData.map(async (batch) => {
          try {
            const studentsQuery = query(
              collection(db, 'students'),
              where('batchId', '==', batch.id)
            );
            const studentsSnapshot = await getDocs(studentsQuery);
            const realStudentCount = studentsSnapshot.size;
            
            console.log(`BATCH ${batch.id} REAL STUDENT COUNT:`, realStudentCount);
            
            return {
              ...batch,
              currentStudents: realStudentCount
            };
          } catch (error) {
            console.error(`Error counting students for batch ${batch.id}:`, error);
            return {
              ...batch,
              currentStudents: 0
            };
          }
        })
      );

      setBatches(batchesWithCounts);
      setLoading(false);
    }, (err) => {
      console.error('Error fetching batches:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [teacherProfile]);

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const newBatch = {
        name: formData.name,
        courseId: formData.courseId,
        teacherId: teacherProfile!.uid,
        weekNumber: formData.weekNumber,
        maxStudents: formData.maxStudents,
        currentStudents: 0,
        status: 'active',
        startDate: serverTimestamp(),
        createdAt: serverTimestamp()
      };

      console.log('CREATED BATCH PAYLOAD:', newBatch);
      console.log('CREATED BATCH COLLECTION PATH: collection(db, "batches")');
      
      await addDoc(collection(db, 'batches'), newBatch);
      setShowCreateForm(false);
      setFormData({
        name: '',
        courseId: teacherProfile?.assignedCourseId || '',
        weekNumber: 1,
        maxStudents: 30,
        status: 'active',
        startDate: new Date().toISOString().split('T')[0]
      });
    } catch (err) {
      console.error('Error creating batch:', err);
      alert('Failed to create batch');
    }
  };

  const handleDeleteBatch = async (batchId: string) => {
    if (!window.confirm('Are you sure you want to delete this batch?')) return;
    
    try {
      await deleteDoc(doc(db, 'batches', batchId));
    } catch (err) {
      console.error('Error deleting batch:', err);
      alert('Failed to delete batch');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'completed': return 'bg-blue-500';
      case 'suspended': return 'bg-red-500';
      case 'upcoming': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  const filteredBatches = batches.filter(batch =>
    batch.name.toLowerCase().includes(searchTerm.toLowerCase())
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
          <h2 className="text-3xl font-black text-white mb-2 tracking-tight">Batch Management</h2>
          <p className="text-slate-400 font-medium">Create and manage student cohorts for organized learning.</p>
        </div>
        <PrimaryButton
          onClick={() => setShowCreateForm(true)}
          className="flex items-center gap-2"
        >
          <Plus size={20} />
          Create Batch
        </PrimaryButton>
      </div>

      {/* Search and Filter */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <input
            type="text"
            placeholder="Search batches..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field pl-12 py-4 w-full"
          />
        </div>
        <button className="flex items-center gap-2 px-4 py-4 bg-white/5 border border-white/10 rounded-xl text-white hover:bg-white/10 transition-colors">
          <Filter size={18} />
          Filter
        </button>
      </div>

      {/* Create Batch Form */}
      {showCreateForm && (
        <GlassCard className="p-6 border border-white/5">
          <h3 className="text-xl font-bold text-white mb-6">Create New Batch</h3>
          <form onSubmit={handleCreateBatch} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Batch Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#6324eb] focus:border-transparent"
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
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#6324eb] focus:border-transparent"
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
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#6324eb] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Status</label>
                <select
                  required
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[#6324eb]"
                >
                  <option value="active">Active</option>
                  <option value="upcoming">Upcoming</option>
                  <option value="completed">Completed</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <PrimaryButton type="submit">Create Batch</PrimaryButton>
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

      {/* Batches Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredBatches.map((batch) => (
          <GlassCard key={batch.id} className="p-6 border border-white/5 hover:bg-white/[0.01] transition-colors">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="size-12 rounded-xl bg-[#6324eb]/10 flex items-center justify-center">
                  <Layers className="text-[#6324eb]" size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">{batch.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`px-2 py-1 text-xs font-bold text-white rounded-full ${getStatusColor(batch.status)}`}>
                      {batch.status.charAt(0).toUpperCase() + batch.status.slice(1)}
                    </span>
                    <span className="text-xs text-slate-500">Week {batch.weekNumber}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigate(`/teacher/batches/${batch.id}`)}
                  className="p-2 rounded-lg bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                  title="View Batch Details"
                >
                  <Eye size={16} />
                </button>
                <button
                  onClick={() => handleDeleteBatch(batch.id)}
                  className="p-2 rounded-lg bg-white/5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  title="Delete Batch"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-400">
                  <Users size={14} />
                  <span className="text-sm">Students</span>
                </div>
                <span className="text-sm font-bold text-white">
                  {batch.currentStudents}/{batch.maxStudents || '∞'}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-400">
                  <Calendar size={14} />
                  <span className="text-sm">Started</span>
                </div>
                <span className="text-sm text-white">
                  {batch.startDate?.toDate?.()?.toLocaleDateString() || 'N/A'}
                </span>
              </div>
            </div>

            <div className="mt-6">
              <button
                onClick={() => navigate(`/teacher/batches/${batch.id}`)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[#6324eb] text-white rounded-lg hover:bg-[#6324eb]/80 transition-colors"
              >
                <Eye size={16} />
                View Batch Details
              </button>
            </div>
          </GlassCard>
        ))}
      </div>

      {filteredBatches.length === 0 && (
        <div className="text-center py-24 bg-white/[0.02] rounded-3xl border border-dashed border-white/10">
          <Layers size={48} className="mx-auto text-slate-500/50 mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">No Batches Created</h3>
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
