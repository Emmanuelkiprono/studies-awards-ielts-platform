import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { StudentData, UserProfile } from '../types';

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
  signIn: async () => {},
  signUp: async () => {},
  signOut: async () => {},
  resetPassword: async () => {},
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

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);

      if (!firebaseUser) {
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

        return;
      }

      const profileRef = doc(db, 'users', firebaseUser.uid);
      unsubscribeProfile = onSnapshot(profileRef, (profileSnapshot) => {
        if (!profileSnapshot.exists()) {
          setProfile(null);
          setStudentData(null);
          setForcePasswordChange(false);
          setLoading(false);
          return;
        }

        const profileData = profileSnapshot.data() as UserProfile & {
          forcePasswordChange?: boolean;
        };
        setProfile(profileData);
        setForcePasswordChange(Boolean(profileData.forcePasswordChange));

        if (profileData.role !== 'student') {
          setStudentData(null);
          setLoading(false);
          return;
        }

        const studentRef = doc(db, 'students', firebaseUser.uid);
        if (unsubscribeStudent) {
          unsubscribeStudent();
        }

        unsubscribeStudent = onSnapshot(studentRef, (studentSnapshot) => {
          if (studentSnapshot.exists()) {
            setStudentData(studentSnapshot.data() as StudentData);
          } else {
            setStudentData(null);
          }

          setLoading(false);
        });
      });
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) {
        unsubscribeProfile();
      }
      if (unsubscribeStudent) {
        unsubscribeStudent();
      }
    };
  }, []);

  const signIn = async (email: string, pass: string) => {
    await signInWithEmailAndPassword(auth, email, pass);
  };

  const signUp = async (email: string, pass: string, name: string, courseId: string) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
    const newUser = userCredential.user;

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

    const studentRecord: StudentData = {
      uid: newUser.uid,
      trainingPaymentStatus: 'pending',
      trainingStatus: 'inactive',
      examPaymentStatus: 'unpaid',
      examStatus: 'not_eligible',
      preferredLocation: null,
      idUploadUrl: null,
      courseId,
      registrationDate: serverTimestamp(),
      onboardingStatus: 'signup_complete',
      enrollmentCompleted: false,
      accessUnlocked: false,
      lastStatusUpdate: serverTimestamp(),
    };

    await setDoc(
      doc(db, 'students', newUser.uid),
      {
        ...studentRecord,
        createdAt: serverTimestamp(),
      },
      { merge: true }
    );
  };

  const signOut = async () => {
    try {
      const currentEmail = auth.currentUser?.email || user?.email;
      if (currentEmail) {
        localStorage.setItem('lastEmail', currentEmail);
      }

      setUser(null);
      setProfile(null);
      setStudentData(null);
      setForcePasswordChange(false);
      sessionStorage.clear();

      await firebaseSignOut(auth);
    } catch (error) {
      throw error;
    }
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
