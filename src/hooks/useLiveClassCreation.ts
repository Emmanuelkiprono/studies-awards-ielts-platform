import { useCallback, useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { LiveClassFormData } from '../components/CreateLiveClassModal';

export const useLiveClassCreation = () => {
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createLiveClass = useCallback(
    async (formData: LiveClassFormData) => {
      setIsCreating(true);
      setError(null);

      try {
        // Validate required fields
        if (
          !formData.title ||
          !formData.moduleId ||
          !formData.batchId ||
          !formData.date ||
          !formData.startTime ||
          !formData.endTime ||
          !formData.meetingLink ||
          !formData.teacherId
        ) {
          throw new Error('Missing required fields');
        }

        // Combine date and time into ISO strings for proper timestamps
        const startDateTime = new Date(`${formData.date}T${formData.startTime}`);
        const endDateTime = new Date(`${formData.date}T${formData.endTime}`);

        // Validate end time is after start time
        if (endDateTime <= startDateTime) {
          throw new Error('End time must be after start time');
        }

        console.log('📅 Class times:', {
          startDateTime: startDateTime.toISOString(),
          endDateTime: endDateTime.toISOString(),
        });

        // Prepare FireStore document data matching LiveSession interface
        const liveSessionData = {
          // Core identifiers
          teacherId: formData.teacherId,
          batchId: formData.batchId,
          moduleId: formData.moduleId,

          // Session details
          title: formData.title.trim(),
          description: formData.description?.trim() || '',
          
          // Timing - store as ISO strings and timestamps
          scheduledAt: serverTimestamp(),
          startTime: startDateTime.toISOString(),
          endTime: endDateTime.toISOString(),
          
          // Meeting
          meetingLink: formData.meetingLink.trim(),
          
          // Status - new classes are scheduled, not live yet
          status: 'scheduled' as const,
          
          // Attendance flags (not enabled until teacher opens it)
          attendanceOpen: false,
          attendanceClosed: false,
          
          // Metadata
          createdAt: serverTimestamp(),
          isLive: false,
          participantsCount: 0,
        };

        // Save to Firestore
        const docRef = await addDoc(
          collection(db, 'liveSessions'),
          liveSessionData
        );

        console.log('✅ Live class created successfully:', {
          id: docRef.id,
          title: formData.title,
          date: formData.date,
          startTime: formData.startTime,
          endTime: formData.endTime,
        });

        return {
          id: docRef.id,
          ...liveSessionData,
        };
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to create live class';
        setError(errorMessage);
        console.error('❌ Error creating live class:', err);
        throw err;
      } finally {
        setIsCreating(false);
      }
    },
    []
  );

  return {
    createLiveClass,
    isCreating,
    error,
  };
};
