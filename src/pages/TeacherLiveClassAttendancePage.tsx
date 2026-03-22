import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  Calendar,
  Clock,
  Users,
  Search,
  CheckCircle2,
  Download,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { db } from '../services/firebase';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
  getDocs,
  orderBy,
} from 'firebase/firestore';
import { GlassCard, PrimaryButton } from '../components/UI';

interface LiveSession {
  id: string;
  title: string;
  description?: string;
  batchId: string;
  teacherId: string;
  moduleId?: string;
  startTime: string;
  endTime: string;
  meetingLink: string;
  status: 'scheduled' | 'live' | 'ended' | 'cancelled';
  createdAt: any;
}

interface LiveClassJoin {
  id: string;
  sessionId: string;
  batchId: string;
  studentId: string;
  joinedAt: any;
  status: string;
}

interface StudentProfile {
  uid: string;
  name: string;
  email: string;
}

interface SessionWithJoins {
  session: LiveSession;
  joins: (LiveClassJoin & { studentName?: string })[];
  totalStudentsInBatch: number;
}

export const TeacherLiveClassAttendancePage: React.FC = () => {
  const { user, profile: teacherProfile } = useAuth();
  const [sessionsWithJoins, setSessionsWithJoins] = useState<SessionWithJoins[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSession, setSelectedSession] = useState<string | null>(null);

  // Load all live sessions for this teacher with attendance info
  useEffect(() => {
    if (!user || !teacherProfile?.uid) {
      setLoading(false);
      return;
    }

    setLoading(true);

    // Query all sessions for this teacher
    const sessionsQuery = query(
      collection(db, 'liveSessions'),
      where('teacherId', '==', teacherProfile.uid),
      orderBy('startTime', 'desc')
    );

    const unsubscribe = onSnapshot(sessionsQuery, async (snapshot) => {
      const sessionsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as LiveSession));

      // Get join records and student info for each session
      const sessionsWithData: SessionWithJoins[] = [];

      for (const session of sessionsData) {
        try {
          // Get all joins for this session
          const joinsQuery = query(
            collection(db, 'live_class_joins'),
            where('sessionId', '==', session.id)
          );
          const joinsSnapshot = await getDocs(joinsQuery);
          const joinsData = joinsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          } as LiveClassJoin));

          // Get student names for each join
          const joinsWithNames: (LiveClassJoin & { studentName?: string })[] = [];
          for (const join of joinsData) {
            try {
              const studentSnap = await getDoc(doc(db, 'users', join.studentId));
              if (studentSnap.exists()) {
                joinsWithNames.push({
                  ...join,
                  studentName: studentSnap.data().name || 'Unknown',
                });
              } else {
                joinsWithNames.push({
                  ...join,
                  studentName: 'Unknown Student',
                });
              }
            } catch (err) {
              console.error('Error fetching student:', err);
              joinsWithNames.push({
                ...join,
                studentName: 'Unknown Student',
              });
            }
          }

          // Get batch info to count total students
          let totalStudentsInBatch = 0;
          try {
            const batchSnap = await getDoc(doc(db, 'batches', session.batchId));
            if (batchSnap.exists()) {
              totalStudentsInBatch = batchSnap.data().currentStudents || 0;
            }
          } catch (err) {
            console.error('Error fetching batch:', err);
          }

          sessionsWithData.push({
            session,
            joins: joinsWithNames,
            totalStudentsInBatch,
          });
        } catch (err) {
          console.error('Error processing session:', err);
          sessionsWithData.push({
            session,
            joins: [],
            totalStudentsInBatch: 0,
          });
        }
      }

      setSessionsWithJoins(sessionsWithData);
      setLoading(false);
    }, (err) => {
      console.error('Error fetching sessions:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, teacherProfile?.uid]);

  const filteredSessions = sessionsWithJoins.filter(item =>
    item.session.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.joins.some(j =>
      j.studentName?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  const formatDateTime = (dateTimeString: string) => {
    const date = new Date(dateTimeString);
    return {
      date: date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }),
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
  };

  const formatJoinTime = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const downloadAttendanceCSV = (session: LiveSession, joins: (LiveClassJoin & { studentName?: string })[]) => {
    const headers = ['Student Name', 'Joined At', 'Status'];
    const rows = joins.map(join => [
      join.studentName || 'Unknown',
      formatJoinTime(join.joinedAt),
      join.status,
    ]);

    const csv = [
      [`Session: ${session.title}`],
      [`Date: ${formatDateTime(session.startTime).date}`],
      [`Time: ${formatDateTime(session.startTime).time}`],
      [],
      headers,
      ...rows,
    ]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${session.title}-attendance-${new Date().getTime()}.csv`;
    a.click();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 space-y-6 max-w-4xl mx-auto w-full pb-24"
    >
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black text-black mb-2">Live Class Attendance</h1>
        <p className="text-gray-700">Track which students joined your live sessions</p>
      </div>

      {/* Search */}
      {filteredSessions.length > 0 && (
        <div className="relative">
          <Search size={18} className="absolute left-4 top-3.5 text-gray-500" />
          <input
            type="text"
            placeholder="Search by class title or student name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-black placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
      )}

      {/* Sessions List */}
      {filteredSessions.length > 0 ? (
        <div className="space-y-4">
          {filteredSessions.map(item => {
            const { session, joins, totalStudentsInBatch } = item;
            const { date, time } = formatDateTime(session.startTime);
            const attendanceRate = totalStudentsInBatch > 0
              ? Math.round((joins.length / totalStudentsInBatch) * 100)
              : 0;
            const isExpanded = selectedSession === session.id;

            return (
              <motion.div
                key={session.id}
                layout
              >
                <GlassCard className="p-4 border border-purple-500/20 cursor-pointer hover:border-purple-500/40 transition-all"
                  onClick={() => setSelectedSession(isExpanded ? null : session.id)}
                >
                  {/* Session Header */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-black mb-1">{session.title}</h3>
                      <div className="flex flex-wrap items-center gap-3 text-sm text-gray-700 mb-3">
                        <span className="flex items-center gap-1">
                          <Calendar size={14} />
                          {date}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock size={14} />
                          {time}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users size={14} />
                          {joins.length} / {totalStudentsInBatch} joined
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 max-w-xs h-2 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-purple-500 to-purple-600"
                            style={{ width: `${attendanceRate}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-purple-700">
                          {attendanceRate}%
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-black">{joins.length}</div>
                      <div className="text-xs text-gray-500">Joined</div>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-4 pt-4 border-t border-white/10 space-y-3"
                    >
                      {/* Download Button */}
                      <button
                        onClick={() => downloadAttendanceCSV(session, joins)}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm font-medium text-gray-700 transition-all"
                      >
                        <Download size={14} />
                        Download Attendance CSV
                      </button>

                      {/* Students List */}
                      <div className="space-y-2 max-h-[400px] overflow-y-auto">
                        {joins.length > 0 ? (
                          joins.map((join, idx) => (
                            <div
                              key={join.id}
                              className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
                                  <span className="text-xs font-semibold text-purple-700">
                                    {idx + 1}
                                  </span>
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-black">
                                    {join.studentName}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    Joined at {formatJoinTime(join.joinedAt)}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-1 text-xs font-medium bg-emerald-500/10 text-emerald-400 rounded">
                                  {join.status}
                                </span>
                                <CheckCircle2 size={16} className="text-emerald-500" />
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-6 text-gray-500">
                            <Users size={24} className="mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No students joined yet</p>
                          </div>
                        )}
                      </div>

                      {/* Meeting Link */}
                      {session.meetingLink && (
                        <a
                          href={session.meetingLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 rounded-lg text-sm font-medium text-purple-700 transition-all"
                        >
                          <ExternalLink size={14} />
                          Open Meeting Link
                        </a>
                      )}
                    </motion.div>
                  )}
                </GlassCard>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <GlassCard className="p-10 text-center border border-slate-700/20">
          <Users size={36} className="mx-auto text-slate-600 mb-3" />
          <p className="text-base font-semibold text-gray-700">No Live Classes Yet</p>
          <p className="text-sm text-gray-500 mt-2">
            {searchTerm
              ? 'No classes match your search.'
              : 'You haven\'t created any live classes yet.'}
          </p>
        </GlassCard>
      )}
    </motion.div>
  );
};

