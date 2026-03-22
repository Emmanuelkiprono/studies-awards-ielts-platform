import { Attendance, AttendanceStatus } from '../types';

export interface AttendanceSummaryMetrics {
  total: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  attendanceRate: number;
}

export interface AttendanceStatusOption {
  value: AttendanceStatus;
  label: string;
  badgeClassName: string;
  buttonClassName: string;
}

export const ATTENDANCE_STATUS_OPTIONS: AttendanceStatusOption[] = [
  {
    value: 'present',
    label: 'Present',
    badgeClassName: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    buttonClassName: 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100',
  },
  {
    value: 'absent',
    label: 'Absent',
    badgeClassName: 'bg-red-100 text-red-700 border border-red-200',
    buttonClassName: 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100',
  },
  {
    value: 'late',
    label: 'Late',
    badgeClassName: 'bg-amber-100 text-amber-700 border border-amber-200',
    buttonClassName: 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100',
  },
  {
    value: 'excused',
    label: 'Excused',
    badgeClassName: 'bg-blue-100 text-blue-700 border border-blue-200',
    buttonClassName: 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100',
  },
];

export const isValidDateValue = (value: Date | null): value is Date =>
  Boolean(value && !Number.isNaN(value.getTime()));

export const getAttendanceStatusLabel = (status?: AttendanceStatus | null) =>
  ATTENDANCE_STATUS_OPTIONS.find((option) => option.value === status)?.label || 'Not Marked';

export const getAttendanceStatusBadgeClassName = (status?: AttendanceStatus | null) =>
  ATTENDANCE_STATUS_OPTIONS.find((option) => option.value === status)?.badgeClassName ||
  'bg-gray-100 text-gray-700 border border-gray-200';

export const getAttendanceDateValue = (
  value:
    | Pick<Attendance, 'date' | 'markedAt' | 'createdAt'>
    | Date
    | string
    | { toDate?: () => Date }
    | null
    | undefined
) => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return isValidDateValue(value) ? value : null;
  }

  if (typeof value === 'string') {
    const parsedDate = new Date(value);
    return isValidDateValue(parsedDate) ? parsedDate : null;
  }

  if (typeof value === 'object' && 'date' in value) {
    return (
      getAttendanceDateValue(value.date) ||
      getAttendanceDateValue(value.markedAt) ||
      getAttendanceDateValue(value.createdAt)
    );
  }

  if (typeof value === 'object' && 'toDate' in value) {
    const dateValue = value.toDate?.() ?? null;
    return isValidDateValue(dateValue) ? dateValue : null;
  }

  return null;
};

export const formatAttendanceDateTime = (value: Date | null) => {
  if (!value) {
    return 'No date';
  }

  return `${value.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })} ${value.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
};

export const isSameLocalDay = (left: Date, right: Date) =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate();

export const buildAttendanceSummary = (
  records: Array<Pick<Attendance, 'status' | 'date' | 'markedAt' | 'createdAt'>>
): AttendanceSummaryMetrics => {
  const summary = records.reduce<AttendanceSummaryMetrics>(
    (accumulator, record) => {
      accumulator.total += 1;

      if (record.status === 'present') {
        accumulator.present += 1;
      } else if (record.status === 'absent') {
        accumulator.absent += 1;
      } else if (record.status === 'late') {
        accumulator.late += 1;
      } else if (record.status === 'excused') {
        accumulator.excused += 1;
      }

      return accumulator;
    },
    {
      total: 0,
      present: 0,
      absent: 0,
      late: 0,
      excused: 0,
      attendanceRate: 0,
    }
  );

  const countedPresent = summary.present + summary.late + summary.excused;
  summary.attendanceRate = summary.total > 0 ? (countedPresent / summary.total) * 100 : 0;

  return summary;
};
