import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
    Users,
    Check,
    X,
    Search,
    Mail,
    Phone,
    Clock,
    AlertCircle,
    CheckCircle2
} from 'lucide-react';
import {
    collection,
    query,
    where,
    onSnapshot,
    getDocs,
    updateDoc,
    setDoc,
    doc,
    getDoc,
    serverTimestamp
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { UserProfile, StudentData, Enrollment } from '../types';
import { NotificationService } from '../services/notificationService';
import { GlassCard, StatusBadge, PrimaryButton } from '../components/UI';

interface PendingStudent extends UserProfile {
    studentData?: StudentData;
    enrollment?: Enrollment;
}

export const TeacherApprovalsPage: React.FC = () => {
    const [students, setStudents] = useState<PendingStudent[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [processingId, setProcessingId] = useState<string | null>(null);

    useEffect(() => {
        const studentsQ = query(collection(db, 'users'), where('role', '==', 'student'));

        const unsubscribe = onSnapshot(studentsQ, async (snapshot) => {
            const pending: PendingStudent[] = [];

            for (const studentDoc of snapshot.docs) {
                console.log('PROCESSING STUDENT DOC:', studentDoc.id);
                const profile = { ...studentDoc.data(), uid: studentDoc.id } as UserProfile;
                console.log('BUILT PROFILE:', { uid: profile.uid, name: profile.name, email: profile.email });

                // Fetch student data
                const sDataDoc = await getDoc(doc(db, 'students', studentDoc.id));
                const sData = sDataDoc.exists() ? sDataDoc.data() as StudentData : undefined;
                console.log('STUDENT DATA EXISTS:', sDataDoc.exists());

                // Fetch enrollment
                const enrollmentsQ = query(collection(db, 'enrollments'), where('userId', '==', studentDoc.id));
                const enrollSnap = await getDocs(enrollmentsQ);
                const firstEnroll = enrollSnap.docs[0]?.data() as Enrollment | undefined;
                const enrollId = enrollSnap.docs[0]?.id;

                // Check if pending (payment pending or status is locked/inactive but student exists)
                const isPending =
                    sData?.trainingPaymentStatus === 'pending' ||
                    firstEnroll?.paymentStatus === 'pending' ||
                    (sData && sData.trainingStatus === 'locked');

                if (isPending) {
                    const pendingStudent = {
                        ...profile,
                        studentData: sData,
                        enrollment: firstEnroll ? { ...firstEnroll, id: enrollId } : undefined
                    };
                    console.log('ADDING PENDING STUDENT:', {
                        uid: pendingStudent.uid,
                        name: pendingStudent.name,
                        hasStudentData: !!pendingStudent.studentData
                    });
                    pending.push(pendingStudent);
                }
            }

            setStudents(pending);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleApprove = async (student: PendingStudent) => {
        console.log('TEACHER APPROVAL DEBUG:');
        console.log('student.uid:', student.uid);
        console.log('before approve:', (await getDoc(doc(db, 'students', student.uid))).data());
        
        if (!student.uid) return;
        setProcessingId(student.uid);
        try {
            await setDoc(doc(db, 'students', student.uid), {
                onboardingStatus: 'approved',
                accessUnlocked: true,
                approvedAt: serverTimestamp(),
                trainingStatus: 'active'
            }, { merge: true });

            const verifySnap = await getDoc(doc(db, 'students', student.uid));
            console.log('after approve:', verifySnap.data());

            if (verifySnap.data()?.onboardingStatus !== 'approved') {
                throw new Error('Approval failed to update Firestore');
            }

            // Update enrollment if exists
            if (student.enrollment?.id) {
                const enrollmentRef = doc(db, 'enrollments', student.enrollment.id);

                // Use existing registration date if present; otherwise treat "now" as registration.
                const baseRegistrationDate = student.enrollment.registeredAt?.toDate
                    ? student.enrollment.registeredAt.toDate()
                    : new Date();
                const eligibleDate = new Date(baseRegistrationDate.getTime() + (28 * 24 * 60 * 60 * 1000)); // registrationDate + 28 days

                const enrollmentUpdates: any = {
                    paymentStatus: 'paid',
                    trainingStatus: 'active',
                    examFeeStatus: 'unpaid',
                    programWeeks: 4,
                    eligibleAt: eligibleDate.toISOString()
                };

                // Only set registeredAt if it doesn't exist (server authoritative timestamp)
                if (!student.enrollment.registeredAt) {
                    enrollmentUpdates.registeredAt = serverTimestamp();
                }

                await updateDoc(enrollmentRef, enrollmentUpdates);
            }

            await NotificationService.create(
                student.uid,
                'Enrollment Approved',
                'Your payment has been approved and your training has started. Welcome!',
                'success',
                '/dashboard'
            );
        } catch (error) {
            console.error("Error approving student:", error);
            alert("Failed to approve student.");
        } finally {
            setProcessingId(null);
        }
    };

    const handleReject = async (student: PendingStudent) => {
        if (!student.uid || !window.confirm(`Reject ${student.name}'s payment request?`)) return;
        setProcessingId(student.uid);
        try {
            await updateDoc(doc(db, 'students', student.uid), {
                trainingPaymentStatus: 'unpaid'
            });

            if (student.enrollment?.id) {
                await updateDoc(doc(db, 'enrollments', student.enrollment.id), {
                    paymentStatus: 'unpaid'
                });
            }

            await NotificationService.create(
                student.uid,
                'Payment Not Confirmed',
                'Your payment could not be verified. Please re-submit your payment proof or contact support.',
                'warning',
                '/dashboard'
            );
        } catch (error) {
            console.error("Error rejecting student:", error);
            alert("Failed to reject student.");
        } finally {
            setProcessingId(null);
        }
    };

    const filteredStudents = students.filter(s =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

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
            <div>
                <h2 className="text-3xl font-black text-white mb-2 tracking-tight">Student Approvals</h2>
                <p className="text-slate-400 font-medium">Verify pending payments and grant course access.</p>
            </div>

            <div className="flex items-center justify-between gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                    <input
                        type="text"
                        placeholder="Search pending students..."
                        className="input-field pl-12 py-4 w-full"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-xl border border-white/10">
                    <Clock size={16} className="text-amber-500" />
                    <span className="text-xs font-bold text-white">{students.length} Pending</span>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {filteredStudents.map((student) => (
                    <GlassCard key={student.uid} className="p-6 border border-white/5 hover:bg-white/[0.01] transition-colors">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div className="flex items-center gap-4">
                                <div className="size-14 rounded-2xl bg-[#6324eb]/10 flex items-center justify-center text-[#6324eb] ring-1 ring-[#6324eb]/20">
                                    <Users size={24} />
                                </div>
                                <div>
                                    <h4 className="text-lg font-bold text-white">{student.name}</h4>
                                    <div className="flex items-center gap-3 mt-1">
                                        <span className="flex items-center gap-1 text-xs text-slate-500"><Mail size={12} /> {student.email}</span>
                                        {student.phone && <span className="flex items-center gap-1 text-xs text-slate-500"><Phone size={12} /> {student.phone}</span>}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-6">
                                <div className="text-right">
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Status</p>
                                    <StatusBadge status="Payment Pending" variant="warning" />
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handleApprove(student)}
                                        disabled={processingId === student.uid}
                                        className="flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 text-white font-bold hover:bg-emerald-600 transition-all disabled:opacity-50"
                                    >
                                        <Check size={18} /> Approve
                                    </button>
                                    <button
                                        onClick={() => handleReject(student)}
                                        disabled={processingId === student.uid}
                                        className="p-3 rounded-xl bg-white/5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all border border-white/10 disabled:opacity-50"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </GlassCard>
                ))}

                {filteredStudents.length === 0 && (
                    <div className="text-center py-24 bg-white/[0.02] rounded-3xl border border-dashed border-white/10">
                        <CheckCircle2 size={48} className="mx-auto text-emerald-500/50 mb-4" />
                        <p className="text-slate-500 font-medium">All students are caught up! No pending approvals.</p>
                    </div>
                )}
            </div>
        </motion.div>
    );
};
