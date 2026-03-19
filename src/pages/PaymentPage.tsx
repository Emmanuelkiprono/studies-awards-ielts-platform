import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { GlassCard, PrimaryButton, StatusBadge } from '../components/UI';
import {
  CreditCard,
  Smartphone,
  Building,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Upload,
  FileText,
  Calendar
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { doc, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { PaymentMethod, OnboardingStatus } from '../types';
import { useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';

export const PaymentPage: React.FC = () => {
  const { user, studentData, loading } = useAuth();
  const navigate = useNavigate();

  // Debug: Log when component mounts
  useEffect(() => {
    console.log('PaymentPage mounted');
    console.log('Student data:', studentData);
  }, [studentData]);

  const [paymentData, setPaymentData] = useState({
    amountPaid: 0,
    balance: 0,
    paymentMethod: 'bank_transfer' as PaymentMethod,
    transactionCode: '',
    paymentDate: new Date().toISOString().split('T')[0],
    notes: ''
  });
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (studentData?.breemicEnrollmentId) {
      loadEnrollmentData();
    }
  }, [studentData]);

  const loadEnrollmentData = async () => {
    if (!studentData?.breemicEnrollmentId) return;
    
    try {
      const enrollmentDoc = await getDoc(doc(db, 'breemicEnrollments', studentData.breemicEnrollmentId));
      if (enrollmentDoc.exists()) {
        const enrollment = enrollmentDoc.data();
        setPaymentData(prev => ({
          ...prev,
          balance: enrollment.balance || 0,
          amountPaid: enrollment.feePaid || 0
        }));
      }
    } catch (error) {
      console.error('Error loading enrollment data:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      setError('Please log in to complete payment.');
      return;
    }

    if (paymentData.amountPaid <= 0) {
      setError('Please enter a valid payment amount.');
      return;
    }

    setLoadingSubmit(true);
    setError('');

    try {
      // Update student payment information in both collections
      const paymentInfo = {
        amountPaid: paymentData.amountPaid,
        balance: paymentData.balance,
        paymentMethod: paymentData.paymentMethod,
        transactionCode: paymentData.transactionCode,
        paymentDate: paymentData.paymentDate,
        verifiedBy: 'pending', // Will be verified by admin
        notes: paymentData.notes
      };

      // Preserve approval if already approved
      const existingSnap = await getDoc(doc(db, 'students', user.uid));
      const existingStatus = existingSnap.data()?.onboardingStatus;
      
      const safeStatus = existingStatus === 'approved' ? 'approved' : 'approval_pending';

      // Update users collection
      await updateDoc(doc(db, 'users', user.uid), {
        paymentInfo,
        onboardingStatus: safeStatus as OnboardingStatus,
        lastStatusUpdate: serverTimestamp()
      });

      // Update students collection (primary data source)
      await updateDoc(doc(db, 'students', user.uid), {
        paymentInfo,
        onboardingStatus: safeStatus as OnboardingStatus,
        lastStatusUpdate: serverTimestamp()
      });

      console.log('Payment submitted, status updated to:', safeStatus);

      // Update Breemic enrollment record
      if (studentData?.breemicEnrollmentId) {
        await updateDoc(doc(db, 'breemicEnrollments', studentData.breemicEnrollmentId), {
          feePaid: paymentData.amountPaid,
          balance: paymentData.balance,
          updatedAt: serverTimestamp()
        });
      }

      setSuccess(true);
      
      // Redirect to onboarding dashboard after 3 seconds
      setTimeout(() => {
        navigate('/onboarding', { 
          state: { 
            paymentCompleted: true,
            newStatus: 'approval_pending',
            timestamp: Date.now()
          } 
        });
      }, 3000);

    } catch (error) {
      console.error('Error submitting payment:', error);
      setError('Failed to submit payment. Please try again.');
    } finally {
      setLoadingSubmit(false);
    }
  };

  const paymentMethods = [
    { value: 'bank_transfer', label: 'Bank Transfer', icon: Building },
    { value: 'mobile_money', label: 'Mobile Money', icon: Smartphone },
    { value: 'credit_card', label: 'Credit Card', icon: CreditCard },
    { value: 'cash', label: 'Cash Payment', icon: DollarSign },
    { value: 'other', label: 'Other', icon: FileText }
  ] as const;

  if (loading) {
    return (
      <div className="p-4 max-w-2xl mx-auto w-full">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="w-8 h-8 border-4 border-[rgba(var(--ui-accent-rgb)/0.30)] border-t-[var(--ui-accent)] rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (success) {
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
          <h2 className="text-2xl font-bold text-white mb-4">Payment Submitted Successfully!</h2>
          <p className="text-slate-400 mb-6">
            Your payment has been recorded and is now pending verification. You will be notified once approved.
          </p>
          <StatusBadge status="PAYMENT PENDING VERIFICATION" variant="primary" className="inline-flex" />
        </GlassCard>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 space-y-6 max-w-2xl mx-auto w-full"
    >
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold text-green-500 bg-green-500/20 p-4 rounded-xl border-2 border-green-500">💳 PAYMENT PAGE - TESTING</h1>
        <p className="text-slate-400">Submit your payment details to complete enrollment</p>
      </div>

      {/* Error Message */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center gap-3"
        >
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <span className="text-red-400 text-sm">{error}</span>
        </motion.div>
      )}

      {/* Payment Form */}
      <GlassCard className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Amount Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-400" />
              Payment Amount
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Amount Paid *
                </label>
                <input
                  type="number"
                  className="input-field w-full"
                  placeholder="0.00"
                  value={paymentData.amountPaid}
                  onChange={(e) => setPaymentData(prev => ({ ...prev, amountPaid: Number(e.target.value) }))}
                  min="0"
                  step="0.01"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Balance
                </label>
                <input
                  type="number"
                  className="input-field w-full"
                  placeholder="0.00"
                  value={paymentData.balance}
                  onChange={(e) => setPaymentData(prev => ({ ...prev, balance: Number(e.target.value) }))}
                  min="0"
                  step="0.01"
                />
              </div>
            </div>
          </div>

          {/* Payment Method */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-blue-400" />
              Payment Method *
            </h3>
            
            <div className="grid grid-cols-1 gap-3">
              {paymentMethods.map((method) => (
                <label
                  key={method.value}
                  className="flex items-center gap-3 p-3 rounded-lg border border-[var(--ui-border)] hover:bg-[var(--ui-border)]/50 cursor-pointer transition-colors"
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value={method.value}
                    checked={paymentData.paymentMethod === method.value}
                    onChange={(e) => setPaymentData(prev => ({ ...prev, paymentMethod: e.target.value as PaymentMethod }))}
                    className="w-4 h-4 text-blue-500"
                  />
                  <method.icon className="w-5 h-5 text-[var(--ui-muted)]" />
                  <span className="text-white">{method.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Transaction Details */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-purple-400" />
              Transaction Details
            </h3>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Transaction Code / Reference
                </label>
                <input
                  type="text"
                  className="input-field w-full"
                  placeholder="Enter transaction reference number"
                  value={paymentData.transactionCode}
                  onChange={(e) => setPaymentData(prev => ({ ...prev, transactionCode: e.target.value }))}
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Payment Date *
                </label>
                <input
                  type="date"
                  className="input-field w-full"
                  value={paymentData.paymentDate}
                  onChange={(e) => setPaymentData(prev => ({ ...prev, paymentDate: e.target.value }))}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Notes (Optional)
                </label>
                <textarea
                  className="input-field w-full min-h-[80px]"
                  placeholder="Add any additional payment notes..."
                  value={paymentData.notes}
                  onChange={(e) => setPaymentData(prev => ({ ...prev, notes: e.target.value }))}
                />
              </div>
            </div>
          </div>

          {/* Receipt Upload */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Upload className="w-5 h-5 text-orange-400" />
              Payment Receipt (Optional)
            </h3>
            
            <div className="border-2 border-dashed border-[var(--ui-border)] rounded-xl p-6 text-center">
              <Upload className="w-8 h-8 text-[var(--ui-muted)] mx-auto mb-2" />
              <p className="text-slate-400 text-sm mb-2">
                Upload payment receipt (PDF, JPG, PNG)
              </p>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                className="hidden"
                id="receipt-upload"
              />
              <label
                htmlFor="receipt-upload"
                className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--ui-accent)]/10 text-[var(--ui-accent)] rounded-lg cursor-pointer hover:bg-[var(--ui-accent)]/20 transition-colors"
              >
                <Upload className="w-4 h-4" />
                Choose File
              </label>
              {receiptFile && (
                <p className="text-green-400 text-sm mt-2">
                  Selected: {receiptFile.name}
                </p>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-center pt-6">
            <PrimaryButton
              type="submit"
              disabled={loadingSubmit}
              className="px-8 py-4 text-lg font-bold min-w-[200px]"
            >
              {loadingSubmit ? (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Submitting...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  Submit Payment
                </div>
              )}
            </PrimaryButton>
          </div>
        </form>
      </GlassCard>

      {/* Payment Instructions */}
      <GlassCard className="p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Payment Instructions</h3>
        <div className="space-y-3 text-sm text-slate-400">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-bold">1</div>
            <p>Choose your preferred payment method from the options above</p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-bold">2</div>
            <p>Complete the payment using your selected method</p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-bold">3</div>
            <p>Fill in the transaction details and upload receipt if available</p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-bold">4</div>
            <p>Submit for verification and wait for approval</p>
          </div>
        </div>
      </GlassCard>
    </motion.div>
  );
};
