import React from "react";
import { useNavigate } from "react-router-dom";

export function TodaysLearning() {
  console.log('🔍 TODAYS LEARNING MOUNTED - STEP 2: Header + Progress card');
  const navigate = useNavigate();

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
        {/* Progress Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm">Completed Today</span>
              <span className="text-green-500 text-lg">✓</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">0</div>
            <div className="text-xs text-gray-500">of 3 tasks</div>
          </div>

          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm">Progress</span>
              <span className="text-yellow-500 text-lg">🏆</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">0%</div>
            <div className="text-xs text-gray-500">completion rate</div>
          </div>

          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm">Streak</span>
              <span className="text-orange-500 text-lg">🔥</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">5</div>
            <div className="text-xs text-gray-500">days in a row</div>
          </div>
        </div>

        {/* Task List */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <span className="text-lg">📖</span>
              </div>
              
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900">Introduction to IELTS Speaking</h3>
                <p className="text-gray-600 text-sm">Learn fundamental speaking techniques and pronunciation</p>
                <div className="flex items-center gap-4 mt-2">
                  <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700">
                    Lesson
                  </span>
                  <span className="text-xs text-gray-500">
                    ⏱️ 45 min • Module 1
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  className="px-4 py-2 bg-blue-500 text-white rounded-xl text-sm font-medium hover:bg-blue-600 transition-colors"
                >
                  Start
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 text-center mt-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">STEP 3: Task Card Added</h2>
          <p className="text-gray-600 text-sm">One hardcoded task card is working. Ready for more cards.</p>
        </div>
      </div>
    </div>
  );
}
