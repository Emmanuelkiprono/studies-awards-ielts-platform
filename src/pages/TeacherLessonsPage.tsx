import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Video,
  Plus,
  Trash2,
  Edit3,
  Save,
  X,
  GripVertical,
  ChevronDown,
  BookOpen,
  FileText,
  Clock,
  Calendar,
  Users
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
  serverTimestamp,
  getDocs,
  where
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { Course, Module, Lesson } from '../types';
import { GlassCard, PrimaryButton, StatusBadge } from '../components/UI';
import { FileUpload } from '../components/FileUpload';
import { cn } from '../lib/utils';
import { NotificationService } from '../services/notificationService';
import { useAuth } from '../hooks/useAuth';

export const TeacherLessonsPage: React.FC = () => {
  const { teacherUser } = useAuth();
  const [searchParams] = useSearchParams();
  const [courses, setCourses] = useState<Course[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);

  const [selectedCourseId, setSelectedCourseId] = useState(searchParams.get('courseId') || '');
  const [selectedModuleId, setSelectedModuleId] = useState(searchParams.get('moduleId') || '');

  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(searchParams.get('mode') === 'create');
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [pdfUrl, setPdfUrl] = useState('');
  const [pdfFileName, setPdfFileName] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageFileName, setImageFileName] = useState('');

  // Live class states
  const [isLiveClass, setIsLiveClass] = useState(false);
  const [liveOption, setLiveOption] = useState<'immediate' | 'scheduled' | 'none'>('none');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [isCreatingLive, setIsCreatingLive] = useState(false);

  // Debug: Log when component mounts
  useEffect(() => {
    console.log('TeacherLessonsPage mounted - Live class features should be visible');
  }, []);
  const [order, setOrder] = useState(1);

  // Fetch Courses
  useEffect(() => {
    const q = query(collection(db, 'courses'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const coursesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course));
      setCourses(coursesData);
      if (!selectedCourseId && coursesData.length > 0) {
        setSelectedCourseId(coursesData[0].id);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Fetch Modules
  useEffect(() => {
    if (!selectedCourseId) return;
    const q = query(collection(db, 'courses', selectedCourseId, 'modules'), orderBy('order', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const modulesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Module));
      setModules(modulesData);
      if (!selectedModuleId && modulesData.length > 0) {
        setSelectedModuleId(modulesData[0].id);
      } else if (modulesData.length === 0) {
        setSelectedModuleId('');
      }
    });
    return () => unsubscribe();
  }, [selectedCourseId]);

  // Fetch Lessons
  useEffect(() => {
    if (!selectedCourseId || !selectedModuleId) {
      setLessons([]);
      return;
    }
    const q = query(
      collection(db, 'courses', selectedCourseId, 'modules', selectedModuleId, 'lessons'),
      orderBy('order', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lessonsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Lesson));
      setLessons(lessonsData);
      setOrder(lessonsData.length + 1);
    });
    return () => unsubscribe();
  }, [selectedCourseId, selectedModuleId]);

  const handleAddLesson = async () => {
    if (!title || !selectedCourseId || !selectedModuleId) return;
    
    try {
      // Create the lesson first
      const lessonDoc = await addDoc(collection(db, 'courses', selectedCourseId, 'modules', selectedModuleId, 'lessons'), {
        title,
        description,
        videoUrl,
        pdfUrl: pdfUrl || null,
        pdfFileName: pdfFileName || null,
        imageUrl: imageUrl || null,
        imageFileName: imageFileName || null,
        durationMinutes: Number(durationMinutes),
        order: Number(order),
        isLiveClass,
        liveOption,
        createdAt: serverTimestamp()
      });

      // Handle live class creation
      if (isLiveClass && teacherUser) {
        setIsCreatingLive(true);
        
        let sessionData: any = {
          title: `Live: ${title}`,
          courseId: selectedCourseId,
          lessonId: lessonDoc.id,
          moduleId: selectedModuleId,
          createdBy: teacherUser.uid,
          createdAt: serverTimestamp()
        };

        if (liveOption === 'immediate') {
          // Start live immediately
          const now = new Date();
          const endTime = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
          
          sessionData = {
            ...sessionData,
            startTime: now.toISOString(),
            endTime: endTime.toISOString(),
            isLive: true,
            startedAt: now.toISOString()
          };

          // Create live session
          const liveSessionDoc = await addDoc(collection(db, 'liveSessions'), sessionData);
          
          // Create mock room URL
          const slug = title.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 30);
          const roomUrl = `https://ielts-academy.daily.co/${slug}-${Date.now()}`;
          
          // Update session with room URL
          await updateDoc(doc(db, 'liveSessions', liveSessionDoc.id), { roomUrl });

          // Notify students about immediate live session
          await notifyStudents(selectedCourseId, 'Live Class Started Now!', 
            `A live session for "${title}" has started. Join now!`, 
            `/live`, 'success');

          // Navigate to live classes with active room
          window.location.href = `/live`;

        } else if (liveOption === 'scheduled' && scheduledDate && scheduledTime) {
          // Schedule live session
          const scheduledDateTime = new Date(`${scheduledDate}T${scheduledTime}`);
          const endTime = new Date(scheduledDateTime.getTime() + 60 * 60 * 1000); // 1 hour duration
          
          sessionData = {
            ...sessionData,
            startTime: scheduledDateTime.toISOString(),
            endTime: endTime.toISOString(),
            isLive: false,
            scheduledDate: scheduledDate,
            scheduledTime: scheduledTime
          };

          // Create scheduled live session
          await addDoc(collection(db, 'liveSessions'), sessionData);

          // Notify students about scheduled session
          await notifyStudents(selectedCourseId, 'Live Class Scheduled', 
            `A live session for "${title}" is scheduled for ${scheduledDate} at ${scheduledTime}.`, 
            `/live`, 'info');
        }
        
        setIsCreatingLive(false);
      }

      setIsAdding(false);
      resetForm();
    } catch (error) {
      console.error("Error adding lesson:", error);
      setIsCreatingLive(false);
    }
  };

  // Helper function to notify students
  const notifyStudents = async (courseId: string, title: string, message: string, link?: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    try {
      // Get all enrolled students for this course
      const enrollmentsQuery = query(collection(db, 'enrollments'), where('courseId', '==', courseId));
      const enrollmentsSnapshot = await getDocs(enrollmentsQuery);
      
      // Send notification to each enrolled student
      const notifications = enrollmentsSnapshot.docs.map(async (enrollmentDoc) => {
        const enrollment = enrollmentDoc.data();
        return NotificationService.create(enrollment.studentId, title, message, type, link);
      });
      
      await Promise.all(notifications);
    } catch (error) {
      console.error("Error notifying students:", error);
    }
  };

  const handleUpdateLesson = async (id: string) => {
    if (!selectedCourseId || !selectedModuleId) return;
    try {
      await updateDoc(doc(db, 'courses', selectedCourseId, 'modules', selectedModuleId, 'lessons', id), {
        title,
        description,
        videoUrl,
        pdfUrl: pdfUrl || null,
        pdfFileName: pdfFileName || null,
        imageUrl: imageUrl || null,
        imageFileName: imageFileName || null,
        durationMinutes: Number(durationMinutes),
        order: Number(order)
      });
      setEditingId(null);
      resetForm();
    } catch (error) {
      console.error("Error updating lesson:", error);
    }
  };

  const handleDeleteLesson = async (id: string) => {
    if (!selectedCourseId || !selectedModuleId) return;
    if (window.confirm("Are you sure you want to delete this lesson?")) {
      try {
        await deleteDoc(doc(db, 'courses', selectedCourseId, 'modules', selectedModuleId, 'lessons', id));
      } catch (error) {
        console.error("Error deleting lesson:", error);
      }
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setVideoUrl('');
    setPdfUrl('');
    setPdfFileName('');
    setImageUrl('');
    setImageFileName('');
    setDurationMinutes(15);
    setIsLiveClass(false);
    setLiveOption('none');
    setScheduledDate('');
    setScheduledTime('');
    setIsCreatingLive(false);
  };

  const startEditing = (les: Lesson) => {
    setEditingId(les.id);
    setTitle(les.title);
    setDescription(les.description);
    setVideoUrl(les.videoUrl || '');
    setPdfUrl(les.pdfUrl || '');
    setPdfFileName(les.pdfFileName || '');
    setImageUrl(les.imageUrl || '');
    setImageFileName(les.imageFileName || '');
    setDurationMinutes(les.durationMinutes);
    setOrder(les.order);
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
          <h2 className="text-3xl font-black text-white mb-2 tracking-tight">Lesson Manager</h2>
          <p className="text-slate-400 font-medium">Create and organize video lessons and resources.</p>
        </div>

        <div className="flex flex-col gap-4">
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

          <div className="flex items-center gap-4 bg-white/5 p-2 rounded-2xl border border-white/10 overflow-x-auto no-scrollbar">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-4">Modules:</span>
            {modules.map(mod => (
              <button
                key={mod.id}
                onClick={() => setSelectedModuleId(mod.id)}
                className={cn(
                  "px-6 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap",
                  selectedModuleId === mod.id
                    ? "bg-[#3b82f6] text-white shadow-lg shadow-[#3b82f6]/20"
                    : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
                )}
              >
                {mod.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Video size={24} className="text-[#6324eb]" />
            Lessons ({lessons.length})
          </h3>
          <PrimaryButton
            className="px-6 py-3 flex items-center gap-2"
            onClick={() => setIsAdding(true)}
            disabled={!selectedModuleId}
          >
            <Plus size={18} /> Add Lesson
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="md:col-span-2 space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Lesson Title</label>
                    <input
                      type="text"
                      className="input-field w-full py-4 bg-[#0a0a0a]"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Introduction to Writing Task 1"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Duration (Mins)</label>
                    <input
                      type="number"
                      className="input-field w-full py-4 bg-[#0a0a0a]"
                      value={durationMinutes}
                      onChange={(e) => setDurationMinutes(Number(e.target.value))}
                    />
                  </div>

                  <div className="md:col-span-2 space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Video URL (YouTube/Vimeo)</label>
                    <input
                      type="text"
                      className="input-field w-full py-4 bg-[#0a0a0a]"
                      value={videoUrl}
                      onChange={(e) => setVideoUrl(e.target.value)}
                      placeholder="https://..."
                    />
                  </div>

                  <div className="space-y-2">
                    <FileUpload
                      folder="lessons/pdfs"
                      label="PDF Resource"
                      accept={{ 'application/pdf': ['.pdf'] }}
                      value={pdfUrl}
                      fileName={pdfFileName}
                      onUploaded={(url, name) => { setPdfUrl(url); setPdfFileName(name); }}
                      onClear={() => { setPdfUrl(''); setPdfFileName(''); }}
                      compact
                    />
                  </div>

                  <div className="md:col-span-2 space-y-2">
                    <FileUpload
                      folder="lessons/images"
                      label="Image Attachment"
                      accept={{ 'image/jpeg': ['.jpg','.jpeg'], 'image/png': ['.png'], 'image/webp': ['.webp'] }}
                      value={imageUrl}
                      fileName={imageFileName}
                      onUploaded={(url, name) => { setImageUrl(url); setImageFileName(name); }}
                      onClear={() => { setImageUrl(''); setImageFileName(''); }}
                      compact
                    />
                  </div>

                  <div className="md:col-span-3 space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Live Class Options</label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <button
                        type="button"
                        onClick={() => { setIsLiveClass(false); setLiveOption('none'); }}
                        className={`p-3 rounded-xl border transition-all ${
                          liveOption === 'none' 
                            ? 'border-[#6324eb] bg-[#6324eb]/10 text-white' 
                            : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10'
                        }`}
                      >
                        <Video size={16} className="mx-auto mb-1" />
                        <div className="text-xs font-bold">Regular Lesson</div>
                        <div className="text-[10px] opacity-70">No live session</div>
                      </button>
                      
                      <button
                        type="button"
                        onClick={() => { setIsLiveClass(true); setLiveOption('immediate'); }}
                        className={`p-3 rounded-xl border transition-all ${
                          liveOption === 'immediate' 
                            ? 'border-green-500 bg-green-500/10 text-green-400' 
                            : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10'
                        }`}
                      >
                        <Clock size={16} className="mx-auto mb-1" />
                        <div className="text-xs font-bold">Start Live Now</div>
                        <div className="text-[10px] opacity-70">Create video room</div>
                      </button>
                      
                      <button
                        type="button"
                        onClick={() => { setIsLiveClass(true); setLiveOption('scheduled'); }}
                        className={`p-3 rounded-xl border transition-all ${
                          liveOption === 'scheduled' 
                            ? 'border-blue-500 bg-blue-500/10 text-blue-400' 
                            : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10'
                        }`}
                      >
                        <Calendar size={16} className="mx-auto mb-1" />
                        <div className="text-xs font-bold">Schedule Live</div>
                        <div className="text-[10px] opacity-70">Set date & time</div>
                      </button>
                    </div>
                  </div>

                  {liveOption === 'scheduled' && (
                    <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Scheduled Date</label>
                        <input
                          type="date"
                          className="input-field w-full py-3 bg-[#0a0a0a]"
                          value={scheduledDate}
                          onChange={(e) => setScheduledDate(e.target.value)}
                          min={new Date().toISOString().split('T')[0]}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Scheduled Time</label>
                        <input
                          type="time"
                          className="input-field w-full py-3 bg-[#0a0a0a]"
                          value={scheduledTime}
                          onChange={(e) => setScheduledTime(e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  <div className="md:col-span-3 space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Description</label>
                    <textarea
                      className="input-field w-full py-4 min-h-[100px] bg-[#0a0a0a]"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Summary of what this lesson covers..."
                    />
                  </div>

                  <div className="md:col-span-3 flex justify-end gap-3 pt-4 border-t border-white/5">
                    <button
                      onClick={() => { setIsAdding(false); setEditingId(null); resetForm(); }}
                      className="px-8 py-3 rounded-xl bg-white/5 text-slate-400 hover:bg-white/10 transition-all font-bold"
                    >
                      Cancel
                    </button>
                    <PrimaryButton
                      className="px-12 py-3"
                      onClick={() => editingId ? handleUpdateLesson(editingId) : handleAddLesson()}
                      disabled={isCreatingLive}
                    >
                      {isCreatingLive ? (
                        <>
                          <Clock size={16} className="animate-spin" />
                          Creating Live Session...
                        </>
                      ) : (
                        <>
                          {editingId ? 'Save Changes' : 'Create Lesson'}
                        </>
                      )}
                    </PrimaryButton>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="space-y-4">
          {lessons.map((les) => (
            <GlassCard key={les.id} className="p-6 group border border-white/5 hover:bg-white/[0.02] transition-colors">
              <div className="flex flex-col md:flex-row md:items-center gap-6">
                <div className="size-16 rounded-2xl bg-white/5 flex flex-col items-center justify-center border border-white/10">
                  <span className="text-[10px] font-black text-slate-500 uppercase">Lesson</span>
                  <span className="text-xl font-black text-white">{les.order}</span>
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h4 className="text-lg font-bold text-white">{les.title}</h4>
                    {les.videoUrl && <StatusBadge status="Video" variant="primary" />}
                    {les.pdfUrl && <StatusBadge status="PDF" variant="accent" />}
                    {les.imageUrl && <StatusBadge status="Image" variant="warning" />}
                  </div>
                  <p className="text-sm text-slate-500 mt-1 line-clamp-1">{les.description}</p>

                  <div className="flex items-center gap-4 mt-3">
                    <span className="text-[10px] font-bold text-slate-600 flex items-center gap-1 uppercase tracking-widest">
                      <Clock size={12} /> {les.durationMinutes} mins
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => startEditing(les)}
                    className="p-3 rounded-xl bg-white/5 text-slate-400 hover:text-[#6324eb] hover:bg-[#6324eb]/10 transition-all"
                  >
                    <Edit3 size={18} />
                  </button>
                  <button
                    onClick={() => handleDeleteLesson(les.id)}
                    className="p-3 rounded-xl bg-white/5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </GlassCard>
          ))}

          {lessons.length === 0 && !isAdding && selectedModuleId && (
            <div className="text-center py-20 bg-white/[0.02] rounded-3xl border border-dashed border-white/10">
              <Video size={48} className="mx-auto text-slate-700 mb-4" />
              <p className="text-slate-500 font-medium italic">This module is empty. Add your first lesson!</p>
            </div>
          )}

          {!selectedModuleId && !loading && (
            <div className="text-center py-24 bg-[#6324eb]/5 rounded-3xl border border-dashed border-[#6324eb]/20">
              <BookOpen size={48} className="mx-auto text-[#6324eb]/30 mb-4" />
              <h4 className="text-white font-bold mb-2">No Module Selected</h4>
              <p className="text-slate-500 text-sm">Please select or create a module to manage lessons.</p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};
