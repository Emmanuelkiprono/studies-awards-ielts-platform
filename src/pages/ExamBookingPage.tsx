import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GlassCard, PrimaryButton, StatusBadge } from '../components/UI';
import { 
  CreditCard, 
  CheckCircle2, 
  Camera, 
  MapPin, 
  ArrowRight,
  ShieldCheck,
  Upload,
  Lock,
  ArrowLeft
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { NotificationService } from '../services/notificationService';
import { useAuth } from '../hooks/useAuth';
import { db } from '../services/firebase';
import { doc, updateDoc, serverTimestamp, collection, getDocs, query, where } from 'firebase/firestore';

export const ExamBookingPage: React.FC = () => {
  const { user, studentData, profile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // Check eligibility
  const isEligible = studentData?.examStatus === 'eligible' ||
    studentData?.examStatus === 'not_started' && studentData?.trainingStatus === 'active' ||
    studentData?.examPaymentStatus === 'paid';

  const alreadyBooked = studentData?.examStatus === 'booked' || studentData?.examStatus === 'completed';

  const handleNext = () => setStep(step + 1);

  const handleSubmitBooking = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'students', user.uid), {
        examStatus: 'booked',
        examBookingDate: serverTimestamp(),
        preferredLocation: selectedLocation,
      });

      // Notify student
      await NotificationService.create(
        user.uid,
        'Exam Booking Submitted',
        'Your exam booking request has been submitted. Our team will contact you with the schedule.',
        'success',
        '/dashboard'
      );

      // Notify teacher
      if (studentData?.courseId) {
        const teachersSnap = await getDocs(query(
          collection(db, 'users'),
          where('role', '==', 'teacher'),
          where('assignedCourseId', '==', studentData.courseId)
        ));
        for (const t of teachersSnap.docs) {
          await NotificationService.create(
            t.id,
            'Exam Booking Request',
            `${profile?.name ?? 'A student'} has submitted an exam booking request.`,
            'info',
            '/teacher/exams'
          );
        }
      }

      setSubmitted(true);
    } catch (error) {
      console.error('Error submitting booking:', error);
      alert('Failed to submit booking request');
    } finally {
      setLoading(false);
    }
  };

  // Success screen
  if (submitted) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="p-4 max-w-2xl mx-auto w-full pb-24 flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <div className="size-20 rounded-3xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20">
          <CheckCircle2 size={40} />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-white">Booking Submitted!</h2>
          <p className="text-slate-400 text-sm max-w-sm">Your exam booking request has been sent. Your teacher will confirm the date and center shortly.</p>
        </div>
        <PrimaryButton className="px-8 py-3" onClick={() => navigate('/dashboard')}>
          Back to Dashboard
        </PrimaryButton>
      </motion.div>
    );
  }

  // Already booked screen
  if (alreadyBooked) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="p-4 max-w-2xl mx-auto w-full pb-24 flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <div className="size-20 rounded-3xl bg-blue-500/10 flex items-center justify-center text-blue-400 border border-blue-500/20">
          <ShieldCheck size={40} />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-white">Already Booked</h2>
          <p className="text-slate-400 text-sm max-w-sm">You have already submitted an exam booking. Your teacher will confirm your date and center.</p>
        </div>
        <PrimaryButton variant="secondary" className="px-8 py-3" onClick={() => navigate('/dashboard')}>
          <ArrowLeft size={16} /> Back to Dashboard
        </PrimaryButton>
      </motion.div>
    );
  }

  // Not eligible screen
  if (!isEligible) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="p-4 max-w-2xl mx-auto w-full pb-24 flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <div className="size-20 rounded-3xl bg-amber-500/10 flex items-center justify-center text-amber-400 border border-amber-500/20">
          <Lock size={40} />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-white">Not Eligible Yet</h2>
          <p className="text-slate-400 text-sm max-w-sm">Exam booking requires 4 weeks of active training and payment approval from your teacher.</p>
        </div>
        <PrimaryButton variant="secondary" className="px-8 py-3" onClick={() => navigate('/dashboard')}>
          <ArrowLeft size={16} /> Back to Dashboard
        </PrimaryButton>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 space-y-6 max-w-2xl mx-auto w-full pb-24"
    >
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/dashboard')} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-slate-400">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-white">IELTS Exam Booking</h2>
          <p className="text-slate-400 text-sm">Complete these steps to schedule your official exam.</p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="flex justify-between items-center px-4">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center">
            <div className={cn(
              "size-8 rounded-full flex items-center justify-center font-bold text-sm transition-all",
              step >= s ? "bg-[#6324eb] text-white" : "bg-white/5 text-slate-500 border border-white/10"
            )}>
              {step > s ? <CheckCircle2 size={16} /> : s}
            </div>
            {s < 3 && (
              <div className={cn(
                "w-16 h-0.5 mx-2",
                step > s ? "bg-[#6324eb]" : "bg-white/5"
              )} />
            )}
          </div>
        ))}
      </div>

      {step === 1 && (
        <GlassCard className="p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="bg-[#6324eb]/20 size-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <CreditCard size={32} className="text-[#6324eb]" />
            </div>
            <h3 className="text-xl font-bold text-white">Exam Fee Payment</h3>
            <p className="text-slate-400 text-sm">The official IELTS exam fee is KSh 25,000.</p>
          </div>

          <div className="bg-white/5 rounded-xl p-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Exam Fee</span>
              <span className="text-white font-bold">KSh 25,000</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Processing Fee</span>
              <span className="text-white font-bold">KSh 500</span>
            </div>
            <div className="border-t border-white/10 pt-3 flex justify-between font-bold">
              <span className="text-white">Total</span>
              <span className="text-[#6324eb]">KSh 25,500</span>
            </div>
          </div>

          <PrimaryButton className="w-full py-4" onClick={handleNext} loading={loading}>
            Pay Now & Continue
          </PrimaryButton>
        </GlassCard>
      )}

      {step === 2 && (
        <GlassCard className="p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="bg-[#3b82f6]/20 size-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <ShieldCheck size={32} className="text-[#3b82f6]" />
            </div>
            <h3 className="text-xl font-bold text-white">Identity Verification</h3>
            <p className="text-slate-400 text-sm">Upload a clear photo of your Passport or National ID.</p>
          </div>

          <div className="border-2 border-dashed border-white/10 rounded-2xl p-8 flex flex-col items-center justify-center gap-4 hover:border-[#6324eb]/50 transition-colors cursor-pointer bg-white/5">
            <Camera size={48} className="text-slate-500" />
            <div className="text-center">
              <p className="text-white font-bold">Click to capture or upload</p>
              <p className="text-slate-500 text-xs mt-1">Supports JPG, PNG (Max 5MB)</p>
            </div>
          </div>

          <PrimaryButton className="w-full py-4" onClick={handleNext} loading={loading}>
            Upload & Continue
          </PrimaryButton>
        </GlassCard>
      )}

      {step === 3 && (
        <GlassCard className="p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="bg-emerald-500/20 size-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <MapPin size={32} className="text-emerald-500" />
            </div>
            <h3 className="text-xl font-bold text-white">Select Location</h3>
            <p className="text-slate-400 text-sm">Choose your preferred test center.</p>
          </div>

          <div className="space-y-3">
            {[
              { name: 'London Central Academy', address: '123 Oxford St, London', slots: 'Available' },
              { name: 'Manchester IELTS Hub', address: '45 Deansgate, Manchester', slots: 'Limited' },
              { name: 'Birmingham Test Center', address: '88 Colmore Row, Birmingham', slots: 'Available' },
            ].map((loc) => (
              <div
                key={loc.name}
                onClick={() => setSelectedLocation(loc.name)}
                className={cn(
                  'p-4 rounded-xl border cursor-pointer transition-all flex justify-between items-center',
                  selectedLocation === loc.name
                    ? 'bg-[#6324eb]/10 border-[#6324eb]/50 ring-1 ring-[#6324eb]/30'
                    : 'bg-white/5 border-white/10 hover:border-[#6324eb]/30'
                )}
              >
                <div>
                  <p className="text-white font-bold">{loc.name}</p>
                  <p className="text-slate-500 text-xs">{loc.address}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={loc.slots} variant={loc.slots === 'Available' ? 'success' : 'warning'} />
                  {selectedLocation === loc.name && <CheckCircle2 size={16} className="text-[#6324eb]" />}
                </div>
              </div>
            ))}
          </div>

          <PrimaryButton
            className="w-full py-4"
            onClick={handleSubmitBooking}
            loading={loading}
            disabled={!selectedLocation}
          >
            Submit Booking Request
          </PrimaryButton>
        </GlassCard>
      )}
    </motion.div>
  );
};
