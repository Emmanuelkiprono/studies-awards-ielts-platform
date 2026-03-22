import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Calendar, X } from 'lucide-react';
import { cn } from '../lib/utils';
import {
  LessonModuleOption,
  TrainerAssignmentStatus,
  TRAINER_STATUS_OPTIONS,
} from '../data/lessonAssignmentData';
import { getProgressForStatus } from '../lib/studentAssignment';

export interface AssignLessonStudent {
  uid: string;
  name: string;
  email: string;
  joinDateLabel: string;
  batchName: string;
  currentStatus: TrainerAssignmentStatus;
  currentModule?: string;
  currentModuleId?: string;
  currentLesson?: string;
  currentLessonId?: string;
  progressPercent: number;
  trainerNotes?: string;
  lessonDeadline?: string | null;
}

export interface AssignLessonPayload {
  moduleId: string;
  moduleTitle: string;
  lessonId: string;
  lessonTitle: string;
  lessonOrder: number;
  status: TrainerAssignmentStatus;
  progressPercent: number;
  deadline: string | null;
  notes: string;
  nextAction: string;
}

interface AssignLessonModalProps {
  isOpen: boolean;
  student: AssignLessonStudent | null;
  modules: LessonModuleOption[];
  isSaving?: boolean;
  onClose: () => void;
  onAssign: (payload: AssignLessonPayload) => Promise<void>;
}

interface AssignLessonFormState {
  moduleId: string;
  lessonId: string;
  status: TrainerAssignmentStatus;
  deadline: string;
  notes: string;
}

