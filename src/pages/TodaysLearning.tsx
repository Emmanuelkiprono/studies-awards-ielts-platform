import React from "react";
import { useNavigate } from "react-router-dom";

export function TodaysLearning() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-4">
      <div className="bg-white rounded-2xl shadow p-6 text-center">
        <h1 className="text-xl font-semibold mb-2">Today's Learning</h1>
        <p className="text-gray-600 mb-4">Base route works</p>
        <button
          onClick={() => navigate("/dashboard")}
          className="px-4 py-2 rounded-xl bg-blue-600 text-white"
        >
          Back Home
        </button>
      </div>
    </div>
  );
}
