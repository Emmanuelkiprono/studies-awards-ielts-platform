import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
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
import { doc, addDoc, collection, updateDoc, serverTimestamp, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { BreemicEnrollment, OnboardingStatus } from '../types';
import { cn } from '../lib/utils';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

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
  const { user, profile } = useAuth();
  const navigate = useNavigate();
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

    // Check if user is logged in
    if (!user) {
      setSubmitError('Please log in to submit your enrollment.');
      return;
    }
    
    setLoading(true);
    setSubmitError('');

    try {
      
      // Create Breemic enrollment record
      const enrollmentData: Omit<BreemicEnrollment, 'id'> = {
        ...formData,
        feePaid: Number(formData.feePaid),
        balance: Number(formData.balance),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        status: 'pending'
      };

      const docRef = await addDoc(collection(db, 'breemicEnrollments'), enrollmentData);

      // Update student's onboarding status in both collections
      // Preserve approval if already approved
      const existingSnap = await getDoc(doc(db, 'students', user.uid));
      const existingStatus = existingSnap.data()?.onboardingStatus;
      
      const computedNextStatus: OnboardingStatus = Number(formData.feePaid) > 0 ? 'approval_pending' : 'payment_pending';
      const safeStatus = existingStatus === 'approved' ? 'approved' : computedNextStatus;
      
      // Update users collection
      try {
        const usersPayload = {
          onboardingStatus: safeStatus,
          breemicEnrollmentId: docRef.id,
          lastStatusUpdate: serverTimestamp(),
          paymentInfo: {
            amountPaid: Number(formData.feePaid),
            balance: Number(formData.balance),
            paymentMethod: 'other', // Will be updated by admin
            paymentDate: Number(formData.feePaid) > 0 ? new Date().toISOString() : undefined
          }
        };
        
        await updateDoc(doc(db, 'users', user.uid), usersPayload);
      } catch (error) {
        console.error('❌ Error updating users collection:', error);
        throw new Error(`Failed to update users collection: ${error.message}`);
      }

      // Update students collection (primary data source)
      try {
        // 1. Define studentsPayload once before the if/else
        const studentsPayload = {
          onboardingStatus: safeStatus,
          breemicEnrollmentId: docRef.id,
          enrollmentCompleted: true,
          paymentInfo: {
            feePaid: Number(formData.feePaid),
            balance: Number(formData.balance),
          },
          lastStatusUpdate: serverTimestamp(),
        };
        
        // Write to students collection with merge
        await setDoc(doc(db, 'students', user.uid), studentsPayload, { merge: true });
        
        // Verify the update was successful
        const verifySnap = await getDoc(doc(db, 'students', user.uid));
        if (verifySnap.data().onboardingStatus !== safeStatus) {
          throw new Error(`Verification failed: Expected onboardingStatus=${safeStatus} but got ${verifySnap.data().onboardingStatus}`);
        }
        
        // Redirect to onboarding after successful submission
        window.location.href = '/onboarding';
        
      } catch (error) {
        throw error;
      }

      
    } catch (error) {
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
          <StatusBadge status={`Application ID: ${Date.now()}`} variant="success" className="inline-flex" />
        </GlassCard>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-900 dark:via-purple-900 dark:to-slate-900"
    >
            {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">🎓 Breemic International Enrollment</h1>
        <p className="text-slate-600 dark:text-slate-400">Complete your enrollment form to start your learning journey</p>
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
      <div className="px-4 pb-24 max-w-2xl mx-auto">
        <form onSubmit={handleSubmit} className="space-y-6">
        <GlassCard className="p-6">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <User className="w-5 h-5 text-blue-400" />
            Personal Information
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Full Name */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1 mb-3">
                <User className="w-3 h-3" />
                Full Name *
              </label>
              <input
                type="text"
                className={cn(
                  "input-field w-full",
                  errors.fullName && "error"
                )}
                placeholder="Enter your full name"
                value={formData.fullName}
                onChange={(e) => handleInputChange('fullName', e.target.value)}
              />
              {errors.fullName && (
                <p className="text-red-400 dark:text-red-300 text-xs flex items-center gap-1 mt-2 font-medium">
                  <AlertCircle className="w-3 h-3" />
                  {errors.fullName}
                </p>
              )}
            </div>

            {/* Email */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1 mb-3">
                <Mail className="w-3 h-3" />
                Email Address *
              </label>
              <input
                type="email"
                className={cn(
                  "input-field w-full",
                  errors.email && "error"
                )}
                placeholder="your.email@example.com"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
              />
              {errors.email && (
                <p className="text-red-400 dark:text-red-300 text-xs flex items-center gap-1 mt-2 font-medium">
                  <AlertCircle className="w-3 h-3" />
                  {errors.email}
                </p>
              )}
            </div>

            {/* Contact */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1 mb-3">
                <Phone className="w-3 h-3" />
                Contact Number *
              </label>
              <input
                type="tel"
                className={cn(
                  "input-field w-full",
                  errors.contact && "error"
                )}
                placeholder="+1234567890"
                value={formData.contact}
                onChange={(e) => handleInputChange('contact', e.target.value)}
              />
              {errors.contact && (
                <p className="text-red-400 dark:text-red-300 text-xs flex items-center gap-1 mt-2 font-medium">
                  <AlertCircle className="w-3 h-3" />
                  {errors.contact}
                </p>
              )}
            </div>

            {/* ID/Passport */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1 mb-3">
                <CreditCard className="w-3 h-3" />
                ID / Passport Number *
              </label>
              <input
                type="text"
                className={cn(
                  "input-field w-full",
                  errors.idPassport && "error"
                )}
                placeholder="Enter your ID or passport number"
                value={formData.idPassport}
                onChange={(e) => handleInputChange('idPassport', e.target.value)}
              />
              {errors.idPassport && (
                <p className="text-red-400 dark:text-red-300 text-xs flex items-center gap-1 mt-2 font-medium">
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
              <label className="text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1 mb-3">
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
              <label className="text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1 mb-3">
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
                    <span className="text-slate-200 dark:text-white font-medium">{mode.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Course Duration */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1 mb-3">
                <Clock className="w-3 h-3" />
                Course Duration *
              </label>
              <input
                type="text"
                className={cn(
                  "input-field w-full",
                  errors.courseDuration && "error"
                )}
                placeholder="e.g., 12 weeks, 3 months"
                value={formData.courseDuration}
                onChange={(e) => handleInputChange('courseDuration', e.target.value)}
              />
              {errors.courseDuration && (
                <p className="text-red-400 dark:text-red-300 text-xs flex items-center gap-1 mt-2 font-medium">
                  <AlertCircle className="w-3 h-3" />
                  {errors.courseDuration}
                </p>
              )}
            </div>

            {/* Highest Level of Education */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1 mb-3">
                <GraduationCap className="w-3 h-3" />
                Highest Level of Education *
              </label>
              <input
                type="text"
                className={cn(
                  "input-field w-full",
                  errors.highestLevelOfEducation && "error"
                )}
                placeholder="e.g., Bachelor's Degree, High School"
                value={formData.highestLevelOfEducation}
                onChange={(e) => handleInputChange('highestLevelOfEducation', e.target.value)}
              />
              {errors.highestLevelOfEducation && (
                <p className="text-red-400 dark:text-red-300 text-xs flex items-center gap-1 mt-2 font-medium">
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
              <label className="text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1 mb-3">
                <Calendar className="w-3 h-3" />
                Date of Enrollment *
              </label>
              <input
                type="date"
                className={cn(
                  "input-field w-full",
                  errors.dateOfEnrollment && "error"
                )}
                value={formData.dateOfEnrollment}
                onChange={(e) => handleInputChange('dateOfEnrollment', e.target.value)}
              />
              {errors.dateOfEnrollment && (
                <p className="text-red-400 dark:text-red-300 text-xs flex items-center gap-1 mt-2 font-medium">
                  <AlertCircle className="w-3 h-3" />
                  {errors.dateOfEnrollment}
                </p>
              )}
            </div>

            {/* Expected Date of Completion */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1 mb-3">
                <Calendar className="w-3 h-3" />
                Expected Date of Completion *
              </label>
              <input
                type="date"
                className={cn(
                  "input-field w-full",
                  errors.expectedDateOfCompletion && "error"
                )}
                value={formData.expectedDateOfCompletion}
                onChange={(e) => handleInputChange('expectedDateOfCompletion', e.target.value)}
                min={formData.dateOfEnrollment}
              />
              {errors.expectedDateOfCompletion && (
                <p className="text-red-400 dark:text-red-300 text-xs flex items-center gap-1 mt-2 font-medium">
                  <AlertCircle className="w-3 h-3" />
                  {errors.expectedDateOfCompletion}
                </p>
              )}
            </div>

            {/* Physical Address */}
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1 mb-3">
                <MapPin className="w-3 h-3" />
                Physical Address *
              </label>
              <textarea
                className={cn(
                  "input-field w-full min-h-[80px]",
                  errors.physicalAddress && "error"
                )}
                placeholder="Enter your complete physical address"
                value={formData.physicalAddress}
                onChange={(e) => handleInputChange('physicalAddress', e.target.value)}
              />
              {errors.physicalAddress && (
                <p className="text-red-400 dark:text-red-300 text-xs flex items-center gap-1 mt-2 font-medium">
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
              <label className="text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1 mb-3">
                <DollarSign className="w-3 h-3" />
                Fee Paid *
              </label>
              <input
                type="number"
                className={cn(
                  "input-field w-full",
                  errors.feePaid && "error"
                )}
                placeholder="0.00"
                value={formData.feePaid}
                onChange={(e) => handleInputChange('feePaid', e.target.value)}
                min="0"
                step="0.01"
              />
              {errors.feePaid && (
                <p className="text-red-400 dark:text-red-300 text-xs flex items-center gap-1 mt-2 font-medium">
                  <AlertCircle className="w-3 h-3" />
                  {errors.feePaid}
                </p>
              )}
            </div>

            {/* Balance */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1 mb-3">
                <DollarSign className="w-3 h-3" />
                Balance *
              </label>
              <input
                type="number"
                className={cn(
                  "input-field w-full",
                  errors.balance && "error"
                )}
                placeholder="0.00"
                value={formData.balance}
                onChange={(e) => handleInputChange('balance', e.target.value)}
                min="0"
                step="0.01"
              />
              {errors.balance && (
                <p className="text-red-400 dark:text-red-300 text-xs flex items-center gap-1 mt-2 font-medium">
                  <AlertCircle className="w-3 h-3" />
                  {errors.balance}
                </p>
              )}
            </div>

            {/* Officer in Charge */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1 mb-3">
                <UserCheck className="w-3 h-3" />
                Officer in Charge *
              </label>
              <input
                type="text"
                className={cn(
                  "input-field w-full",
                  errors.officerInCharge && "error"
                )}
                placeholder="Officer name"
                value={formData.officerInCharge}
                onChange={(e) => handleInputChange('officerInCharge', e.target.value)}
              />
              {errors.officerInCharge && (
                <p className="text-red-400 dark:text-red-300 text-xs flex items-center gap-1 mt-2 font-medium">
                  <AlertCircle className="w-3 h-3" />
                  {errors.officerInCharge}
                </p>
              )}
            </div>
          </div>
        </GlassCard>

        {/* Submit Button */}
        <div className="sticky bottom-20 bg-gradient-to-t from-slate-50 via-slate-50/95 to-transparent dark:from-slate-900 dark:via-slate-900/95 pt-6 pb-4 -mx-4 px-4 md:static md:bg-transparent md:pt-6 md:pb-0 md:mx-0">
          <div className="flex justify-center">
            <PrimaryButton
              type="submit"
              disabled={loading}
              className="px-8 py-4 text-lg font-bold min-w-[200px] shadow-lg"
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
        </div>
      </form>
      </div>
    </motion.div>
  );
};