export const AssignLessonModal: React.FC<AssignLessonModalProps> = ({
  isOpen,
  student,
  modules,
  isSaving = false,
  onClose,
  onAssign,
}) => {
  const [form, setForm] = useState<AssignLessonFormState>({
    moduleId: '',
    lessonId: '',
    status: 'New',
    deadline: '',
    notes: '',
  });
  const [error, setError] = useState<string | null>(null);

  const resolvedModules = useMemo(
    () => modules.filter((module) => module.lessons.length > 0),
    [modules]
  );

  const selectedModule = useMemo(
    () => resolvedModules.find((module) => module.id === form.moduleId) || null,
    [form.moduleId, resolvedModules]
  );

  const selectedLesson = useMemo(
    () => selectedModule?.lessons.find((lesson) => lesson.id === form.lessonId) || null,
    [form.lessonId, selectedModule]
  );

  useEffect(() => {
    if (!isOpen || !student) {
      return;
    }

    const defaultModuleId = student.currentModuleId || resolvedModules[0]?.id || '';
    const defaultModule =
      resolvedModules.find((module) => module.id === defaultModuleId) ||
      resolvedModules[0] ||
      null;
    const defaultLessonId =
      student.currentLessonId || defaultModule?.lessons[0]?.id || '';

    setForm({
      moduleId: defaultModuleId,
      lessonId: defaultLessonId,
      status: student.currentStatus,
      deadline: student.lessonDeadline || '',
      notes: student.trainerNotes || '',
    });
    setError(null);
  }, [isOpen, resolvedModules, student]);

  useEffect(() => {
    if (!selectedModule) {
      return;
    }

    const lessonStillExists = selectedModule.lessons.some(
      (lesson) => lesson.id === form.lessonId
    );

    if (!lessonStillExists) {
      setForm((currentForm) => ({
        ...currentForm,
        lessonId: selectedModule.lessons[0]?.id || '',
      }));
    }
  }, [form.lessonId, selectedModule]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!selectedModule || !selectedLesson) {
      setError('Please choose a module and lesson before saving.');
      return;
    }

    setError(null);

    try {
      await onAssign({
        moduleId: selectedModule.id,
        moduleTitle: selectedModule.title,
        lessonId: selectedLesson.id,
        lessonTitle: selectedLesson.title,
        lessonOrder: selectedLesson.order,
        status: form.status,
        progressPercent: getProgressForStatus(form.status, student?.progressPercent || 0),
        deadline: form.deadline || null,
        notes: form.notes.trim(),
        nextAction: selectedLesson.nextAction || `Complete ${selectedLesson.title}`,
      });
    } catch (assignError) {
      setError(assignError instanceof Error ? assignError.message : 'Failed to save assignment.');
    }
  };

  if (!student) {
    return null;
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[70] bg-slate-950/45 backdrop-blur-sm"
          />

          <motion.aside
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="fixed inset-x-0 bottom-0 z-[80] max-h-[92vh] overflow-hidden rounded-t-[28px] bg-white shadow-2xl md:inset-y-0 md:right-0 md:left-auto md:max-h-none md:w-full md:max-w-xl md:rounded-none md:border-l md:border-gray-200"
          >
            <div className="flex h-full flex-col">
              <div className="border-b border-gray-200 px-5 py-4 sm:px-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-semibold tracking-tight text-black">Edit Assignment</h2>
                    <p className="mt-1 text-sm text-gray-700">
                      Update the student's lesson, status, and notes.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-full border border-gray-200 p-2 text-gray-500 transition-colors hover:bg-gray-50 hover:text-black"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
                <div className="space-y-5">
                  <section className="rounded-3xl border border-gray-200 bg-gray-50 p-4 shadow-sm">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="text-lg font-semibold tracking-tight text-black">{student.name}</h3>
                        <p className="text-sm text-gray-700">{student.email}</p>
                      </div>
                      <div className="rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-700 shadow-sm">
                        {student.progressPercent}% progress
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl bg-white p-3 shadow-sm">
                        <p className="text-xs font-medium uppercase tracking-[0.16em] text-gray-500">Join Date</p>
                        <p className="mt-1 text-sm font-medium text-black">{student.joinDateLabel}</p>
                      </div>
                      <div className="rounded-2xl bg-white p-3 shadow-sm">
                        <p className="text-xs font-medium uppercase tracking-[0.16em] text-gray-500">Batch</p>
                        <p className="mt-1 text-sm font-medium text-black">{student.batchName}</p>
                      </div>
                      <div className="rounded-2xl bg-white p-3 shadow-sm">
                        <p className="text-xs font-medium uppercase tracking-[0.16em] text-gray-500">Current Module</p>
                        <p className="mt-1 text-sm font-medium text-black">{student.currentModule || 'Speaking'}</p>
                      </div>
                      <div className="rounded-2xl bg-white p-3 shadow-sm">
                        <p className="text-xs font-medium uppercase tracking-[0.16em] text-gray-500">Current Lesson</p>
                        <p className="mt-1 text-sm font-medium text-black">{student.currentLesson || 'Speaking Basics'}</p>
                      </div>
                    </div>
                  </section>

                  <form onSubmit={handleSubmit} className="space-y-5">
                    <section className="space-y-4 rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <label className="space-y-2">
                          <span className="text-sm font-medium text-gray-700">Module</span>
                          <select
                            value={form.moduleId}
                            onChange={(event) =>
                              setForm((currentForm) => ({
                                ...currentForm,
                                moduleId: event.target.value,
                              }))
                            }
                            className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-black outline-none transition-colors focus:border-purple-500"
                          >
                            <option value="">Select module</option>
                            {resolvedModules.map((module) => (
                              <option key={module.id} value={module.id}>
                                {module.title}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="space-y-2">
                          <span className="text-sm font-medium text-gray-700">Lesson</span>
                          <select
                            value={form.lessonId}
                            onChange={(event) =>
                              setForm((currentForm) => ({
                                ...currentForm,
                                lessonId: event.target.value,
                              }))
                            }
                            className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-black outline-none transition-colors focus:border-purple-500 disabled:bg-gray-50"
                            disabled={!selectedModule}
                          >
                            <option value="">Select lesson</option>
                            {selectedModule?.lessons.map((lesson) => (
                              <option key={lesson.id} value={lesson.id}>
                                {lesson.title}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="space-y-2">
                          <span className="text-sm font-medium text-gray-700">Status</span>
                          <select
                            value={form.status}
                            onChange={(event) =>
                              setForm((currentForm) => ({
                                ...currentForm,
                                status: event.target.value as TrainerAssignmentStatus,
                              }))
                            }
                            className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-black outline-none transition-colors focus:border-purple-500"
                          >
                            {TRAINER_STATUS_OPTIONS.map((statusOption) => (
                              <option key={statusOption} value={statusOption}>
                                {statusOption}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="space-y-2">
                          <span className="text-sm font-medium text-gray-700">Deadline</span>
                          <div className="relative">
                            <Calendar
                              size={16}
                              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                            />
                            <input
                              type="date"
                              value={form.deadline}
                              onChange={(event) =>
                                setForm((currentForm) => ({
                                  ...currentForm,
                                  deadline: event.target.value,
                                }))
                              }
                              className="w-full rounded-2xl border border-gray-200 bg-white py-3 pl-11 pr-4 text-sm text-black outline-none transition-colors focus:border-purple-500"
                            />
                          </div>
                        </label>
                      </div>

                      <label className="block space-y-2">
                        <span className="text-sm font-medium text-gray-700">Notes</span>
                        <textarea
                          value={form.notes}
                          onChange={(event) =>
                            setForm((currentForm) => ({
                              ...currentForm,
                              notes: event.target.value,
                            }))
                          }
                          rows={4}
                          placeholder="Add a simple note for the student or trainer record."
                          className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-black outline-none transition-colors focus:border-purple-500"
                        />
                      </label>

                      {selectedLesson && (
                        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                          <p className="text-sm font-semibold text-black">{selectedLesson.title}</p>
                          {selectedLesson.description && (
                            <p className="mt-1 text-sm text-gray-700">{selectedLesson.description}</p>
                          )}
                          <p className="mt-2 text-xs text-gray-500">
                            Saving this status will set progress to{' '}
                            {getProgressForStatus(form.status, student.progressPercent)}%.
                          </p>
                        </div>
                      )}

                      {error && (
                        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                          {error}
                        </div>
                      )}
                    </section>

                    <div className="sticky bottom-0 z-10 flex flex-col gap-3 border-t border-gray-200 bg-white/95 px-1 pt-4 backdrop-blur sm:flex-row sm:justify-end">
                      <button
                        type="button"
                        onClick={onClose}
                        className="rounded-2xl border border-gray-200 px-5 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSaving}
                        className={cn(
                          'inline-flex items-center justify-center gap-2 rounded-2xl bg-purple-600 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-60',
                          isSaving && 'hover:bg-purple-600'
                        )}
                      >
                        {isSaving ? (
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        ) : null}
                        Save Assignment
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};
