import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GlassCard, StatusBadge, PrimaryButton } from '../components/UI';
import {
  Users,
  GraduationCap,
  Calendar,
  Bell,
  Plus,
  Video,
  ClipboardList,
  CheckCircle2,
  Clock,
  ChevronRight,
  TrendingUp,
  BookOpen,
  Search,
  LayoutDashboard,
  X,
  FileText,
  Volume2,
  PlayCircle,
  AlertCircle,
  FolderOpen
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useAuth } from '../hooks/useAuth';
import { db } from '../services/firebase';
import { collection, query, where, onSnapshot, doc, getDoc, getDocs, updateDoc, serverTimestamp, addDoc, orderBy } from 'firebase/firestore';
import { Course, UserProfile, Enrollment, Module, Assignment, Announcement, Resource } from '../types';
import { NotificationService } from '../services/notificationService';
import { FileUpload } from '../components/FileUpload';

interface TeacherDashboardProps {
  onCreateAssignment: () => void;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({ onCreateAssignment }) => {
  const navigate = useNavigate();
  const { profile: teacherData, user: teacherUser } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [enrolledStudents, setEnrolledStudents] = useState<(UserProfile & Partial<Enrollment>)[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  // Create Assignment modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: '',
    description: '',
    dueDate: '',
    courseId: '',
    moduleId: '',
    type: 'writing' as Assignment['type'],
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [modalModules, setModalModules] = useState<Module[]>([]);
  const [createAttachmentUrl, setCreateAttachmentUrl] = useState('');
  const [createAttachmentName, setCreateAttachmentName] = useState('');
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [pendingSubmissionsCount, setPendingSubmissionsCount] = useState(0);

  // Share Resource modal
  const [showResourceModal, setShowResourceModal] = useState(false);
  const [resourceForm, setResourceForm] = useState({ title: '', type: 'pdf' as Resource['type'], url: '', description: '' });
  const [resourceLoading, setResourceLoading] = useState(false);

  // Schedule Live Session modal
  const [showLiveModal, setShowLiveModal] = useState(false);
  const [liveForm, setLiveForm] = useState({
    title: '',
    courseId: '',
    date: '',
    startTime: '',
    endTime: '',
    meetingUrl: '',
    sendReminder: true,
    reminderMinutes: '15',
  });
  const [liveLoading, setLiveLoading] = useState(false);

  // Send Announcement modal
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [announcementForm, setAnnouncementForm] = useState({ title: '', message: '' });
  const [announcementLoading, setAnnouncementLoading] = useState(false);

  const isEnrollmentEligible = (s: Partial<Enrollment>) => {
    const eligibleIso = s.eligibleAt || s.eligibleExamDate;
    if (!eligibleIso || typeof eligibleIso !== 'string') return false;
    return new Date() >= new Date(eligibleIso);
  };

  const handleApproveExamBooking = async (student: UserProfile & Partial<Enrollment>) => {
    if (!teacherUser) return;
    if (!student.id) {
      alert('Missing enrollment id.');
      return;
    }

    setApprovingId(student.uid);
    try {
      await updateDoc(doc(db, 'enrollments', student.id), {
        examStatus: 'pending_booking',
        examBookingApprovedAt: serverTimestamp(),
        examBookingApprovedBy: teacherUser.uid,
      });

      await updateDoc(doc(db, 'students', student.uid), {
        examStatus: 'pending_booking',
        examBookingApprovedAt: serverTimestamp(),
        examBookingApprovedBy: teacherUser.uid,
      } as any);

      alert(`${student.name} can now proceed with exam booking.`);
    } catch (error) {
      console.error('Error approving exam booking:', error);
      alert('Failed to approve exam booking.');
    } finally {
      setApprovingId(null);
    }
  };

  // 1. Fetch all courses
  useEffect(() => {
    const coursesQ = query(collection(db, 'courses'));
    const unsubscribe = onSnapshot(coursesQ, (snapshot) => {
      const coursesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course));
      setCourses(coursesData);

      // Default to first course or assigned course if not yet set
      if (!selectedCourseId) {
        if (teacherData?.assignedCourseId) {
          setSelectedCourseId(teacherData.assignedCourseId);
        } else if (coursesData.length > 0) {
          setSelectedCourseId(coursesData[0].id);
        }
      }
    });

    return () => unsubscribe();
  }, [teacherData?.assignedCourseId, selectedCourseId]);

  // 2. Fetch selected course details and students
  useEffect(() => {
    if (!selectedCourseId) {
      if (!loading) setLoading(false);
      return;
    }

    setLoading(true);

    // Fetch course details
    const courseRef = doc(db, 'courses', selectedCourseId);
    const unsubscribeCourse = onSnapshot(courseRef, (docSnap) => {
      if (docSnap.exists()) {
        setSelectedCourse({ id: docSnap.id, ...docSnap.data() } as Course);
      }
    });

    // Fetch enrolled students via enrollments
    const enrollmentsQ = query(
      collection(db, 'enrollments'),
      where('courseId', '==', selectedCourseId)
    );

    let unsubscribeStudents: (() => void) | undefined;

    const unsubscribeEnrollments = onSnapshot(enrollmentsQ, (snapshot) => {
      const enrollments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Enrollment));
      const studentIds = enrollments.map(e => e.userId);

      if (studentIds.length === 0) {
        setEnrolledStudents([]);
        setLoading(false);
        return;
      }

      // Fetch student profiles
      if (unsubscribeStudents) unsubscribeStudents();

      const studentsQ = query(
        collection(db, 'users'),
        where('role', '==', 'student'),
        where('uid', 'in', studentIds)
      );

      unsubscribeStudents = onSnapshot(studentsQ, (studentsSnapshot) => {
        const studentsData = studentsSnapshot.docs.map(doc => {
          const profile = doc.data() as UserProfile;
          const enrollment = enrollments.find(e => e.userId === profile.uid);
          return { ...profile, ...enrollment };
        });

        setEnrolledStudents(studentsData);
        setLoading(false);
      }, (error) => {
        console.error("Error fetching student profiles:", error);
        setLoading(false);
      });
    });

