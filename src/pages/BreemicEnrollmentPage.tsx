import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  Calendar,
  CreditCard,
  DollarSign,
  GraduationCap,
  Mail,
  MapPin,
  Phone,
  Save,
  User,
} from 'lucide-react';
import {
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
  email: string;
  contact: string;
  dateOfEnrollment: string;
  courseDuration: string;
  expectedDateOfCompletion: string;
  mode: NonNullable<BreemicEnrollment['modeOfTraining']>;
  physicalAddress: string;
  idPassport: string;
  education: string;
  courseType: NonNullable<BreemicEnrollment['courseType']>;
  feePaid: string;
  balance: string;
  officerInCharge: string;
  courseId: string;
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
    email: '',
    contact: '',
    dateOfEnrollment: new Date().toISOString().slice(0, 10),
    courseDuration: '',
    expectedDateOfCompletion: '',
    mode: 'online',
    physicalAddress: '',
    idPassport: '',
    education: '',
    courseType: 'IELTS',
    feePaid: '0',
    balance: '0',
    officerInCharge: 'Pending assignment',
    courseId: '',
    supportingDocumentUrl: '',
    supportingDocumentName: '',
  });

  useEffect(() => {
    setFormData((currentForm) => ({
      ...currentForm,
      name: profile?.name || currentForm.name,
      email: profile?.email || currentForm.email,
      contact: studentData?.phone || profile?.phone || currentForm.contact,
      courseId: studentData?.courseId || currentForm.courseId,
    }));
  }, [profile?.email, profile?.name, profile?.phone, studentData?.courseId, studentData?.phone]);

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

    if (!formData.email.trim()) {
      nextErrors.email = 'Email is required';
    } else if (!formData.email.includes('@')) {
      nextErrors.email = 'Enter a valid email address';
    }

    if (!formData.contact.trim()) {
      nextErrors.contact = 'Contact is required';
    }

    if (!formData.dateOfEnrollment.trim()) {
      nextErrors.dateOfEnrollment = 'Date of enrollment is required';
    }

    if (!formData.courseDuration.trim()) {
      nextErrors.courseDuration = 'Course duration is required';
    }

    if (!formData.expectedDateOfCompletion.trim()) {
      nextErrors.expectedDateOfCompletion = 'Expected completion date is required';
    }

    if (!formData.courseId.trim()) {
      nextErrors.courseId = 'Course is required';
    }

    if (!formData.mode.trim()) {
      nextErrors.mode = 'Mode is required';
    }

    if (!formData.physicalAddress.trim()) {
      nextErrors.physicalAddress = 'Physical address is required';
    }

    if (!formData.idPassport.trim()) {
      nextErrors.idPassport = 'ID/Passport is required';
    }

    if (!formData.education.trim()) {
      nextErrors.education = 'Education is required';
    }

    if (!formData.courseType?.trim()) {
      nextErrors.courseType = 'Course type is required';
    }

    if (formData.feePaid.trim() === '' || Number.isNaN(Number(formData.feePaid))) {
      nextErrors.feePaid = 'Fee paid must be a valid number';
    }

    if (formData.balance.trim() === '' || Number.isNaN(Number(formData.balance))) {
      nextErrors.balance = 'Balance must be a valid number';
    }

    if (!formData.officerInCharge.trim()) {
      nextErrors.officerInCharge = 'Officer in charge is required';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const getEnrollmentErrorMessage = (error: unknown) => {
    if (typeof error === 'object' && error !== null) {
      const firebaseError = error as { code?: unknown; message?: unknown };
      if (firebaseError.code || firebaseError.message) {
        return `${String(firebaseError.code || 'error')}: ${String(firebaseError.message || 'Unknown error')}`;
      }
    }

    if (error instanceof Error) {
      return error.message;
    }

    return 'Unknown enrollment error';
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
      console.log('ENROLLMENT SUBMIT START');
      console.log('CURRENT USER:', user?.uid);

      const selectedCourse = courseOptions.find((courseOption) => courseOption.id === formData.courseId);
      const enrollmentRef = doc(db, 'breemicEnrollments', user.uid);

      const enrollmentPayload: Omit<BreemicEnrollment, 'id'> = {
        studentUid: user.uid,
        userId: user.uid,
        courseId: formData.courseId,
        courseName: selectedCourse?.name,
        fullName: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        contact: formData.contact.trim(),
        dateOfEnrollment: formData.dateOfEnrollment,
        courseDuration: formData.courseDuration.trim(),
        expectedDateOfCompletion: formData.expectedDateOfCompletion,
        modeOfTraining: formData.mode,
        physicalAddress: formData.physicalAddress.trim(),
        idPassport: formData.idPassport.trim(),
        highestLevelOfEducation: formData.education.trim(),
        courseType: formData.courseType,
        feePaid: Number(formData.feePaid),
        balance: Number(formData.balance),
        officerInCharge: formData.officerInCharge.trim(),
        supportingDocumentUrl: formData.supportingDocumentUrl || undefined,
        supportingDocumentName: formData.supportingDocumentName || undefined,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        status: 'enrollment_submitted',
      };

      console.log('ENROLLMENT PAYLOAD:', enrollmentPayload);

      await setDoc(enrollmentRef, enrollmentPayload, { merge: true });

      await setDoc(
        doc(db, 'students', user.uid),
        {
          name: formData.name.trim(),
          email: formData.email.trim().toLowerCase(),
          phone: formData.contact.trim(),
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
          phone: formData.contact.trim(),
          onboardingStatus: 'enrollment_submitted',
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      try {
        const teacherQuery = query(collection(db, 'users'), where('role', '==', 'teacher'));
        const teacherSnapshot = await getDocs(teacherQuery);
        const matchingTeachers = teacherSnapshot.docs.filter(
          (teacherDoc) => teacherDoc.data().assignedCourseId === formData.courseId
        );

        await Promise.all(
          matchingTeachers.map((teacherDoc) =>
            NotificationService.create(
              teacherDoc.id,
              'Enrollment Submitted',
              `${formData.name.trim()} is waiting for approval.`,
              'info',
              '/teacher/approvals'
            )
          )
        );
      } catch (notificationError) {
        console.error('ENROLLMENT NOTIFICATION ERROR:', notificationError);
      }

      navigate('/pending-approval', { replace: true });
    } catch (error) {
      console.error('ENROLLMENT SUBMIT ERROR:', error);
      setSubmitError(getEnrollmentErrorMessage(error));
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
                <Mail size={16} />
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(event) => handleFieldChange('email', event.target.value)}
                className={inputClassName}
                placeholder="Enter your email address"
              />
              {errors.email && <p className="mt-2 text-xs text-red-600">{errors.email}</p>}
            </div>

            <div>
              <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
                <Phone size={16} />
                Contact
              </label>
              <input
                type="tel"
                value={formData.contact}
                onChange={(event) => handleFieldChange('contact', event.target.value)}
                className={inputClassName}
                placeholder="Enter your contact number"
              />
              {errors.contact && <p className="mt-2 text-xs text-red-600">{errors.contact}</p>}
            </div>

            <div>
              <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
                <Calendar size={16} />
                Date of Enrollment
              </label>
              <input
                type="date"
                value={formData.dateOfEnrollment}
                onChange={(event) => handleFieldChange('dateOfEnrollment', event.target.value)}
                className={inputClassName}
              />
              {errors.dateOfEnrollment && (
                <p className="mt-2 text-xs text-red-600">{errors.dateOfEnrollment}</p>
              )}
            </div>

            <div>
              <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
                <BookOpen size={16} />
                Course Duration
              </label>
              <input
                type="text"
                value={formData.courseDuration}
                onChange={(event) => handleFieldChange('courseDuration', event.target.value)}
                className={inputClassName}
                placeholder="Example: 12 weeks"
              />
              {errors.courseDuration && (
                <p className="mt-2 text-xs text-red-600">{errors.courseDuration}</p>
              )}
            </div>

            <div>
              <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
                <Calendar size={16} />
                Expected Date of Completion
              </label>
              <input
                type="date"
                value={formData.expectedDateOfCompletion}
                onChange={(event) =>
                  handleFieldChange('expectedDateOfCompletion', event.target.value)
                }
                className={inputClassName}
              />
              {errors.expectedDateOfCompletion && (
                <p className="mt-2 text-xs text-red-600">{errors.expectedDateOfCompletion}</p>
              )}
            </div>

            <div>
              <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
                <BookOpen size={16} />
                Mode of Training
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
                <MapPin size={16} />
                Physical Address
              </label>
              <textarea
                value={formData.physicalAddress}
                onChange={(event) => handleFieldChange('physicalAddress', event.target.value)}
                className={`${inputClassName} min-h-[110px]`}
                placeholder="Enter your physical address"
              />
              {errors.physicalAddress && (
                <p className="mt-2 text-xs text-red-600">{errors.physicalAddress}</p>
              )}
            </div>

            <div>
              <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
                <CreditCard size={16} />
                ID / Passport
              </label>
              <input
                type="text"
                value={formData.idPassport}
                onChange={(event) => handleFieldChange('idPassport', event.target.value)}
                className={inputClassName}
                placeholder="Enter ID or passport number"
              />
              {errors.idPassport && <p className="mt-2 text-xs text-red-600">{errors.idPassport}</p>}
            </div>

            <div>
              <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
                <GraduationCap size={16} />
                Highest Level of Education
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

            <div>
              <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
                <BookOpen size={16} />
                Course Type
              </label>
              <select
                value={formData.courseType}
                onChange={(event) =>
                  handleFieldChange(
                    'courseType',
                    event.target.value as EnrollmentFormState['courseType']
                  )
                }
                className={inputClassName}
              >
                <option value="IELTS">IELTS</option>
                <option value="TOEFL">TOEFL</option>
                <option value="PTE">PTE</option>
                <option value="SAT">SAT</option>
                <option value="TOEIC">TOEIC</option>
                <option value="German">German</option>
                <option value="French">French</option>
                <option value="Chinese">Chinese</option>
              </select>
              {errors.courseType && <p className="mt-2 text-xs text-red-600">{errors.courseType}</p>}
            </div>

            <div>
              <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
                <DollarSign size={16} />
                Fee Paid
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.feePaid}
                onChange={(event) => handleFieldChange('feePaid', event.target.value)}
                className={inputClassName}
                placeholder="0.00"
              />
              {errors.feePaid && <p className="mt-2 text-xs text-red-600">{errors.feePaid}</p>}
            </div>

            <div>
              <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
                <DollarSign size={16} />
                Balance
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.balance}
                onChange={(event) => handleFieldChange('balance', event.target.value)}
                className={inputClassName}
                placeholder="0.00"
              />
              {errors.balance && <p className="mt-2 text-xs text-red-600">{errors.balance}</p>}
            </div>

            <div>
              <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
                <User size={16} />
                Officer in Charge
              </label>
              <input
                type="text"
                value={formData.officerInCharge}
                onChange={(event) => handleFieldChange('officerInCharge', event.target.value)}
                className={inputClassName}
                placeholder="Enter officer in charge"
              />
              {errors.officerInCharge && (
                <p className="mt-2 text-xs text-red-600">{errors.officerInCharge}</p>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
                <BookOpen size={16} />
                Internal Course
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

            <div className="md:col-span-2">
              <FileUpload
                folder={user ? `enrollments/${user.uid}` : 'enrollments'}
                label="Optional Upload"
                appearance="light"
                uploadErrorMessage="Document upload failed"
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
