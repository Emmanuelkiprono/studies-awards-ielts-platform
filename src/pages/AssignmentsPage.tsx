import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

interface Assignment {
  id: string;
  type: 'writing' | 'listening' | 'reading' | 'speaking' | 'vocabulary';
  title: string;
  description: string;
  dueDate: string;
  module: string;
  status: 'pending' | 'submitted' | 'graded';
  score?: number;
}

export function AssignmentsPage() {
  console.log('🔍 ASSIGNMENTS PAGE MOUNTED - Rebuilt with content');
  const navigate = useNavigate();
  
  // Safe sample assignments
  const [assignments] = useState<Assignment[]>([
    {
      id: '1',
      type: 'writing',
      title: 'Academic Writing Task 1',
      description: 'Analyze and describe a graph or chart in a formal report',
      dueDate: 'Tomorrow, 11:59 PM',
      module: 'Module 2',
      status: 'pending'
    },
    {
      id: '2',
      type: 'speaking',
      title: 'Speaking Assessment',
      description: 'Record and submit your speaking sample for evaluation',
      dueDate: 'In 2 days',
      module: 'Module 1',
      status: 'submitted',
      score: 7.5
    },
    {
      id: '3',
      type: 'listening',
      title: 'Listening Comprehension',
      description: 'Complete the listening exercise and answer questions',
      dueDate: 'In 3 days',
      module: 'Module 1',
      status: 'graded',
      score: 8.0
    },
    {
      id: '4',
      type: 'reading',
      title: 'Reading Passage Analysis',
      description: 'Read the passage and answer comprehension questions',
      dueDate: 'Next week',
      module: 'Module 3',
      status: 'pending'
    }
  ]);

  const getAssignmentIcon = (type: Assignment['type']) => {
    switch (type) {
      case 'writing': return '📝';
      case 'speaking': return '🎤';
      case 'listening': return '🎧';
      case 'reading': return '📖';
      case 'vocabulary': return '📚';
      default: return '📝';
    }
  };

  const getAssignmentColor = (type: Assignment['type']) => {
    switch (type) {
      case 'writing': return 'bg-purple-100 text-purple-700';
      case 'speaking': return 'bg-green-100 text-green-700';
      case 'listening': return 'bg-blue-100 text-blue-700';
      case 'reading': return 'bg-orange-100 text-orange-700';
      case 'vocabulary': return 'bg-pink-100 text-pink-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusColor = (status: Assignment['status']) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-700';
      case 'submitted': return 'bg-blue-100 text-blue-700';
      case 'graded': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const pendingCount = assignments.filter(a => a.status === 'pending').length;
  const submittedCount = assignments.filter(a => a.status === 'submitted').length;
  const gradedCount = assignments.filter(a => a.status === 'graded').length;

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
              <span className="text-gray-700">←</span>
            </button>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-black">Assignments</h1>
              <p className="text-sm text-gray-500">Track and submit your work</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Summary Card */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-6">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="flex items-center justify-center mb-1">
                <span className="text-yellow-500 text-sm mr-1">⏰</span>
                <span className="text-gray-700 text-sm">Pending</span>
              </div>
              <div className="text-xl font-bold text-black">{pendingCount}</div>
              <div className="text-xs text-gray-500">to do</div>
            </div>
            
            <div>
              <div className="flex items-center justify-center mb-1">
                <span className="text-blue-500 text-sm mr-1">📤</span>
                <span className="text-gray-700 text-sm">Submitted</span>
              </div>
              <div className="text-xl font-bold text-black">{submittedCount}</div>
              <div className="text-xs text-gray-500">in review</div>
            </div>
            
            <div>
              <div className="flex items-center justify-center mb-1">
                <span className="text-green-500 text-sm mr-1">✓</span>
                <span className="text-gray-700 text-sm">Graded</span>
              </div>
              <div className="text-xl font-bold text-black">{gradedCount}</div>
              <div className="text-xs text-gray-500">completed</div>
            </div>
          </div>
        </div>

        {/* Assignment List */}
        <div className="space-y-3">
          {assignments.map((assignment) => (
            <div 
              key={assignment.id}
              className={`bg-white rounded-2xl p-4 shadow-sm border ${
                assignment.status === 'graded' ? 'border-green-200 bg-green-50' : 'border-gray-100'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm ${getAssignmentColor(assignment.type)}`}>
                  {getAssignmentIcon(assignment.type)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-black text-sm truncate">{assignment.title}</h3>
                  <p className="text-gray-700 text-xs truncate">{assignment.description}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${getAssignmentColor(assignment.type)}`}>
                      {assignment.type.charAt(0).toUpperCase() + assignment.type.slice(1)}
                    </span>
                    <span className="text-xs text-gray-500">
                      {assignment.module} • {assignment.dueDate}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(assignment.status)}`}>
                      {assignment.status.charAt(0).toUpperCase() + assignment.status.slice(1)}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5 items-end">
                  {assignment.score && (
                    <div className="text-sm font-semibold text-black">
                      {assignment.score}/9.0
                    </div>
                  )}
                  <button
                    className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
                  >
                    {assignment.status === 'pending' ? 'Start' : 
                     assignment.status === 'submitted' ? 'View' : 'Review'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

