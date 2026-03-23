import React from 'react';
import { CheckCircle2, Clock, LogOut, RefreshCw, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { getSimplifiedStudentStatus } from '../lib/studentAccess';

export const StudentPendingApprovalPage: React.FC = () => {
  const navigate = useNavigate();
  const { studentData, signOut } = useAuth();
  const simplifiedStatus = getSimplifiedStudentStatus(studentData);
  const isRejected = simplifiedStatus === 'rejected';
  const statusLabel = isRejected ? 'rejected' : 'enrollment_submitted';

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-xl rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex justify-center">
          <div
            className={`flex h-16 w-16 items-center justify-center rounded-2xl ${
              isRejected ? 'bg-red-100' : 'bg-blue-100'
            }`}
          >
            {isRejected ? (
              <XCircle className="h-8 w-8 text-red-600" />
            ) : (
              <Clock className="h-8 w-8 text-blue-600" />
            )}
          </div>
        </div>

        <div className="space-y-3 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-black">
            {isRejected ? 'Enrollment Needs Attention' : 'Enrollment Submitted'}
          </h1>
          <div className="flex justify-center">
            <span
              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${
                isRejected ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
              }`}
            >
              {statusLabel.replace('_', ' ')}
            </span>
          </div>
          <p className="text-sm text-gray-700">
            {isRejected
              ? 'Your enrollment was reviewed and needs to be updated before approval.'
              : 'Your enrollment form has been submitted successfully. Please wait while your teacher reviews it.'}
          </p>
        </div>

        <div className="mt-8 rounded-2xl border border-gray-200 bg-gray-50 p-5">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
            <div className="space-y-2 text-sm text-gray-700">
              <p>Your dashboard will unlock automatically once your teacher approves your enrollment.</p>
              {isRejected ? (
                <p>You can reopen the enrollment form, update your details, and submit again.</p>
              ) : (
                <p>You can check back here anytime to see whether your account has been approved.</p>
              )}
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            <RefreshCw size={16} />
            Refresh Status
          </button>

          {isRejected ? (
            <button
              type="button"
              onClick={() => navigate('/enrollment')}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-purple-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-purple-700"
            >
              Update Enrollment
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                void signOut();
              }}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gray-900 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-black"
            >
              <LogOut size={16} />
              Sign Out
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
