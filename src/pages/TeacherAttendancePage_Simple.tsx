import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  DoorClosed,
  DoorOpen,
  RefreshCw,
  Save,
  Search,
  Users,
  XCircle,
} from 'lucide-react';
import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { PrimaryButton } from '../components/UI';
import { AttendanceTable, AttendanceTableRow } from '../components/AttendanceTable';
import {
  buildAttendanceSummary,
  formatAttendanceDateTime,
  getAttendanceDateValue,
  isValidDateValue,
} from '../lib/attendance';
import { useAuth } from '../hooks/useAuth';
import { db } from '../services/firebase';
import { Attendance, AttendanceStatus, StudentData, UserProfile } from '../types';

interface TeacherLiveSessionRecord {
  id: string;
  batchId?: string;
  lessonId?: string;
  teacherId?: string;
  title?: string;
  status?: 'scheduled' | 'live' | 'ended' | 'cancelled';
  attendanceOpen?: boolean;
  attendanceClosed?: boolean;
  startTime?: string;
  endTime?: string;
  scheduledAt?: { toDate?: () => Date };
  createdAt?: { toDate?: () => Date };
}

interface TeacherBatchRecord {
  id: string;
  name?: string;
  teacherId?: string;
  currentStudents?: number;
}

interface StudentRosterRecord extends Partial<StudentData> {
  uid: string;
  name: string;
  email: string;
}

interface AttendanceDraft {
  status?: AttendanceStatus;
  notes: string;
}

const getSessionDateValue = (session?: TeacherLiveSessionRecord | null) => {
  if (!session) {
    return null;
  }

  if (session.startTime) {
    const parsedDate = new Date(session.startTime);
    if (isValidDateValue(parsedDate)) {
      return parsedDate;
    }
  }

  const scheduledDate = session.scheduledAt?.toDate?.();
  if (scheduledDate && isValidDateValue(scheduledDate)) {
    return scheduledDate;
  }

  const createdDate = session.createdAt?.toDate?.();
  return createdDate && isValidDateValue(createdDate) ? createdDate : null;
};

