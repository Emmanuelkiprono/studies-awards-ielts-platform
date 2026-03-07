import React, { useEffect, useState } from 'react';
import { GlassCard, PrimaryButton } from '../components/UI';
import { Clock, BookOpen, LogOut, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../hooks/useAuth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Course } from '../types';

export const PaymentPendingPage: React.FC = () => {
    const { user, studentData, signOut } = useAuth();
    const [course, setCourse] = useState<Course | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchCourse = async () => {
            if (studentData?.courseId) {
                const courseDoc = await getDoc(doc(db, 'courses', studentData.courseId));
                if (courseDoc.exists()) {
                    setCourse({ id: courseDoc.id, ...courseDoc.data() } as Course);
                }
            }
            setLoading(false);
        };
        fetchCourse();
    }, [studentData?.courseId]);

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-[#050505] relative overflow-hidden">
            {/* Background Decor */}
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#6324eb]/10 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#3b82f6]/10 rounded-full blur-[120px]" />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-md w-full relative z-10"
            >
                <GlassCard className="p-8 text-center space-y-8 border-t-4 border-[#6324eb]">
                    <div className="size-20 bg-[#6324eb]/10 rounded-2xl flex items-center justify-center mx-auto text-[#6324eb] shadow-lg shadow-[#6324eb]/10">
                        <Clock size={40} className="animate-pulse" />
                    </div>

                    <div className="space-y-2">
                        <h1 className="text-2xl font-bold text-white">Payment Pending</h1>
                        <p className="text-slate-400 text-sm leading-relaxed">
                            Your payment is being verified. You will get access after approval.
                        </p>
                    </div>

                    <div className="bg-white/5 rounded-2xl p-6 space-y-4 border border-white/5">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Selected Course</span>
                            <div className="flex items-center gap-1.5 text-[#3b82f6] font-bold text-sm">
                                <BookOpen size={14} />
                                <span>{course?.name || 'Loading...'}</span>
                            </div>
                        </div>

                        <div className="h-px bg-white/5 w-full" />

                        <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Required Fee</span>
                            <span className="text-xl font-bold text-white">KSh {course?.trainingPrice?.toLocaleString() || '---'}</span>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-widest bg-emerald-400/10 py-2 rounded-lg border border-emerald-400/20">
                            <ShieldCheck size={14} />
                            Secure Verification In Progress
                        </div>

                        <PrimaryButton
                            className="w-full py-4 text-sm"
                            onClick={() => window.location.reload()}
                        >
                            Check Status
                        </PrimaryButton>

                        <button
                            onClick={() => signOut()}
                            className="flex items-center justify-center gap-2 text-slate-500 hover:text-white transition-colors text-sm font-bold mx-auto"
                        >
                            <LogOut size={16} />
                            Sign Out
                        </button>
                    </div>
                </GlassCard>
            </motion.div>
        </div>
    );
};
