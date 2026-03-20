import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

interface Task {
  id: string;
  type: 'lesson' | 'live_class' | 'assignment';
  title: string;
  description: string;
  duration: string;
  module: string;
  status: 'not_started' | 'in_progress' | 'completed';
}

export function TodaysLearning() {
  console.log('🔍 TODAYS LEARNING MOUNTED - COMPACT VERSION');
  const navigate = useNavigate();
  
  // Sample tasks - will be replaced with real data later
  const [tasks, setTasks] = useState<Task[]>([
    {
      id: '1',
      type: 'lesson',
      title: 'Introduction to IELTS Speaking',
      description: 'Learn fundamental speaking techniques and pronunciation',
      duration: '45 min',
      module: 'Module 1',
      status: 'not_started'
    },
    {
      id: '2',
      type: 'live_class',
      title: 'Live Speaking Practice',
      description: 'Join instructor for interactive speaking session',
      duration: '2:00 PM',
      module: 'Module 1',
      status: 'not_started'
    },
    {
      id: '3',
      type: 'assignment',
      title: 'Speaking Assessment Task',
      description: 'Record and submit your speaking sample for evaluation',
      duration: '30 min',
      module: 'Module 1',
      status: 'not_started'
    }
  ]);

  const completedCount = tasks.filter(task => task.status === 'completed').length;
  const progressPercentage = tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0;
  const streak = 5; // Will be dynamic later

  const handleStartTask = (taskId: string) => {
    setTasks(prevTasks => 
      prevTasks.map(task => 
        task.id === taskId 
          ? { ...task, status: 'in_progress' as const }
          : task
      )
    );
  };

  const handleMarkComplete = (taskId: string) => {
    setTasks(prevTasks => 
      prevTasks.map(task => 
        task.id === taskId 
          ? { ...task, status: 'completed' as const }
          : task
      )
    );
  };

  const getTaskIcon = (type: Task['type']) => {
    switch (type) {
      case 'lesson':
        return '📖';
      case 'live_class':
        return '🎥';
      case 'assignment':
        return '📝';
      default:
        return '📖';
    }
  };

  const getTaskColor = (type: Task['type']) => {
    switch (type) {
      case 'lesson':
        return 'bg-blue-100 text-blue-700';
      case 'live_class':
        return 'bg-purple-100 text-purple-700';
      case 'assignment':
        return 'bg-green-100 text-green-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getActionButton = (task: Task) => {
    if (task.status === 'completed') {
      return (
        <div className="flex items-center gap-1 text-green-600">
          <span className="text-sm">✓</span>
          <span className="text-sm font-medium">Done</span>
        </div>
      );
    }

    const buttonText = task.status === 'in_progress' ? 'Continue' : 
      task.type === 'live_class' ? 'Join' : 'Start';

    return (
      <button
        onClick={() => handleStartTask(task.id)}
        className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
      >
        {buttonText}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 pb-24">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-100">
        <div className="px-4 py-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate("/dashboard")}
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
        {/* Combined Summary Card */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-6">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="flex items-center justify-center mb-1">
                <span className="text-green-500 text-sm mr-1">✓</span>
                <span className="text-gray-600 text-sm">Completed</span>
              </div>
              <div className="text-xl font-bold text-gray-900">{completedCount}</div>
              <div className="text-xs text-gray-500">of {tasks.length} tasks</div>
            </div>
            
            <div>
              <div className="flex items-center justify-center mb-1">
                <span className="text-yellow-500 text-sm mr-1">🏆</span>
                <span className="text-gray-600 text-sm">Progress</span>
              </div>
              <div className="text-xl font-bold text-gray-900">{Math.round(progressPercentage)}%</div>
              <div className="text-xs text-gray-500">completion</div>
            </div>
            
            <div>
              <div className="flex items-center justify-center mb-1">
                <span className="text-orange-500 text-sm mr-1">🔥</span>
                <span className="text-gray-600 text-sm">Streak</span>
              </div>
              <div className="text-xl font-bold text-gray-900">{streak}</div>
              <div className="text-xs text-gray-500">days</div>
            </div>
          </div>
        </div>

        {/* Task List */}
        <div className="space-y-3">
          {tasks.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-gray-400 text-2xl">📚</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No tasks today</h3>
              <p className="text-gray-600 text-sm">Take a break or review previous lessons</p>
            </div>
          ) : (
            tasks.map((task) => (
              <div 
                key={task.id}
                className={`bg-white rounded-2xl p-4 shadow-sm border ${
                  task.status === 'completed' ? 'border-green-200 bg-green-50' : 'border-gray-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm ${getTaskColor(task.type)}`}>
                    {getTaskIcon(task.type)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className={`font-semibold text-gray-900 text-sm truncate ${
                      task.status === 'completed' ? 'line-through opacity-60' : ''
                    }`}>
                      {task.title}
                    </h3>
                    <p className="text-gray-600 text-xs truncate">{task.description}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${getTaskColor(task.type)}`}>
                        {task.type === 'lesson' ? 'Lesson' : 
                         task.type === 'live_class' ? 'Live' : 'Assignment'}
                      </span>
                      <span className="text-xs text-gray-500">
                        {task.duration} • {task.module}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    {getActionButton(task)}
                    {task.status !== 'completed' && (
                      <button
                        onClick={() => handleMarkComplete(task.id)}
                        className="px-2 py-1 text-xs text-gray-600 hover:text-gray-800 transition-colors"
                      >
                        Mark Complete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
