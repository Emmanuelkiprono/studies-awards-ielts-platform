import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
    BookOpen,
    ChevronRight,
    LayoutDashboard,
    Users,
    Clock,
    CheckCircle2,
    Plus
} from 'lucide-react';
import { collection, query, onSnapshot, getDocs, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Course, Module } from '../types';
import { GlassCard, StatusBadge, PrimaryButton } from '../components/UI';
import { cn } from '../lib/utils';

export const TeacherCoursesPage: React.FC = () => {
    const navigate = useNavigate();
    const [courses, setCourses] = useState<Course[]>([]);
    const [moduleCounts, setModuleCounts] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const q = query(collection(db, 'courses'));
        const unsubscribe = onSnapshot(q, async (snapshot) => {
            const coursesData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Course[];

            setCourses(coursesData);

            // Fetch module counts for each course
            const counts: Record<string, number> = {};
            for (const course of coursesData) {
                const modulesQ = query(collection(db, 'modules'), where('courseId', '==', course.id));
                const modulesSnap = await getDocs(modulesQ);
                counts[course.id] = modulesSnap.size;
            }
            setModuleCounts(counts);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

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
                    <h2 className="text-3xl font-semibold text-black mb-2 tracking-tight">Manage Courses</h2>
                    <p className="text-slate-400 font-medium">Overview of all active IELTS and PTE Academic courses.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {courses.map((course) => (
                    <GlassCard key={course.id} gradient className="p-8 group hover:scale-[1.01] transition-all border border-white/5">
                        <div className="flex flex-col h-full gap-6">
                            <div className="flex items-start justify-between">
                                <div className="size-16 rounded-2xl bg-[#6324eb]/10 flex items-center justify-center text-[#6324eb] ring-1 ring-[#6324eb]/20 group-hover:bg-[#6324eb] group-hover:text-black transition-colors">
                                    <BookOpen size={32} />
                                </div>
                                <StatusBadge
                                    status={course.active ? "Active" : "Inactive"}
                                    variant={course.active ? "success" : "warning"}
                                />
                            </div>

                            <div>
                                <h3 className="text-2xl font-semibold text-black mb-2">{course.name}</h3>
                                <p className="text-slate-400 text-sm line-clamp-2 leading-relaxed">
                                    {course.description}
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-4 py-6 border-y border-white/5">
                                <div className="space-y-1">
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Modules</p>
                                    <p className="text-xl font-semibold text-black">{moduleCounts[course.id] || 0}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Duration</p>
                                    <p className="text-xl font-semibold text-black">{course.durationWeeks} Weeks</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <PrimaryButton
                                    className="flex-1 py-4"
                                    onClick={() => navigate(`/teacher/modules?courseId=${course.id}`)}
                                >
                                    Manage Modules
                                </PrimaryButton>
                                <button className="p-4 rounded-xl bg-white/5 text-slate-400 hover:text-black hover:bg-white/10 transition-all">
                                    <ChevronRight size={24} />
                                </button>
                            </div>
                        </div>
                    </GlassCard>
                ))}
            </div>
        </motion.div>
    );
};

