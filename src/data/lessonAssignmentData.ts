export const TRAINER_STATUS_OPTIONS = [
  'New',
  'In Progress',
  'Almost Done',
  'Completed',
] as const;

export type TrainerAssignmentStatus = (typeof TRAINER_STATUS_OPTIONS)[number];

export const DEFAULT_MODULE_ID = 'speaking';
export const DEFAULT_MODULE_TITLE = 'Speaking';
export const DEFAULT_LESSON_ID = 'speaking-basics';
export const DEFAULT_LESSON_TITLE = 'Speaking Basics';
export const DEFAULT_NEXT_ACTION = 'Complete Speaking Basics';

export interface LessonOption {
  id: string;
  title: string;
  description?: string;
  durationLabel?: string;
  order: number;
  nextAction?: string;
}

export interface LessonModuleOption {
  id: string;
  title: string;
  lessons: LessonOption[];
}

export const SAMPLE_LESSON_MODULES: LessonModuleOption[] = [
  {
    id: 'listening',
    title: 'Listening',
    lessons: [
      {
        id: 'listening-basics',
        title: 'Listening Basics',
        description: 'Understand the IELTS listening format and question flow.',
        durationLabel: '35 min',
        order: 1,
        nextAction: 'Complete Listening Basics',
      },
      {
        id: 'note-completion',
        title: 'Note Completion Practice',
        description: 'Practice listening for keywords and structured note answers.',
        durationLabel: '40 min',
        order: 2,
        nextAction: 'Complete Note Completion Practice',
      },
      {
        id: 'map-labelling',
        title: 'Map and Diagram Labelling',
        description: 'Build confidence with directional language and spatial clues.',
        durationLabel: '45 min',
        order: 3,
        nextAction: 'Complete Map and Diagram Labelling',
      },
    ],
  },
  {
    id: 'reading',
    title: 'Reading',
    lessons: [
      {
        id: 'reading-skimming',
        title: 'Reading Skimming',
        description: 'Learn to skim passages quickly for topic and structure.',
        durationLabel: '30 min',
        order: 1,
        nextAction: 'Complete Reading Skimming',
      },
      {
        id: 'scan-for-detail',
        title: 'Scanning for Detail',
        description: 'Find dates, names, and supporting evidence fast.',
        durationLabel: '35 min',
        order: 2,
        nextAction: 'Complete Scanning for Detail',
      },
      {
        id: 'true-false-not-given',
        title: 'True / False / Not Given',
        description: 'Improve accuracy on common IELTS reading traps.',
        durationLabel: '40 min',
        order: 3,
        nextAction: 'Complete True / False / Not Given',
      },
    ],
  },
  {
    id: 'writing',
    title: 'Writing',
    lessons: [
      {
        id: 'task1-overview',
        title: 'Writing Task 1 Overview',
        description: 'Structure introductions and overviews for Task 1.',
        durationLabel: '45 min',
        order: 1,
        nextAction: 'Complete Writing Task 1 Overview',
      },
      {
        id: 'task2-essay-structure',
        title: 'Task 2 Essay Structure',
        description: 'Build a clear essay with ideas, examples, and cohesion.',
        durationLabel: '50 min',
        order: 2,
        nextAction: 'Complete Task 2 Essay Structure',
      },
      {
        id: 'coherence-cohesion',
        title: 'Coherence and Cohesion',
        description: 'Strengthen linking, paragraph flow, and clarity.',
        durationLabel: '35 min',
        order: 3,
        nextAction: 'Complete Coherence and Cohesion',
      },
    ],
  },
  {
    id: DEFAULT_MODULE_ID,
    title: DEFAULT_MODULE_TITLE,
    lessons: [
      {
        id: DEFAULT_LESSON_ID,
        title: DEFAULT_LESSON_TITLE,
        description: 'Cover speaking test flow, fluency, and simple responses.',
        durationLabel: '30 min',
        order: 1,
        nextAction: DEFAULT_NEXT_ACTION,
      },
      {
        id: 'cue-card-practice',
        title: 'Cue Card Practice',
        description: 'Practice structuring strong Part 2 cue card answers.',
        durationLabel: '40 min',
        order: 2,
        nextAction: 'Complete Cue Card Practice',
      },
      {
        id: 'follow-up-discussion',
        title: 'Follow-up Discussion',
        description: 'Develop extended answers for Part 3 discussion prompts.',
        durationLabel: '35 min',
        order: 3,
        nextAction: 'Complete Follow-up Discussion',
      },
    ],
  },
];
