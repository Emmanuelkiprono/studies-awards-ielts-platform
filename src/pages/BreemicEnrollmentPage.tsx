import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, BookOpen, GraduationCap, Phone, Save, User } from 'lucide-react';
import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { FileUpload } from '../components/FileUpload';
import { useAuth } from '../hooks/useAuth';
import { db } from '../services/firebase';
import { NotificationService } from '../services/notificationService';
import { BreemicEnrollment, Course } from '../types';

interface EnrollmentFormState {
  name: string;
  phone: string;
  courseId: string;
  mode: NonNullable<BreemicEnrollment['modeOfTraining']>;
  education: string;
  supportingDocumentUrl: string;
  supportingDocumentName: string;
}

interface FormErrors {
  [key: string]: string;
}

interface CourseOption {
  id: string;
  name: string;
}

export const BreemicEnrollmentPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile, studentData } = useAuth();
  const [loading, setLoading] = useState(false);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [submitError, setSubmitError] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [courses, setCourses] = useState<Course[]>([]);
  const [formData, setFormData] = useState<EnrollmentFormState>({
    name: '',
    phone: '',
    courseId: '',
    mode: 'online',
    education: '',
    supportingDocumentUrl: '',
    supportingDocumentName: '',
  });

  useEffect(() => {
    setFormData((currentForm) => ({
      ...currentForm,
      name: profile?.name || currentForm.name,
      phone: studentData?.phone || profile?.phone || currentForm.phone,
      courseId: studentData?.courseId || currentForm.courseId,
    }));
  }, [profile?.name, profile?.phone, studentData?.courseId, studentData?.phone]);

  useEffect(() => {
    const loadCourses = async () => {
      setLoadingCourses(true);

      try {
        const coursesQuery = query(collection(db, 'courses'), where('active', '==', true));
        const snapshot = await getDocs(coursesQuery);
        const activeCourses = snapshot.docs.map(
          (courseDoc) => ({ id: courseDoc.id, ...courseDoc.data() }) as Course
        );
        setCourses(activeCourses);
      } catch (error) {
        console.error('Error loading enrollment courses:', error);
      } finally {
        setLoadingCourses(false);
      }
    };

    void loadCourses();
  }, []);

  const courseOptions = useMemo<CourseOption[]>(() => {
    const nextOptions = courses.map((course) => ({
      id: course.id,
      name: course.name,
    }));

    if (
      studentData?.courseId &&
      !nextOptions.some((courseOption) => courseOption.id === studentData.courseId)
    ) {
      nextOptions.unshift({
        id: studentData.courseId,
        name: 'Selected Course',
      });
    }

    return nextOptions;
  }, [courses, studentData?.courseId]);

  useEffect(() => {
    if (formData.courseId || courseOptions.length === 0) {
      return;
    }

    setFormData((currentForm) => ({
      ...currentForm,
      courseId: currentForm.courseId || courseOptions[0].id,
    }));
  }, [courseOptions, formData.courseId]);

  const handleFieldChange = (field: keyof EnrollmentFormState, value: string) => {
    setFormData((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));

    if (errors[field]) {
      setErrors((currentErrors) => ({
        ...currentErrors,
        [field]: '',
      }));
    }
  };

  const validateForm = () => {
    const nextErrors: FormErrors = {};

    if (!formData.name.trim()) {
      nextErrors.name = 'Name is required';
    }

    if (!formData.phone.trim()) {
      nextErrors.phone = 'Phone is required';
    }

    if (!formData.courseId.trim()) {
      nextErrors.courseId = 'Course is required';
    }

    if (!formData.mode.trim()) {
      nextErrors.mode = 'Mode is required';
    }

    if (!formData.education.trim()) {
      nextErrors.education = 'Education is required';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitError('');

    if (!validateForm()) {
      return;
    }

    if (!user) {
      setSubmitError('Please sign in before submitting your enrollment.');
      return;
    }

    setLoading(true);

    try {
      const selectedCourse = courseOptions.find((courseOption) => courseOption.id === formData.courseId);

      const enrollmentPayload: Omit<BreemicEnrollment, 'id'> = {
        userId: user.uid,
        courseId: formData.courseId,
        courseName: selectedCourse?.name,
        fullName: formData.name.trim(),
        email: (profile?.email || user.email || '').toLowerCase(),
        contact: formData.phone.trim(),
        dateOfEnrollment: new Date().toISOString().slice(0, 10),
        modeOfTraining: formData.mode,
        highestLevelOfEducation: formData.education.trim(),
        supportingDocumentUrl: formData.supportingDocumentUrl || undefined,
        supportingDocumentName: formData.supportingDocumentName || undefined,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        status: 'pending',
      };

      const enrollmentRef = await addDoc(collection(db, 'breemicEnrollments'), enrollmentPayload);

      await setDoc(
        doc(db, 'students', user.uid),
        {
          phone: formData.phone.trim(),
          courseId: formData.courseId,
          idUploadUrl: formData.supportingDocumentUrl || null,
          onboardingStatus: 'enrollment_submitted',
          enrollmentCompleted: true,
          breemicEnrollmentId: enrollmentRef.id,
          accessUnlocked: false,
          trainingStatus: 'inactive',
          lastStatusUpdate: serverTimestamp(),
        },
        { merge: true }
      );

      await setDoc(
        doc(db, 'users', user.uid),
        {
          name: formData.name.trim(),
          phone: formData.phone.trim(),
          onboardingStatus: 'enrollment_submitted',
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      const teacherQuery = query(
        collection(db, 'users'),
        where('role', '==', 'teacher'),
        where('assignedCourseId', '==', formData.courseId)
      );
      const teacherSnapshot = await getDocs(teacherQuery);

      await Promise.all(
        teacherSnapshot.docs.map((teacherDoc) =>
          NotificationService.create(
            teacherDoc.id,
            'Enrollment Submitted',
            `${formData.name.trim()} is waiting for approval.`,
            'info',
            '/teacher/approvals'
          )
        )
      );

      navigate('/pending-approval', { replace: true });
    } catch (error) {
      console.error('Error submitting enrollment:', error);
      setSubmitError('Failed to submit enrollment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputClassName =
    'w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-black outline-none transition-colors focus:border-purple-500';

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <h1 className="text-3xl font-semibold tracking-tight text-black">Enrollment</h1>
          <p className="mt-2 text-sm text-gray-700">
            Complete this form to submit your enrollment for teacher approval.
          </p>
          {profile?.email && (
            <p className="mt-3 text-xs font-medium uppercase tracking-[0.16em] text-gray-500">
              Signed in as {profile.email}
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
                <User size={16} />
                Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(event) => handleFieldChange('name', event.target.value)}
                className={inputClassName}
                placeholder="Enter your full name"
              />
              {errors.name && <p className="mt-2 text-xs text-red-600">{errors.name}</p>}
            </div>

            <div>
              <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
                <Phone size={16} />
                Phone
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(event) => handleFieldChange('phone', event.target.value)}
                className={inputClassName}
                placeholder="Enter your phone number"
              />
              {errors.phone && <p className="mt-2 text-xs text-red-600">{errors.phone}</p>}
            </div>

            <div>
              <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
                <BookOpen size={16} />
                Course
              </label>
              <select
                value={formData.courseId}
                onChange={(event) => handleFieldChange('courseId', event.target.value)}
                className={inputClassName}
                disabled={loadingCourses}
              >
                <option value="">
                  {loadingCourses ? 'Loading courses...' : 'Select course'}
                </option>
                {courseOptions.map((courseOption) => (
                  <option key={courseOption.id} value={courseOption.id}>
                    {courseOption.name}
                  </option>
                ))}
              </select>
              {errors.courseId && <p className="mt-2 text-xs text-red-600">{errors.courseId}</p>}
            </div>

            <div>
              <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
                <BookOpen size={16} />
                Mode
              </label>
              <select
                value={formData.mode}
                onChange={(event) =>
                  handleFieldChange('mode', event.target.value as EnrollmentFormState['mode'])
                }
                className={inputClassName}
              >
                <option value="online">Online</option>
                <option value="in-person">In Person</option>
              </select>
              {errors.mode && <p className="mt-2 text-xs text-red-600">{errors.mode}</p>}
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
                <GraduationCap size={16} />
                Education
              </label>
              <input
                type="text"
                value={formData.education}
                onChange={(event) => handleFieldChange('education', event.target.value)}
                className={inputClassName}
                placeholder="Example: Bachelor's Degree"
              />
              {errors.education && <p className="mt-2 text-xs text-red-600">{errors.education}</p>}
            </div>

            <div className="md:col-span-2">
              <FileUpload
                folder={user ? `enrollments/${user.uid}` : 'enrollments'}
                label="Optional Upload"
                appearance="light"
                value={formData.supportingDocumentUrl}
                fileName={formData.supportingDocumentName}
                onUploaded={(url, fileName) => {
                  setFormData((currentForm) => ({
                    ...currentForm,
                    supportingDocumentUrl: url,
                    supportingDocumentName: fileName,
                  }));
                }}
                onClear={() => {
                  setFormData((currentForm) => ({
                    ...currentForm,
                    supportingDocumentUrl: '',
                    supportingDocumentName: '',
                  }));
                }}
              />
              <p className="mt-2 text-xs text-gray-500">
                Upload an optional ID, transcript, or supporting document.
              </p>
            </div>
          </div>

          {submitError && (
            <div className="mt-5 flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-2xl bg-purple-600 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save size={16} />
              {loading ? 'Submitting...' : 'Submit Enrollment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
