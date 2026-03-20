import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../hooks/useAuth';
import {
  ArrowLeft,
  PlayCircle,
  Video,
  FileText,
  CheckCircle2,
  Clock,
  Calendar,
  Flame,
  Trophy,
  ChevronRight,
  BookOpen,
  Users,
  Timer,
  Sparkles,
  Target,
  Award,
  Coffee
} from 'lucide-react';
import '../styles/premium.css';

interface Task {
  id: string;
  type: 'lesson' | 'live_class' | 'assignment';
  title: string;
  description: string;
  duration?: number;
  time?: string;
  status: 'not_started' | 'in_progress' | 'completed';
  url?: string;
  module?: string;
}

export const TodaysLearning: React.FC = () => {
  const navigate = useNavigate();
  const { profile, studentData } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [completedCount, setCompletedCount] = useState(0);
  const [streak, setStreak] = useState(0);

  // Mock today's tasks - in real app, this would come from API
  useEffect(() => {
    const mockTasks: Task[] = [
      {
        id: '1',
        type: 'lesson',
        title: 'Introduction to IELTS Speaking',
        description: 'Learn the basics of IELTS Speaking test format',
        duration: 45,
        status: 'not_started',
        module: 'Module 1'
      },
      {
        id: '2',
        type: 'live_class',
        title: 'Live Speaking Practice Session',
        description: 'Join instructor for interactive speaking practice',
        time: '2:00 PM',
        status: 'not_started',
        module: 'Module 1'
      },
      {
        id: '3',
        type: 'assignment',
        title: 'Speaking Assessment Task',
        description: 'Record and submit your speaking response',
        duration: 30,
        status: 'not_started',
        module: 'Module 1'
      },
      {
        id: '4',
        type: 'lesson',
        title: 'Reading Comprehension Skills',
        description: 'Master strategies for IELTS Reading section',
        duration: 60,
        status: 'not_started',
        module: 'Module 2'
      },
      {
        id: '5',
        type: 'assignment',
        title: 'Reading Practice Test',
        description: 'Complete a timed reading passage with questions',
        duration: 40,
        status: 'not_started',
        module: 'Module 2'
      },
      {
        id: '6',
        type: 'live_class',
        title: 'Writing Workshop',
        description: 'Learn effective essay writing techniques',
        time: '4:00 PM',
        status: 'not_started',
        module: 'Module 3'
      }
    ];

    setTasks(mockTasks);
    setCompletedCount(0);
    setStreak((studentData as any)?.weeklyStreak || 5);
    setLoading(false);
  }, [studentData]);

  const handleMarkAsComplete = (taskId: string) => {
    setTasks(prevTasks => 
      prevTasks.map(task => 
        task.id === taskId 
          ? { ...task, status: 'completed' as const }
          : task
      )
    );
    
    setCompletedCount(prev => prev + 1);
  };

  const handlePrimaryAction = (task: Task) => {
    switch (task.type) {
      case 'lesson':
        navigate('/student/lessons');
        break;
      case 'live_class':
        navigate('/student/live');
        break;
      case 'assignment':
        navigate('/student/assignments');
        break;
    }
  };

  const getTaskIcon = (type: Task['type']) => {
    switch (type) {
      case 'lesson':
        return PlayCircle;
      case 'live_class':
        return Video;
      case 'assignment':
        return FileText;
      default:
        return BookOpen;
    }
  };

  const getTaskColor = (type: Task['type']) => {
    switch (type) {
      case 'lesson':
        return 'from-blue-500 to-indigo-600';
      case 'live_class':
        return 'from-purple-500 to-pink-600';
      case 'assignment':
        return 'from-green-500 to-emerald-600';
      default:
        return 'from-gray-500 to-gray-600';
    }
  };

  const getPrimaryActionText = (task: Task) => {
    switch (task.status) {
      case 'not_started':
        return task.type === 'live_class' ? 'Join' : 'Start';
      case 'in_progress':
        return 'Continue';
      case 'completed':
        return 'Review';
      default:
        return 'Start';
    }
  };

  // Safe data defaults
  const safeTasksList = Array.isArray(tasks) ? tasks : [];
  const progressPercentage = safeTasksList.length > 0 ? (completedCount / safeTasksList.length) * 100 : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-t-purple-400 rounded-full animate-spin animation-delay-150" />
        </div>
      </div>
    );
  }

  // REAL TODAY'S LEARNING CONTENT - SAFE VERSION
  console.log('🔍 TODAYS LEARNING PAGE RENDERING');
  
  // Safe data defaults
  const safeUserName = profile?.name || user?.user_metadata?.full_name || "Student";

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 pb-24">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-100">
        <div className="px-4 py-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/dashboard')}
              className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
            >
              <span className="text-gray-600">←</span>
            </button>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-gray-900">Today's Learning</h1>
              <p className="text-sm text-gray-500">Continue your IELTS journey</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Progress Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm">Completed</span>
              <span className="text-green-500 text-lg">✓</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{completedCount}</div>
            <div className="text-xs text-gray-500">of {safeTasksList.length} tasks</div>
          </div>

          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm">Progress</span>
              <span className="text-yellow-500 text-lg">🏆</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{Math.round(progressPercentage)}%</div>
            <div className="text-xs text-gray-500">completion rate</div>
          </div>

          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm">Streak</span>
              <span className="text-orange-500 text-lg">🔥</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{streak}</div>
            <div className="text-xs text-gray-500">days in a row</div>
          </div>
        </div>

        {/* Task List */}
        <div className="space-y-4">
          {safeTasksList.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-gray-400 text-2xl">📚</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No tasks today</h3>
              <p className="text-gray-600 text-sm">Take a break or review previous lessons</p>
            </div>
          ) : (
            safeTasksList.map((task, index) => {
              const isCompleted = task.status === 'completed';
              
              return (
                <div 
                  key={task.id}
                  className={`bg-white rounded-2xl p-4 shadow-sm border ${
                    isCompleted ? 'border-green-200 bg-green-50' : 'border-gray-100'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      task.type === 'lesson' ? 'bg-blue-100' :
                      task.type === 'live_class' ? 'bg-purple-100' :
                      'bg-green-100'
                    }`}>
                      <span className="text-lg">
                        {task.type === 'lesson' ? '📖' :
                         task.type === 'live_class' ? '🎥' : '📝'}
                      </span>
                    </div>
                    
                    <div className="flex-1">
                      <h3 className={`font-semibold text-gray-900 ${isCompleted ? 'line-through opacity-60' : ''}`}>
                        {task.title}
                      </h3>
                      <p className="text-gray-600 text-sm">{task.description}</p>
                      <div className="flex items-center gap-4 mt-2">
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          task.type === 'lesson' ? 'bg-blue-100 text-blue-700' :
                          task.type === 'live_class' ? 'bg-purple-100 text-purple-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {task.type.replace('_', ' ').charAt(0).toUpperCase() + task.type.replace('_', ' ').slice(1)}
                        </span>
                        <span className="text-xs text-gray-500">
                          ⏱️ {task.duration}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {!isCompleted && (
                        <button
                          onClick={() => handleMarkAsComplete(task.id)}
                          className="px-4 py-2 bg-blue-500 text-white rounded-xl text-sm font-medium hover:bg-blue-600 transition-colors"
                        >
                          Start
                        </button>
                      )}
                      
                      {isCompleted && (
                        <div className="flex items-center gap-1 text-green-600">
                          <span className="text-sm">✓</span>
                          <span className="text-sm font-medium">Done</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Motivational Message */}
        {completedCount === safeTasksList.length && safeTasksList.length > 0 && (
          <div className="mt-8 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl p-6 text-white text-center">
            <div className="text-2xl mb-2">🎉</div>
            <h3 className="font-semibold text-lg mb-2">Congratulations!</h3>
            <p className="text-sm opacity-90">You've completed all today's learning tasks. Keep up the amazing work!</p>
          </div>
        )}
      </div>
    </div>
  );

};
