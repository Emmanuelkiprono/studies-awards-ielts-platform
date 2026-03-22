import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  Video,
  Plus,
  Users,
  Calendar,
  Clock,
  AlertCircle,
  X,
  CheckCircle2,
  Link as LinkIcon,
  DoorOpen,
  DoorClosed,
  Square,
} from 'lucide-react';
import {
  Timestamp,
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import { db } from '../services/firebase';
import { GlassCard, PrimaryButton } from '../components/UI';

const CREATE_CLASS_TIMEOUT_MS = 15000;

const EMPTY_FORM_DATA = {
  title: '',
  batchId: '',
  date: '',
  startTime: '',
  endTime: '',
  meetingLink: '',
  description: '',
};

interface LiveSession {
  id: string;
  batchId: string;
  teacherId: string;
  title: string;
  description?: string;
  meetingLink?: string;
  startTime: string;
  endTime: string;
  status: 'scheduled' | 'live' | 'ended' | 'cancelled';
  createdAt: any;
  scheduledAt?: any;
  participantsCount?: number;
  attendanceOpen?: boolean;
  startedAt?: any;
}

interface Batch {
  id: string;
  name: string;
}

type LiveClassFormState = typeof EMPTY_FORM_DATA;

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string) => {
  let timeoutId: number | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = window.setTimeout(() => {
          reject(new Error(timeoutMessage));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
    }
  }
};

const getSessionStartTime = (session: LiveSession) => new Date(session.startTime).getTime();

const getSessionEndTime = (session: LiveSession) => new Date(session.endTime).getTime();

const isValidSessionDate = (value?: string) => {
  if (!value) {
    return false;
  }

  return !Number.isNaN(new Date(value).getTime());
};

const isRealTeacherSession = (session: LiveSession) => {
  if (!session.id || !session.teacherId || !session.batchId || !session.title?.trim()) {
    return false;
  }

  if (!isValidSessionDate(session.startTime) || !isValidSessionDate(session.endTime)) {
    return false;
  }

  return getSessionEndTime(session) > getSessionStartTime(session);
};

const isSessionLive = (session: LiveSession) => {
  if (session.status === 'cancelled' || session.status === 'ended') {
    return false;
  }

  if (session.status === 'live') {
    return true;
  }

  const now = Date.now();
  return getSessionStartTime(session) <= now && now < getSessionEndTime(session);
};

const isSessionUpcoming = (session: LiveSession) => {
  if (session.status === 'cancelled') {
    return false;
  }

  return getSessionStartTime(session) > Date.now();
};

const isSessionCompleted = (session: LiveSession) => {
  if (session.status === 'ended') {
    return true;
  }

  if (session.status === 'cancelled') {
    return false;
  }

  return getSessionEndTime(session) <= Date.now();
};

const sortTeacherSessions = (items: LiveSession[]) => {
  const realSessions = items.filter(isRealTeacherSession);

  const liveSessions = realSessions
    .filter(isSessionLive)
    .sort((a, b) => getSessionStartTime(a) - getSessionStartTime(b));

  const upcomingSessions = realSessions
    .filter((session) => !isSessionLive(session) && isSessionUpcoming(session))
    .sort((a, b) => getSessionStartTime(a) - getSessionStartTime(b));

  const completedSessions = realSessions
    .filter((session) => !isSessionLive(session) && !isSessionUpcoming(session) && isSessionCompleted(session))
    .sort((a, b) => getSessionStartTime(b) - getSessionStartTime(a));

  return [...liveSessions, ...upcomingSessions, ...completedSessions];
};

