# Batch-Based Lesson and Attendance System Design

## Overview
This document outlines the comprehensive batch-based lesson and attendance system implemented for the IELTS academy platform. The system allows teachers to organize students by cohorts, manage lessons per batch, conduct live classes, and track attendance efficiently.

## Firestore Structure

### 1. Batch Collection (`batches`)
```typescript
interface Batch {
  id: string;
  courseId: string;
  name: string;
  description?: string;
  startDate: Timestamp;
  endDate?: Timestamp;
  weekNumber: number;
  teacherId: string;
  status: 'active' | 'completed' | 'suspended' | 'upcoming';
  maxStudents?: number;
  currentStudents: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  schedule?: {
    weekdays: string[]; // ['monday', 'tuesday', etc.]
    startTime: string; // '09:00'
    endTime: string; // '11:00'
  };
}
```

### 2. Lesson Collection (`lessons`)
```typescript
interface Lesson {
  id: string;
  courseId: string;
  batchId: string;
  weekNumber: number;
  title: string;
  description: string;
  materials: LessonMaterial[];
  order: number;
  liveEnabled: boolean;
  status: 'draft' | 'published' | 'archived';
  teacherId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  scheduledDate?: Timestamp;
  duration?: number; // minutes
}

interface LessonMaterial {
  id: string;
  name: string;
  type: 'document' | 'video' | 'image' | 'link' | 'assignment';
  url: string;
  size?: number;
  uploadedAt: Timestamp;
}
```

### 3. Live Session Collection (`liveSessions`)
```typescript
interface LiveSession {
  id: string;
  lessonId: string;
  batchId: string;
  teacherId: string;
  title: string;
  meetingLink?: string;
  meetingId?: string;
  startedAt?: Timestamp;
  endedAt?: Timestamp;
  status: 'scheduled' | 'live' | 'ended' | 'cancelled';
  attendanceOpen: boolean;
  attendanceClosed: boolean;
  scheduledAt?: Timestamp;
  duration?: number;
  participantsCount?: number;
  createdAt: Timestamp;
  notes?: string;
}
```

### 4. Attendance Collection (`attendance`)
```typescript
interface Attendance {
  id: string;
  sessionId: string;
  lessonId: string;
  studentUid: string;
  batchId: string;
  status: 'present' | 'late' | 'absent' | 'excused';
  markedAt: Timestamp;
  markedBy?: string;
  lateMinutes?: number;
  notes?: string;
  autoMarked: boolean;
}
```

### 5. Extended StudentData
```typescript
interface StudentData {
  // ... existing fields
  batchId?: string;
  batchInfo?: StudentBatchInfo;
}

interface StudentBatchInfo {
  batchId: string;
  joinedAt: Timestamp;
  currentLessonId?: string;
  currentWeek: number;
  progressPercent: number;
  attendanceRate?: number;
  lastAttendanceDate?: Timestamp;
}
```

## Key Components and Pages

### 1. Teacher Components

#### TeacherBatchesPage (`/teacher/batches`)
- **Purpose**: Create and manage batches
- **Features**:
  - Create new batches with course assignment
  - Edit batch details (name, schedule, capacity)
  - View batch statistics (student count, status)
  - Navigate to batch lessons and students
  - Delete inactive batches

#### TeacherBatchLessonsPage (`/teacher/batches/:batchId/lessons`)
- **Purpose**: Manage lessons for a specific batch
- **Features**:
  - Create lessons with materials
  - Drag-and-drop lesson reordering
  - Organize lessons by week
  - Upload lesson materials (documents, videos, links)
  - Start live classes from lessons
  - Edit/delete lessons

#### TeacherLiveSessionPage (`/teacher/batches/:batchId/lessons/:lessonId/live`)
- **Purpose**: Conduct live classes and manage attendance
- **Features**:
  - Start/end live sessions
  - Open/close attendance window
  - Real-time attendance tracking
  - Manual attendance marking
  - Session statistics (present, late, absent)
  - Meeting link generation

#### TeacherApprovalsPage_Batch (`/teacher/approvals`)
- **Purpose**: Approve students and assign to batches
- **Features**:
  - View pending student applications
  - Auto-suggest appropriate batches based on join date
  - Manual batch selection
  - Batch assignment on approval
  - Student statistics dashboard

### 2. Student Components

#### StudentBatchView (`/batch`)
- **Purpose**: Student's batch dashboard
- **Features**:
  - View batch information and progress
  - Access current lesson materials
  - Join live classes
  - View upcoming lessons
  - Track attendance statistics
  - Progress visualization

### 3. Custom Hooks

#### useBatchManagement
```typescript
const {
  batches,
  loading,
  error,
  createBatch,
  updateBatch,
  deleteBatch,
  getBatch,
  suggestBatch,
  assignStudentToBatch,
  getBatchStudents
} = useBatchManagement(courseId);
```

