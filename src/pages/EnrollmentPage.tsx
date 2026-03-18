import React, { useState } from 'react';
import { GlassCard, PrimaryButton, StatusBadge } from '../components/UI';
import {
  CheckCircle2,
  ShieldCheck,
  Zap,
  Trophy,
  ArrowRight
} from 'lucide-react';
import { motion } from 'motion/react';
import { doc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { NotificationService } from '../services/notificationService';
import { db } from '../services/firebase';
import { useAuth } from '../hooks/useAuth';
import { cn } from '../lib/utils';
import { Link } from 'react-router-dom';

export const EnrollmentPage: React.FC<{ onEnrolled: () => void }> = ({ onEnrolled }) => {
  const { user } = useAuth();
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const packages = [
    {
      id: 'basic',
      name: 'Standard Training',
      price: 'KSh 25,000',
      features: ['40+ Live Classes', '10 Mock Tests', 'Study Materials', 'Community Support'],
      popular: false
    },
    {
      id: 'premium',
      name: 'Premium Intensive',
      price: 'KSh 45,000',
      features: ['Unlimited Live Classes', '25 Mock Tests', '1-on-1 Speaking Drills', 'Personalized Feedback', 'Exam Booking Assistance'],
      popular: true
    },
    {
      id: 'crash',
      name: '2-Week Crash Course',
      price: 'KSh 18,000',
      features: ['Daily Intensive Sessions', '5 Mock Tests', 'Key Strategies Only', '24/7 Support'],
      popular: false
    }
  ];

  const [location, setLocation] = useState({ country: '', city: '', centerPreference: '' });

  const handleEnroll = async () => {
    if (!selectedPackage || !user) return;
    if (!location.country || !location.city) {
      alert("Please fill in your country and city.");
      return;
    }

    setLoading(true);
    try {
      const studentRef = doc(db, 'students', user.uid);
      await updateDoc(studentRef, {
        trainingPaymentStatus: 'pending',
        trainingStatus: 'locked',
        examStatus: 'not_eligible',
      });

      // Update enrollment with location
      const enrollmentsQ = query(collection(db, 'enrollments'), where('userId', '==', user.uid));
      const enrollSnap = await getDocs(enrollmentsQ);
      let courseId: string | undefined;
      if (!enrollSnap.empty) {
        const enrollDoc = enrollSnap.docs[0];
        courseId = enrollDoc.data().courseId;
        await updateDoc(doc(db, 'enrollments', enrollDoc.id), {
          location,
          paymentStatus: 'pending',
          examFeeStatus: 'unpaid',
          examStatus: 'not_eligible',
          programWeeks: 4,
        });
      }

      // Notify teachers assigned to the course
      if (courseId) {
        const teachersSnap = await getDocs(query(
          collection(db, 'users'),
          where('role', '==', 'teacher'),
          where('assignedCourseId', '==', courseId)
        ));
        await Promise.all(teachersSnap.docs.map(t =>
          NotificationService.create(
            t.id,
            'New Enrollment Request',
            `A new student has submitted payment for your course. Review in Student Approvals.`,
            'info',
            '/teacher/approvals'
          )
        ));
      }

      onEnrolled();
    } catch (error) {
      console.error("Enrollment error:", error);
      alert("Failed to enroll. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="p-4 space-y-8 max-w-4xl mx-auto w-full pb-24"
    >
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold text-white">Complete Your Enrollment</h2>
        <p className="text-slate-400">Provide your details to unlock your intensive training.</p>
        
        {/* Breemic Enrollment Link */}
        <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl">
          <p className="text-blue-400 text-sm mb-2">🎓 New to Breemic International?</p>
          <Link 
            to="/breemic-enrollment"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
          >
            Complete Full Enrollment Form
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left Col: Location Info */}
        <div className="space-y-6">
          <GlassCard className="p-6 space-y-6">
            <h3 className="text-xl font-bold text-white border-b border-white/5 pb-4">Exam Location Preference</h3>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase px-1">Country</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Nigeria, Ghana, etc."
                  value={location.country}
                  onChange={(e) => setLocation(prev => ({ ...prev, country: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase px-1">City / Town</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Lagos, Abuja"
                  value={location.city}
                  onChange={(e) => setLocation(prev => ({ ...prev, city: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase px-1">Preferred Exam Center (Optional)</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. British Council Victoria Island"
                  value={location.centerPreference}
                  onChange={(e) => setLocation(prev => ({ ...prev, centerPreference: e.target.value }))}
                />
              </div>
            </div>
          </GlassCard>
        </div>

        {/* Right Col: Packages */}
        <div className="flex flex-col gap-4">
          <h3 className="text-sm font-bold text-slate-500 uppercase px-1">Select A Plan</h3>
          <div className="space-y-4">
            {packages.map((pkg) => (
              <div
                key={pkg.id}
                onClick={() => setSelectedPackage(pkg.id)}
                className={cn(
                  "glass-card p-5 flex flex-col gap-4 cursor-pointer transition-all relative",
                  selectedPackage === pkg.id ? "border-[#6324eb] ring-2 ring-[#6324eb]/20" : "hover:border-white/10 opacity-70",
                  pkg.popular && "border-[#3b82f6]/30"
                )}
              >
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-bold text-white">{pkg.name}</h3>
                  <p className="text-xl font-black text-[#6324eb]">{pkg.price}</p>
                </div>
                <ul className="grid grid-cols-2 gap-2">
                  {pkg.features.slice(0, 4).map((feat, i) => (
                    <li key={i} className="flex items-center gap-2 text-[10px] text-slate-400">
                      <CheckCircle2 size={10} className="text-emerald-400 shrink-0" />
                      {feat}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto">
        <PrimaryButton
          className="w-full py-4"
          disabled={!selectedPackage}
          loading={loading}
          onClick={handleEnroll}
        >
          Enroll Now & Start Training <ArrowRight size={20} />
        </PrimaryButton>
        <p className="text-center text-slate-500 text-xs mt-4 flex items-center justify-center gap-1">
          <ShieldCheck size={12} /> Secure payment powered by Stripe
        </p>
      </div>
    </motion.div>
  );
};
