import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { useAuth } from "../hooks/useAuth";
import { db } from "../services/firebase";

interface Task {
  id: string;
  type: "lesson" | "live_class" | "assignment";
  title: string;
  description?: string;
  duration: string;
  module: string;
  status: "not_started" | "in_progress" | "completed" | "live" | "coming_soon" | "scheduled";
  actionLabel?: "Start" | "Join" | "Continue";
  actionTarget?: string;
  externalUrl?: string;
  sortTime: number;
}

interface BackendBatch {
  name?: string;
  courseId?: string;
}

interface BackendModule {
  name?: string;
}

interface BackendLiveSession {
  id: string;
  title?: string;
  description?: string;
  batchId?: string;
  moduleId?: string;
  startTime?: string;
  endTime?: string;
  meetingLink?: string;
  status?: "scheduled" | "live" | "ended" | "cancelled";
  scheduledAt?: { toDate?: () => Date };
}

interface BackendAssignment {
  id: string;
  title?: string;
  description?: string;
  dueDate?: string;
  moduleId?: string;
}

interface BackendLesson {
  id: string;
  title?: string;
  description?: string;
  moduleId?: string;
  scheduledDate?: { toDate?: () => Date };
  duration?: number;
  durationMinutes?: number;
  status?: string;
}

interface BackendSubmission {
  assignmentId?: string;
}

const isValidDate = (value: Date | null): value is Date => Boolean(value && !Number.isNaN(value.getTime()));

const isSameLocalDay = (left: Date, right: Date) =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate();

const parseStoredDate = (value?: string | null) => {
  if (!value) {
    return null;
  }

  const localDateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (localDateMatch) {
    const [, year, month, day] = localDateMatch;
    const parsedLocalDate = new Date(Number(year), Number(month) - 1, Number(day));
    return isValidDate(parsedLocalDate) ? parsedLocalDate : null;
  }

  const parsedDate = new Date(value);
  return isValidDate(parsedDate) ? parsedDate : null;
};

const getDateValue = (value: unknown) => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return isValidDate(value) ? value : null;
  }

  if (typeof value === "string") {
    return parseStoredDate(value);
  }

  if (typeof value === "object" && value !== null && "toDate" in value) {
    const timestampDate = (value as { toDate?: () => Date }).toDate?.() ?? null;
    return isValidDate(timestampDate) ? timestampDate : null;
  }

  return null;
};

const formatClockTime = (date: Date) =>
  date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const formatTimeRange = (startDate: Date, endDate?: Date | null) =>
  endDate ? `${formatClockTime(startDate)} - ${formatClockTime(endDate)}` : formatClockTime(startDate);

const getTodaysLearningLiveSessionFilterReasons = (
  session: BackendLiveSession,
  expectedBatchId: string | undefined,
  today: Date
) => {
  const reasons: string[] = [];
  const startDate = getDateValue(session.startTime) || getDateValue(session.scheduledAt);
  const endDate = getDateValue(session.endTime);

  if (session.status === "cancelled") {
    reasons.push("status is cancelled");
  }

  if (!session.batchId) {
    reasons.push("missing batchId");
  } else if (expectedBatchId && session.batchId !== expectedBatchId) {
    reasons.push(`batchId mismatch: expected ${expectedBatchId}, got ${session.batchId}`);
  }

  if (!startDate) {
    reasons.push("missing or invalid startTime");
  } else if (!isSameLocalDay(startDate, today)) {
    reasons.push("session is not scheduled for today");
  }

  if (session.endTime && !endDate) {
    reasons.push("invalid endTime");
  }

  if (startDate && endDate && endDate.getTime() <= startDate.getTime()) {
    reasons.push("endTime must be after startTime");
  }

  return reasons;
};