#### useLessonManagement
```typescript
const {
  lessons,
  loading,
  error,
  createLesson,
  updateLesson,
  deleteLesson,
  getLesson,
  addMaterial,
  removeMaterial,
  reorderLessons,
  getCurrentLesson,
  moveToNextLesson
} = useLessonManagement(batchId);
```

#### useLiveSession & useAttendance
```typescript
// Live session management
const {
  sessions,
  currentSession,
  loading,
  error,
  startLiveSession,
  endLiveSession,
  openAttendance,
  closeAttendance,
  getSession
} = useLiveSession(lessonId);

// Attendance management
const {
  attendance,
  summary,
  loading,
  error,
  markAttendance,
  autoMarkAttendance,
  getStudentAttendance,
  getBatchAttendanceSummary
} = useAttendance(sessionId);
```

## Data Flow

### 1. Student Approval → Batch Assignment
```
1. Student submits application
2. Teacher reviews pending applications
3. System auto-suggests batch based on:
   - Join date (last 2 weeks)
   - Course compatibility
   - Batch capacity
4. Teacher selects/overrides batch
5. On approval:
   - Student status updated to 'approved'
   - Student assigned to batch
   - Batch student count incremented
   - Student batchInfo populated
```

### 2. Teacher Lesson Creation
```
1. Teacher selects batch
2. Creates lesson with:
   - Title, description, week number
   - Materials upload
   - Duration and schedule
3. Lesson saved with batch association
4. Students in batch can access lesson
```

### 3. Live Class Start
```
1. Teacher starts live session from lesson
2. System generates meeting link
3. Session created with 'live' status
4. Attendance window opens automatically
5. Students can join and be auto-marked
6. Teacher can manually mark attendance
7. Session ends → attendance closes
```

### 4. Attendance Open/Close
```
1. Teacher opens attendance
2. Students joining session auto-marked 'present'
3. Teacher can manually override:
   - Present, Late, Absent, Excused
4. Attendance closed → no more changes
5. Summary statistics calculated
6. Student attendance rates updated
```

## Routing Structure

### Teacher Routes
- `/teacher/batches` - Batch management
- `/teacher/batches/:batchId/lessons` - Lesson management
- `/teacher/batches/:batchId/lessons/:lessonId/live` - Live sessions
- `/teacher/approvals` - Student approvals with batch assignment

### Student Routes
- `/batch` - Student batch dashboard
- `/batch/:batchId/lessons/:lessonId/live` - Join live classes

## Implementation Priority

### Phase 1: Core Infrastructure ✅
1. **Types and Interfaces** - Extended type definitions
2. **Batch Management Hook** - CRUD operations for batches
3. **Lesson Management Hook** - Lesson and material management
4. **Live Session Hook** - Session control and attendance

### Phase 2: Teacher Interface ✅
1. **Batch Management Page** - Create and manage batches
2. **Lesson Management Page** - Create and organize lessons
3. **Live Session Page** - Conduct classes and track attendance
4. **Enhanced Approvals Page** - Batch assignment on approval

### Phase 3: Student Interface ✅
1. **Student Batch View** - Dashboard for batch students
2. **Live Class Integration** - Join sessions from student view
3. **Progress Tracking** - Visual progress indicators

### Phase 4: Advanced Features (Future)
1. **Attendance Analytics** - Detailed reports and insights
2. **Automated Batch Creation** - Smart batch generation
3. **Lesson Templates** - Reusable lesson structures
4. **Parent/Guardian Access** - External progress viewing

## Key Features Summary

### ✅ Implemented Features
- **Batch Creation & Management**: Complete CRUD operations
- **Student Batch Assignment**: Automatic and manual assignment
- **Lesson Management**: Create, organize, and reorder lessons
- **Material Upload**: Support for documents, videos, links
- **Live Sessions**: Start/end sessions with meeting links
- **Attendance Tracking**: Real-time and manual marking
- **Progress Visualization**: Student progress bars and statistics
- **Responsive Design**: Mobile-friendly interfaces

### 🔄 Data Synchronization
- Real-time updates using Firestore listeners
- Automatic student count updates in batches
- Live attendance status updates
- Progress calculation on lesson completion

### 🎯 User Experience
- Clean, professional interface design
- Intuitive drag-and-drop lesson ordering
- One-click batch assignment suggestions
- Real-time attendance feedback
- Mobile-optimized layouts

## Technical Considerations

### Performance
- Efficient Firestore queries with proper indexing
- Pagination for large student/lesson lists
- Lazy loading of materials
- Optimistic UI updates

### Security
- Role-based access control
- Batch membership validation
- Attendance marking permissions
- Secure file uploads

### Scalability
- Designed for multiple concurrent batches
- Support for 100+ students per batch
- Efficient attendance tracking
- Scalable live session management

This batch-based system provides a robust foundation for managing cohorts, lessons, and attendance while maintaining clean separation of concerns and excellent user experience.
