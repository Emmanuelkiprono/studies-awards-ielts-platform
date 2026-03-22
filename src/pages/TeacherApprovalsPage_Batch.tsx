import React from 'react';
import { TeacherStudentManagementTable } from '../components/TeacherStudentManagementTable';

export const TeacherApprovalsPage_Batch: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <h1 className="text-3xl font-semibold tracking-tight text-black">Approvals</h1>
          <p className="mt-2 max-w-3xl text-sm text-gray-700">
            Teachers can approve or reject students, auto-assign the starter lesson, and place
            learners into the correct weekly batch from this page.
          </p>
        </div>

        <TeacherStudentManagementTable mode="approvals" />
      </div>
    </div>
  );
};
