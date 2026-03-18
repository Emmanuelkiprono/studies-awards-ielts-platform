import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { GlassCard } from '../components/UI';

export const DebugTest: React.FC = () => {
  const { user, studentData, loading } = useAuth();
  const [testResults, setTestResults] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const addResult = (message: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const testFirebaseConnection = async () => {
    if (!user) {
      addResult('❌ No user logged in');
      return;
    }

    setIsLoading(true);
    addResult('🔄 Starting Firebase connection test...');

    try {
      // Test 1: Check if student document exists
      addResult(`📋 Testing student document for UID: ${user.uid}`);
      const studentRef = doc(db, 'students', user.uid);
      const studentDoc = await getDoc(studentRef);
      
      if (studentDoc.exists()) {
        addResult('✅ Student document exists');
        const data = studentDoc.data();
        addResult(`📊 Onboarding Status: ${data.onboardingStatus || 'NOT_SET'}`);
        addResult(`💳 Payment Info: ${data.paymentInfo ? 'EXISTS' : 'MISSING'}`);
        addResult(`📅 Last Update: ${data.lastStatusUpdate?.toDate()?.toLocaleString() || 'NEVER'}`);
        
        // Test 2: Try to update status
        addResult('🔄 Testing status update...');
        await updateDoc(studentRef, {
          testField: `test_${Date.now()}`,
          lastStatusUpdate: serverTimestamp()
        });
        addResult('✅ Status update successful');
        
      } else {
        addResult('❌ Student document does NOT exist');
        
        // Test 3: Try to create student document
        addResult('🔄 Creating student document...');
        await updateDoc(studentRef, {
          uid: user.uid,
          onboardingStatus: 'account_created',
          lastStatusUpdate: serverTimestamp(),
          trainingPaymentStatus: 'pending',
          trainingStatus: 'locked',
          examPaymentStatus: 'unpaid',
          examStatus: 'not_eligible',
          preferredLocation: null,
          idUploadUrl: null,
        });
        addResult('✅ Student document created');
      }
      
    } catch (error) {
      addResult(`❌ Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const testManualStatusUpdate = async () => {
    if (!user) {
      addResult('❌ No user logged in');
      return;
    }

    setIsLoading(true);
    addResult('🔄 Testing manual status update...');

    try {
      const studentRef = doc(db, 'students', user.uid);
      await updateDoc(studentRef, {
        onboardingStatus: 'payment_pending',
        lastStatusUpdate: serverTimestamp(),
        paymentInfo: {
          amountPaid: 100,
          balance: 0,
          paymentMethod: 'test',
          paymentDate: new Date().toISOString()
        }
      });
      addResult('✅ Manual status update to payment_pending');
      
    } catch (error) {
      addResult(`❌ Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-4 max-w-2xl mx-auto w-full">
      <GlassCard className="p-6">
        <h2 className="text-2xl font-bold text-white mb-6">Firebase Debug Test</h2>
        
        <div className="space-y-4 mb-6">
          <div className="text-sm text-slate-300">
            <div>User UID: {user?.uid || 'NOT_LOGGED_IN'}</div>
            <div>Loading: {loading ? 'YES' : 'NO'}</div>
            <div>Student Data: {studentData ? 'EXISTS' : 'MISSING'}</div>
            <div>Current Status: {studentData?.onboardingStatus || 'UNKNOWN'}</div>
          </div>
        </div>

        <div className="flex gap-4 mb-6">
          <button
            onClick={testFirebaseConnection}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {isLoading ? 'Testing...' : 'Test Firebase Connection'}
          </button>
          
          <button
            onClick={testManualStatusUpdate}
            disabled={isLoading}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
          >
            {isLoading ? 'Updating...' : 'Force Status Update'}
          </button>
        </div>

        <div className="bg-slate-800 rounded-lg p-4 max-h-96 overflow-y-auto">
          <h3 className="text-lg font-semibold text-white mb-3">Test Results:</h3>
          {testResults.length === 0 ? (
            <div className="text-slate-400 text-sm">No tests run yet</div>
          ) : (
            <div className="space-y-1">
              {testResults.map((result, index) => (
                <div key={index} className="text-xs text-slate-300 font-mono">
                  {result}
                </div>
              ))}
            </div>
          )}
        </div>
      </GlassCard>
    </div>
  );
};