export function TodaysLearning() {
  const navigate = useNavigate();
  const { user, studentData } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);

  const studentBatchId = studentData?.batchId || studentData?.batchInfo?.batchId;

  useEffect(() => {
    let isActive = true;

    const loadTodayTasks = async () => {
      if (!user || (!studentBatchId && !studentData?.courseId)) {
        if (isActive) {
          setTasks([]);
          setLoadingTasks(false);
        }
        return;
      }

      setLoadingTasks(true);

      try {
        const today = new Date();
        const now = new Date();

        console.log("[TodaysLearning] Loading today's learning tasks", {
          studentBatchId,
          studentDataBatchId: studentData?.batchId,
          studentBatchInfoBatchId: studentData?.batchInfo?.batchId,
          studentCourseId: studentData?.courseId,
        });

        let batchData: BackendBatch | null = null;
        if (studentBatchId) {
          const batchSnapshot = await getDoc(doc(db, "batches", studentBatchId));
          batchData = batchSnapshot.exists() ? (batchSnapshot.data() as BackendBatch) : null;
        }

        const courseId = studentData?.courseId || batchData?.courseId;
        const batchName = batchData?.name || "";

        const [
          liveSessionsSnapshot,
          lessonsSnapshot,
          assignmentsSnapshot,
          submissionsSnapshot,
          modulesSnapshot,
        ] = await Promise.all([
          studentBatchId
            ? getDocs(query(collection(db, "liveSessions"), where("batchId", "==", studentBatchId)))
            : Promise.resolve(null),
          studentBatchId
            ? getDocs(query(collection(db, "lessons"), where("batchId", "==", studentBatchId)))
            : Promise.resolve(null),
          courseId
            ? getDocs(query(collection(db, "assignments"), where("courseId", "==", courseId)))
            : Promise.resolve(null),
          getDocs(query(collection(db, "submissions"), where("studentId", "==", user.uid))),
          courseId ? getDocs(collection(db, "courses", courseId, "modules")) : Promise.resolve(null),
        ]);

        const moduleNames = Object.fromEntries(
          (modulesSnapshot?.docs ?? []).map((moduleDoc) => {
            const moduleData = moduleDoc.data() as BackendModule;
            return [moduleDoc.id, moduleData.name || "Not assigned"];
          })
        ) as Record<string, string>;

        const submittedAssignmentIds = new Set(
          (submissionsSnapshot?.docs ?? [])
            .map((submissionDoc) => (submissionDoc.data() as BackendSubmission).assignmentId)
            .filter((assignmentId): assignmentId is string => Boolean(assignmentId))
        );

        const fetchedLiveSessions = (liveSessionsSnapshot?.docs ?? [])
          .map((sessionDoc) => ({ id: sessionDoc.id, ...sessionDoc.data() } as BackendLiveSession));

        console.log("[TodaysLearning] Fetched live sessions for today's learning", {
          studentBatchId,
          fetchedLiveSessions,
        });

        const liveTasks = fetchedLiveSessions
          .filter((session) => {
            const filterReasons = getTodaysLearningLiveSessionFilterReasons(session, studentBatchId, today);

            if (filterReasons.length > 0) {
              console.log("[TodaysLearning] Filtering out live session from today's learning", {
                studentBatchId,
                sessionId: session.id,
                filterReasons,
                session,
              });
              return false;
            }

            if (!session.meetingLink) {
              console.log("[TodaysLearning] Today's learning live session missing meetingLink", {
                studentBatchId,
                sessionId: session.id,
                session,
              });
            }

            if (!session.status) {
              console.log("[TodaysLearning] Today's learning live session missing status, using time-based fallback", {
                studentBatchId,
                sessionId: session.id,
                session,
              });
            }

            return true;
          })
          .map((session) => {
            const startDate = getDateValue(session.startTime) || getDateValue(session.scheduledAt);
            const endDate = getDateValue(session.endTime);

            const moduleName = (session.moduleId && moduleNames[session.moduleId]) || batchName || "Not assigned";

            let status: Task["status"] = "coming_soon";
            if (session.status === "ended" || (endDate && endDate.getTime() <= now.getTime())) {
              status = "completed";
            } else if (
              session.status === "live" ||
              (endDate && startDate.getTime() <= now.getTime() && now.getTime() < endDate.getTime())
            ) {
              status = "live";
            }

            return {
              id: `live-${session.id}`,
              type: "live_class" as const,
              title: session.title || "Live Class",
              description: session.description?.trim() || undefined,
              duration: formatTimeRange(startDate, endDate),
              module: moduleName,
              status,
              actionLabel: status === "completed" ? undefined : "Join",
              actionTarget: status === "live" && session.meetingLink ? undefined : "/live",
              externalUrl: status === "live" ? session.meetingLink : undefined,
              sortTime: startDate.getTime(),
            } satisfies Task;
          })
          .filter((task): task is Task => Boolean(task));

        const lessonTasks = (lessonsSnapshot?.docs ?? [])
          .map((lessonDoc) => ({ id: lessonDoc.id, ...lessonDoc.data() } as BackendLesson))
          .map((lesson) => {
            if (lesson.status && lesson.status !== "published") {
              return null;
            }

            const scheduledDate = getDateValue(lesson.scheduledDate);
            if (!scheduledDate || !isSameLocalDay(scheduledDate, today)) {
              return null;
            }

            const moduleName = (lesson.moduleId && moduleNames[lesson.moduleId]) || batchName || "Not assigned";
            const durationMinutes = lesson.duration || lesson.durationMinutes || 60;
            const isCurrentLesson = lesson.id === studentData?.batchInfo?.currentLessonId;

            return {
              id: `lesson-${lesson.id}`,
              type: "lesson" as const,
              title: lesson.title || "Lesson",
              description: lesson.description?.trim() || undefined,
              duration: `${durationMinutes} min`,
              module: moduleName,
              status: isCurrentLesson ? "in_progress" : "scheduled",
              actionLabel: isCurrentLesson ? "Continue" : "Start",
              actionTarget: "/batch",
              sortTime: scheduledDate.getTime(),
            } satisfies Task;
          })
          .filter((task): task is Task => Boolean(task));

        const assignmentTasks = (assignmentsSnapshot?.docs ?? [])
          .map((assignmentDoc) => ({ id: assignmentDoc.id, ...assignmentDoc.data() } as BackendAssignment))
          .map((assignment) => {
            const dueDate = parseStoredDate(assignment.dueDate);
            if (!dueDate || !isSameLocalDay(dueDate, today)) {
              return null;
            }

            const moduleName = (assignment.moduleId && moduleNames[assignment.moduleId]) || batchName || "Not assigned";
            const isSubmitted = submittedAssignmentIds.has(assignment.id);

            return {
              id: `assignment-${assignment.id}`,
              type: "assignment" as const,
              title: assignment.title || "Assignment",
              description: assignment.description?.trim() || undefined,
              duration: "Due Today",
              module: moduleName,
              status: isSubmitted ? "completed" : "not_started",
              actionLabel: isSubmitted ? undefined : "Start",
              actionTarget: isSubmitted ? undefined : "/tasks",
              sortTime: new Date(
                dueDate.getFullYear(),
                dueDate.getMonth(),
                dueDate.getDate(),
                23,
                59,
                59
              ).getTime(),
            } satisfies Task;
          })
          .filter((task): task is Task => Boolean(task));

        const nextTasks = [...liveTasks, ...lessonTasks, ...assignmentTasks].sort(
          (left, right) => left.sortTime - right.sortTime
        );

        if (isActive) {
          setTasks(nextTasks);
        }
      } catch (error) {
        console.error("Error loading today's learning tasks:", error);
        if (isActive) {
          setTasks([]);
        }
      } finally {
        if (isActive) {
          setLoadingTasks(false);
        }
      }
    };

    loadTodayTasks();

    return () => {
      isActive = false;
    };
  }, [
    user,
    studentBatchId,
    studentData?.courseId,
    studentData?.batchInfo?.currentLessonId,
  ]);

  const completedCount = tasks.filter((task) => task.status === "completed").length;
  const progressPercentage = tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0;
  const pendingCount = Math.max(tasks.length - completedCount, 0);

  const handleTaskAction = (task: Task) => {
    if (task.externalUrl) {
      window.open(task.externalUrl, "_blank", "noopener,noreferrer");
      return;
    }

    if (task.actionTarget) {
      navigate(task.actionTarget);
    }
  };

  const getTaskIcon = (type: Task["type"]) => {
    switch (type) {
      case "lesson":
        return "📖";
      case "live_class":
        return "🎥";
      case "assignment":
        return "📝";
      default:
        return "📖";
    }
  };

  const getTaskColor = (type: Task["type"]) => {
    switch (type) {
      case "lesson":
        return "bg-blue-100 text-blue-700";
      case "live_class":
        return "bg-purple-100 text-purple-700";
      case "assignment":
        return "bg-green-100 text-green-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getStatusColor = (status: Task["status"]) => {
    switch (status) {
      case "live":
        return "bg-red-100 text-red-700";
      case "coming_soon":
        return "bg-amber-100 text-amber-700";
      case "scheduled":
        return "bg-purple-100 text-purple-700";
      case "in_progress":
        return "bg-blue-100 text-blue-700";
      case "completed":
        return "bg-green-100 text-green-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getStatusLabel = (status: Task["status"]) => {
    switch (status) {
      case "live":
        return "Live";
      case "coming_soon":
        return "Coming Soon";
      case "scheduled":
        return "Scheduled";
      case "in_progress":
        return "In Progress";
      case "completed":
        return "Completed";
      default:
        return "Not Started";
    }
  };

  const getActionButton = (task: Task) => {
    if (task.status === "completed") {
      return (
        <div className="flex items-center gap-1 text-green-600">
          <span className="text-sm">OK</span>
          <span className="text-sm font-medium">Done</span>
        </div>
      );
    }

    return (
      <button
        onClick={() => handleTaskAction(task)}
        className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
      >
        {task.actionLabel || "Start"}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 pb-24">
      <div className="bg-white shadow-sm border-b border-gray-100">
        <div className="px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/dashboard")}
              className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
            >
              <span className="text-gray-700">←</span>
            </button>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-black">Today's Learning</h1>
              <p className="text-sm text-gray-500">Continue your IELTS journey</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-6">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="flex items-center justify-center mb-1">
                <span className="text-green-500 text-sm mr-1">OK</span>
                <span className="text-gray-700 text-sm">Completed</span>
              </div>
              <div className="text-xl font-bold text-black">{completedCount}</div>
              <div className="text-xs text-gray-500">of {tasks.length} tasks</div>
            </div>

            <div>
              <div className="flex items-center justify-center mb-1">
                <span className="text-yellow-500 text-sm mr-1">%</span>
                <span className="text-gray-700 text-sm">Progress</span>
              </div>
              <div className="mt-2">
                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${Math.min(progressPercentage, 100)}%` }}
                  />
                </div>
              </div>
              <div className="text-xs text-gray-500 mt-1">{Math.round(progressPercentage)}% complete</div>
            </div>

            <div>
              <div className="flex items-center justify-center mb-1">
                <span className="text-orange-500 text-sm mr-1">!</span>
                <span className="text-gray-700 text-sm">Pending</span>
              </div>
              <div className="text-xl font-bold text-black">{pendingCount}</div>
              <div className="text-xs text-gray-500">tasks left</div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {loadingTasks ? (
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-gray-400 text-xl">...</span>
              </div>
              <h3 className="text-lg font-semibold text-black mb-2">Loading today's learning</h3>
              <p className="text-gray-700 text-sm">Checking your scheduled learning activities.</p>
            </div>
          ) : tasks.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-gray-400 text-2xl">📚</span>
              </div>
              <h3 className="text-lg font-semibold text-black mb-2">No learning activities scheduled for today</h3>
              <p className="text-gray-700 text-sm">Check back later for new lessons, live classes, and assignments.</p>
            </div>
          ) : (
            tasks.map((task) => (
              <div
                key={task.id}
                className={`bg-white rounded-2xl p-4 shadow-sm border ${
                  task.status === "completed" ? "border-green-200 bg-green-50" : "border-gray-100"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm ${getTaskColor(task.type)}`}>
                    {getTaskIcon(task.type)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3
                      className={`font-semibold text-black text-sm truncate ${
                        task.status === "completed" ? "line-through opacity-60" : ""
                      }`}
                    >
                      {task.title}
                    </h3>
                    {task.description && (
                      <p className="text-gray-700 text-xs truncate">{task.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${getTaskColor(task.type)}`}>
                        {task.type === "lesson" ? "Lesson" : task.type === "live_class" ? "Live" : "Assignment"}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(task.status)}`}>
                        {getStatusLabel(task.status)}
                      </span>
                      <span className="text-xs text-gray-500">
                        {task.duration} • {task.module}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    {getActionButton(task)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

