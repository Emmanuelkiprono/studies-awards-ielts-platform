import React, { useState, useEffect } from 'react';
import { GlassCard, StatusBadge, PrimaryButton } from '../components/UI';
import {
  FileText,
  Headphones,
  BookOpen,
  Mic2,
  Volume2,
  ClipboardList,
  X,
  CheckCircle2,
  MessageSquare,
  TrendingUp,
  ExternalLink,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useAuth } from '../hooks/useAuth';
import { db } from '../services/firebase';
import { collection, getDocs, query, where, addDoc, doc, getDoc } from 'firebase/firestore';
import { NotificationService } from '../services/notificationService';
import { Assignment, Submission, Module } from '../types';
import { FileUpload } from '../components/FileUpload';

const typeIcons: Record<string, React.ElementType> = {
  writing: FileText,
  listening: Headphones,
  reading: BookOpen,
  speaking: Mic2,
  vocabulary: ClipboardList,
};

const typeColors: Record<string, string> = {
  writing: 'bg-orange-500/20 text-orange-400',
  listening: 'bg-blue-500/20 text-blue-400',
  reading: 'bg-emerald-500/20 text-emerald-400',
  speaking: 'bg-pink-500/20 text-pink-400',
  vocabulary: 'bg-violet-500/20 text-violet-400',
};

type FilterTab = 'all' | 'pending' | 'submitted' | 'graded';

