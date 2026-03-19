import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  Users, 
  BookOpen, 
  Plus, 
  Edit, 
  Trash2, 
  Play, 
  Calendar,
  Clock,
  Layers,
  ArrowLeft,
  User,
  Mail,
  CreditCard,
  TrendingUp,
  FileText
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { db } from '../services/firebase';
import { collection, query, where, getDocs, doc, getDoc, onSnapshot, orderBy } from 'firebase/firestore';
import { GlassCard, PrimaryButton, StatusBadge } from '../components/UI';

interface Batch {
  id: string;
  name: string;
  courseId: string;
  teacherId: string;
  startDate: any;
  weekNumber: number;
  status: 'active' | 'completed' | 'suspended' | 'upcoming';
  currentStudents: number;
  maxStudents?: number;
  createdAt: any;
}

interface Student {
  uid: string;
  name: string;
  email: string;
  trainingStatus: string;
  paymentStatus: string;
  progress?: number;
  batchId: string;
}

interface Lesson {
  id: string;
  title: string;
  weekNumber: number;
  order: number;
  materialsCount: number;
  liveEnabled: boolean;
  batchId: string;
}

export const TeacherBatchDetailsPage: React.FC = () => {
  const navigate = useNavigate();
  const { batchId } = useParams<{ batchId: string }>();
  const { profile: teacherProfile } = useAuth();
  
  const [batch, setBatch] = useState<Batch | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  console.log('OPENING BATCH DETAILS:', batchId);

  // Load batch details
  useEffect(() => {
    if (!batchId) return;

    setLoading(true);
    console.log('OPENING BATCH DETAILS:', batchId);

    const batchRef = doc(db, 'batches', batchId);
    const unsubscribeBatch = onSnapshot(batchRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const batchData = {
          id: docSnapshot.id,
          ...docSnapshot.data()
        } as Batch;
        
        console.log('BATCH DATA:', batchData);
        setBatch(batchData);
        setError(null);
      } else {
        setError('Batch not found');
        setLoading(false);
      }
    }, (err) => {
      console.error('Error loading batch:', err);
      setError('Failed to load batch');
      setLoading(false);
    });

    return () => unsubscribeBatch();
  }, [batchId]);

  // Load students for this batch
  useEffect(() => {
    if (!batchId) return;

    const studentsQuery = query(
      collection(db, 'students'),
      where('batchId', '==', batchId)
    );

    const unsubscribeStudents = onSnapshot(studentsQuery, (snapshot) => {
      const studentsData = snapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data()
      } as Student));
      
      console.log('BATCH STUDENTS:', studentsData);
      setStudents(studentsData);
    }, (err) => {
      console.error('Error loading students:', err);
    });

    return () => unsubscribeStudents();
  }, [batchId]);

  // Load lessons for this batch
  useEffect(() => {
    if (!batchId) return;

    const lessonsQuery = query(
      collection(db, 'lessons'),
      where('batchId', '==', batchId),
      orderBy('weekNumber', 'asc'),
      orderBy('order', 'asc')
    );

    const unsubscribeLessons = onSnapshot(lessonsQuery, (snapshot) => {
      const lessonsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Lesson));
      
      console.log('BATCH LESSONS:', lessonsData);
      setLessons(lessonsData);
      setLoading(false);
    }, (err) => {
      console.error('BATCH LESSONS ERROR:', err);
      setError('Failed to load lessons');
      setLoading(false);
    });

    return () => unsubscribeLessons();
  }, [batchId]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'completed': return 'bg-blue-500';
      case 'suspended': return 'bg-red-500';
      case 'upcoming': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  const getTrainingStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'completed': return 'bg-blue-500';
      case 'locked': return 'bg-red-500';
      case 'inactive': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#6324eb]"></div>
      </div>
    );
  }

  if (error || !batch) {
    return (
      <div className="text-center py-24 bg-red-500/10 rounded-3xl border border-red-500/30">
        <h3 className="text-xl font-bold text-white mb-2">Error</h3>
        <p className="text-slate-400 mb-6">{error || 'Batch not found'}</p>
        <button
          onClick={() => navigate('/teacher/batches')}
          className="px-6 py-3 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors"
        >
          Back to Batches
        </button>
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
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/teacher/batches')}
          className="p-2 rounded-lg bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h2 className="text-3xl font-black text-white mb-2 tracking-tight">{batch.name}</h2>
          <p className="text-slate-400 font-medium">Batch Details and Management</p>
        </div>
      </div>

      {/* Batch Summary */}
      <GlassCard className="p-6 border border-white/5">
        <h3 className="text-xl font-bold text-white mb-6">Batch Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div>
            <div className="flex items-center gap-2 text-slate-400 mb-1">
              <Layers size={16} />
              <span className="text-sm">Status</span>
            </div>
            <span className={`px-3 py-1 text-xs font-bold text-white rounded-full ${getStatusColor(batch.status)}`}>
              {batch.status.charAt(0).toUpperCase() + batch.status.slice(1)}
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2 text-slate-400 mb-1">
              <Users size={16} />
              <span className="text-sm">Students</span>
            </div>
            <span className="text-lg font-bold text-white">{students.length}/{batch.maxStudents || '∞'}</span>
          </div>
          <div>
            <div className="flex items-center gap-2 text-slate-400 mb-1">
              <Calendar size={16} />
              <span className="text-sm">Week</span>
            </div>
            <span className="text-lg font-bold text-white">Week {batch.weekNumber}</span>
          </div>
          <div>
            <div className="flex items-center gap-2 text-slate-400 mb-1">
              <Clock size={16} />
              <span className="text-sm">Started</span>
            </div>
            <span className="text-lg font-bold text-white">
              {batch.startDate?.toDate?.()?.toLocaleDateString() || 'N/A'}
            </span>
          </div>
        </div>
      </GlassCard>

      {/* Students in this Batch */}
      <GlassCard className="p-6 border border-white/5">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-white">Students in this Batch</h3>
          <div className="text-sm text-slate-400">{students.length} students</div>
        </div>
        
        {students.length === 0 ? (
          <div className="text-center py-12 bg-white/[0.02] rounded-2xl border border-dashed border-white/10">
            <Users size={48} className="mx-auto text-slate-500/50 mb-4" />
            <h4 className="text-lg font-bold text-white mb-2">No students assigned to this batch yet</h4>
            <p className="text-slate-500">Students will appear here once they are approved and assigned to this batch.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-slate-400 text-sm border-b border-white/10">
                  <th className="pb-3 font-medium">Name</th>
                  <th className="pb-3 font-medium">Email</th>
                  <th className="pb-3 font-medium">Training Status</th>
                  <th className="pb-3 font-medium">Payment Status</th>
                  <th className="pb-3 font-medium">Progress</th>
                </tr>
              </thead>
              <tbody className="text-white">
                {students.map((student) => (
                  <tr key={student.uid} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#6324eb]/10 flex items-center justify-center">
                          <User size={16} className="text-[#6324eb]" />
                        </div>
                        <span className="font-medium">{student.name}</span>
                      </div>
                    </td>
                    <td className="py-4">
                      <div className="flex items-center gap-2 text-slate-400">
                        <Mail size={14} />
                        <span className="text-sm">{student.email}</span>
                      </div>
                    </td>
                    <td className="py-4">
                      <span className={`px-2 py-1 text-xs font-bold text-white rounded-full ${getTrainingStatusColor(student.trainingStatus)}`}>
                        {student.trainingStatus || 'Unknown'}
                      </span>
                    </td>
                    <td className="py-4">
                      <div className="flex items-center gap-2">
                        <CreditCard size={14} className="text-slate-400" />
                        <span className="text-sm">{student.paymentStatus || 'Unknown'}</span>
                      </div>
                    </td>
                    <td className="py-4">
                      <div className="flex items-center gap-2">
                        <TrendingUp size={14} className="text-slate-400" />
                        <span className="text-sm">{student.progress || 0}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      {/* Lessons in this Batch */}
      <GlassCard className="p-6 border border-white/5">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-white">Lessons in this Batch</h3>
          <div className="flex items-center gap-4">
            <div className="text-sm text-slate-400">{lessons.length} lessons</div>
            <PrimaryButton onClick={() => navigate(`/teacher/batches/${batchId}/lessons`)}>
              <Plus size={16} className="mr-2" />
              Create Lesson
            </PrimaryButton>
          </div>
        </div>

        {lessons.length === 0 ? (
          <div className="text-center py-12 bg-white/[0.02] rounded-2xl border border-dashed border-white/10">
            <BookOpen size={48} className="mx-auto text-slate-500/50 mb-4" />
            <h4 className="text-lg font-bold text-white mb-2">No lessons created for this batch yet</h4>
            <p className="text-slate-500 mb-6">Create your first lesson to start building the curriculum for {batch.name}.</p>
            <PrimaryButton onClick={() => navigate(`/teacher/batches/${batchId}/lessons`)}>
              <Plus size={16} className="mr-2" />
              Create Lesson
            </PrimaryButton>
          </div>
        ) : (
          <div className="space-y-4">
            {lessons.map((lesson) => (
              <div key={lesson.id} className="p-4 bg-white/[0.02] rounded-xl border border-white/5 hover:bg-white/[0.04] transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-[#6324eb]/10 flex items-center justify-center">
                      <BookOpen size={20} className="text-[#6324eb]" />
                    </div>
                    <div>
                      <h4 className="font-bold text-white">{lesson.title}</h4>
                      <div className="flex items-center gap-4 mt-1 text-sm text-slate-400">
                        <span>Week {lesson.weekNumber}</span>
                        <span>Order {lesson.order}</span>
                        <span>{lesson.materialsCount || 0} materials</span>
                        {lesson.liveEnabled && (
                          <span className="flex items-center gap-1 text-green-400">
                            <Play size={12} />
                            Live Enabled
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => navigate(`/teacher/batches/${batchId}/lessons/${lesson.id}`)}
                      className="p-2 rounded-lg bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                      title="View Lesson"
                    >
                      <FileText size={16} />
                    </button>
                    <button
                      onClick={() => navigate(`/teacher/batches/${batchId}/lessons/${lesson.id}/live`)}
                      className="p-2 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors"
                      title="Start Live Session"
                    >
                      <Play size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </motion.div>
  );
};
