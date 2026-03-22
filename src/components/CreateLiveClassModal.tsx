import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Calendar, Clock, Link, BookOpen } from 'lucide-react';
import { cn } from '../lib/utils';

interface CreateLiveClassModalProps {
  isOpen: boolean;
  onClose: () => void;
  modules: Array<{ id: string; name: string }>;
  batches: Array<{ id: string; name: string }>;
  onCreateClass: (classData: LiveClassFormData) => Promise<void>;
}

export interface LiveClassFormData {
  title: string;
  moduleId: string;
  batchId: string;
  date: string;
  startTime: string;
  endTime: string;
  meetingLink: string;
  description: string;
  teacherId: string;
}

export const CreateLiveClassModal: React.FC<CreateLiveClassModalProps> = ({
  isOpen,
  onClose,
  modules,
  batches,
  onCreateClass,
}) => {
  const [formData, setFormData] = useState<Partial<LiveClassFormData>>({
    title: '',
    moduleId: '',
    batchId: '',
    date: '',
    startTime: '',
    endTime: '',
    meetingLink: '',
    description: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.title?.trim()) {
      newErrors.title = 'Class title is required';
    }
    if (!formData.moduleId) {
      newErrors.moduleId = 'Please select a module';
    }
    if (!formData.batchId) {
      newErrors.batchId = 'Please select a batch/group';
    }
    if (!formData.date) {
      newErrors.date = 'Date is required';
    }
    if (!formData.startTime) {
      newErrors.startTime = 'Start time is required';
    }
    if (!formData.endTime) {
      newErrors.endTime = 'End time is required';
    }
    if (formData.startTime && formData.endTime && formData.startTime >= formData.endTime) {
      newErrors.endTime = 'End time must be after start time';
    }
    if (!formData.meetingLink?.trim()) {
      newErrors.meetingLink = 'Meeting link is required';
    } else if (!isValidUrl(formData.meetingLink)) {
      newErrors.meetingLink = 'Please enter a valid URL';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isValidUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onCreateClass(formData as LiveClassFormData);
      // Reset form on success
      setFormData({
        title: '',
        moduleId: '',
        batchId: '',
        date: '',
        startTime: '',
        endTime: '',
        meetingLink: '',
        description: '',
      });
      onClose();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to create class');
      console.error('Error creating class:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: '',
      }));
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-[60]"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          >
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="sticky top-0 flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white">
                <h2 className="text-2xl font-bold text-black">Create Live Class</h2>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <X size={24} className="text-gray-400" />
                </button>
              </div>

              {/* Form Content */}
              <form onSubmit={handleSubmit} className="p-6 space-y-6">
                {/* Error Message */}
                {submitError && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-700">{submitError}</p>
                  </div>
                )}

                {/* Class Title */}
                <div>
                  <label htmlFor="title" className="block text-sm font-semibold text-black mb-2">
                    Class Title *
                  </label>
                  <input
                    id="title"
                    name="title"
                    type="text"
                    placeholder="e.g., Advanced Speaking Workshop"
                    value={formData.title || ''}
                    onChange={handleChange}
                    className={cn(
                      'w-full px-4 py-3 rounded-lg border-2 transition-colors outline-none',
                      errors.title
                        ? 'border-red-400 bg-red-50 focus:border-red-500'
                        : 'border-gray-200 bg-white focus:border-purple-500'
                    )}
                  />
                  {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title}</p>}
                </div>

                {/* Module Selection */}
                <div>
                  <label htmlFor="moduleId" className="block text-sm font-semibold text-black mb-2">
                    Module *
                  </label>
                  <select
                    id="moduleId"
                    name="moduleId"
                    value={formData.moduleId || ''}
                    onChange={handleChange}
                    className={cn(
                      'w-full px-4 py-3 rounded-lg border-2 transition-colors outline-none',
                      errors.moduleId
                        ? 'border-red-400 bg-red-50 focus:border-red-500'
                        : 'border-gray-200 bg-white focus:border-purple-500'
                    )}
                  >
                    <option value="">Select a module...</option>
                    {modules.map((module) => (
                      <option key={module.id} value={module.id}>
                        {module.name}
                      </option>
                    ))}
                  </select>
                  {errors.moduleId && <p className="mt-1 text-sm text-red-600">{errors.moduleId}</p>}
                </div>

                {/* Batch Selection */}
                <div>
                  <label htmlFor="batchId" className="block text-sm font-semibold text-black mb-2">
                    Batch / Group *
                  </label>
                  <select
                    id="batchId"
                    name="batchId"
                    value={formData.batchId || ''}
                    onChange={handleChange}
                    className={cn(
                      'w-full px-4 py-3 rounded-lg border-2 transition-colors outline-none',
                      errors.batchId
                        ? 'border-red-400 bg-red-50 focus:border-red-500'
                        : 'border-gray-200 bg-white focus:border-purple-500'
                    )}
                  >
                    <option value="">Select a batch...</option>
                    {batches.map((batch) => (
                      <option key={batch.id} value={batch.id}>
                        {batch.name}
                      </option>
                    ))}
                  </select>
                  {errors.batchId && <p className="mt-1 text-sm text-red-600">{errors.batchId}</p>}
                </div>

                {/* Date */}
                <div>
                  <label htmlFor="date" className="flex items-center text-sm font-semibold text-black mb-2">
                    <Calendar size={16} className="mr-2" /> Date *
                  </label>
                  <input
                    id="date"
                    name="date"
                    type="date"
                    value={formData.date || ''}
                    onChange={handleChange}
                    className={cn(
                      'w-full px-4 py-3 rounded-lg border-2 transition-colors outline-none',
                      errors.date
                        ? 'border-red-400 bg-red-50 focus:border-red-500'
                        : 'border-gray-200 bg-white focus:border-purple-500'
                    )}
                  />
                  {errors.date && <p className="mt-1 text-sm text-red-600">{errors.date}</p>}
                </div>

                {/* Start & End Time */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="startTime" className="flex items-center text-sm font-semibold text-black mb-2">
                      <Clock size={16} className="mr-2" /> Start Time *
                    </label>
                    <input
                      id="startTime"
                      name="startTime"
                      type="time"
                      value={formData.startTime || ''}
                      onChange={handleChange}
                      className={cn(
                        'w-full px-4 py-3 rounded-lg border-2 transition-colors outline-none',
                        errors.startTime
                          ? 'border-red-400 bg-red-50 focus:border-red-500'
                          : 'border-gray-200 bg-white focus:border-purple-500'
                      )}
                    />
                    {errors.startTime && <p className="mt-1 text-sm text-red-600">{errors.startTime}</p>}
                  </div>

                  <div>
                    <label htmlFor="endTime" className="block text-sm font-semibold text-black mb-2">
                      End Time *
                    </label>
                    <input
                      id="endTime"
                      name="endTime"
                      type="time"
                      value={formData.endTime || ''}
                      onChange={handleChange}
                      className={cn(
                        'w-full px-4 py-3 rounded-lg border-2 transition-colors outline-none',
                        errors.endTime
                          ? 'border-red-400 bg-red-50 focus:border-red-500'
                          : 'border-gray-200 bg-white focus:border-purple-500'
                      )}
                    />
                    {errors.endTime && <p className="mt-1 text-sm text-red-600">{errors.endTime}</p>}
                  </div>
                </div>

                {/* Meeting Link */}
                <div>
                  <label htmlFor="meetingLink" className="flex items-center text-sm font-semibold text-black mb-2">
                    <Link size={16} className="mr-2" /> Meeting Link *
                  </label>
                  <input
                    id="meetingLink"
                    name="meetingLink"
                    type="url"
                    placeholder="e.g., https://zoom.us/j/123456789"
                    value={formData.meetingLink || ''}
                    onChange={handleChange}
                    className={cn(
                      'w-full px-4 py-3 rounded-lg border-2 transition-colors outline-none',
                      errors.meetingLink
                        ? 'border-red-400 bg-red-50 focus:border-red-500'
                        : 'border-gray-200 bg-white focus:border-purple-500'
                    )}
                  />
                  {errors.meetingLink && <p className="mt-1 text-sm text-red-600">{errors.meetingLink}</p>}
                </div>

                {/* Description (Optional) */}
                <div>
                  <label htmlFor="description" className="flex items-center text-sm font-semibold text-black mb-2">
                    <BookOpen size={16} className="mr-2" /> Description (Optional)
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    placeholder="Add any additional details about this class..."
                    value={formData.description || ''}
                    onChange={handleChange}
                    rows={3}
                    className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 bg-white focus:border-purple-500 focus:outline-none transition-colors resize-none"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 px-4 py-3 rounded-lg border-2 border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 px-4 py-3 rounded-lg bg-purple-600 text-white font-semibold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isSubmitting ? 'Creating...' : 'Create Class'}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

