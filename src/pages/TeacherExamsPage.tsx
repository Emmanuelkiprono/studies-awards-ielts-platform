import React, { useEffect, useMemo, useState } from 'react';
import { GlassCard, StatusBadge, PrimaryButton } from '../components/UI';
import {
  Calendar,
  Search,
  MapPin,
  CheckCircle2,
  Clock,
  BookOpen,
  Edit3,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, doc, getDoc, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import { NotificationService } from '../services/notificationService';
import { db } from '../services/firebase';
import { Course, Enrollment, UserProfile, StudentData, ExamStatus } from '../types';
import { useAuth } from '../hooks/useAuth';
import { cn } from '../lib/utils';

interface ExamRow extends UserProfile {
  enrollment: Enrollment;
  studentData?: StudentData;
  course?: Course;
}

export const TeacherExamsPage: React.FC = () => {
  const { profile } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [rows, setRows] = useState<ExamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [bookingModalRow, setBookingModalRow] = useState<ExamRow | null>(null);
  const [bookingDate, setBookingDate] = useState('');
  const [bookingCenter, setBookingCenter] = useState('');
  const [bookingRef, setBookingRef] = useState('');
  const [bookingNotes, setBookingNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Fetch courses (for filter)
  useEffect(() => {
    const coursesQ = query(collection(db, 'courses'));
    const unsubscribe = onSnapshot(coursesQ, (snapshot) => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Course));
      setCourses(list);
      if (!selectedCourseId && list.length > 0) {
        const preferred = profile?.assignedCourseId && list.find(c => c.id === profile.assignedCourseId);
        setSelectedCourseId(preferred?.id || list[0].id);
      }
    });
    return () => unsubscribe();
  }, [profile?.assignedCourseId, selectedCourseId]);

  // Fetch enrollments + users for selected course
  useEffect(() => {
    if (!selectedCourseId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);

    const enrollmentsQ = query(
      collection(db, 'enrollments'),
      where('courseId', '==', selectedCourseId)
    );

    const unsubscribe = onSnapshot(enrollmentsQ, async (snapshot) => {
      const enrollments = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Enrollment));
      const userIds = enrollments.map(e => e.userId);
      if (userIds.length === 0) {
        setRows([]);
        setLoading(false);
        return;
      }

      const usersSnap = await Promise.all(
        userIds.map(id => getDoc(doc(db, 'users', id)))
      );
      const studentsSnap = await Promise.all(
        userIds.map(id => getDoc(doc(db, 'students', id)))
      );

      const courseMap: Record<string, Course> = {};
      for (const c of courses) {
        courseMap[c.id] = c;
      }

      const combined: ExamRow[] = [];
      for (let i = 0; i < userIds.length; i++) {
        const userDoc = usersSnap[i];
        if (!userDoc.exists()) continue;
        const profileData = userDoc.data() as UserProfile;
        const enrollment = enrollments.find(e => e.userId === profileData.uid);
        if (!enrollment) continue;

        const sDoc = studentsSnap[i];
        const sData = sDoc.exists() ? (sDoc.data() as StudentData) : undefined;

        combined.push({
          ...profileData,
          enrollment,
          studentData: sData,
          course: courseMap[enrollment.courseId],
        });
      }

      setRows(combined);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [selectedCourseId, courses]);

  // Helpers
  const computeRegistrationDate = (enrollment: Enrollment) => {
    if (enrollment.registrationDate?.toDate) return enrollment.registrationDate.toDate();
    if (enrollment.registeredAt?.toDate) return enrollment.registeredAt.toDate();
    if (enrollment.registrationDate) return new Date(enrollment.registrationDate as any);
    if (enrollment.registeredAt) return new Date(enrollment.registeredAt as any);
    return null;
  };

  const computeEligibleDate = (enrollment: Enrollment) => {
    if (enrollment.eligibleExamDate) return new Date(enrollment.eligibleExamDate);
    if (enrollment.eligibleAt) return new Date(enrollment.eligibleAt);
    const reg = computeRegistrationDate(enrollment);
    if (!reg) return null;
    return new Date(reg.getTime() + 28 * 24 * 60 * 60 * 1000);
  };

  const computeEligibilityStatus = (enrollment: Enrollment): ExamStatus => {
    const eligibleDate = computeEligibleDate(enrollment);
    if (!eligibleDate) return 'not_eligible';
    const now = new Date();
    if (enrollment.examStatus === 'booked' || enrollment.examStatus === 'completed') {
      return enrollment.examStatus;
    }
    return now >= eligibleDate ? 'eligible' : 'not_eligible';
  };

  const filteredRows = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return rows.filter(r => {
      const matchSearch =
        r.name.toLowerCase().includes(term) ||
        r.email.toLowerCase().includes(term);
      return matchSearch;
    });
  }, [rows, searchTerm]);

  const openBookingModal = (row: ExamRow) => {
    const enrollment = row.enrollment;
    setBookingModalRow(row);
    setBookingDate(enrollment.examDate || '');
    setBookingCenter(enrollment.examCenter || row.enrollment.location?.centerPreference || '');
    setBookingRef(enrollment.bookingReference || '');
    setBookingNotes(enrollment.bookingNotes || '');
  };

  const handleSaveBooking = async () => {
    if (!bookingModalRow) return;
    if (!bookingDate || !bookingCenter || !bookingRef) {
      alert('Please fill exam date, center and booking reference.');
      return;
    }
    setSaving(true);
    try {
      const enrollmentId = bookingModalRow.enrollment.id;
      const enrollmentRef = doc(db, 'enrollments', enrollmentId);
      await updateDoc(enrollmentRef, {
        examStatus: 'booked',
        examFeeStatus: 'paid',
        examDate: bookingDate,
        examCenter: bookingCenter,
        bookingReference: bookingRef,
        bookingNotes: bookingNotes || null,
        eligibleExamDate: computeEligibleDate(bookingModalRow.enrollment)?.toISOString() || null,
        registrationDate: computeRegistrationDate(bookingModalRow.enrollment) || null,
      });

      // Keep student record in sync for other dashboards
      await updateDoc(doc(db, 'students', bookingModalRow.uid), {
        examStatus: 'booked',
        examDate: bookingDate,
        examCenter: bookingCenter,
        bookingReference: bookingRef,
      });

      // Notify student
      await NotificationService.create(
        bookingModalRow.uid,
        'Exam Booking Confirmed',
        `Your IELTS exam has been booked at ${bookingCenter} on ${new Date(bookingDate).toLocaleDateString()}. Ref: ${bookingRef}`,
        'success',
        '/exam_booking'
      );

      setBookingModalRow(null);
    } catch (err) {
      console.error('Error saving booking:', err);
      alert('Failed to save booking.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="size-10 border-4 border-[#6324eb]/30 border-t-[#6324eb] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 space-y-6 max-w-6xl mx-auto w-full pb-24"
    >
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-2">
            <Calendar className="text-[#6324eb]" size={24} />
            Exam Booking Panel
          </h2>
          <p className="text-slate-400 text-sm">
            Manage IELTS / PTE exam eligibility, fees and bookings for your students.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 bg-white/5 rounded-2xl p-1 border border-white/10">
          {courses.map(course => (
            <button
              key={course.id}
              onClick={() => setSelectedCourseId(course.id)}
              className={cn(
                "px-4 py-1.5 rounded-xl text-xs font-bold transition-all",
                selectedCourseId === course.id
                  ? "bg-[#6324eb] text-white shadow-lg shadow-[#6324eb]/20"
                  : "text-slate-400 hover:text-white hover:bg-white/10"
              )}
            >
              {course.name}
            </button>
          ))}
        </div>
      </header>

      {/* Search */}
      <GlassCard className="p-4">
        <div className="relative max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <input
            type="text"
            placeholder="Search by name or email..."
            className="input-field pl-12 py-3"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </GlassCard>

      {/* Table */}
      <GlassCard className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5 border-b border-white/5 text-[11px] text-slate-400 uppercase tracking-wider">
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Course</th>
                <th className="px-4 py-3">Registration</th>
                <th className="px-4 py-3">Eligible From</th>
                <th className="px-4 py-3">Exam Fee</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Exam Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-sm">
              {filteredRows.map(row => {
                const reg = computeRegistrationDate(row.enrollment);
                const eligibleDate = computeEligibleDate(row.enrollment);
                const eligibilityStatus = computeEligibilityStatus(row.enrollment);
                const isEligible = eligibilityStatus === 'eligible' || eligibilityStatus === 'booked' || eligibilityStatus === 'completed';
                const feeStatus = row.enrollment.examFeeStatus || row.enrollment.paymentStatus as any;

                const examStatusLabel = (() => {
                  const s = row.enrollment.examStatus as ExamStatus;
                  if (s === 'booked') return 'Booked';
                  if (s === 'completed') return 'Completed';
                  if (s === 'pending_booking') return 'Pending Booking';
                  if (isEligible) return 'Eligible';
                  return 'Not Eligible';
                })();

                return (
                  <tr key={row.uid} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="size-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-white">
                          {row.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-white text-sm font-semibold">{row.name}</p>
                          <p className="text-[11px] text-slate-500">{row.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-slate-300">
                      {row.course?.name || '—'}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-slate-300">
                      {reg ? reg.toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-[12px]">
                      <div className="flex flex-col gap-1">
                        <span className="text-slate-300">
                          {eligibleDate ? eligibleDate.toLocaleDateString() : '—'}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          Reg. + 28 days
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        status={feeStatus || 'unpaid'}
                        variant={
                          feeStatus === 'paid' ? 'success' :
                            feeStatus === 'pending' ? 'warning' :
                              'accent'
                        }
                      />
                    </td>
                    <td className="px-4 py-3 text-[12px] text-slate-300">
                      {row.enrollment.location ? (
                        <div className="flex flex-col gap-1">
                          <span className="flex items-center gap-1">
                            <MapPin size={12} className="text-slate-500" />
                            {row.enrollment.location.city}, {row.enrollment.location.country}
                          </span>
                          {row.enrollment.location.centerPreference && (
                            <span className="text-[11px] text-slate-500">
                              Pref: {row.enrollment.location.centerPreference}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-500 text-xs">Not set</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <StatusBadge
                          status={examStatusLabel}
                          variant={
                            row.enrollment.examStatus === 'booked' || row.enrollment.examStatus === 'completed'
                              ? 'success'
                              : isEligible
                                ? 'primary'
                                : 'accent'
                          }
                        />
                        {isEligible && (
                          <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold">
                            <CheckCircle2 size={10} /> Eligible
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <PrimaryButton
                        className="py-1.5 px-3 text-xs"
                        variant={row.enrollment.examStatus === 'booked' ? 'secondary' : 'primary'}
                        disabled={!isEligible}
                        onClick={() => openBookingModal(row)}
                      >
                        <Edit3 size={14} className="mr-1" />
                        {row.enrollment.examStatus === 'booked' ? 'Edit Booking' : 'Book Exam'}
                      </PrimaryButton>
                    </td>
                  </tr>
                );
              })}

              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-slate-500 text-sm">
                    No students found for this course yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* Booking Modal */}
      <AnimatePresence>
        {bookingModalRow && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.9 }}
              exit={{ opacity: 0 }}
              onClick={() => setBookingModalRow(null)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60]"
            />
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              className="fixed inset-0 z-[70] flex items-center justify-center p-4 pointer-events-none"
            >
              <GlassCard className="max-w-md w-full p-6 space-y-5 pointer-events-auto bg-[#0b0814] border-white/10">
                <div className="flex justify-between items-start gap-3">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <BookOpen size={18} className="text-[#6324eb]" />
                      Book Exam
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      {bookingModalRow.name} • {bookingModalRow.course?.name || 'Course'}
                    </p>
                  </div>
                  <button
                    onClick={() => setBookingModalRow(null)}
                    className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-slate-400"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 uppercase font-bold px-1">Exam Date</label>
                      <input
                        type="date"
                        className="input-field py-2 text-sm [color-scheme:dark]"
                        value={bookingDate}
                        onChange={(e) => setBookingDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 uppercase font-bold px-1">Local Time</label>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 px-3 py-2 rounded-xl bg-white/5 border border-white/10">
                        <Clock size={12} />
                        Based on exam center timezone
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 uppercase font-bold px-1">Exam Center</label>
                    <input
                      type="text"
                      className="input-field py-2 text-sm"
                      placeholder="e.g. British Council - Lagos"
                      value={bookingCenter}
                      onChange={(e) => setBookingCenter(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 uppercase font-bold px-1">Booking Reference</label>
                    <input
                      type="text"
                      className="input-field py-2 text-sm"
                      placeholder="e.g. BC-IELTS-123456"
                      value={bookingRef}
                      onChange={(e) => setBookingRef(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 uppercase font-bold px-1">Internal Notes (Optional)</label>
                    <textarea
                      className="input-field py-2 text-sm min-h-[80px]"
                      placeholder="Special instructions, center policies, etc."
                      value={bookingNotes}
                      onChange={(e) => setBookingNotes(e.target.value)}
                    />
                  </div>
                </div>

                <div className="pt-3 flex gap-3">
                  <PrimaryButton
                    className="flex-1 py-3"
                    onClick={handleSaveBooking}
                    loading={saving}
                  >
                    Save Booking
                  </PrimaryButton>
                  <PrimaryButton
                    variant="secondary"
                    className="px-5 py-3"
                    onClick={() => setBookingModalRow(null)}
                  >
                    Cancel
                  </PrimaryButton>
                </div>
              </GlassCard>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

