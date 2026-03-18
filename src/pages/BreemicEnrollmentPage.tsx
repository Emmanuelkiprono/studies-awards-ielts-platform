import React, { useState, useEffect } from 'react';
import { GlassCard, PrimaryButton, StatusBadge } from '../components/UI';
import {
  User,
  Mail,
  Phone,
  Calendar,
  Clock,
  MapPin,
  CreditCard,
  BookOpen,
  GraduationCap,
  DollarSign,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  Save
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { BreemicEnrollment } from '../types';
import { cn } from '../lib/utils';

interface FormErrors {
  [key: string]: string;
}

const courseTypes = [
  'IELTS',
  'TOEFL', 
  'PTE',
  'SAT',
  'TOEIC',
  'German',
  'French',
  'Chinese'
] as const;

const trainingModes = [
  { value: 'in-person', label: 'In-Person Training' },
  { value: 'online', label: 'Online Training' }
] as const;

export const BreemicEnrollmentPage: React.FC = () => {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    contact: '',
    dateOfEnrollment: '',
    courseDuration: '',
    expectedDateOfCompletion: '',
    modeOfTraining: 'in-person' as const,
    physicalAddress: '',
    idPassport: '',
    highestLevelOfEducation: '',
    courseType: 'IELTS' as const,
    feePaid: 0,
    balance: 0,
    officerInCharge: ''
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    // Set today's date as default enrollment date
    const today = new Date().toISOString().split('T')[0];
    setFormData(prev => ({ ...prev, dateOfEnrollment: today }));
  }, []);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Required fields validation
    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.contact.trim()) {
      newErrors.contact = 'Contact number is required';
    } else if (!/^\+?[\d\s\-\(\)]+$/.test(formData.contact)) {
      newErrors.contact = 'Please enter a valid contact number';
    }

    if (!formData.dateOfEnrollment) {
      newErrors.dateOfEnrollment = 'Date of enrollment is required';
    }

    if (!formData.courseDuration.trim()) {
      newErrors.courseDuration = 'Course duration is required';
    }

    if (!formData.expectedDateOfCompletion) {
      newErrors.expectedDateOfCompletion = 'Expected completion date is required';
    }

    if (!formData.physicalAddress.trim()) {
      newErrors.physicalAddress = 'Physical address is required';
    }

    if (!formData.idPassport.trim()) {
      newErrors.idPassport = 'ID/Passport number is required';
    }

    if (!formData.highestLevelOfEducation.trim()) {
      newErrors.highestLevelOfEducation = 'Highest level of education is required';
    }

    if (!formData.officerInCharge.trim()) {
      newErrors.officerInCharge = 'Officer in charge is required';
    }

    // Fee validation
    if (formData.feePaid < 0) {
      newErrors.feePaid = 'Fee paid cannot be negative';
    }

    if (formData.balance < 0) {
      newErrors.balance = 'Balance cannot be negative';
    }

    // Date validation
    if (formData.expectedDateOfCompletion && formData.dateOfEnrollment) {
      const completionDate = new Date(formData.expectedDateOfCompletion);
      const enrollmentDate = new Date(formData.dateOfEnrollment);
      
      if (completionDate <= enrollmentDate) {
        newErrors.expectedDateOfCompletion = 'Expected completion date must be after enrollment date';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setSubmitError('');

    try {
      const enrollmentData: Omit<BreemicEnrollment, 'id'> = {
        ...formData,
        feePaid: Number(formData.feePaid),
        balance: Number(formData.balance),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        status: 'pending'
      };

      const docRef = await addDoc(collection(db, 'breemicEnrollments'), enrollmentData);
      
      console.log('Enrollment created with ID:', docRef.id);
      setSubmitted(true);
      
      // Reset form after successful submission
      setTimeout(() => {
        setFormData({
          fullName: '',
          email: '',
          contact: '',
          dateOfEnrollment: new Date().toISOString().split('T')[0],
          courseDuration: '',
          expectedDateOfCompletion: '',
          modeOfTraining: 'in-person',
          physicalAddress: '',
          idPassport: '',
          highestLevelOfEducation: '',
          courseType: 'IELTS',
          feePaid: 0,
          balance: 0,
          officerInCharge: ''
        });
        setSubmitted(false);
      }, 3000);

    } catch (error) {
      console.error('Error submitting enrollment:', error);
      setSubmitError('Failed to submit enrollment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="p-4 max-w-2xl mx-auto w-full"
      >
        <GlassCard className="p-8 text-center">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-8 h-8 text-green-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-4">Enrollment Submitted Successfully!</h2>
          <p className="text-slate-400 mb-6">
            Thank you for enrolling at Breemic International. Your enrollment has been received and is currently pending review.
          </p>
          <StatusBadge variant="success" className="inline-flex">
            Application ID: {Date.now()}
          </StatusBadge>
        </GlassCard>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 space-y-6 max-w-4xl mx-auto w-full"
    >
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-white">🎓 Breemic International Enrollment (Live Now)</h1>
        <p className="text-slate-400">Complete your enrollment form to start your learning journey</p>
      </div>

      {/* Error Message */}
      <AnimatePresence>
        {submitError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center gap-3"
          >
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <span className="text-red-400 text-sm">{submitError}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <GlassCard className="p-6">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <User className="w-5 h-5 text-blue-400" />
            Personal Information
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Full Name */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <User className="w-3 h-3" />
                Full Name *
              </label>
              <input
                type="text"
                className={cn(
                  "input-field w-full",
                  errors.fullName && "border-red-500/50 bg-red-500/5"
                )}
                placeholder="Enter your full name"
                value={formData.fullName}
                onChange={(e) => handleInputChange('fullName', e.target.value)}
              />
              {errors.fullName && (
                <p className="text-red-400 text-xs flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.fullName}
                </p>
              )}
            </div>

            {/* Email */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Mail className="w-3 h-3" />
                Email Address *
              </label>
              <input
                type="email"
                className={cn(
                  "input-field w-full",
                  errors.email && "border-red-500/50 bg-red-500/5"
                )}
                placeholder="your.email@example.com"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
              />
              {errors.email && (
                <p className="text-red-400 text-xs flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.email}
                </p>
              )}
            </div>

            {/* Contact */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Phone className="w-3 h-3" />
                Contact Number *
              </label>
              <input
                type="tel"
                className={cn(
                  "input-field w-full",
                  errors.contact && "border-red-500/50 bg-red-500/5"
                )}
                placeholder="+1234567890"
                value={formData.contact}
                onChange={(e) => handleInputChange('contact', e.target.value)}
              />
              {errors.contact && (
                <p className="text-red-400 text-xs flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.contact}
                </p>
              )}
            </div>

            {/* ID/Passport */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <CreditCard className="w-3 h-3" />
                ID / Passport Number *
              </label>
              <input
                type="text"
                className={cn(
                  "input-field w-full",
                  errors.idPassport && "border-red-500/50 bg-red-500/5"
                )}
                placeholder="Enter your ID or passport number"
                value={formData.idPassport}
                onChange={(e) => handleInputChange('idPassport', e.target.value)}
              />
              {errors.idPassport && (
                <p className="text-red-400 text-xs flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.idPassport}
                </p>
              )}
            </div>
          </div>
        </GlassCard>

        {/* Course Information */}
        <GlassCard className="p-6">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-purple-400" />
            Course Information
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Course Type */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <BookOpen className="w-3 h-3" />
                Course Type *
              </label>
              <select
                className="input-field w-full"
                value={formData.courseType}
                onChange={(e) => handleInputChange('courseType', e.target.value)}
              >
                {courseTypes.map(course => (
                  <option key={course} value={course}>
                    {course}
                  </option>
                ))}
              </select>
            </div>

            {/* Mode of Training */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <GraduationCap className="w-3 h-3" />
                Mode of Training *
              </label>
              <div className="space-y-2">
                {trainingModes.map(mode => (
                  <label key={mode.value} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="modeOfTraining"
                      value={mode.value}
                      checked={formData.modeOfTraining === mode.value}
                      onChange={(e) => handleInputChange('modeOfTraining', e.target.value)}
                      className="w-4 h-4 text-blue-500"
                    />
                    <span className="text-white">{mode.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Course Duration */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Course Duration *
              </label>
              <input
                type="text"
                className={cn(
                  "input-field w-full",
                  errors.courseDuration && "border-red-500/50 bg-red-500/5"
                )}
                placeholder="e.g., 12 weeks, 3 months"
                value={formData.courseDuration}
                onChange={(e) => handleInputChange('courseDuration', e.target.value)}
              />
              {errors.courseDuration && (
                <p className="text-red-400 text-xs flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.courseDuration}
                </p>
              )}
            </div>

            {/* Highest Level of Education */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <GraduationCap className="w-3 h-3" />
                Highest Level of Education *
              </label>
              <input
                type="text"
                className={cn(
                  "input-field w-full",
                  errors.highestLevelOfEducation && "border-red-500/50 bg-red-500/5"
                )}
                placeholder="e.g., Bachelor's Degree, High School"
                value={formData.highestLevelOfEducation}
                onChange={(e) => handleInputChange('highestLevelOfEducation', e.target.value)}
              />
              {errors.highestLevelOfEducation && (
                <p className="text-red-400 text-xs flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.highestLevelOfEducation}
                </p>
              )}
            </div>
          </div>
        </GlassCard>

        {/* Dates & Address */}
        <GlassCard className="p-6">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-green-400" />
            Dates & Address
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Date of Enrollment */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Date of Enrollment *
              </label>
              <input
                type="date"
                className={cn(
                  "input-field w-full",
                  errors.dateOfEnrollment && "border-red-500/50 bg-red-500/5"
                )}
                value={formData.dateOfEnrollment}
                onChange={(e) => handleInputChange('dateOfEnrollment', e.target.value)}
              />
              {errors.dateOfEnrollment && (
                <p className="text-red-400 text-xs flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.dateOfEnrollment}
                </p>
              )}
            </div>

            {/* Expected Date of Completion */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Expected Date of Completion *
              </label>
              <input
                type="date"
                className={cn(
                  "input-field w-full",
                  errors.expectedDateOfCompletion && "border-red-500/50 bg-red-500/5"
                )}
                value={formData.expectedDateOfCompletion}
                onChange={(e) => handleInputChange('expectedDateOfCompletion', e.target.value)}
                min={formData.dateOfEnrollment}
              />
              {errors.expectedDateOfCompletion && (
                <p className="text-red-400 text-xs flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.expectedDateOfCompletion}
                </p>
              )}
            </div>

            {/* Physical Address */}
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                Physical Address *
              </label>
              <textarea
                className={cn(
                  "input-field w-full min-h-[80px]",
                  errors.physicalAddress && "border-red-500/50 bg-red-500/5"
                )}
                placeholder="Enter your complete physical address"
                value={formData.physicalAddress}
                onChange={(e) => handleInputChange('physicalAddress', e.target.value)}
              />
              {errors.physicalAddress && (
                <p className="text-red-400 text-xs flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.physicalAddress}
                </p>
              )}
            </div>
          </div>
        </GlassCard>

        {/* Financial Information */}
        <GlassCard className="p-6">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-yellow-400" />
            Financial Information
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Fee Paid */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <DollarSign className="w-3 h-3" />
                Fee Paid *
              </label>
              <input
                type="number"
                className={cn(
                  "input-field w-full",
                  errors.feePaid && "border-red-500/50 bg-red-500/5"
                )}
                placeholder="0.00"
                value={formData.feePaid}
                onChange={(e) => handleInputChange('feePaid', e.target.value)}
                min="0"
                step="0.01"
              />
              {errors.feePaid && (
                <p className="text-red-400 text-xs flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.feePaid}
                </p>
              )}
            </div>

            {/* Balance */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <DollarSign className="w-3 h-3" />
                Balance *
              </label>
              <input
                type="number"
                className={cn(
                  "input-field w-full",
                  errors.balance && "border-red-500/50 bg-red-500/5"
                )}
                placeholder="0.00"
                value={formData.balance}
                onChange={(e) => handleInputChange('balance', e.target.value)}
                min="0"
                step="0.01"
              />
              {errors.balance && (
                <p className="text-red-400 text-xs flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.balance}
                </p>
              )}
            </div>

            {/* Officer in Charge */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <UserCheck className="w-3 h-3" />
                Officer in Charge *
              </label>
              <input
                type="text"
                className={cn(
                  "input-field w-full",
                  errors.officerInCharge && "border-red-500/50 bg-red-500/5"
                )}
                placeholder="Officer name"
                value={formData.officerInCharge}
                onChange={(e) => handleInputChange('officerInCharge', e.target.value)}
              />
              {errors.officerInCharge && (
                <p className="text-red-400 text-xs flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.officerInCharge}
                </p>
              )}
            </div>
          </div>
        </GlassCard>

        {/* Submit Button */}
        <div className="flex justify-center pt-6">
          <PrimaryButton
            type="submit"
            disabled={loading}
            className="px-8 py-4 text-lg font-bold min-w-[200px]"
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Submitting...
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Save className="w-5 h-5" />
                Submit Enrollment
              </div>
            )}
          </PrimaryButton>
        </div>
      </form>
    </motion.div>
  );
};
