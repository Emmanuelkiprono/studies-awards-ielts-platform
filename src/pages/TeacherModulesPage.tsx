import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
    BookOpen,
    Plus,
    Trash2,
    Edit3,
    Save,
    X,
    GripVertical
} from 'lucide-react';
import {
    collection,
    query,
    onSnapshot,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    orderBy,
    serverTimestamp
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { Course, Module } from '../types';
import { GlassCard, PrimaryButton } from '../components/UI';
import { cn } from '../lib/utils';

export const TeacherModulesPage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const [courses, setCourses] = useState<Course[]>([]);
    const [selectedCourseId, setSelectedCourseId] = useState(searchParams.get('courseId') || '');
    const [modules, setModules] = useState<Module[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Form states
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [order, setOrder] = useState(1);

    useEffect(() => {
        const q = query(collection(db, 'courses'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const coursesData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Course[];
            setCourses(coursesData);
            if (!selectedCourseId && coursesData.length > 0) {
                setSelectedCourseId(coursesData[0].id);
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (!selectedCourseId) return;

        // Aligned with AdminDashboard subcollection structure
        const q = query(
            collection(db, 'courses', selectedCourseId, 'modules'),
            orderBy('order', 'asc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const modulesData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Module[];
            setModules(modulesData);
            setOrder(modulesData.length + 1);
        });

        return () => unsubscribe();
    }, [selectedCourseId]);

    const handleAddModule = async () => {
        if (!name || !selectedCourseId) return;
        try {
            await addDoc(collection(db, 'courses', selectedCourseId, 'modules'), {
                name,
                description,
                order: Number(order),
                createdAt: serverTimestamp()
            });
            setIsAdding(false);
            setName('');
            setDescription('');
        } catch (error) {
            console.error("Error adding module:", error);
        }
    };

    const handleUpdateModule = async (id: string) => {
        if (!selectedCourseId) return;
        try {
            await updateDoc(doc(db, 'courses', selectedCourseId, 'modules', id), {
                name,
                description,
                order: Number(order)
            });
            setEditingId(null);
            setName('');
            setDescription('');
        } catch (error) {
            console.error("Error updating module:", error);
        }
    };

    const handleDeleteModule = async (id: string) => {
        if (!selectedCourseId) return;
        if (window.confirm("Are you sure you want to delete this module?")) {
            try {
                await deleteDoc(doc(db, 'courses', selectedCourseId, 'modules', id));
            } catch (error) {
                console.error("Error deleting module:", error);
            }
        }
    };

    const startEditing = (mod: Module) => {
        setEditingId(mod.id);
        setName(mod.name);
        setDescription(mod.description);
        setOrder(mod.order);
    };

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
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h2 className="text-3xl font-black text-white mb-2 tracking-tight">Curriculum Builder</h2>
                    <p className="text-slate-400 font-medium">Manage modules and structure for your courses.</p>
                </div>

                <div className="flex items-center gap-4 bg-white/5 p-2 rounded-2xl border border-white/10 overflow-x-auto no-scrollbar">
                    {courses.map(course => (
                        <button
                            key={course.id}
                            onClick={() => setSelectedCourseId(course.id)}
                            className={cn(
                                "px-6 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap",
                                selectedCourseId === course.id
                                    ? "bg-[#6324eb] text-white shadow-lg shadow-[#6324eb]/20"
                                    : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
                            )}
                        >
                            {course.name}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <BookOpen size={24} className="text-[#6324eb]" />
                        Modules ({modules.length})
                    </h3>
                    <PrimaryButton
                        className="px-6 py-3 flex items-center gap-2"
                        onClick={() => setIsAdding(true)}
                    >
                        <Plus size={18} /> Add Module
                    </PrimaryButton>
                </div>

                <AnimatePresence>
                    {(isAdding || editingId) && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                        >
                            <GlassCard className="p-8 border border-[#6324eb]/30 bg-[#6324eb]/5 mb-6">
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                    <div className="md:col-span-2 space-y-2">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Module Name</label>
                                        <input
                                            type="text"
                                            className="input-field w-full py-4 bg-[#0a0a0a]"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            placeholder="e.g. Introduction to IELTS"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Order</label>
                                        <input
                                            type="number"
                                            className="input-field w-full py-4 bg-[#0a0a0a]"
                                            value={order}
                                            onChange={(e) => setOrder(Number(e.target.value))}
                                        />
                                    </div>
                                    <div className="flex items-end gap-3">
                                        <PrimaryButton
                                            className="flex-1 py-4 h-[58px]"
                                            onClick={() => editingId ? handleUpdateModule(editingId) : handleAddModule()}
                                        >
                                            {editingId ? <Save size={18} /> : <Plus size={18} />}
                                            {editingId ? 'Save' : 'Add'}
                                        </PrimaryButton>
                                        <button
                                            onClick={() => { setIsAdding(false); setEditingId(null); setName(''); setDescription(''); }}
                                            className="size-[58px] flex items-center justify-center rounded-xl bg-white/5 text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all border border-white/10"
                                        >
                                            <X size={20} />
                                        </button>
                                    </div>
                                    <div className="md:col-span-4 space-y-2">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Description</label>
                                        <textarea
                                            className="input-field w-full py-4 min-h-[100px] bg-[#0a0a0a]"
                                            value={description}
                                            onChange={(e) => setDescription(e.target.value)}
                                            placeholder="What will students learn in this module?"
                                        />
                                    </div>
                                </div>
                            </GlassCard>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="space-y-4">
                    {modules.map((mod) => (
                        <GlassCard key={mod.id} className="p-6 group border border-white/5 hover:bg-white/[0.02] transition-colors">
                            <div className="flex items-center gap-6">
                                <div className="text-slate-600 cursor-grab active:cursor-grabbing">
                                    <GripVertical size={20} />
                                </div>

                                <div className="size-12 rounded-xl bg-white/5 flex items-center justify-center text-slate-400 font-black text-lg border border-white/10">
                                    {mod.order}
                                </div>

                                <div className="flex-1">
                                    <h4 className="text-lg font-bold text-white">{mod.name}</h4>
                                    <p className="text-sm text-slate-500 mt-1 line-clamp-1">{mod.description}</p>
                                </div>

                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => startEditing(mod)}
                                        className="p-3 rounded-xl bg-white/5 text-slate-400 hover:text-[#6324eb] hover:bg-[#6324eb]/10 transition-all"
                                    >
                                        <Edit3 size={18} />
                                    </button>
                                    <button
                                        onClick={() => handleDeleteModule(mod.id)}
                                        className="p-3 rounded-xl bg-white/5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        </GlassCard>
                    ))}

                    {modules.length === 0 && !isAdding && (
                        <div className="text-center py-20 bg-white/[0.02] rounded-3xl border border-dashed border-white/10">
                            <BookOpen size={48} className="mx-auto text-slate-700 mb-4" />
                            <p className="text-slate-500 font-medium italic">No modules found for this course.</p>
                            <button
                                onClick={() => setIsAdding(true)}
                                className="mt-4 text-[#6324eb] font-bold hover:underline"
                            >
                                Create your first module
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    );
};
