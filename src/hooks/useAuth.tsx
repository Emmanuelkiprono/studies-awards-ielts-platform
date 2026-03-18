import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail
} from 'firebase/auth';
import { doc, getDoc, onSnapshot, setDoc, serverTimestamp, query, where, getDocs, collection } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { UserProfile, StudentData, UserRole } from '../types';
import { NotificationService } from '../services/notificationService';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  studentData: StudentData | null;
  loading: boolean;
  forcePasswordChange: boolean;
  isAdmin: boolean;
  isTeacher: boolean;
  signIn: (email: string, pass: string) => Promise<void>;
  signUp: (email: string, pass: string, name: string, courseId: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  studentData: null,
  loading: true,
  forcePasswordChange: false,
  isAdmin: false,
  isTeacher: false,
  signIn: async () => { },
  signUp: async () => { },
  signOut: async () => { },
  resetPassword: async () => { },
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [studentData, setStudentData] = useState<StudentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [forcePasswordChange, setForcePasswordChange] = useState(false);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | undefined;
    let unsubscribeStudent: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        // Fetch profile
        const profileRef = doc(db, 'users', firebaseUser.uid);

        // Use onSnapshot for real-time profile updates
        unsubscribeProfile = onSnapshot(profileRef, (docSnap) => {
          if (docSnap.exists()) {
            const profileData = docSnap.data() as UserProfile & { forcePasswordChange?: boolean };
            setProfile(profileData);
            setForcePasswordChange(!!profileData.forcePasswordChange);

            // If student, fetch student data
            if (profileData.role === 'student') {
              const studentRef = doc(db, 'students', firebaseUser.uid);
              if (unsubscribeStudent) unsubscribeStudent(); // Clean up previous if it exists
              unsubscribeStudent = onSnapshot(studentRef, (sDoc) => {
                console.log('🔍 USEAUTH: Students collection snapshot triggered for UID:', firebaseUser.uid);
                if (sDoc.exists()) {
                  const data = sDoc.data() as StudentData;
                  console.log('🔍 USEAUTH: Student data received from students collection:', {
                    uid: data.uid,
                    onboardingStatus: data.onboardingStatus,
                    hasPaymentInfo: !!data.paymentInfo,
                    paymentAmount: data.paymentInfo?.amountPaid,
                    breemicEnrollmentId: data.breemicEnrollmentId,
                    lastStatusUpdate: data.lastStatusUpdate?.toDate()?.toISOString(),
                    timestamp: new Date().toISOString()
                  });
                  
                  // CRITICAL: Check if this is the expected status after enrollment
                  if (data.onboardingStatus === 'payment_pending') {
                    console.log('✅ USEAUTH: Student has payment_pending status - dashboard should show payment step');
                  } else if (data.onboardingStatus === 'account_created') {
                    console.log('🔍 USEAUTH: Student still has account_created status - enrollment update may have failed');
                  }
                  
                  setStudentData(data);
                } else {
                  console.log('❌ USEAUTH: No student document found for UID:', firebaseUser.uid);
                  console.log('❌ USEAUTH: This means the student document was never created or was deleted');
                }
              });
            }
          } else {
            setProfile(null);
            setForcePasswordChange(false);
          }
          // Fix: Ensure setLoading(false) gets called!
          setLoading(false);
        });
      } else {
        setProfile(null);
        setStudentData(null);
        setForcePasswordChange(false);
        setLoading(false);
        if (unsubscribeProfile) {
          unsubscribeProfile();
          unsubscribeProfile = undefined;
        }
        if (unsubscribeStudent) {
          unsubscribeStudent();
          unsubscribeStudent = undefined;
        }
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
      if (unsubscribeStudent) unsubscribeStudent();
    };
  }, []);

  const signIn = async (email: string, pass: string) => {
    await signInWithEmailAndPassword(auth, email, pass);
  };

  const signUp = async (email: string, pass: string, name: string, courseId: string) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
    const newUser = userCredential.user;

    const now = new Date();
    const eligibleAtIso = new Date(now.getTime() + 28 * 24 * 60 * 60 * 1000).toISOString();

    // Create user profile
    const profileData: UserProfile = {
      uid: newUser.uid,
      name,
      email: email.toLowerCase(),
      role: 'student',
      academyId: 'studies_awards',
      createdAt: serverTimestamp(),
      fcmToken: null,
    };

    await setDoc(doc(db, 'users', newUser.uid), profileData);

    // Create student data
    const sData: StudentData = {
      uid: newUser.uid,
      trainingPaymentStatus: 'pending',
      trainingStatus: 'locked',
      examPaymentStatus: 'unpaid',
      examStatus: 'not_eligible',
      preferredLocation: null,
      idUploadUrl: null,
      courseId: courseId,
      registrationDate: serverTimestamp(),
      eligibleExamDate: eligibleAtIso,
      // Breemic International approval workflow fields
      onboardingStatus: 'account_created',
      lastStatusUpdate: serverTimestamp(),
    };

    await setDoc(doc(db, 'students', newUser.uid), {
      ...sData,
      createdAt: serverTimestamp()
    });

    // Create enrollment record
    await setDoc(doc(db, 'enrollments', `${newUser.uid}_${courseId}`), {
      userId: newUser.uid,
      courseId: courseId,
      trainingStatus: "locked",
      paymentStatus: "pending",
      examStatus: "not_eligible",
      registeredAt: serverTimestamp(),
      registrationDate: serverTimestamp(),
      eligibleAt: eligibleAtIso,
      eligibleExamDate: eligibleAtIso,
      programWeeks: 4,
      createdAt: serverTimestamp()
    });

    // Notify teacher
    const teachersQ = query(collection(db, 'users'), where('role', '==', 'teacher'), where('assignedCourseId', '==', courseId));
    const teachersSnap = await getDocs(teachersQ);
    for (const teacherDoc of teachersSnap.docs) {
      await NotificationService.create(
        teacherDoc.id,
        'New Student Enrollment',
        `${name} has enrolled in your course.`,
        'info',
        '/students'
      );
    }
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const value = {
    user,
    profile,
    studentData,
    loading,
    forcePasswordChange,
    isAdmin: profile?.role === 'admin',
    isTeacher: profile?.role === 'teacher' || profile?.role === 'admin',
    signIn,
    signUp,
    signOut,
    resetPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
