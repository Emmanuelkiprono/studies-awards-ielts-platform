import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  Calendar, 
  Clock, 
  BookOpen, 
  Play, 
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Award,
  Target
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useLessonManagement } from '../hooks/useLessonManagement';
import { useBatchManagement } from '../hooks/useBatchManagement';
import { GlassCard, StatusBadge, PrimaryButton } from '../components/UI';
import { Lesson, Batch, StudentData } from '../types';

export const StudentBatchView: React.FC = () => {
  const navigate = useNavigate();
  const { studentData, user } = useAuth();
  const { getBatch } = useBatchManagement();
  const { getCurrentLesson, getLessonsByWeek } = useLessonManagement(studentData?.batchId);
  
  const [batch, setBatch] = useState<Batch | null>(null);
  const [currentLesson, setCurrentLesson] = useState<Lesson | null>(null);
  const [upcomingLessons, setUpcomingLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBatchData = async () => {
      if (!studentData?.batchId) return;
      
      try {
        // Fetch batch info
        const batchData = await getBatch(studentData.batchId);
        setBatch(batchData);
        
        // Fetch current lesson
        const currentLessonData = await getCurrentLesson(user!.uid);
        setCurrentLesson(currentLessonData);
        
        // Fetch upcoming lessons for current week
        if (currentLessonData) {
          const weekLessons = getLessonsByWeek(currentLessonData.weekNumber);
          const upcoming = weekLessons.filter(lesson => 
            lesson.id !== currentLessonData.id && lesson.status === 'published'
          );
          setUpcomingLessons(upcoming);
        }
      } catch (err) {
        console.error('Error fetching batch data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchBatchData();
  }, [studentData, user, getBatch, getCurrentLesson, getLessonsByWeek]);

  const handleJoinLiveClass = (lessonId: string) => {
    navigate(`/student/batches/${studentData?.batchId}/lessons/${lessonId}/live`);
  };

  const handleViewLesson = (lessonId: string) => {
    navigate(`/student/batches/${studentData?.batchId}/lessons/${lessonId}`);
  };

  const getProgressColor = (progress: number) => {
    if (progress >= 80) return 'text-green-400';
    if (progress >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getProgressBg = (progress: number) => {
    if (progress >= 80) return 'bg-green-500';
    if (progress >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#6324eb]"></div>
      </div>
    );
  }

  if (!batch || !studentData?.batchId) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <AlertCircle className="mx-auto text-slate-500 mb-4" size={48} />
          <h3 className="text-xl font-bold text-white mb-2">No Batch Assigned</h3>
          <p className="text-slate-500">You haven't been assigned to a batch yet. Please contact your teacher.</p>
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
          <h2 className="text-3xl font-black text-white mb-2 tracking-tight">{batch.name}</h2>
          <p className="text-slate-400 font-medium">
            Week {studentData.batchInfo?.currentWeek || 1} • {batch.currentStudents} Students
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-white mb-1">
            {studentData.batchInfo?.progressPercent || 0}%
          </div>
          <div className="text-sm text-slate-400">Progress</div>
        </div>
      </div>

      {/* Progress Bar */}
      <GlassCard className="p-6 border border-white/5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold text-white">Overall Progress</h3>
          <span className={`font-bold ${getProgressColor(studentData.batchInfo?.progressPercent || 0)}`}>
            {studentData.batchInfo?.progressPercent || 0}%
          </span>
        </div>
        <div className="w-full bg-white/10 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all duration-500 ${getProgressBg(studentData.batchInfo?.progressPercent || 0)}`}
            style={{ width: `${studentData.batchInfo?.progressPercent || 0}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-3 text-sm text-slate-400">
          <span>Current Week: {studentData.batchInfo?.currentWeek || 1}</span>
          <span>Target: Week {batch.weekNumber}</span>
        </div>
      </GlassCard>

      {/* Current Lesson */}
      {currentLesson && (
        <GlassCard className="p-6 border border-white/5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-white">Current Lesson</h3>
            <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm font-medium">
              Active
            </span>
          </div>
          
          <div className="space-y-4">
            <div>
              <h4 className="text-lg font-bold text-white mb-2">{currentLesson.title}</h4>
              <p className="text-slate-400 mb-4">{currentLesson.description}</p>
              
              <div className="flex items-center gap-4 text-sm text-slate-400">
                <div className="flex items-center gap-1">
                  <Calendar size={14} />
                  <span>Week {currentLesson.weekNumber}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock size={14} />
                  <span>{currentLesson.duration || 60} minutes</span>
                </div>
                {currentLesson.scheduledDate && (
                  <div className="flex items-center gap-1">
                    <Calendar size={14} />
                    <span>{currentLesson.scheduledDate.toDate().toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            </div>

            {currentLesson.materials.length > 0 && (
              <div>
                <h5 className="text-sm font-medium text-white mb-2">Materials</h5>
                <div className="flex flex-wrap gap-2">
                  {currentLesson.materials.map((material) => (
                    <a
                      key={material.id}
                      href={material.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-lg text-xs text-slate-300 hover:bg-white/10 transition-colors"
                    >
                      <BookOpen size={12} />
                      {material.name}
                    </a>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <PrimaryButton
                onClick={() => handleViewLesson(currentLesson.id)}
                className="flex items-center gap-2"
              >
                <BookOpen size={16} />
                View Lesson
              </PrimaryButton>
              {currentLesson.liveEnabled && (
                <button
                  onClick={() => handleJoinLiveClass(currentLesson.id)}
                  className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-colors"
                >
                  <Play size={16} />
                  Join Live Class
                </button>
              )}
            </div>
          </div>
        </GlassCard>
      )}

      {/* Upcoming Lessons */}
      {upcomingLessons.length > 0 && (
        <GlassCard className="p-6 border border-white/5">
          <h3 className="text-xl font-bold text-white mb-4">Upcoming Lessons</h3>
          <div className="space-y-3">
            {upcomingLessons.map((lesson) => (
              <div
                key={lesson.id}
                className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10 hover:bg-white/[0.01] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#6324eb]/10 flex items-center justify-center">
                    <BookOpen className="text-[#6324eb]" size={20} />
                  </div>
                  <div>
                    <h4 className="font-medium text-white">{lesson.title}</h4>
                    <div className="flex items-center gap-3 text-sm text-slate-400">
                      <span>Week {lesson.weekNumber}</span>
                      <span>{lesson.duration || 60} min</span>
                    </div>
                  </div>
                </div>
                
                <button
                  onClick={() => handleViewLesson(lesson.id)}
                  className="px-4 py-2 bg-white/5 text-white rounded-lg hover:bg-white/10 transition-colors"
                >
                  View
                </button>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Batch Info */}
      <GlassCard className="p-6 border border-white/5">
        <h3 className="text-xl font-bold text-white mb-4">Batch Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Batch Name</span>
              <span className="text-white font-medium">{batch.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Start Date</span>
              <span className="text-white font-medium">
                {batch.startDate.toDate().toLocaleDateString()}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Duration</span>
              <span className="text-white font-medium">{batch.weekNumber} Weeks</span>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Students</span>
              <span className="text-white font-medium">
                {batch.currentStudents}/{batch.maxStudents || '∞'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Status</span>
              <span className="text-white font-medium capitalize">{batch.status}</span>
            </div>
            {batch.schedule && (
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Schedule</span>
                <span className="text-white font-medium">
                  {batch.schedule.weekdays.slice(0, 2).join(', ')} {batch.schedule.startTime}
                </span>
              </div>
            )}
          </div>
        </div>
      </GlassCard>

      {/* Attendance Summary */}
      {studentData.batchInfo?.attendanceRate !== undefined && (
        <GlassCard className="p-6 border border-white/5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-white">Attendance Summary</h3>
            <div className="flex items-center gap-2">
              <TrendingUp className="text-green-400" size={20} />
              <span className="text-green-400 font-bold">
                {studentData.batchInfo.attendanceRate.toFixed(1)}%
              </span>
            </div>
          </div>
          
          <div className="text-center py-4">
            <div className="text-3xl font-bold text-white mb-2">
              {studentData.batchInfo.attendanceRate.toFixed(1)}%
            </div>
            <p className="text-slate-400 text-sm">
              Last attended: {studentData.batchInfo.lastAttendanceDate?.toDate().toLocaleDateString() || 'No records'}
            </p>
          </div>
        </GlassCard>
      )}
    </motion.div>
  );
};
