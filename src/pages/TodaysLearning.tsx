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

  // TEMPORARY TEST: Isolate the white screen issue
  console.log('🔍 TODAYS LEARNING COMPONENT MOUNTING');
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center shadow-lg">
        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-blue-600 text-xl">📚</span>
        </div>
        <h3 className="text-lg font-bold text-gray-900 mb-2">Continue Learning</h3>
        <p className="text-gray-600 text-sm mb-4">Route works! Page is loading correctly.</p>
        <div className="text-xs text-gray-500">
          <p>Tasks: {tasks?.length || 0}</p>
          <p>Loading: {loading ? 'Yes' : 'No'}</p>
          <p>Profile: {profile?.name || 'No profile'}</p>
        </div>
        <button 
          onClick={() => navigate('/dashboard')}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg text-sm"
        >
          Back to Home
        </button>
      </div>
    </div>
  );

};