    return () => {
      unsubscribeCourse();
      unsubscribeEnrollments();
      if (unsubscribeStudents) unsubscribeStudents();
    };
  }, [selectedCourseId]);

  // 3. Real-time assignments for selected course
  useEffect(() => {
    if (!selectedCourseId) { setAssignments([]); return; }
    const q = query(
      collection(db, 'assignments'),
      where('courseId', '==', selectedCourseId),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setAssignments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Assignment)));
    });
    return () => unsub();
  }, [selectedCourseId]);

  // 4. Fetch pending submissions count for grading queue
  useEffect(() => {
    if (!selectedCourseId) { setPendingSubmissionsCount(0); return; }
    getDocs(query(
      collection(db, 'submissions'),
      where('courseId', '==', selectedCourseId),
      where('status', '==', 'pending')
    )).then(snap => setPendingSubmissionsCount(snap.size));
  }, [selectedCourseId]);

  // 5. Fetch modules when create modal opens or course changes
  useEffect(() => {
    const courseId = createForm.courseId || selectedCourseId;
    if (!showCreateModal || !courseId) { setModalModules([]); return; }
    getDocs(query(
      collection(db, 'courses', courseId, 'modules'),
      orderBy('order', 'asc')
    )).then(snap => {
      setModalModules(snap.docs.map(d => ({ id: d.id, ...d.data() } as Module)));
    });
  }, [showCreateModal, createForm.courseId, selectedCourseId]);

  const handleSendAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherUser || !selectedCourseId) return;
    setAnnouncementLoading(true);
    try {
      await addDoc(collection(db, 'announcements'), {
        title: announcementForm.title,
        message: announcementForm.message,
        courseId: selectedCourseId,
        createdAt: serverTimestamp(),
        createdBy: teacherUser.uid,
      });

      const enrollSnap = await getDocs(query(
        collection(db, 'enrollments'),
        where('courseId', '==', selectedCourseId)
      ));
      await Promise.all(enrollSnap.docs.map(d =>
        NotificationService.create(
          d.data().userId,
          announcementForm.title,
          announcementForm.message,
          'info',
          '/dashboard'
        )
      ));

      setShowAnnouncementModal(false);
      setAnnouncementForm({ title: '', message: '' });
    } catch (err) {
      console.error('Error sending announcement:', err);
      alert('Failed to send announcement.');
    } finally {
      setAnnouncementLoading(false);
    }
  };

  const handleShareResource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherUser || !selectedCourseId) return;
    setResourceLoading(true);
    try {
      await addDoc(collection(db, 'resources'), {
        title: resourceForm.title,
        type: resourceForm.type,
        url: resourceForm.url,
        description: resourceForm.description || null,
        courseId: selectedCourseId,
        createdAt: serverTimestamp(),
        createdBy: teacherUser.uid,
      });

      // Notify enrolled students
      const enrollSnap = await getDocs(query(
        collection(db, 'enrollments'),
        where('courseId', '==', selectedCourseId)
      ));
      await Promise.all(enrollSnap.docs.map(d =>
        NotificationService.create(
          d.data().userId,
          'New Resource Available',
          `"${resourceForm.title}" has been added to your course resources.`,
          'info',
          '/resources'
        )
      ));

      setShowResourceModal(false);
      setResourceForm({ title: '', type: 'pdf', url: '', description: '' });
    } catch (err) {
      console.error('Error sharing resource:', err);
      alert('Failed to share resource.');
    } finally {
      setResourceLoading(false);
    }
  };

  const handleStartLiveNow = async () => {
  if (!teacherUser || !selectedCourseId) {
    alert('Please select a course first');
    return;
  }
  
  try {
    // Create an instant live session
    const now = new Date();
    const endTime = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
    
    const sessionData = {
      title: `Live Session - ${now.toLocaleTimeString()}`,
      courseId: selectedCourseId,
      startTime: now.toISOString(),
      endTime: endTime.toISOString(),
      isLive: true,
      startedAt: now.toISOString(),
      createdAt: serverTimestamp(),
      createdBy: teacherUser.uid,
    };
    
    const docRef = await addDoc(collection(db, 'liveSessions'), sessionData);
    
    // Create Daily.co room immediately (using mock URL for server-side compatibility)
    const slug = sessionData.title.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 30);
    const roomUrl = `https://ielts-academy.daily.co/${slug}-${Date.now()}`;
    
    // Real Daily.co API call (commented out for server-side compatibility)
    /*
    const DAILY_API_KEY = import.meta.env.VITE_DAILY_API_KEY as string | undefined;
    
    if (!DAILY_API_KEY) {
      const slug = sessionData.title.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 30);
      roomUrl = `https://ielts-academy.daily.co/${slug}-${Date.now()}`;
    } else {
      // Only use fetch on client-side
      if (typeof window === 'undefined') {
        const slug = sessionData.title.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 30);
        roomUrl = `https://ielts-academy.daily.co/${slug}-${Date.now()}`;
      } else {
        const res = await fetch('https://api.daily.co/v1/rooms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DAILY_API_KEY}` },
          body: JSON.stringify({
            name: `ielts-${Date.now()}`,
            privacy: 'public',
            properties: { exp: Math.floor(Date.now() / 1000) + 60 * 60 * 4, enable_chat: true, enable_screenshare: true },
          }),
        });
        if (!res.ok) throw new Error('Failed to create Daily room');
        const data = await res.json();
        roomUrl = data.url;
      }
    }
    */
    
    // Update the session with the room URL
    await updateDoc(doc(db, 'liveSessions', docRef.id), { roomUrl });
    
    // Notify enrolled students about immediate live session
    const enrollSnap = await getDocs(query(
      collection(db, 'enrollments'),
      where('courseId', '==', selectedCourseId)
    ));
    
    await Promise.all(enrollSnap.docs.map(d =>
      NotificationService.create(
        d.data().userId,
        '🔴 Live Class Started Now!',
        `A live session for "${selectedCourse?.title || 'Your Course'}" has started. Join now!`,
        'success',
        '/live'
      )
    ));
    
    // Navigate directly to live classes with the active room
    navigate('/live', { state: { activeRoom: { session: { ...sessionData, id: docRef.id, roomUrl }, roomUrl } } });
    
  } catch (err) {
    console.error('Error starting live session:', err);
    alert(`Failed to start live session: ${err.message}`);
  }
};

const handleScheduleSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherUser) return;
    
        
    setLiveLoading(true);
    try {
      const liveCourseId = liveForm.courseId || selectedCourseId;
      
      if (!liveCourseId) {
        throw new Error('No course selected');
      }
      
      const sessionData = {
        title: liveForm.title,
        courseId: liveCourseId,
        startTime: liveForm.date && liveForm.startTime ? `${liveForm.date}T${liveForm.startTime}` : '',
        endTime: liveForm.date && liveForm.endTime ? `${liveForm.date}T${liveForm.endTime}` : '',
        meetingUrl: liveForm.meetingUrl || null,
        createdAt: serverTimestamp(),
        createdBy: teacherUser.uid,
      };
      
      const docRef = await addDoc(collection(db, 'liveSessions'), sessionData);

      if (liveCourseId) {
        const enrollSnap = await getDocs(query(
          collection(db, 'enrollments'),
          where('courseId', '==', liveCourseId)
        ));
        const sessionDate = liveForm.date
          ? new Date(`${liveForm.date}T${liveForm.startTime}`).toLocaleString()
          : 'TBD';
        await Promise.all(enrollSnap.docs.map(d =>
          NotificationService.create(
            d.data().userId,
            '📅 Live Class Scheduled',
            `A live session "${liveForm.title}" is scheduled for ${sessionDate}. Don\'t miss it!`,
            'info',
            '/live'
          )
        ));
        
              }

      setShowLiveModal(false);
      setLiveForm({ title: '', courseId: '', date: '', startTime: '', endTime: '', meetingUrl: '' });
      
      alert('Session scheduled successfully!');
    } catch (err) {
      console.error('Error scheduling session:', err);
      alert(`Failed to schedule session: ${err.message}`);
    } finally {
      setLiveLoading(false);
    }
  };

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherUser) return;
    setCreateLoading(true);
    try {
      const assignCourseId = createForm.courseId || selectedCourseId;
      await addDoc(collection(db, 'assignments'), {
        title: createForm.title,
        description: createForm.description,
        dueDate: createForm.dueDate,
        courseId: assignCourseId,
        moduleId: createForm.moduleId || null,
        type: createForm.type,
        createdAt: serverTimestamp(),
        createdBy: teacherUser.uid,
        attachmentUrl: createAttachmentUrl || null,
        attachmentName: createAttachmentName || null,
      });

      if (assignCourseId) {
        const enrollSnap = await getDocs(query(
          collection(db, 'enrollments'),
          where('courseId', '==', assignCourseId)
        ));
        await Promise.all(enrollSnap.docs.map(d =>
          NotificationService.create(
            d.data().userId,
            'New Assignment Posted',
            `"${createForm.title}" has been assigned. Due: ${createForm.dueDate ? new Date(createForm.dueDate).toLocaleDateString() : 'TBD'}.`,
            'info',
            '/tasks'
          )
        ));
      }

      setShowCreateModal(false);
      setCreateForm({ title: '', description: '', dueDate: '', courseId: '', moduleId: '', type: 'writing' });
      setCreateAttachmentUrl('');
      setCreateAttachmentName('');
    } catch (err) {
      console.error('Error creating assignment:', err);
      alert('Failed to create assignment.');
    } finally {
      setCreateLoading(false);
    }
  };

  const filteredStudents = enrolledStudents.filter(s =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const eligibleStudents = filteredStudents.filter(s => isEnrollmentEligible(s));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--ui-accent)]"></div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 space-y-8 max-w-7xl mx-auto w-full pb-24"
    >
      {/* Welcome Section */}
      <section className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-[var(--ui-heading)] mb-2 tracking-tight">Teacher Home</h2>
          <p className="text-[var(--ui-muted)] font-medium">Welcome back, {teacherData?.name}. What would you like to manage today?</p>
        </div>
        <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10">
          {courses.map(course => (
            <button
              key={course.id}
              onClick={() => setSelectedCourseId(course.id)}
              className={cn(
                "px-6 py-2 rounded-xl text-xs font-bold transition-all",
                selectedCourseId === course.id
                  ? "bg-[var(--ui-accent)] text-white shadow-lg"
                  : "text-[var(--ui-muted)] hover:text-[var(--ui-body)] hover:bg-white/5"
              )}
            >
              {course.name}
            </button>
          ))}
        </div>
      </section>

      {/* Primary Navigation Cards */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <GlassCard
          gradient
          className="p-6 cursor-pointer group hover:scale-[1.02] transition-all border-l-4 border-l-[#6324eb]"
          onClick={() => navigate('/teacher/courses')}
        >
          <div className="size-12 rounded-2xl bg-[#6324eb]/20 flex items-center justify-center text-[#6324eb] mb-4 group-hover:bg-[#6324eb] group-hover:text-white transition-colors">
            <LayoutDashboard size={24} />
          </div>
          <h3 className="text-[var(--ui-heading)] font-bold">Manage Courses</h3>
          <p className="text-[10px] text-[var(--ui-muted)] mt-1 uppercase font-bold tracking-wider">IELTS + PTE Academic</p>
        </GlassCard>

        <GlassCard
          className="p-6 cursor-pointer group hover:scale-[1.02] transition-all border-l-4 border-l-blue-500"
          onClick={() => navigate(`/teacher/modules?courseId=${selectedCourseId}`)}
        >
          <div className="size-12 rounded-2xl bg-blue-500/20 flex items-center justify-center text-blue-500 mb-4 group-hover:bg-blue-500 group-hover:text-white transition-colors">
            <BookOpen size={24} />
          </div>
          <h3 className="text-[var(--ui-heading)] font-bold">Manage Modules</h3>
          <p className="text-[10px] text-[var(--ui-muted)] mt-1 uppercase font-bold tracking-wider">Curriculum Builder</p>
        </GlassCard>

        <GlassCard
          className="p-6 cursor-pointer group hover:scale-[1.02] transition-all border-l-4 border-l-emerald-500"
          onClick={() => navigate(`/teacher/lessons?courseId=${selectedCourseId}`)}
        >
          <div className="size-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center text-emerald-500 mb-4 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
            <Video size={24} />
          </div>
          <h3 className="text-[var(--ui-heading)] font-bold">Manage Lessons</h3>
          <p className="text-[10px] text-[var(--ui-muted)] mt-1 uppercase font-bold tracking-wider">Video & PDF Content</p>
        </GlassCard>

        <GlassCard
          className="p-6 cursor-pointer group hover:scale-[1.02] transition-all border-l-4 border-l-amber-500"
          onClick={() => navigate('/teacher/approvals')}
        >
          <div className="size-12 rounded-2xl bg-amber-500/20 flex items-center justify-center text-amber-500 mb-4 group-hover:bg-amber-500 group-hover:text-white transition-colors">
            <Users size={24} />
          </div>
          <h3 className="text-[var(--ui-heading)] font-bold">Student Approvals</h3>
          <p className="text-[10px] text-[var(--ui-muted)] mt-1 uppercase font-bold tracking-wider">{enrolledStudents.length} Students Active</p>
        </GlassCard>
      </section>

      {selectedCourse ? (
        <>
          {/* Detailed Stats Row */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <GlassCard className="p-6 flex items-center gap-4 relative overflow-hidden group border border-white/5">
              <div className="size-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 ring-1 ring-emerald-500/20">
                <CheckCircle2 size={24} />
              </div>
              <div>
                <p className="text-[var(--ui-muted)] text-[10px] font-bold uppercase tracking-widest">Active Learners</p>
                <p className="text-2xl font-black text-[var(--ui-heading)]">{enrolledStudents.length}</p>
              </div>
            </GlassCard>

            <GlassCard className="p-6 flex items-center gap-4 relative overflow-hidden group border border-white/5">
              <div className="size-14 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 ring-1 ring-amber-500/20">
                <Clock size={24} />
              </div>
              <div>
                <p className="text-[var(--ui-muted)] text-[10px] font-bold uppercase tracking-widest">Grading Queue</p>
                <p className="text-2xl font-black text-[var(--ui-heading)]">{pendingSubmissionsCount}</p>
              </div>
            </GlassCard>

            <GlassCard className="p-6 flex items-center gap-4 relative overflow-hidden group border border-white/5">
              <div className="size-14 rounded-2xl bg-[#6324eb]/10 flex items-center justify-center text-[#6324eb] ring-1 ring-[#6324eb]/20">
                <TrendingUp size={24} />
              </div>
              <div>
                <p className="text-[var(--ui-muted)] text-[10px] font-bold uppercase tracking-widest">Assignments</p>
                <p className="text-2xl font-black text-[var(--ui-heading)]">{assignments.length}</p>
              </div>
            </GlassCard>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Quick Student Glance */}
            <section className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-[var(--ui-heading)] flex items-center gap-2">
                  <GraduationCap className="text-[var(--ui-accent)]" size={20} />
                  Recent Student Activity
                </h3>
                {eligibleStudents.length > 0 && (
                  <button
                    onClick={() => navigate('/teacher/exams')}
                    className="text-[10px] font-black uppercase tracking-widest text-[var(--ui-accent)] hover:opacity-90"
                  >
                    {eligibleStudents.length} eligible
                  </button>
                )}
              </div>
              <GlassCard className="p-0 overflow-hidden border border-white/5">
                <div className="divide-y divide-white/5">
                  {filteredStudents.slice(0, 5).map((student) => (
                    <div
                      key={student.uid}
                      onClick={() => navigate(`/teacher/students/${student.uid}`)}
                      className="p-4 flex items-center justify-between hover:bg-white/[0.03] transition-colors group cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={student.avatarUrl || `https://picsum.photos/seed/${student.uid}/100/100`}
                          alt={student.name}
                          className="size-10 rounded-xl object-cover border border-white/10"
                        />
                        <div>
                          <p className="text-sm font-bold text-[var(--ui-heading)]">{student.name}</p>
                          <p className="text-[10px] text-[var(--ui-muted)] uppercase font-black tracking-widest">IELTS ACADEMIC</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <StatusBadge
                          status={student.trainingStatus?.replace('_', ' ') || 'inactive'}
                          variant={student.trainingStatus === 'active' ? 'primary' : student.trainingStatus === 'completed' ? 'success' : 'accent'}
                          className="text-[10px]"
                        />

                        {isEnrollmentEligible(student) && student.examStatus !== 'booked' && student.examStatus !== 'completed' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleApproveExamBooking(student);
                            }}
                            disabled={approvingId === student.uid}
                            className="px-3 py-2 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500/20 transition-all disabled:opacity-50"
                            title="Approve exam booking"
                          >
                            {approvingId === student.uid ? 'Approving…' : 'Approve'}
                          </button>
                        )}

                        <button className="p-2 rounded-xl bg-white/5 text-[var(--ui-muted)] group-hover:text-[var(--ui-heading)] transition-colors">
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </GlassCard>
            </section>

            {/* Quick Actions / Course Info */}
            <section className="space-y-4">
              <h3 className="text-lg font-bold text-[var(--ui-heading)] flex items-center gap-2">
                <LayoutDashboard className="text-[var(--ui-accent)] size={20} animate-pulse" />
                🔴 Quick Actions - Live Classes (Updated)
              </h3>
              <div className="grid grid-cols-1 gap-3">
                <PrimaryButton className="w-full py-4 justify-between group bg-green-600 hover:bg-green-700 border-green-500" onClick={() => handleStartLiveNow()}>
                  🔴 Start Live Now <Video size={18} className="animate-pulse" />
                </PrimaryButton>
                <PrimaryButton variant="secondary" className="w-full py-4 justify-between border-blue-500/30 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400" onClick={() => setShowLiveModal(true)}>
                  📅 Schedule Live Session <Video size={18} />
                </PrimaryButton>
                <PrimaryButton className="w-full py-4 justify-between group" onClick={() => setShowCreateModal(true)}>
                  Create Assignment <Plus size={18} className="group-hover:rotate-90 transition-transform" />
                </PrimaryButton>
                <PrimaryButton variant="secondary" className="w-full py-4 justify-between border-white/10 hover:bg-white/5" onClick={() => setShowAnnouncementModal(true)}>
                  Send Announcement <Bell size={18} />
                </PrimaryButton>
                <PrimaryButton variant="secondary" className="w-full py-4 justify-between border-white/10 hover:bg-white/5" onClick={() => setShowResourceModal(true)}>
                  Share Resource <FolderOpen size={18} />
                </PrimaryButton>
              </div>
            </section>
          </div>

          {/* Assignments Section */}
          <section className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-lg font-bold text-[var(--ui-heading)] flex items-center gap-2">
                <ClipboardList className="text-[var(--ui-accent)]" size={20} />
                Assignments
              </h3>
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-[var(--ui-accent)] hover:opacity-80"
              >
                <Plus size={12} /> New
              </button>
            </div>
            {assignments.length === 0 ? (
              <GlassCard className="p-8 text-center border border-white/5">
                <AlertCircle size={28} className="mx-auto text-[var(--ui-muted)] mb-2" />
                <p className="text-[var(--ui-muted)] text-sm">No assignments yet for this course.</p>
              </GlassCard>
            ) : (
              <GlassCard className="p-0 overflow-hidden border border-white/5 divide-y divide-white/5">
                {assignments.slice(0, 5).map((a) => (
                  <div key={a.id} className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="size-9 rounded-xl bg-[var(--ui-accent)]/10 flex items-center justify-center text-[var(--ui-accent)]">
                        <FileText size={16} />
                      </div>
                      <div>
                        <p className="text-[var(--ui-heading)] font-semibold text-sm">{a.title}</p>
                        <p className="text-[10px] text-[var(--ui-muted)] uppercase font-bold">Due: {a.dueDate} · {a.type}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => navigate('/teacher/tasks')}
                      className="p-2 rounded-xl bg-white/5 text-[var(--ui-muted)] hover:text-[var(--ui-heading)] transition-colors"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                ))}
              </GlassCard>
            )}
          </section>
        </>
      ) : (
        <GlassCard className="p-12 text-center space-y-4">
          <div className="size-20 rounded-full bg-white/5 flex items-center justify-center mx-auto text-slate-500">
            <GraduationCap size={40} />
          </div>
          <div className="max-w-md mx-auto">
            <h3 className="text-xl font-bold text-[var(--ui-heading)]">No Course Assigned</h3>
            <p className="text-[var(--ui-muted)] text-sm mt-2">
              You haven't been assigned to any course yet. Please contact the administrator to get started.
            </p>
          </div>
        </GlassCard>
      )}

      {/* Quick Actions Floating Button */}
      {selectedCourse && (
        <div className="fixed bottom-24 right-6 z-40">
          <button
            onClick={() => setShowQuickActions(true)}
            className="bg-[var(--ui-accent)] text-white size-14 flex items-center justify-center rounded-2xl shadow-2xl hover:scale-110 transition-transform active:scale-95"
          >
            <Plus size={32} />
          </button>
        </div>
      )}

      {/* Quick Action Modal */}
      <AnimatePresence>
        {showQuickActions && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowQuickActions(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="fixed inset-0 z-[70] flex items-center justify-center p-4 pointer-events-none"
            >
              <div className="bg-[var(--ui-bg)] border border-[var(--ui-border)] rounded-3xl p-8 shadow-2xl max-w-sm w-full pointer-events-auto space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-bold text-[var(--ui-heading)]">Quick Actions</h3>
                  <button onClick={() => setShowQuickActions(false)} className="text-[var(--ui-muted)] hover:text-[var(--ui-heading)]">
                    <X size={24} />
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <button
                    onClick={() => {
                      setShowQuickActions(false);
                      setShowLiveModal(true);
                    }}
                    className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-emerald-500/10 hover:border-emerald-500/30 transition-all group w-full text-left"
                  >
                    <div className="size-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white transition-all">
                      <Video size={24} />
                    </div>
                    <div>
                      <p className="font-bold text-[var(--ui-heading)]">Schedule Session</p>
                      <p className="text-xs text-[var(--ui-muted)]">Live Class</p>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setShowQuickActions(false);
                      navigate(`/teacher/lessons?courseId=${selectedCourseId}&mode=create`);
                    }}
                    className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-[#6324eb]/10 hover:border-[#6324eb]/30 transition-all group w-full text-left"
                  >
                    <div className="size-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white transition-all">
                      <Video size={24} />
                    </div>
                    <div>
                      <p className="font-bold text-[var(--ui-heading)]">Add Lesson</p>
                      <p className="text-xs text-[var(--ui-muted)]">Video & Resources</p>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setShowQuickActions(false);
                      navigate(`/teacher/modules?courseId=${selectedCourseId}&mode=create`);
                    }}
                    className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-blue-500/10 hover:border-blue-500/30 transition-all group w-full text-left"
                  >
                    <div className="size-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 group-hover:bg-blue-500 group-hover:text-white transition-all">
                      <BookOpen size={24} />
                    </div>
                    <div>
                      <p className="font-bold text-[var(--ui-heading)]">Add Module</p>
                      <p className="text-xs text-[var(--ui-muted)]">New Chapter</p>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setShowQuickActions(false);
                      setShowCreateModal(true);
                    }}
                    className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-[#6324eb]/10 hover:border-[#6324eb]/30 transition-all group w-full text-left"
                  >
                    <div className="size-12 rounded-xl bg-[#6324eb]/10 flex items-center justify-center text-[#6324eb] group-hover:bg-[#6324eb] group-hover:text-white transition-all">
                      <ClipboardList size={24} />
                    </div>
                    <div>
                      <p className="font-bold text-[var(--ui-heading)]">Create Task</p>
                      <p className="text-xs text-[var(--ui-muted)]">New Assignment</p>
                    </div>
                  </button>
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => setShowQuickActions(false)}
                    className="w-full py-4 rounded-2xl bg-white/5 text-[var(--ui-body)] font-bold hover:bg-white/10 transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Schedule Live Session Modal */}
      <AnimatePresence>
        {showLiveModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLiveModal(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="fixed inset-0 z-[70] flex items-center justify-center p-4 pointer-events-none"
            >
              <div className="bg-[var(--ui-bg)] border border-[var(--ui-border)] rounded-3xl p-8 shadow-2xl max-w-lg w-full pointer-events-auto">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="text-xl font-bold text-[var(--ui-heading)]">Schedule Live Session</h3>
                    <p className="text-xs text-[var(--ui-muted)] mt-0.5">Saved to Firestore — students see it immediately</p>
                  </div>
                  <button onClick={() => setShowLiveModal(false)} className="text-[var(--ui-muted)] hover:text-[var(--ui-heading)] transition-colors">
                    <X size={22} />
                  </button>
                </div>

                <form onSubmit={handleScheduleSession} className="space-y-4">
                  {/* Title */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[var(--ui-muted)] uppercase tracking-wider">Session Title</label>
                    <input
                      required
                      value={liveForm.title}
                      onChange={e => setLiveForm(f => ({ ...f, title: e.target.value }))}
                      className="input-field w-full"
                      placeholder="e.g. Writing Task 2: Advanced Structures"
                    />
                  </div>

                  {/* Course */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[var(--ui-muted)] uppercase tracking-wider">Course</label>
                    <select
                      required
                      value={liveForm.courseId || selectedCourseId || ''}
                      onChange={e => setLiveForm(f => ({ ...f, courseId: e.target.value }))}
                      className="input-field w-full"
                    >
                      <option value="">Select course</option>
                      {courses.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Date */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[var(--ui-muted)] uppercase tracking-wider">Date</label>
                    <input
                      required
                      type="date"
                      value={liveForm.date}
                      onChange={e => setLiveForm(f => ({ ...f, date: e.target.value }))}
                      className="input-field w-full [color-scheme:dark]"
                    />
                  </div>

                  {/* Start / End time row */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[var(--ui-muted)] uppercase tracking-wider">Start Time</label>
                      <input
                        required
                        type="time"
                        value={liveForm.startTime}
                        onChange={e => setLiveForm(f => ({ ...f, startTime: e.target.value }))}
                        className="input-field w-full [color-scheme:dark]"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[var(--ui-muted)] uppercase tracking-wider">End Time</label>
                      <input
                        required
                        type="time"
                        value={liveForm.endTime}
                        onChange={e => setLiveForm(f => ({ ...f, endTime: e.target.value }))}
                        className="input-field w-full [color-scheme:dark]"
                      />
                    </div>
                  </div>

                  {/* Meeting Link */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[var(--ui-muted)] uppercase tracking-wider">Meeting Link</label>
                    <input
                      type="url"
                      value={liveForm.meetingUrl}
                      onChange={e => setLiveForm(f => ({ ...f, meetingUrl: e.target.value }))}
                      className="input-field w-full"
                      placeholder="https://zoom.us/j/... or meet.google.com/..."
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowLiveModal(false)}
                      className="flex-1 py-3 rounded-2xl bg-white/5 text-[var(--ui-body)] font-bold hover:bg-white/10 transition-all"
                    >
                      Cancel
                    </button>
                    <PrimaryButton type="submit" loading={liveLoading} className="flex-1 py-3">
                      <Video size={16} /> Schedule Session
                    </PrimaryButton>
                  </div>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Create Assignment Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCreateModal(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="fixed inset-0 z-[70] flex items-center justify-center p-4 pointer-events-none"
            >
              <div className="bg-[var(--ui-bg)] border border-[var(--ui-border)] rounded-3xl p-8 shadow-2xl max-w-lg w-full pointer-events-auto">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="text-xl font-bold text-[var(--ui-heading)]">Create Assignment</h3>
                    <p className="text-xs text-[var(--ui-muted)] mt-0.5">Save to Firestore — visible to all students in this course</p>
                  </div>
                  <button onClick={() => setShowCreateModal(false)} className="text-[var(--ui-muted)] hover:text-[var(--ui-heading)] transition-colors">
                    <X size={22} />
                  </button>
                </div>

                <form onSubmit={handleCreateAssignment} className="space-y-4">
                  {/* Title */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[var(--ui-muted)] uppercase tracking-wider">Title</label>
                    <input
                      required
                      value={createForm.title}
                      onChange={e => setCreateForm(f => ({ ...f, title: e.target.value }))}
                      className="input-field w-full"
                      placeholder="e.g. Academic Writing Task 1"
                    />
                  </div>

                  {/* Description */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[var(--ui-muted)] uppercase tracking-wider">Description</label>
                    <textarea
                      required
                      value={createForm.description}
                      onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))}
                      className="input-field w-full min-h-[88px] resize-none"
                      placeholder="Provide instructions and scoring criteria..."
                      rows={3}
                    />
                  </div>

                  {/* Course + Due Date row */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[var(--ui-muted)] uppercase tracking-wider">Course</label>
                      <select
                        required
                        value={createForm.courseId || selectedCourseId || ''}
                        onChange={e => setCreateForm(f => ({ ...f, courseId: e.target.value, moduleId: '' }))}
                        className="input-field w-full"
                      >
                        <option value="">Select course</option>
                        {courses.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[var(--ui-muted)] uppercase tracking-wider">Due Date</label>
                      <input
                        required
                        type="date"
                        value={createForm.dueDate}
                        onChange={e => setCreateForm(f => ({ ...f, dueDate: e.target.value }))}
                        className="input-field w-full [color-scheme:dark]"
                      />
                    </div>
                  </div>

                  {/* Module */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[var(--ui-muted)] uppercase tracking-wider">Module (optional)</label>
                    <select
                      value={createForm.moduleId}
                      onChange={e => setCreateForm(f => ({ ...f, moduleId: e.target.value }))}
                      className="input-field w-full"
                    >
                      <option value="">No specific module</option>
                      {modalModules.map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Type */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[var(--ui-muted)] uppercase tracking-wider">Type</label>
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                      {[
                        { id: 'writing', label: 'Writing', Icon: FileText },
                        { id: 'listening', label: 'Listen', Icon: Volume2 },
                        { id: 'reading', label: 'Reading', Icon: BookOpen },
                        { id: 'speaking', label: 'Speaking', Icon: PlayCircle },
                        { id: 'vocabulary', label: 'Vocab', Icon: ClipboardList },
                      ].map(({ id, label, Icon }) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setCreateForm(f => ({ ...f, type: id as Assignment['type'] }))}
                          className={cn(
                            'flex flex-col items-center gap-1 py-2.5 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all',
                            createForm.type === id
                              ? 'bg-[var(--ui-accent)]/20 border-[var(--ui-accent)] text-[var(--ui-accent)]'
                              : 'bg-white/5 border-white/5 text-[var(--ui-muted)] hover:border-white/20'
                          )}
                        >
                          <Icon size={16} />
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* File Upload */}
                  <FileUpload
                    folder="assignments"
                    label="Attach Resource (optional)"
                    value={createAttachmentUrl}
                    fileName={createAttachmentName}
                    onUploaded={(url, name) => { setCreateAttachmentUrl(url); setCreateAttachmentName(name); }}
                    onClear={() => { setCreateAttachmentUrl(''); setCreateAttachmentName(''); }}
                    compact
                  />

                  {/* Actions */}
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowCreateModal(false)}
                      className="flex-1 py-3 rounded-2xl bg-white/5 text-[var(--ui-body)] font-bold hover:bg-white/10 transition-all"
                    >
                      Cancel
                    </button>
                    <PrimaryButton type="submit" loading={createLoading} className="flex-1 py-3">
                      <Plus size={16} /> Save Assignment
                    </PrimaryButton>
                  </div>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Send Announcement Modal */}
      <AnimatePresence>
        {showAnnouncementModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAnnouncementModal(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="fixed inset-0 z-[70] flex items-center justify-center p-4 pointer-events-none"
            >
              <div className="bg-[var(--ui-bg)] border border-[var(--ui-border)] rounded-3xl p-8 shadow-2xl max-w-lg w-full pointer-events-auto">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="text-xl font-bold text-[var(--ui-heading)]">Send Announcement</h3>
                    <p className="text-xs text-[var(--ui-muted)] mt-0.5">Broadcast to all students in this course</p>
                  </div>
                  <button onClick={() => setShowAnnouncementModal(false)} className="text-[var(--ui-muted)] hover:text-[var(--ui-heading)] transition-colors">
                    <X size={22} />
                  </button>
                </div>

                <form onSubmit={handleSendAnnouncement} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[var(--ui-muted)] uppercase tracking-wider">Title</label>
                    <input
                      required
                      value={announcementForm.title}
                      onChange={e => setAnnouncementForm(f => ({ ...f, title: e.target.value }))}
                      className="input-field w-full"
                      placeholder="e.g. Exam date changed"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[var(--ui-muted)] uppercase tracking-wider">Message</label>
                    <textarea
                      required
                      rows={5}
                      value={announcementForm.message}
                      onChange={e => setAnnouncementForm(f => ({ ...f, message: e.target.value }))}
                      className="input-field w-full resize-none"
                      placeholder="Write your announcement here..."
                    />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowAnnouncementModal(false)}
                      className="flex-1 py-3 rounded-2xl bg-white/5 text-[var(--ui-body)] font-bold hover:bg-white/10 transition-all"
                    >
                      Cancel
                    </button>
                    <PrimaryButton type="submit" loading={announcementLoading} className="flex-1 py-3">
                      <Bell size={16} /> Send
                    </PrimaryButton>
                  </div>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Share Resource Modal */}
      <AnimatePresence>
        {showResourceModal && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]" onClick={() => setShowResourceModal(false)} />
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="fixed inset-0 z-[70] flex items-center justify-center p-4 pointer-events-none">
              <div className="bg-[var(--ui-bg)] border border-[var(--ui-border)] rounded-3xl p-8 shadow-2xl max-w-lg w-full pointer-events-auto">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="text-xl font-bold text-[var(--ui-heading)]">Share Resource</h3>
                    <p className="text-xs text-[var(--ui-muted)] mt-0.5">Visible to all students in this course</p>
                  </div>
                  <button onClick={() => setShowResourceModal(false)} className="text-[var(--ui-muted)] hover:text-[var(--ui-heading)] transition-colors">
                    <X size={22} />
                  </button>
                </div>
                <form onSubmit={handleShareResource} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[var(--ui-muted)] uppercase tracking-wider">Title</label>
                    <input required value={resourceForm.title} onChange={e => setResourceForm(f => ({ ...f, title: e.target.value }))} className="input-field w-full" placeholder="e.g. Writing Task 2 Guide" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[var(--ui-muted)] uppercase tracking-wider">Type</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['pdf', 'video', 'tip'] as const).map(t => (
                        <button key={t} type="button" onClick={() => setResourceForm(f => ({ ...f, type: t }))}
                          className={cn('py-2.5 rounded-xl border text-xs font-bold capitalize transition-all',
                            resourceForm.type === t
                              ? 'bg-[var(--ui-accent)]/15 border-[var(--ui-accent)]/50 text-[var(--ui-accent)]'
                              : 'bg-white/5 border-white/10 text-[var(--ui-muted)] hover:bg-white/10'
                          )}
                        >
                          {t === 'pdf' ? 'PDF' : t === 'video' ? 'Video' : 'Tip'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[var(--ui-muted)] uppercase tracking-wider">URL / Link</label>
                    <input required type="url" value={resourceForm.url} onChange={e => setResourceForm(f => ({ ...f, url: e.target.value }))} className="input-field w-full" placeholder="https://docs.google.com/..." />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[var(--ui-muted)] uppercase tracking-wider">Description <span className="font-normal normal-case">(optional)</span></label>
                    <input value={resourceForm.description} onChange={e => setResourceForm(f => ({ ...f, description: e.target.value }))} className="input-field w-full" placeholder="Brief note about this resource" />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button type="button" onClick={() => setShowResourceModal(false)} className="flex-1 py-3 rounded-2xl bg-white/5 text-[var(--ui-body)] font-bold hover:bg-white/10 transition-all">Cancel</button>
                    <PrimaryButton type="submit" loading={resourceLoading} className="flex-1 py-3">
                      <FolderOpen size={16} /> Share
                    </PrimaryButton>
                  </div>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div >
  );
};
