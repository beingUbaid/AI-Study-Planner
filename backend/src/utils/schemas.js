import { z } from 'zod';

// Schema for extracted syllabus chapters
export const SyllabusSchema = z.array(
  z.object({
    name: z.string().trim().min(1, 'Chapter name must not be empty').max(100, 'Chapter name is too long'),
    estimatedHours: z.number().int().min(1, 'Hours must be at least 1').max(100, 'Hours limit exceeded').default(1),
    order: z.number().int().nonnegative().optional()
  })
)
.min(1, 'Syllabus must contain at least 1 chapter')
.max(50, 'Syllabus cannot exceed 50 chapters')
.refine(
  (chapters) => new Set(chapters.map(c => c.name.toLowerCase())).size === chapters.length,
  { message: 'Chapter names must be unique within the syllabus' }
);

// Schema for generated flashcards
export const FlashcardSchema = z.array(
  z.object({
    front: z.string().trim().min(1, 'Question must not be empty').max(300, 'Question is too long'),
    back: z.string().trim().min(1, 'Answer must not be empty').max(500, 'Answer is too long'),
    category: z.string().trim().max(100).optional()
  })
)
.min(1, 'Must generate at least 1 flashcard')
.max(30, 'Cannot exceed 30 flashcards')
.refine(
  (cards) => new Set(cards.map(c => c.front.toLowerCase())).size === cards.length,
  { message: 'Flashcard questions must be unique' }
);

// Schema for generated quizzes
export const QuizSchema = z.array(
  z.object({
    question: z.string().trim().min(1, 'Question text must not be empty').max(300, 'Question is too long'),
    options: z.array(
      z.string().trim().min(1, 'Option text cannot be empty').max(100, 'Option text is too long')
    )
    .min(2, 'At least 2 options are required')
    .max(6, 'At most 6 options allowed')
    .refine(
      (opts) => new Set(opts.map(o => o.toLowerCase())).size === opts.length,
      { message: 'Quiz options must contain unique, non-duplicate strings' }
    ),
    correctAnswer: z.number().int().nonnegative('Correct answer index must be non-negative'),
    explanation: z.string().trim().max(500, 'Explanation is too long').optional().default('')
  })
)
.min(1, 'Quiz must have at least 1 question')
.max(20, 'Quiz cannot exceed 20 questions')
.refine(
  (questions) => questions.every(q => q.correctAnswer >= 0 && q.correctAnswer < q.options.length),
  { message: 'Each quiz correctAnswer index must reference a valid index in the options array' }
)
.refine(
  (questions) => new Set(questions.map(q => q.question.toLowerCase())).size === questions.length,
  { message: 'Quiz questions must be unique within the quiz set' }
);

// Schema for exam roadmap steps
export const RoadmapSchema = z.array(
  z.object({
    days: z.string().trim().min(1, 'Days interval label is required').max(50, 'Days label is too long'),
    focus: z.string().trim().min(1, 'Focus area description is required').max(150, 'Focus description is too long'),
    description: z.string().trim().min(1, 'Detailed description is required').max(500, 'Description is too long')
  })
)
.min(1, 'Roadmap must have at least 1 step')
.max(15, 'Roadmap steps cannot exceed 15 steps')
.refine(
  (steps) => new Set(steps.map(s => s.focus.toLowerCase())).size === steps.length,
  { message: 'Roadmap focus areas must be unique' }
);
