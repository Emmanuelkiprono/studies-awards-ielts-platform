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

  const progressPercentage = (completedCount / tasks.length) * 100;

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 pb-24">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
        className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8"
      >
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="flex items-center gap-4 mb-6"
        >
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate('/student/dashboard')}
            className="w-9 h-9 bg-white/60 backdrop-blur-xl rounded-lg flex items-center justify-center border border-white/20 shadow-lg"
          >
            <ArrowLeft size={16} className="text-gray-700" />
          </motion.button>
          
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900 bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
              Today's Learning
            </h1>
            <p className="text-gray-600 text-sm mt-1">Focus on your daily tasks and make progress</p>
          </div>
        </motion.div>

        {/* Progress Overview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="bg-white/60 backdrop-blur-xl rounded-2xl p-4 mb-6 border border-white/20 shadow-xl"
        >
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Daily Progress */}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg">
                  <Target size={14} className="text-white" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-gray-900">Daily Progress</h2>
                  <p className="text-xs text-gray-600">Keep up the great work!</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-700">Completed Today</span>
                  <span className="text-xs font-bold text-indigo-600">{completedCount}/{tasks.length}</span>
                </div>
                
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercentage}%` }}
                    transition={{ duration: 1, delay: 0.5, ease: "easeInOut" }}
                    className="bg-gradient-to-r from-indigo-500 to-purple-600 h-2 rounded-full"
                  />
                </div>
                
                <p className="text-xs text-gray-500">
                  {progressPercentage === 100 
                    ? "🎉 Excellent! You've completed all today's tasks!"
                    : `${Math.round(progressPercentage)}% complete - ${tasks.length - completedCount} task${tasks.length - completedCount > 1 ? 's' : ''} remaining`
                  }
                </p>
              </div>
            </div>
            
            {/* Streak Indicator */}
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className="w-10 h-10 bg-gradient-to-br from-orange-100 to-red-100 rounded-lg flex items-center justify-center mb-1 shadow-lg">
                  <Flame size={20} className="text-orange-600" />
                </div>
                <p className="text-lg font-bold text-gray-900">{streak}</p>
                <p className="text-xs text-gray-600">Day Streak</p>
              </div>
              
              {progressPercentage === 100 && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.5, delay: 0.8 }}
                  className="text-center"
                >
                  <div className="w-10 h-10 bg-gradient-to-br from-yellow-100 to-amber-100 rounded-lg flex items-center justify-center mb-1 shadow-lg">
                    <Trophy size={20} className="text-yellow-600" />
                  </div>
                  <p className="text-xs font-bold text-gray-900">Perfect!</p>
                  <p className="text-xs text-gray-600">Daily Goal</p>
                </motion.div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Task List */}
        <div className="space-y-3">
          {tasks.map((task, index) => {
            const Icon = getTaskIcon(task.type);
            const color = getTaskColor(task.type);
            const isCompleted = task.status === 'completed';
            
            return (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: isCompleted ? 0.7 : 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 + index * 0.1 }}
                whileHover={{ scale: isCompleted ? 1 : 1.02, y: isCompleted ? 0 : -2 }}
                className={`relative ${isCompleted ? 'opacity-70' : ''}`}
              >
                {/* Glass morphism card */}
                <div className="bg-white/60 backdrop-blur-xl rounded-2xl border border-white/20 shadow-xl hover:shadow-2xl transition-all duration-300">
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      {/* Task Icon */}
                      <div className={`w-8 h-8 bg-gradient-to-br ${color} rounded-lg flex items-center justify-center shadow-lg ${isCompleted ? 'opacity-50' : ''} hover:scale-105 transition-transform duration-300`}>
                        <Icon size={16} className="text-white" />
                      </div>
                      
                      {/* Task Content */}
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-1">
                          <div>
                            <h3 className={`font-semibold text-gray-900 text-base mb-1 ${isCompleted ? 'line-through' : ''}`}>
                              {task.title}
                            </h3>
                            <p className="text-gray-600 text-xs mb-1 line-clamp-2">{task.description}</p>
                            
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              {task.duration && (
                                <span className="flex items-center gap-1">
                                  <Clock size={10} />
                                  {task.duration} min
                                </span>
                              )}
                              {task.time && (
                                <span className="flex items-center gap-1">
                                  <Calendar size={10} />
                                  {task.time}
                                </span>
                              )}
                              <span className="flex items-center gap-1">
                                <BookOpen size={10} />
                                {task.module}
                              </span>
                            </div>
                          </div>
                          
                          {/* Status Badge */}
                          <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                            isCompleted 
                              ? 'bg-green-100 text-green-700' 
                              : task.status === 'in_progress'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}>
                            {isCompleted ? 'Completed' : task.status === 'in_progress' ? 'In Progress' : 'Not Started'}
                          </div>
                        </div>
                        
                        {/* Action Buttons */}
                        <div className="flex items-center gap-2 mt-2">
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => handlePrimaryAction(task)}
                            disabled={isCompleted}
                            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-300 ${
                              isCompleted
                                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                : `bg-gradient-to-r ${color} text-white shadow-lg hover:shadow-xl`
                            }`}
                          >
                            {getPrimaryActionText(task)}
                            <ChevronRight size={12} className="inline ml-1" />
                          </motion.button>
                          
                          {!isCompleted && (
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => handleMarkAsComplete(task.id)}
                              className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors duration-300"
                            >
                              Mark as Complete
                            </motion.button>
                          )}
                          
                          {isCompleted && (
                            <div className="flex items-center gap-1 text-green-600">
                              <CheckCircle2 size={14} />
                              <span className="text-sm font-medium">Completed</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Motivational Message */}
        {progressPercentage === 100 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="mt-6 bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-4 border border-green-200"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center shadow-lg">
                <Trophy size={16} className="text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 text-base">Congratulations! 🎉</h3>
                <p className="text-gray-600 text-sm">You've completed all today's learning tasks. Keep up the amazing work!</p>
              </div>
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};