export const AssignmentsPage: React.FC = () => {
  const { user, studentData, profile } = useAuth();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<FilterTab>('all');

  // Submit modal state
  const [submitTarget, setSubmitTarget] = useState<Assignment | null>(null);
  const [notes, setNotes] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [fileName, setFileName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [courseTeacherId, setCourseTeacherId] = useState<string | null>(null);

  const [courseName, setCourseName] = useState<string | null>(null);
  const [modulesById, setModulesById] = useState<Record<string, Module>>({});

  // Detail sheet state
  const [detailTarget, setDetailTarget] = useState<Assignment | null>(null);

  useEffect(() => {
    if (!studentData?.courseId || !user) { setLoading(false); return; }
    const load = async () => {
      try {
        const [aSnap, sSnap, courseSnap, modulesSnap] = await Promise.all([
          getDocs(query(collection(db, 'assignments'), where('courseId', '==', studentData.courseId))),
          getDocs(query(collection(db, 'submissions'), where('studentId', '==', user.uid))),
          getDoc(doc(db, 'courses', studentData.courseId)),
          getDocs(collection(db, 'courses', studentData.courseId, 'modules')),
        ]);
        setAssignments(aSnap.docs.map(d => ({ id: d.id, ...d.data() } as Assignment)));
        setSubmissions(sSnap.docs.map(d => ({ id: d.id, ...d.data() } as Submission)));
        if (courseSnap.exists()) {
          const data = courseSnap.data() as { teacherId?: string; name?: string };
          setCourseTeacherId(data.teacherId ?? null);
          setCourseName(data.name ?? null);
        }

        const modules = modulesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Module));
        const map: Record<string, Module> = {};
        modules.forEach(m => { map[m.id] = m; });
        setModulesById(map);
      } catch (err) {
        console.error('Error loading assignments:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [studentData?.courseId, user]);

  const getSubmission = (assignmentId: string) =>
    submissions.find(s => s.assignmentId === assignmentId);

  const filtered = assignments.filter(a => {
    const sub = getSubmission(a.id);
    if (tab === 'pending') return !sub;
    if (tab === 'submitted') return sub?.status === 'pending';
    if (tab === 'graded') return sub?.status === 'graded';
    return true;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!submitTarget || !user || !studentData?.courseId) return;
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'submissions'), {
        assignmentId: submitTarget.id,
        studentId: user.uid,
        courseId: studentData.courseId,
        notes,
        fileUrl: fileUrl || null,
        fileName: fileName || null,
        submittedAt: new Date().toISOString(),
        status: 'pending',
      });
      const newSub: Submission = {
        id: `local-${Date.now()}`,
        assignmentId: submitTarget.id,
        studentId: user.uid,
        courseId: studentData.courseId,
        notes,
        fileUrl: fileUrl || undefined,
        fileName: fileName || undefined,
        submittedAt: new Date().toISOString(),
        status: 'pending',
      };
      setSubmissions(prev => [...prev, newSub]);

      if (courseTeacherId) {
        await NotificationService.create(
          courseTeacherId,
          'New Assignment Submission',
          `${profile?.name ?? 'A student'} submitted "${submitTarget.title}". Review it in the Tasks panel.`,
          'info',
          '/teacher/tasks'
        );
      }

      setSubmitTarget(null);
      setNotes('');
      setFileUrl('');
      setFileName('');
    } catch (err) {
      console.error('Submit error:', err);
      alert('Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="size-10 border-4 border-[rgba(99,36,235,0.3)] border-t-[#6324eb] rounded-full animate-spin" />
      </div>
    );
  }

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'submitted', label: 'Submitted' },
    { key: 'graded', label: 'Graded' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="p-4 space-y-6 max-w-2xl mx-auto w-full pb-24"
    >
      <h2 className="text-xl font-bold text-[var(--ui-heading)] tracking-tight">My Assignments</h2>

      {/* Tabs */}
      <div className="border-b border-[#6324eb]/20 flex gap-6">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'pb-3 pt-2 text-sm font-bold border-b-2 transition-colors',
              tab === t.key
                ? 'border-[#6324eb] text-slate-100'
                : 'border-transparent text-slate-400 hover:text-slate-300'
            )}
          >
            {t.label}
            {t.key === 'pending' && assignments.filter(a => !getSubmission(a.id)).length > 0 && (
              <span className="ml-1.5 text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full font-black">
                {assignments.filter(a => !getSubmission(a.id)).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-[var(--ui-muted)]">
          <ClipboardList size={36} className="mx-auto mb-3 opacity-40" />
          <p className="font-bold">No assignments here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(item => {
            const sub = getSubmission(item.id);
            const Icon = typeIcons[item.type] ?? FileText;
            return (
              <GlassCard
                key={item.id}
                onClick={() => setDetailTarget(item)}
                className={cn(
                  'p-4 flex items-center justify-between cursor-pointer transition-all group',
                  !sub && 'hover:border-[#6324eb]/40'
                )}
              >
                <div className="flex items-center gap-4">
                  <div className={cn('size-12 rounded-xl flex items-center justify-center border border-white/5', typeColors[item.type] ?? typeColors.writing)}>
                    <Icon size={22} />
                  </div>
                  <div>
                    <p className="text-[var(--ui-heading)] font-semibold">{item.title}</p>
                    <p className="text-[var(--ui-muted)] text-xs">Due: {item.dueDate} · {item.type}</p>
                    <p className="text-[var(--ui-muted)] text-[11px] mt-0.5">
                      {courseName ?? 'Course'}
                      {item.moduleId && modulesById[item.moduleId] && (
                        <> · {modulesById[item.moduleId].name}</>
                      )}
                    </p>
                    <p className="text-[var(--ui-muted)] text-xs mt-1 line-clamp-2">
                      {item.description}
                    </p>
                  </div>
                </div>
                {sub ? (
                  <StatusBadge
                    status={sub.status === 'graded' ? (sub.bandScore ? `${sub.bandScore}` : 'Graded') : 'Submitted'}
                    variant={sub.status === 'graded' ? 'success' : 'accent'}
                  />
                ) : (
                  <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border bg-white/5 text-[var(--ui-muted)] border-white/10 group-hover:bg-[#6324eb]/20 group-hover:text-[#6324eb] group-hover:border-[#6324eb]/30 transition-colors shrink-0">
                    Submit
                  </span>
                )}
              </GlassCard>
            );
          })}
        </div>
      )}

      {/* Submit Modal */}
      <AnimatePresence>
        {submitTarget && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSubmitTarget(null)} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]" />
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="fixed inset-0 z-[70] flex items-center justify-center p-4 pointer-events-none">
              <div className="bg-[var(--ui-bg)] border border-[var(--ui-border)] rounded-3xl shadow-2xl max-w-lg w-full pointer-events-auto max-h-[80vh] flex flex-col">
                <div className="flex justify-between items-center px-8 pt-8 pb-4 border-b border-white/5">
                  <div>
                    <h3 className="text-xl font-bold text-[var(--ui-heading)]">Submit Assignment</h3>
                    <p className="text-xs text-[var(--ui-muted)] mt-0.5 truncate max-w-[280px]">{submitTarget.title}</p>
                  </div>
                  <button onClick={() => setSubmitTarget(null)} className="text-[var(--ui-muted)] hover:text-[var(--ui-heading)]">
                    <X size={22} />
                  </button>
                </div>
                <div className="px-8 pb-6 pt-4 overflow-y-auto space-y-5">
                  {/* Assignment details */}
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                    {(() => {
                      const Icon = typeIcons[submitTarget.type] ?? FileText;
                      return (
                        <div className="flex items-start gap-3">
                          <div className={cn('size-10 rounded-xl flex items-center justify-center border border-white/10', typeColors[submitTarget.type] ?? typeColors.writing)}>
                            <Icon size={18} />
                          </div>
                          <div className="flex-1 min-w-0 space-y-1">
                            <p className="text-[var(--ui-heading)] font-semibold text-sm">{submitTarget.title}</p>
                            <p className="text-[11px] text-[var(--ui-muted)]">
                              Due: {submitTarget.dueDate} · {submitTarget.type}
                            </p>
                            <p className="text-[11px] text-[var(--ui-muted)]">
                              {courseName ?? 'Course'}
                              {submitTarget.moduleId && modulesById[submitTarget.moduleId] && (
                                <> · {modulesById[submitTarget.moduleId].name}</>
                              )}
                            </p>
                          </div>
                        </div>
                      );
                    })()}
                    {submitTarget.description && (
                      <div className="mt-1 max-h-40 overflow-y-auto no-scrollbar text-xs text-[var(--ui-body)] leading-relaxed bg-[var(--ui-bg-3)]/60 border border-white/5 rounded-xl px-3 py-2 whitespace-pre-wrap">
                        {submitTarget.description}
                      </div>
                    )}
                    {submitTarget.attachmentUrl && (
                      <a
                        href={submitTarget.attachmentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 flex items-center gap-2 px-3 py-2 rounded-xl bg-[#6324eb]/10 border border-[#6324eb]/20 hover:bg-[#6324eb]/20 transition-colors text-xs"
                      >
                        <ExternalLink size={14} className="text-[#6324eb] shrink-0" />
                        <span className="text-[#6324eb] font-semibold truncate">
                          {submitTarget.attachmentName || 'Open assignment resource'}
                        </span>
                      </a>
                    )}
                  </div>

                  {/* Answer + upload */}
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[var(--ui-muted)] uppercase tracking-wider">
                        Your Answer / Notes <span className="text-red-400">*</span>
                      </label>
                      <textarea
                        required
                        rows={5}
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        className="input-field w-full resize-none"
                        placeholder="Write your response here..."
                      />
                    </div>
                    <FileUpload
                      folder="submissions"
                      label="Attach File (optional)"
                      value={fileUrl}
                      fileName={fileName}
                      onUploaded={(url, name) => {
                        setFileUrl(url);
                        setFileName(name);
                      }}
                      onClear={() => {
                        setFileUrl('');
                        setFileName('');
                      }}
                      compact
                    />
                    <div className="flex gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setSubmitTarget(null)}
                        className="flex-1 py-3 rounded-2xl bg-white/5 text-[var(--ui-body)] font-bold hover:bg-white/10 transition-all"
                      >
                        Cancel
                      </button>
                      <PrimaryButton type="submit" loading={submitting} className="flex-1 py-3">
                        <CheckCircle2 size={16} /> Submit
                      </PrimaryButton>
                    </div>
                  </form>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Detail Sheet (submitted / graded) */}
      <AnimatePresence>
        {detailTarget && (() => {
          const sub = getSubmission(detailTarget.id);
          const Icon = typeIcons[detailTarget.type] ?? FileText;
          return (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDetailTarget(null)} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]" />
              <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="fixed inset-x-0 bottom-0 z-[70] flex flex-col px-4 pb-4">
                <div className="bg-[var(--ui-bg)] border border-[var(--ui-border)] rounded-3xl p-6 shadow-2xl max-w-2xl mx-auto w-full">
                  <div className="w-12 h-1.5 bg-slate-700 rounded-full mx-auto mb-6" />
                  <div className="flex justify-between items-start mb-5 gap-4">
                    <div className="flex items-center gap-3">
                      <div className={cn('size-12 rounded-xl flex items-center justify-center border border-white/5', typeColors[detailTarget.type] ?? typeColors.writing)}>
                        <Icon size={22} />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-[var(--ui-heading)]">{detailTarget.title}</h3>
                        <p className="text-xs text-[var(--ui-muted)]">
                          Due: {detailTarget.dueDate} · {detailTarget.type}
                        </p>
                        <p className="text-[11px] text-[var(--ui-muted)] mt-0.5">
                          {courseName ?? 'Course'}
                          {detailTarget.moduleId && modulesById[detailTarget.moduleId] && (
                            <> · {modulesById[detailTarget.moduleId].name}</>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {sub && (
                        <StatusBadge
                          status={sub.status === 'graded'
                            ? (sub.bandScore ? `Graded · ${sub.bandScore}` : 'Graded')
                            : 'Submitted'}
                          variant={sub.status === 'graded' ? 'success' : 'accent'}
                        />
                      )}
                      <button onClick={() => setDetailTarget(null)} className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-[var(--ui-muted)]">
                        <X size={18} />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {detailTarget.description && (
                      <div className="p-3 rounded-xl bg-white/5 border border-white/5 text-sm text-[var(--ui-body)] leading-relaxed max-h-40 overflow-y-auto no-scrollbar">
                        {detailTarget.description}
                      </div>
                    )}

                    {detailTarget.attachmentUrl && (
                      <a
                        href={detailTarget.attachmentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 rounded-xl bg-[#6324eb]/10 border border-[#6324eb]/20 hover:bg-[#6324eb]/20 transition-colors"
                      >
                        <ExternalLink size={16} className="text-[#6324eb] shrink-0" />
                        <span className="text-sm text-[#6324eb] font-bold truncate">
                          {detailTarget.attachmentName || 'View Assignment Resource'}
                        </span>
                      </a>
                    )}

                    {sub ? (
                      <>
                        {sub.status === 'graded' && sub.bandScore && (
                          <div className="flex items-center gap-4 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                            <TrendingUp className="text-emerald-400 shrink-0" size={24} />
                            <div>
                              <p className="text-[10px] font-black text-emerald-400 uppercase tracking-wider">Band Score</p>
                              <p className="text-3xl font-black text-emerald-300 leading-none">{sub.bandScore}</p>
                            </div>
                          </div>
                        )}

                        {sub.notes && (
                          <div className="space-y-1.5">
                            <p className="text-[10px] font-black text-[var(--ui-muted)] uppercase tracking-wider">Your Submission</p>
                            <div className="p-3 rounded-xl bg-white/5 border border-white/5 text-sm text-[var(--ui-body)] leading-relaxed whitespace-pre-wrap max-h-32 overflow-y-auto no-scrollbar">
                              {sub.notes}
                            </div>
                          </div>
                        )}

                        {sub.fileUrl && (
                          <a href={sub.fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 rounded-xl bg-[#6324eb]/10 border border-[#6324eb]/20 hover:bg-[#6324eb]/20 transition-colors">
                            <ExternalLink size={16} className="text-[#6324eb] shrink-0" />
                            <span className="text-sm text-[#6324eb] font-bold truncate">{sub.fileName || 'View Attached File'}</span>
                          </a>
                        )}

                        {sub.feedback && (
                          <div className="p-4 rounded-xl bg-[#6324eb]/10 border border-[#6324eb]/20">
                            <p className="text-[#6324eb] text-xs font-bold uppercase mb-2 flex items-center gap-1">
                              <MessageSquare size={12} /> Teacher Feedback
                            </p>
                            <p className="text-[var(--ui-body)] text-sm leading-relaxed">{sub.feedback}</p>
                          </div>
                        )}

                        {sub.status === 'pending' && (
                          <div className="text-center py-3 px-4 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400 text-xs font-bold uppercase tracking-wider">
                            Submitted — Awaiting Review
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="space-y-4">
                        <div className="text-xs text-[var(--ui-muted)] bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                          You haven't submitted this assignment yet. When you're ready, start your submission below.
                        </div>
                        <PrimaryButton
                          className="w-full py-3"
                          onClick={() => {
                            setSubmitTarget(detailTarget);
                            setDetailTarget(null);
                          }}
                        >
                          <CheckCircle2 size={16} /> Start Submission
                        </PrimaryButton>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            </>
          );
        })()}
      </AnimatePresence>
    </motion.div>
  );
};
