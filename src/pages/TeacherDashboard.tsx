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
import { useLiveClassCreation } from '../hooks/useLiveClassCreation';
import { db } from '../services/firebase';
import { collection, query, where, onSnapshot, doc, getDoc, getDocs, updateDoc, serverTimestamp, addDoc, orderBy } from 'firebase/firestore';
import { Course, UserProfile, Enrollment, Module, Assignment, Announcement, Resource, Batch } from '../types';
import { NotificationService } from '../services/notificationService';
import { FileUpload } from '../components/FileUpload';
import { CreateLiveClassModal } from '../components/CreateLiveClassModal';

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

  // Create Live Class modal
  const [showCreateLiveClassModal, setShowCreateLiveClassModal] = useState(false);
  const [liveClassModalModules, setLiveClassModalModules] = useState<Module[]>([]);
  const [liveClassModalBatches, setLiveClassModalBatches] = useState<Batch[]>([]);
  const { createLiveClass, isCreating: isCreatingLiveClass } = useLiveClassCreation();

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

  // 6. Fetch modules and batches for Create Live Class modal
  useEffect(() => {
    if (!showCreateLiveClassModal || !selectedCourseId) {
      setLiveClassModalModules([]);
      setLiveClassModalBatches([]);
      return;
    }

    // Fetch modules
    getDocs(query(
      collection(db, 'courses', selectedCourseId, 'modules'),
      orderBy('order', 'asc')
    )).then(snap => {
      setLiveClassModalModules(snap.docs.map(d => ({ id: d.id, ...d.data() } as Module)));
    }).catch(err => console.error('Error fetching modules:', err));

    // Fetch batches
    getDocs(query(
      collection(db, 'batches'),
      where('teacherId', '==', teacherData?.uid)
    )).then(snap => {
      setLiveClassModalBatches(snap.docs.map(d => ({ id: d.id, ...d.data() } as Batch)));
    }).catch(err => console.error('Error fetching batches:', err));
  }, [showCreateLiveClassModal, selectedCourseId, teacherData?.uid]);

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

  const handleCreateLiveClass = async (formData: any) => {
    if (!teacherUser) {
      throw new Error('Teacher information not available');
    }

    try {
      await createLiveClass({
        ...formData,
        teacherId: teacherUser.uid,
      });

      // Show success message
      alert('✅ Live class created successfully!');
      
      // Reset and close modal
      setShowCreateLiveClassModal(false);
    } catch (err) {
      console.error('Error creating live class:', err);
      throw err;
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
      className="w-full space-y-6"
    >
      {/* ===== TOP BAR ===== */}
      <section className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        {/* Search Input */}
        <div className="flex-1 max-w-md bg-white rounded-lg px-4 py-3 border border-gray-200 flex items-center gap-2">
          <Search size={18} className="text-gray-400" />
          <input
            type="text"
            placeholder="Search students, lessons..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 bg-transparent text-sm text-gray-900 placeholder-gray-400 outline-none"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 text-xs font-medium text-gray-600">
            <Calendar size={14} />
            {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-semibold text-sm transition-colors"
          >
            <Plus size={16} /> Create
          </button>
        </div>
      </section>

      {/* ===== COURSE SELECTOR ===== */}
      {courses.length > 0 && (
        <section className="flex gap-2 overflow-x-auto pb-2">
          {courses.map(course => (
            <button
              key={course.id}
              onClick={() => setSelectedCourseId(course.id)}
              className={cn(
                "px-4 py-2 rounded-lg font-medium text-sm transition-all whitespace-nowrap flex-shrink-0 border",
                selectedCourseId === course.id
                  ? "bg-purple-600 text-white border-purple-700 shadow-md"
                  : "bg-white text-gray-700 border-gray-200 hover:border-gray-300"
              )}
            >
              {course.name}
            </button>
          ))}
        </section>
      )}

      {selectedCourse ? (
        <>
          {/* ===== KPI CARDS SECTION ===== */}
          <section className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Total Students */}
            <div className="bg-white rounded-lg p-4 border border-gray-200 hover:border-gray-300 transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 bg-emerald-100 rounded-md">
                  <Users size={16} className="text-emerald-600" />
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900">{enrolledStudents.length}</p>
              <p className="text-xs text-gray-600 font-medium">Students</p>
            </div>

            {/* Pending Approvals */}
            <div className="bg-white rounded-lg p-4 border border-gray-200 hover:border-gray-300 transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 bg-amber-100 rounded-md">
                  <Clock size={16} className="text-amber-600" />
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {eligibleStudents.filter(s => s.examStatus !== 'booked' && s.examStatus !== 'completed').length}
              </p>
              <p className="text-xs text-gray-600 font-medium">Pending</p>
            </div>

            {/* Active Batches */}
            <div className="bg-white rounded-lg p-4 border border-gray-200 hover:border-gray-300 transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 bg-blue-100 rounded-md">
                  <BookOpen size={16} className="text-blue-600" />
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900">{courses.length}</p>
              <p className="text-xs text-gray-600 font-medium">Batches</p>
            </div>

            {/* Assignments */}
            <div className="bg-white rounded-lg p-4 border border-gray-200 hover:border-gray-300 transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 bg-purple-100 rounded-md">
                  <ClipboardList size={16} className="text-purple-600" />
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900">{assignments.length}</p>
              <p className="text-xs text-gray-600 font-medium">Tasks</p>
            </div>

            {/* Grading Queue */}
            <div className="bg-white rounded-lg p-4 border border-gray-200 hover:border-gray-300 transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 bg-red-100 rounded-md">
                  <CheckCircle2 size={16} className="text-red-600" />
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900">{pendingSubmissionsCount}</p>
              <p className="text-xs text-gray-600 font-medium">Grading</p>
            </div>
          </section>

          {/* ===== MAIN TWO-COLUMN LAYOUT ===== */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* LEFT COLUMN */}
            <div className="lg:col-span-2 space-y-6">
              {/* TODAY'S FOCUS - Command Center */}
              <section className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-purple-50 to-transparent">
                  <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                    <LayoutDashboard size={20} className="text-purple-600" />
                    Today's Focus
                  </h3>
                  <p className="text-xs text-gray-600 mt-1">What needs your attention</p>
                </div>

                <div className="p-6 space-y-4">
                  {/* Pending Approvals Alert */}
                  {eligibleStudents.filter(s => s.examStatus !== 'booked' && s.examStatus !== 'completed').length > 0 && (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-amber-100 rounded-lg flex-shrink-0">
                          <AlertCircle size={16} className="text-amber-600" />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-amber-900 text-sm">
                            {eligibleStudents.filter(s => s.examStatus !== 'booked' && s.examStatus !== 'completed').length} Student Approvals Pending
                          </p>
                          <p className="text-xs text-amber-700 mt-1">Review and approve exam bookings</p>
                          <button
                            onClick={() => navigate('/teacher/approvals')}
                            className="mt-2 text-xs font-semibold text-amber-600 hover:text-amber-700 flex items-center gap-1"
                          >
                            Review Now <ChevronRight size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Assignments Needing Review */}
                  {pendingSubmissionsCount > 0 && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-red-100 rounded-lg flex-shrink-0">
                          <ClipboardList size={16} className="text-red-600" />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-red-900 text-sm">
                            {pendingSubmissionsCount} Submissions to Grade
                          </p>
                          <p className="text-xs text-red-700 mt-1">Students are waiting for feedback</p>
                          <button
                            onClick={() => navigate('/teacher/tasks')}
                            className="mt-2 text-xs font-semibold text-red-600 hover:text-red-700 flex items-center gap-1"
                          >
                            Grade Now <ChevronRight size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Upcoming Class */}
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-blue-100 rounded-lg flex-shrink-0">
                        <Video size={16} className="text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-blue-900 text-sm">No Live Class Scheduled</p>
                        <p className="text-xs text-blue-700 mt-1">Schedule a session for your students</p>
                        <button
                          onClick={() => setShowLiveModal(true)}
                          className="mt-2 text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                        >
                          Schedule Now <ChevronRight size={12} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Quick Stats */}
                  {eligibleStudents.filter(s => s.examStatus !== 'booked' && s.examStatus !== 'completed').length === 0 && pendingSubmissionsCount === 0 && (
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-center">
                      <div className="flex justify-center mb-2">
                        <CheckCircle2 size={24} className="text-green-600" />
                      </div>
                      <p className="font-semibold text-green-900 text-sm">All Caught Up!</p>
                      <p className="text-xs text-green-700 mt-1">No urgent tasks at the moment</p>
                    </div>
                  )}
                </div>
              </section>

              {/* UPCOMING LIVE CLASS */}
              <section className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-emerald-50 to-transparent">
                  <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                    <Video size={20} className="text-emerald-600" />
                    Next Live Class
                  </h3>
                </div>
                <div className="p-6">
                  <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-center">
                    <p className="text-sm text-gray-600">No live class scheduled</p>
                    <button
                      onClick={() => setShowLiveModal(true)}
                      className="mt-3 text-xs font-semibold text-purple-600 hover:text-purple-700 flex items-center gap-1 justify-center"
                    >
                      <Plus size={14} /> Schedule Live Class
                    </button>
                  </div>
                </div>
              </section>

              {/* RECENT STUDENT ACTIVITY */}
              <section className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-transparent">
                  <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                    <GraduationCap size={20} className="text-blue-600" />
                    Recent Activity
                  </h3>
                </div>
                <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                  {filteredStudents.slice(0, 6).length > 0 ? (
                    filteredStudents.slice(0, 6).map((student) => (
                      <div
                        key={student.uid}
                        onClick={() => navigate(`/teacher/students/${student.uid}`)}
                        className="px-6 py-4 flex items-center gap-3 hover:bg-gray-50 transition-colors cursor-pointer"
                      >
                        <img
                          src={student.avatarUrl || `https://picsum.photos/seed/${student.uid}/100/100`}
                          alt={student.name}
                          className="w-10 h-10 rounded-full object-cover border border-gray-200"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 text-sm truncate">{student.name}</p>
                          <p className="text-xs text-gray-500">
                            {student.trainingStatus ? student.trainingStatus.replace('_', ' ') : 'No activity'}
                          </p>
                        </div>
                        <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />
                      </div>
                    ))
                  ) : (
                    <div className="px-6 py-8 text-center">
                      <p className="text-sm text-gray-500">No student activity yet</p>
                    </div>
                  )}
                </div>
              </section>
            </div>

            {/* RIGHT COLUMN */}
            <div className="space-y-6">
              {/* QUICK ACTIONS */}
              <section className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-pink-50 to-transparent">
                  <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                    <Plus size={20} className="text-pink-600" />
                    Quick Actions
                  </h3>
                </div>
                <div className="p-6 space-y-3">
                  <button
                    onClick={() => navigate('/teacher/batches')}
                    className="w-full flex items-center gap-3 p-3 rounded-lg bg-gradient-to-br from-purple-50 to-purple-100/50 border border-purple-200 hover:border-purple-300 hover:shadow-md transition-all group text-left"
                  >
                    <div className="p-2 bg-purple-600 rounded-lg text-white flex-shrink-0 group-hover:bg-purple-700">
                      <Users size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-gray-900 text-sm">Manage Batches</p>
                      <p className="text-xs text-gray-600">{courses.length} courses</p>
                    </div>
                  </button>

                  <button
                    onClick={() => navigate('/teacher/approvals')}
                    className="w-full flex items-center gap-3 p-3 rounded-lg bg-gradient-to-br from-amber-50 to-amber-100/50 border border-amber-200 hover:border-amber-300 hover:shadow-md transition-all group text-left"
                  >
                    <div className="p-2 bg-amber-600 rounded-lg text-white flex-shrink-0 group-hover:bg-amber-700">
                      <CheckCircle2 size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-gray-900 text-sm">Approvals</p>
                      <p className="text-xs text-gray-600">
                        {eligibleStudents.filter(s => s.examStatus !== 'booked' && s.examStatus !== 'completed').length} pending
                      </p>
                    </div>
                  </button>

                  <button
                    onClick={() => navigate(`/teacher/lessons?courseId=${selectedCourseId}`)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg bg-gradient-to-br from-blue-50 to-blue-100/50 border border-blue-200 hover:border-blue-300 hover:shadow-md transition-all group text-left"
                  >
                    <div className="p-2 bg-blue-600 rounded-lg text-white flex-shrink-0 group-hover:bg-blue-700">
                      <BookOpen size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-gray-900 text-sm">Lessons</p>
                      <p className="text-xs text-gray-600">Manage content</p>
                    </div>
                  </button>

                  <button
                    onClick={() => navigate(`/teacher/attendance`)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg bg-gradient-to-br from-green-50 to-green-100/50 border border-green-200 hover:border-green-300 hover:shadow-md transition-all group text-left"
                  >
                    <div className="p-2 bg-green-600 rounded-lg text-white flex-shrink-0 group-hover:bg-green-700">
                      <Calendar size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-gray-900 text-sm">Attendance</p>
                      <p className="text-xs text-gray-600">Track presence</p>
                    </div>
                  </button>

                  <button
                    onClick={() => setShowCreateLiveClassModal(true)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg bg-gradient-to-br from-red-50 to-red-100/50 border border-red-200 hover:border-red-300 hover:shadow-md transition-all group text-left"
                  >
                    <div className="p-2 bg-red-600 rounded-lg text-white flex-shrink-0 group-hover:bg-red-700">
                      <Video size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-gray-900 text-sm">Create Class</p>
                      <p className="text-xs text-gray-600">Schedule live session</p>
                    </div>
                  </button>

                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg bg-gradient-to-br from-cyan-50 to-cyan-100/50 border border-cyan-200 hover:border-cyan-300 hover:shadow-md transition-all group text-left"
                  >
                    <div className="p-2 bg-cyan-600 rounded-lg text-white flex-shrink-0 group-hover:bg-cyan-700">
                      <ClipboardList size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-gray-900 text-sm">Create Task</p>
                      <p className="text-xs text-gray-600">{assignments.length} active</p>
                    </div>
                  </button>
                </div>
              </section>

              {/* PENDING APPROVALS SUMMARY */}
              {eligibleStudents.filter(s => s.examStatus !== 'booked' && s.examStatus !== 'completed').length > 0 && (
                <section className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-orange-50 to-transparent">
                    <h3 className="font-bold text-gray-900 flex items-center gap-2">
                      <AlertCircle size={18} className="text-orange-600" />
                      Pending Approvals
                    </h3>
                  </div>
                  <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
                    {eligibleStudents.filter(s => s.examStatus !== 'booked' && s.examStatus !== 'completed').slice(0, 4).map((student) => (
                      <div key={student.uid} className="px-6 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-gray-900 text-sm truncate">{student.name}</p>
                          <p className="text-xs text-gray-500">Exam booking waiting</p>
                        </div>
                        <button
                          onClick={() => handleApproveExamBooking(student)}
                          disabled={approvingId === student.uid}
                          className="px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 text-xs font-semibold transition-all disabled:opacity-50 flex-shrink-0 ml-2"
                        >
                          {approvingId === student.uid ? '...' : 'Approve'}
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* COURSE OVERVIEW CARD */}
              <section className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-lg p-6 text-white">
                <h4 className="font-bold mb-4">Course Overview</h4>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-purple-100">Course</p>
                    <p className="font-semibold">{selectedCourse?.name}</p>
                  </div>
                  <div className="pt-3 border-t border-purple-400">
                    <p className="text-xs text-purple-100 mb-2">Quick Stats</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-purple-100 text-xs">Students</p>
                        <p className="font-bold">{enrolledStudents.length}</p>
                      </div>
                      <div>
                        <p className="text-purple-100 text-xs">Tasks</p>
                        <p className="font-bold">{assignments.length}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <GraduationCap size={32} className="text-gray-400" />
          </div>
          <h3 className="text-lg font-bold text-gray-900">No Course Assigned</h3>
          <p className="text-gray-600 text-sm mt-2">
            You haven't been assigned to any course yet. Contact the administrator.
          </p>
        </div>
      )}
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
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <GraduationCap size={32} className="text-gray-400" />
          </div>
          <h3 className="text-lg font-bold text-gray-900">No Course Assigned</h3>
          <p className="text-gray-600 text-sm mt-2">
            You haven't been assigned to any course yet. Please contact the administrator.
          </p>
        </div>
      )}

      {/* ===== MODALS ===== */}
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

      {/* Create Live Class Modal */}
      <CreateLiveClassModal
        isOpen={showCreateLiveClassModal}
        onClose={() => setShowCreateLiveClassModal(false)}
        modules={liveClassModalModules}
        batches={liveClassModalBatches}
        onCreateClass={handleCreateLiveClass}
      />
    </motion.div >
  );
};