export const TeacherLiveClassesPage_Simple: React.FC = () => {
  const { profile: teacherProfile, user: teacherUser } = useAuth();
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState<LiveClassFormState>(EMPTY_FORM_DATA);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!teacherProfile?.uid) {
      return;
    }

    const batchesQuery = query(
      collection(db, 'batches'),
      where('teacherId', '==', teacherProfile.uid)
    );

    const unsubscribe = onSnapshot(
      batchesQuery,
      (snapshot) => {
        const batchesData = snapshot.docs.map((batchDoc) => ({
          id: batchDoc.id,
          ...batchDoc.data(),
        } as Batch));

        setBatches(batchesData);
      },
      (error) => {
        console.error('Error fetching batches:', error);
      }
    );

    return () => unsubscribe();
  }, [teacherProfile?.uid]);

  const refreshTeacherSessions = async (teacherId: string) => {
    const liveSessionsQuery = query(
      collection(db, 'liveSessions'),
      where('teacherId', '==', teacherId)
    );
    const snapshot = await getDocs(liveSessionsQuery);
    const sessionsData = snapshot.docs.map((sessionDoc) => ({
      id: sessionDoc.id,
      ...sessionDoc.data(),
    } as LiveSession));

    setSessions(sortTeacherSessions(sessionsData));
  };

  useEffect(() => {
    if (!teacherProfile?.uid) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const liveSessionsQuery = query(
      collection(db, 'liveSessions'),
      where('teacherId', '==', teacherProfile.uid)
    );

    const unsubscribe = onSnapshot(
      liveSessionsQuery,
      (snapshot) => {
        const sessionsData = snapshot.docs.map((sessionDoc) => ({
          id: sessionDoc.id,
          ...sessionDoc.data(),
        } as LiveSession));

        setSessions(sortTeacherSessions(sessionsData));
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching sessions:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [teacherProfile?.uid]);

  const closeCreateForm = () => {
    setShowCreateForm(false);
    setFormData(EMPTY_FORM_DATA);
    setFormErrors({});
    setSubmitError(null);
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!formData.title.trim()) {
      errors.title = 'Title is required';
    }
    if (!formData.batchId) {
      errors.batchId = 'Please select a batch';
    }
    if (!formData.date) {
      errors.date = 'Date is required';
    }
    if (!formData.startTime) {
      errors.startTime = 'Start time is required';
    }
    if (!formData.endTime) {
      errors.endTime = 'End time is required';
    }
    if (formData.startTime && formData.endTime && formData.startTime >= formData.endTime) {
      errors.endTime = 'End time must be after start time';
    }
    if (!formData.meetingLink.trim()) {
      errors.meetingLink = 'Meeting link is required';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateClass = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitError(null);

    if (!validateForm()) {
      return;
    }

    if (!teacherUser) {
      setSubmitError('Teacher information not available');
      return;
    }

    setIsSubmitting(true);

    try {
      const selectedBatch = batches.find((batch) => batch.id === formData.batchId);

      if (!selectedBatch) {
        throw new Error('Selected batch was not found. Please refresh and try again.');
      }

      const startDateTime = new Date(`${formData.date}T${formData.startTime}`);
      const endDateTime = new Date(`${formData.date}T${formData.endTime}`);

      if (Number.isNaN(startDateTime.getTime()) || Number.isNaN(endDateTime.getTime())) {
        throw new Error('Please enter a valid date and time for this class');
      }

      const liveSessionData = {
        batchId: selectedBatch.id,
        teacherId: teacherUser.uid,
        title: formData.title.trim(),
        description: formData.description.trim(),
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
        meetingLink: formData.meetingLink.trim(),
        status: 'scheduled' as const,
        createdAt: serverTimestamp(),
        scheduledAt: Timestamp.fromDate(startDateTime),
        participantsCount: 0,
        attendanceOpen: false,
      };

      console.log('[TeacherLiveClassesPage_Simple] Saving live class payload', {
        selectedBatchId: selectedBatch.id,
        selectedBatchName: selectedBatch.name,
        requiredFields: {
          title: liveSessionData.title,
          batchId: liveSessionData.batchId,
          startTime: liveSessionData.startTime,
          endTime: liveSessionData.endTime,
          meetingLink: liveSessionData.meetingLink,
          status: liveSessionData.status,
        },
        liveSessionData,
      });

      const savedSession = await withTimeout(
        addDoc(collection(db, 'liveSessions'), liveSessionData),
        CREATE_CLASS_TIMEOUT_MS,
        'Saving the live class took too long. Please try again.'
      );

      console.log('[TeacherLiveClassesPage_Simple] Live class saved successfully', {
        sessionId: savedSession.id,
        batchId: liveSessionData.batchId,
        teacherId: liveSessionData.teacherId,
        title: liveSessionData.title,
        startTime: liveSessionData.startTime,
        endTime: liveSessionData.endTime,
        meetingLink: liveSessionData.meetingLink,
        status: liveSessionData.status,
      });

      await withTimeout(
        refreshTeacherSessions(teacherUser.uid),
        CREATE_CLASS_TIMEOUT_MS,
        'The class was saved, but refreshing the teacher class list took too long.'
      );

      closeCreateForm();
    } catch (error) {
      console.error('Error creating class:', error);
      setSubmitError(error instanceof Error ? error.message : 'Failed to create live class');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleAttendance = async (sessionId: string, isOpen: boolean) => {
    try {
      await updateDoc(doc(db, 'liveSessions', sessionId), {
        attendanceOpen: isOpen,
      });
    } catch (error) {
      console.error('Error toggling attendance:', error);
      alert('Failed to update attendance state');
    }
  };

  const handleEndSession = async (sessionId: string) => {
    try {
      await updateDoc(doc(db, 'liveSessions', sessionId), {
        status: 'ended',
      });
    } catch (error) {
      console.error('Error ending session:', error);
      alert('Failed to end live session');
    }
  };

  const getBatchInfo = (batchId: string) => batches.find((batch) => batch.id === batchId);

  const activeSessions = sessions.filter(isSessionLive);
  const upcomingSessions = sessions.filter(
    (session) => !isSessionLive(session) && isSessionUpcoming(session)
  );
  const completedSessions = sessions.filter(
    (session) => !isSessionLive(session) && !isSessionUpcoming(session) && isSessionCompleted(session)
  );
  const visibleSessions = [...activeSessions, ...upcomingSessions, ...completedSessions];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#6324eb]"></div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 space-y-8 max-w-7xl mx-auto w-full pb-24"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-semibold text-black mb-2 tracking-tight">Live Classes</h2>
          <p className="text-gray-700 font-medium">Create and manage live classes for your students.</p>
        </div>
        <PrimaryButton onClick={() => setShowCreateForm(true)} className="flex items-center gap-2">
          <Plus size={20} />
          Create Live Class
        </PrimaryButton>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <GlassCard className="p-4 border border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center">
              <Video className="text-red-500" size={24} />
            </div>
            <div>
              <div className="text-2xl font-semibold text-black">{activeSessions.length}</div>
              <div className="text-sm text-gray-500">Live Now</div>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4 border border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Calendar className="text-blue-500" size={24} />
            </div>
            <div>
              <div className="text-2xl font-semibold text-black">{upcomingSessions.length}</div>
              <div className="text-sm text-gray-500">Scheduled</div>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4 border border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gray-500/10 flex items-center justify-center">
              <Clock className="text-gray-500" size={24} />
            </div>
            <div>
              <div className="text-2xl font-semibold text-black">{completedSessions.length}</div>
              <div className="text-sm text-gray-500">Completed</div>
            </div>
          </div>
        </GlassCard>
      </div>

      {showCreateForm && (
        <GlassCard className="p-6 border border-white/5">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-black">Create New Live Class</h3>
            <button onClick={closeCreateForm} className="p-2 hover:bg-white/10 rounded-lg">
              <X size={20} className="text-gray-500" />
            </button>
          </div>

          {submitError && (
            <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-3">
              <AlertCircle size={20} className="text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{submitError}</p>
            </div>
          )}

          <form onSubmit={handleCreateClass} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Class Title *
              </label>
              <input
                type="text"
                placeholder="e.g., Advanced Speaking Session"
                value={formData.title}
                onChange={(event) => setFormData({ ...formData, title: event.target.value })}
                className={`w-full px-4 py-2 rounded-lg border-2 bg-white/5 text-black placeholder:text-gray-500 outline-none transition-colors ${
                  formErrors.title ? 'border-red-500' : 'border-white/10 focus:border-purple-500'
                }`}
              />
              {formErrors.title && <p className="mt-1 text-xs text-red-400">{formErrors.title}</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Batch / Group *
              </label>
              <select
                value={formData.batchId}
                onChange={(event) => setFormData({ ...formData, batchId: event.target.value })}
                className={`w-full px-4 py-2 rounded-lg border-2 bg-white/5 text-black outline-none transition-colors ${
                  formErrors.batchId ? 'border-red-500' : 'border-white/10 focus:border-purple-500'
                }`}
              >
                <option value="">Select a batch...</option>
                {batches.map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    {batch.name}
                  </option>
                ))}
              </select>
              {formErrors.batchId && <p className="mt-1 text-xs text-red-400">{formErrors.batchId}</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Date *</label>
              <input
                type="date"
                value={formData.date}
                onChange={(event) => setFormData({ ...formData, date: event.target.value })}
                className={`w-full px-4 py-2 rounded-lg border-2 bg-white/5 text-black outline-none transition-colors ${
                  formErrors.date ? 'border-red-500' : 'border-white/10 focus:border-purple-500'
                }`}
              />
              {formErrors.date && <p className="mt-1 text-xs text-red-400">{formErrors.date}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Start Time *
                </label>
                <input
                  type="time"
                  value={formData.startTime}
                  onChange={(event) => setFormData({ ...formData, startTime: event.target.value })}
                  className={`w-full px-4 py-2 rounded-lg border-2 bg-white/5 text-black outline-none transition-colors ${
                    formErrors.startTime ? 'border-red-500' : 'border-white/10 focus:border-purple-500'
                  }`}
                />
                {formErrors.startTime && <p className="mt-1 text-xs text-red-400">{formErrors.startTime}</p>}
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">End Time *</label>
                <input
                  type="time"
                  value={formData.endTime}
                  onChange={(event) => setFormData({ ...formData, endTime: event.target.value })}
                  className={`w-full px-4 py-2 rounded-lg border-2 bg-white/5 text-black outline-none transition-colors ${
                    formErrors.endTime ? 'border-red-500' : 'border-white/10 focus:border-purple-500'
                  }`}
                />
                {formErrors.endTime && <p className="mt-1 text-xs text-red-400">{formErrors.endTime}</p>}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Meeting Link *
              </label>
              <input
                type="url"
                placeholder="e.g., https://meet.google.com/xyz or https://zoom.us/j/123"
                value={formData.meetingLink}
                onChange={(event) => setFormData({ ...formData, meetingLink: event.target.value })}
                className={`w-full px-4 py-2 rounded-lg border-2 bg-white/5 text-black placeholder:text-gray-500 outline-none transition-colors ${
                  formErrors.meetingLink ? 'border-red-500' : 'border-white/10 focus:border-purple-500'
                }`}
              />
              {formErrors.meetingLink && <p className="mt-1 text-xs text-red-400">{formErrors.meetingLink}</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Description (Optional)
              </label>
              <textarea
                placeholder="Add notes about this class..."
                value={formData.description}
                onChange={(event) => setFormData({ ...formData, description: event.target.value })}
                rows={2}
                className="w-full px-4 py-2 rounded-lg border-2 border-white/10 bg-white/5 text-black placeholder:text-gray-500 outline-none transition-colors focus:border-purple-500 resize-none"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={closeCreateForm}
                className="flex-1 px-4 py-2 rounded-lg border border-white/10 text-gray-700 font-medium hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 px-4 py-2 rounded-lg bg-purple-600 text-white font-semibold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? 'Creating...' : 'Create Class'}
              </button>
            </div>
          </form>
        </GlassCard>
      )}

      {activeSessions.length > 0 && (
        <div>
          <h3 className="text-xl font-semibold text-black mb-4">Live Now</h3>
          <div className="space-y-4">
            {activeSessions.map((session) => {
              const batch = getBatchInfo(session.batchId);

              return (
                <GlassCard key={session.id} className="p-6 border border-red-500/20 bg-red-500/5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center">
                        <Video className="text-red-500" size={24} />
                      </div>
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="text-lg font-semibold text-black">{session.title}</h4>
                          <span className="px-2 py-1 text-xs font-semibold text-black bg-red-500 rounded-full animate-pulse">
                            LIVE
                          </span>
                        </div>
                        <p className="text-gray-700 text-sm mb-2">
                          {batch?.name || 'Unknown Batch'}
                        </p>
                        {session.description && (
                          <p className="text-gray-700 text-sm mb-2">{session.description}</p>
                        )}
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <div className="flex items-center gap-1">
                            <Users size={14} />
                            <span>{session.participantsCount || 0} participants</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock size={14} />
                            <span>
                              Started {session.startedAt?.toDate?.()?.toLocaleTimeString() || 'N/A'}
                            </span>
                          </div>
                        </div>
                        {session.meetingLink && (
                          <div className="flex items-center gap-2 mt-2">
                            <LinkIcon size={14} className="text-gray-500" />
                            <a
                              href={session.meetingLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-purple-600 hover:text-purple-700 text-sm"
                            >
                              Join Meeting {'->'}
                            </a>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleAttendance(session.id, !session.attendanceOpen)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-colors ${
                          session.attendanceOpen
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-gray-500/20 text-gray-400'
                        }`}
                      >
                        {session.attendanceOpen ? <DoorOpen size={16} /> : <DoorClosed size={16} />}
                        {session.attendanceOpen ? 'Attendance Open' : 'Attendance Closed'}
                      </button>
                      <button
                        onClick={() => handleEndSession(session.id)}
                        className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors"
                      >
                        <Square size={16} />
                        End Session
                      </button>
                    </div>
                  </div>
                </GlassCard>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <h3 className="text-xl font-semibold text-black mb-4">
          {visibleSessions.length > 0 ? 'All Live Classes' : 'No Classes Yet'}
        </h3>
        <div className="space-y-3">
          {visibleSessions.map((session) => {
            const batch = getBatchInfo(session.batchId);
            const startTime = new Date(session.startTime);
            const endTime = new Date(session.endTime);
            const now = new Date();
            const isUpcoming = startTime > now;
            const isActive = isSessionLive(session);

            return (
              <GlassCard
                key={session.id}
                className={`p-4 border ${isActive ? 'border-red-500/30 bg-red-500/5' : 'border-white/5'}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-base font-semibold text-black">{session.title}</h4>
                      {isActive && (
                        <span className="px-2 py-0.5 text-xs font-semibold text-black bg-red-500 rounded-full animate-pulse">
                          LIVE
                        </span>
                      )}
                      {isUpcoming && (
                        <span className="px-2 py-0.5 text-xs font-bold text-blue-700 bg-blue-500/30 rounded-full">
                          SCHEDULED
                        </span>
                      )}
                    </div>
                    <p className="text-gray-700 text-sm mb-2">{batch?.name || 'Unknown Batch'}</p>
                    {session.description && (
                      <p className="text-gray-700 text-sm mb-2">{session.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar size={14} />
                        {startTime.toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={14} />
                        {startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -{' '}
                        {endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {session.meetingLink && (
                        <a
                          href={session.meetingLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-purple-600 hover:text-purple-700"
                        >
                          View Meeting {'->'}
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </GlassCard>
            );
          })}
        </div>

        {visibleSessions.length === 0 && (
          <GlassCard className="p-10 text-center border border-white/5">
            <Video size={32} className="mx-auto text-slate-600 mb-3" />
            <p className="text-gray-700 font-medium">No live classes created yet</p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
            >
              Create Your First Class
            </button>
          </GlassCard>
        )}
      </div>
    </motion.div>
  );
};