export const TeacherAttendancePage_Simple: React.FC = () => {
  const { profile: teacherProfile } = useAuth();
  const [sessions, setSessions] = useState<TeacherLiveSessionRecord[]>([]);
  const [batches, setBatches] = useState<Record<string, TeacherBatchRecord>>({});
  const [studentProfiles, setStudentProfiles] = useState<Record<string, UserProfile>>({});
  const [studentDocs, setStudentDocs] = useState<Record<string, StudentData>>({});
  const [attendanceRecords, setAttendanceRecords] = useState<Attendance[]>([]);
  const [attendanceDrafts, setAttendanceDrafts] = useState<Record<string, AttendanceDraft>>({});
  const [loading, setLoading] = useState(true);
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | AttendanceStatus | 'not_marked'>('all');
  const [saving, setSaving] = useState(false);
  const [toggleLoading, setToggleLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (!teacherProfile?.uid) {
      setLoading(false);
      return;
    }

    const unsubscribeBatches = onSnapshot(collection(db, 'batches'), (snapshot) => {
      const nextBatches = snapshot.docs.reduce((accumulator, batchDoc) => {
        accumulator[batchDoc.id] = {
          id: batchDoc.id,
          ...batchDoc.data(),
        } as TeacherBatchRecord;
        return accumulator;
      }, {} as Record<string, TeacherBatchRecord>);

      setBatches(nextBatches);
    });

    const unsubscribeStudentProfiles = onSnapshot(
      query(collection(db, 'users'), where('role', '==', 'student')),
      (snapshot) => {
        const nextProfiles = snapshot.docs.reduce((accumulator, userDoc) => {
          accumulator[userDoc.id] = {
            uid: userDoc.id,
            ...userDoc.data(),
          } as UserProfile;
          return accumulator;
        }, {} as Record<string, UserProfile>);

        setStudentProfiles(nextProfiles);
      }
    );

    const unsubscribeStudentDocs = onSnapshot(collection(db, 'students'), (snapshot) => {
      const nextStudents = snapshot.docs.reduce((accumulator, studentDoc) => {
        accumulator[studentDoc.id] = {
          uid: studentDoc.id,
          ...studentDoc.data(),
        } as StudentData;
        return accumulator;
      }, {} as Record<string, StudentData>);

      setStudentDocs(nextStudents);
    });

    const unsubscribeSessions = onSnapshot(
      query(collection(db, 'liveSessions'), where('teacherId', '==', teacherProfile.uid)),
      (snapshot) => {
        const nextSessions = snapshot.docs
          .map((sessionDoc) => ({
            id: sessionDoc.id,
            ...sessionDoc.data(),
          } as TeacherLiveSessionRecord))
          .sort((left, right) => {
            const leftTime = getSessionDateValue(left)?.getTime() ?? 0;
            const rightTime = getSessionDateValue(right)?.getTime() ?? 0;
            return rightTime - leftTime;
          });

        setSessions(nextSessions);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching teacher live sessions for attendance:', error);
        setSessions([]);
        setLoading(false);
      }
    );

    return () => {
      unsubscribeBatches();
      unsubscribeStudentProfiles();
      unsubscribeStudentDocs();
      unsubscribeSessions();
    };
  }, [teacherProfile?.uid]);

  useEffect(() => {
    if (!selectedSessionId) {
      setAttendanceRecords([]);
      return;
    }

    const unsubscribeAttendance = onSnapshot(
      query(collection(db, 'attendance'), where('sessionId', '==', selectedSessionId)),
      (snapshot) => {
        const nextAttendance = snapshot.docs.map((attendanceDoc) => ({
          id: attendanceDoc.id,
          ...attendanceDoc.data(),
        } as Attendance));

        setAttendanceRecords(nextAttendance);
      },
      (error) => {
        console.error('Error fetching attendance records:', error);
        setAttendanceRecords([]);
      }
    );

    return () => unsubscribeAttendance();
  }, [selectedSessionId]);

  const allStudents = useMemo(() => {
    const allStudentIds = Array.from(
      new Set([...Object.keys(studentProfiles), ...Object.keys(studentDocs)])
    );

    return allStudentIds
      .map((studentId) => {
        const profileRecord = studentProfiles[studentId];
        const studentRecord = studentDocs[studentId];
        const fallbackName =
          profileRecord?.email?.split('@')[0] ||
          studentRecord?.email?.split('@')[0] ||
          'Student';

        return {
          ...studentRecord,
          uid: studentId,
          name: profileRecord?.name || studentRecord?.name || fallbackName,
          email: profileRecord?.email || studentRecord?.email || 'No email available',
          batchId: studentRecord?.batchId || studentRecord?.batchInfo?.batchId,
          batchName:
            studentRecord?.batchName ||
            batches[studentRecord?.batchId || studentRecord?.batchInfo?.batchId || '']?.name ||
            '',
        } as StudentRosterRecord;
      })
      .filter((student) => Boolean(student.batchId))
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [batches, studentDocs, studentProfiles]);

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedSessionId) || null,
    [selectedSessionId, sessions]
  );

  const attendanceByStudentId = useMemo(
    () =>
      attendanceRecords.reduce((accumulator, record) => {
        accumulator[record.studentUid || record.studentId || ''] = record;
        return accumulator;
      }, {} as Record<string, Attendance>),
    [attendanceRecords]
  );

  const sessionBatchStudents = useMemo(() => {
    if (!selectedSession?.batchId) {
      return [];
    }

    return allStudents.filter((student) => {
      const studentBatchId = student.batchId || student.batchInfo?.batchId;
      return studentBatchId === selectedSession.batchId;
    });
  }, [allStudents, selectedSession?.batchId]);

  useEffect(() => {
    if (!selectedSessionId) {
      setAttendanceDrafts({});
      setSaveError(null);
      setSaveSuccess(false);
      return;
    }

    const nextDrafts = sessionBatchStudents.reduce((accumulator, student) => {
      const existingRecord = attendanceByStudentId[student.uid];
      accumulator[student.uid] = {
        status: existingRecord?.status,
        notes: existingRecord?.notes || '',
      };
      return accumulator;
    }, {} as Record<string, AttendanceDraft>);

    setAttendanceDrafts(nextDrafts);
    setSaveError(null);
    setSaveSuccess(false);
  }, [attendanceByStudentId, selectedSessionId, sessionBatchStudents]);

  const filteredStudents = useMemo(() => {
    return sessionBatchStudents.filter((student) => {
      const draft = attendanceDrafts[student.uid];
      const effectiveStatus = draft?.status || attendanceByStudentId[student.uid]?.status;
      const matchesSearch =
        student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'not_marked' ? !effectiveStatus : effectiveStatus === statusFilter);

      return matchesSearch && matchesStatus;
    });
  }, [attendanceByStudentId, attendanceDrafts, searchTerm, sessionBatchStudents, statusFilter]);

  const tableRows = useMemo<AttendanceTableRow[]>(() => {
    const batchName =
      batches[selectedSession?.batchId || '']?.name ||
      selectedSession?.batchId ||
      'Unassigned batch';
    const sessionDateLabel = formatAttendanceDateTime(getSessionDateValue(selectedSession));

    return filteredStudents.map((student) => ({
      studentId: student.uid,
      studentName: student.name,
      studentEmail: student.email,
      batchName,
      sessionTitle: selectedSession?.title || 'Live Session',
      dateLabel: sessionDateLabel,
      status: attendanceDrafts[student.uid]?.status,
      notes: attendanceDrafts[student.uid]?.notes || '',
    }));
  }, [attendanceDrafts, batches, filteredStudents, selectedSession]);

  const sessionSummary = useMemo(() => {
    return buildAttendanceSummary(
      sessionBatchStudents
        .map((student) => attendanceDrafts[student.uid]?.status)
        .filter((status): status is AttendanceStatus => Boolean(status))
        .map((status) => ({ status }))
    );
  }, [attendanceDrafts, sessionBatchStudents]);

  const markedCount = useMemo(
    () => sessionBatchStudents.filter((student) => attendanceDrafts[student.uid]?.status).length,
    [attendanceDrafts, sessionBatchStudents]
  );

  const hasDraftChanges = useMemo(
    () =>
      sessionBatchStudents.some((student) => {
        const existingRecord = attendanceByStudentId[student.uid];
        const draft = attendanceDrafts[student.uid];

        return (
          (draft?.status || null) !== (existingRecord?.status || null) ||
          (draft?.notes?.trim() || '') !== (existingRecord?.notes?.trim() || '')
        );
      }),
    [attendanceByStudentId, attendanceDrafts, sessionBatchStudents]
  );

  const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
    setAttendanceDrafts((currentDrafts) => ({
      ...currentDrafts,
      [studentId]: {
        status,
        notes: currentDrafts[studentId]?.notes || '',
      },
    }));
    setSaveSuccess(false);
  };

  const handleNotesChange = (studentId: string, notes: string) => {
    setAttendanceDrafts((currentDrafts) => ({
      ...currentDrafts,
      [studentId]: {
        status: currentDrafts[studentId]?.status,
        notes,
      },
    }));
    setSaveSuccess(false);
  };

  const handleResetRow = (studentId: string) => {
    const existingRecord = attendanceByStudentId[studentId];

    setAttendanceDrafts((currentDrafts) => ({
      ...currentDrafts,
      [studentId]: {
        status: existingRecord?.status,
        notes: existingRecord?.notes || '',
      },
    }));
    setSaveSuccess(false);
  };

  const syncStudentAttendanceSummary = async (
    student: StudentRosterRecord,
    fallbackBatchId?: string
  ) => {
    const attendanceSnapshot = await getDocs(
      query(collection(db, 'attendance'), where('studentUid', '==', student.uid))
    );

    const studentAttendance = attendanceSnapshot.docs.map((attendanceDoc) => ({
      id: attendanceDoc.id,
      ...attendanceDoc.data(),
    } as Attendance));

    const summary = buildAttendanceSummary(studentAttendance);
    const latestAttendanceDate = studentAttendance
      .map((record) => getAttendanceDateValue(record))
      .filter(isValidDateValue)
      .sort((left, right) => right.getTime() - left.getTime())[0];
    const studentBatchId = student.batchId || student.batchInfo?.batchId || fallbackBatchId || '';
    const studentBatchName =
      student.batchName ||
      batches[studentBatchId]?.name ||
      batches[fallbackBatchId || '']?.name ||
      '';

    await setDoc(
      doc(db, 'students', student.uid),
      {
        batchId: studentBatchId,
        batchName: studentBatchName,
        batchInfo: {
          ...(student.batchInfo || {}),
          batchId: studentBatchId,
          joinedAt: student.batchInfo?.joinedAt || serverTimestamp(),
          currentWeek: student.batchInfo?.currentWeek || 1,
          progressPercent: student.batchInfo?.progressPercent || 0,
          attendanceRate: summary.attendanceRate,
          lastAttendanceDate: latestAttendanceDate
            ? Timestamp.fromDate(latestAttendanceDate)
            : student.batchInfo?.lastAttendanceDate || null,
        },
      },
      { merge: true }
    );
  };

  const handleSaveAttendance = async () => {
    if (!teacherProfile?.uid || !selectedSession?.id || !selectedSession.batchId) {
      return;
    }

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const attendanceDate = getSessionDateValue(selectedSession) || new Date();
      const batchName = batches[selectedSession.batchId]?.name || selectedSession.batchId;

      await Promise.all(
        sessionBatchStudents.map(async (student) => {
          const draft = attendanceDrafts[student.uid];
          if (!draft?.status) {
            return;
          }

          const existingRecord = attendanceByStudentId[student.uid];
          const basePayload = {
            sessionId: selectedSession.id,
            sessionTitle: selectedSession.title || 'Live Session',
            lessonId: selectedSession.lessonId || '',
            studentUid: student.uid,
            studentId: student.uid,
            studentName: student.name,
            teacherId: teacherProfile.uid,
            teacherName: teacherProfile.name || teacherProfile.email || 'Teacher',
            batchId: selectedSession.batchId || student.batchId || '',
            batch: batchName,
            date: attendanceDate.toISOString(),
            status: draft.status,
            notes: draft.notes.trim(),
            markedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            markedBy: teacherProfile.uid,
            autoMarked: false,
          };

          if (existingRecord?.id) {
            await setDoc(
              doc(db, 'attendance', existingRecord.id),
              {
                ...basePayload,
                createdAt: existingRecord.createdAt || serverTimestamp(),
              },
              { merge: true }
            );
            return;
          }

          await addDoc(collection(db, 'attendance'), {
            ...basePayload,
            createdAt: serverTimestamp(),
          });
        })
      );

      await Promise.all(
        sessionBatchStudents.map((student) =>
          syncStudentAttendanceSummary(student, selectedSession.batchId)
        )
      );

      setSaveSuccess(true);
    } catch (error) {
      console.error('Error saving attendance records:', error);
      setSaveError(error instanceof Error ? error.message : 'Failed to save attendance records');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAttendance = async () => {
    if (!selectedSessionId || !selectedSession) {
      return;
    }

    setToggleLoading(true);

    try {
      await updateDoc(doc(db, 'liveSessions', selectedSessionId), {
        attendanceOpen: !selectedSession.attendanceOpen,
        attendanceClosed: selectedSession.attendanceOpen,
      });
    } catch (error) {
      console.error('Error toggling attendance state:', error);
      setSaveError('Failed to update attendance state for this session');
    } finally {
      setToggleLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-t-2 border-[#6324eb]" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto w-full max-w-7xl space-y-6 p-6"
    >
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h1 className="mb-2 text-3xl font-semibold tracking-tight text-black">
          Attendance Management
        </h1>
        <p className="text-gray-700">
          Select a live class, mark students quickly, add notes when needed, and save one clean attendance sheet.
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col gap-3 md:flex-row">
            <select
              value={selectedSessionId}
              onChange={(event) => setSelectedSessionId(event.target.value)}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-black focus:border-purple-500 focus:outline-none md:max-w-xl"
            >
              <option value="">Select a live class/session</option>
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {(session.title || 'Live Session')} ·{' '}
                  {batches[session.batchId || '']?.name || session.batchId || 'Batch'} ·{' '}
                  {formatAttendanceDateTime(getSessionDateValue(session))}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => {
                setSelectedSessionId('');
                setSearchTerm('');
                setStatusFilter('all');
                setSaveError(null);
                setSaveSuccess(false);
              }}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 px-4 py-3 text-gray-700 transition-colors hover:bg-gray-50"
            >
              <RefreshCw size={18} />
              Reset
            </button>
          </div>

          <PrimaryButton
            onClick={handleSaveAttendance}
            disabled={!selectedSession || saving || !hasDraftChanges}
            className="inline-flex items-center justify-center gap-2 px-5 py-3"
          >
            <Save size={18} />
            {saving ? 'Saving Attendance...' : 'Save Attendance Records'}
          </PrimaryButton>
        </div>
      </div>

      {selectedSession ? (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                <Users size={22} />
              </div>
              <p className="text-sm text-gray-700">Students in Batch</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-black">
                {sessionBatchStudents.length}
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
                <CheckCircle2 size={22} />
              </div>
              <p className="text-sm text-gray-700">Present</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-black">
                {sessionSummary.present}
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-red-100 text-red-600">
                <XCircle size={22} />
              </div>
              <p className="text-sm text-gray-700">Absent</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-black">
                {sessionSummary.absent}
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                <Clock size={22} />
              </div>
              <p className="text-sm text-gray-700">Late</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-black">
                {sessionSummary.late}
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-purple-100 text-purple-600">
                <Calendar size={22} />
              </div>
              <p className="text-sm text-gray-700">Attendance Rate</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-black">
                {sessionSummary.attendanceRate.toFixed(1)}%
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-xl font-semibold tracking-tight text-black">
                  {selectedSession.title || 'Live Session'}
                </h2>
                <p className="mt-1 text-gray-700">
                  {batches[selectedSession.batchId || '']?.name || selectedSession.batchId || 'Batch'} ·{' '}
                  {formatAttendanceDateTime(getSessionDateValue(selectedSession))}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-gray-500">
                  <span className="rounded-full bg-gray-100 px-3 py-1 font-medium text-gray-700">
                    {selectedSession.status?.toUpperCase() || 'SCHEDULED'}
                  </span>
                  <span>{markedCount} of {sessionBatchStudents.length} students marked</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleToggleAttendance}
                disabled={toggleLoading}
                className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${
                  selectedSession.attendanceOpen
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-gray-200 bg-gray-50 text-gray-700'
                }`}
              >
                {selectedSession.attendanceOpen ? <DoorOpen size={18} /> : <DoorClosed size={18} />}
                {toggleLoading
                  ? 'Updating...'
                  : selectedSession.attendanceOpen
                    ? 'Attendance Open'
                    : 'Attendance Closed'}
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-xl font-semibold tracking-tight text-black">Attendance Table</h2>
                <p className="mt-1 text-gray-700">
                  Mark students as Present, Absent, Late, or Excused and save the sheet when you are done.
                </p>
              </div>

              <div className="flex flex-col gap-3 md:flex-row">
                <div className="relative">
                  <Search
                    size={16}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    type="text"
                    placeholder="Search student"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    className="rounded-xl border border-gray-300 py-2.5 pl-9 pr-4 text-sm text-black placeholder:text-gray-400 focus:border-purple-500 focus:outline-none"
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(event.target.value as 'all' | AttendanceStatus | 'not_marked')
                  }
                  className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-black focus:border-purple-500 focus:outline-none"
                >
                  <option value="all">All statuses</option>
                  <option value="present">Present</option>
                  <option value="absent">Absent</option>
                  <option value="late">Late</option>
                  <option value="excused">Excused</option>
                  <option value="not_marked">Not marked</option>
                </select>
              </div>
            </div>

            {saveError && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {saveError}
              </div>
            )}

            {saveSuccess && (
              <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                Attendance saved successfully.
              </div>
            )}

            {!selectedSession.attendanceOpen && (
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                Attendance is currently closed for this session. You can still prepare marks and notes, then save them when ready.
              </div>
            )}

            <AttendanceTable
              rows={tableRows}
              disabled={saving}
              onStatusChange={handleStatusChange}
              onNotesChange={handleNotesChange}
              onResetRow={handleResetRow}
              emptyMessage="No students match the current search/filter for this session."
            />
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-16 text-center">
          <AlertCircle size={42} className="mx-auto mb-4 text-gray-400" />
          <h2 className="text-xl font-semibold tracking-tight text-black">Select a live class to begin</h2>
          <p className="mt-2 text-gray-700">
            Once you choose a session, the platform will load the assigned batch roster and your saved attendance records.
          </p>
        </div>
      )}
    </motion.div>
  );
};
