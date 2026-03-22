import React from 'react';
import { RotateCcw } from 'lucide-react';
import { cn } from '../lib/utils';
import {
  ATTENDANCE_STATUS_OPTIONS,
  getAttendanceStatusBadgeClassName,
  getAttendanceStatusLabel,
} from '../lib/attendance';
import { AttendanceStatus } from '../types';

export interface AttendanceTableRow {
  studentId: string;
  studentName: string;
  studentEmail: string;
  batchName: string;
  sessionTitle: string;
  dateLabel: string;
  status?: AttendanceStatus;
  notes: string;
}

interface AttendanceTableProps {
  rows: AttendanceTableRow[];
  disabled?: boolean;
  onStatusChange: (studentId: string, status: AttendanceStatus) => void;
  onNotesChange: (studentId: string, notes: string) => void;
  onResetRow: (studentId: string) => void;
  emptyMessage?: string;
}

export const AttendanceTable: React.FC<AttendanceTableProps> = ({
  rows,
  disabled = false,
  onStatusChange,
  onNotesChange,
  onResetRow,
  emptyMessage = 'No students found for this session.',
}) => {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
      <div className="max-h-[620px] overflow-auto">
        <table className="min-w-full border-separate border-spacing-0 text-sm">
          <thead className="sticky top-0 z-10 bg-gray-50">
            <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="border-b border-gray-200 px-4 py-3 font-semibold">Student Name</th>
              <th className="border-b border-gray-200 px-4 py-3 font-semibold">Batch</th>
              <th className="border-b border-gray-200 px-4 py-3 font-semibold">Session</th>
              <th className="border-b border-gray-200 px-4 py-3 font-semibold">Date</th>
              <th className="border-b border-gray-200 px-4 py-3 font-semibold">Status</th>
              <th className="border-b border-gray-200 px-4 py-3 font-semibold">Notes</th>
              <th className="border-b border-gray-200 px-4 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-500">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.studentId} className="align-top hover:bg-gray-50/70">
                  <td className="border-b border-gray-100 px-4 py-4">
                    <div>
                      <p className="font-medium text-black">{row.studentName}</p>
                      <p className="text-xs text-gray-500">{row.studentEmail}</p>
                    </div>
                  </td>
                  <td className="border-b border-gray-100 px-4 py-4 text-gray-700">{row.batchName}</td>
                  <td className="border-b border-gray-100 px-4 py-4 text-gray-700">{row.sessionTitle}</td>
                  <td className="border-b border-gray-100 px-4 py-4 text-gray-700">{row.dateLabel}</td>
                  <td className="border-b border-gray-100 px-4 py-4">
                    <span
                      className={cn(
                        'inline-flex rounded-full px-2.5 py-1 text-xs font-medium',
                        getAttendanceStatusBadgeClassName(row.status)
                      )}
                    >
                      {getAttendanceStatusLabel(row.status)}
                    </span>
                  </td>
                  <td className="border-b border-gray-100 px-4 py-4">
                    <textarea
                      value={row.notes}
                      onChange={(event) => onNotesChange(row.studentId, event.target.value)}
                      placeholder="Optional notes"
                      rows={2}
                      disabled={disabled}
                      className="min-h-[64px] w-full min-w-[220px] rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:border-purple-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-50"
                    />
                  </td>
                  <td className="border-b border-gray-100 px-4 py-4">
                    <div className="flex min-w-[330px] flex-wrap items-center gap-2">
                      {ATTENDANCE_STATUS_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => onStatusChange(row.studentId, option.value)}
                          disabled={disabled}
                          className={cn(
                            'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                            row.status === option.value
                              ? option.badgeClassName
                              : option.buttonClassName
                          )}
                        >
                          {option.label}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => onResetRow(row.studentId)}
                        disabled={disabled}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <RotateCcw size={14} />
                        Reset
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
