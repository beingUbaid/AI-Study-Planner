import { z } from 'zod';

// Schema for extracted syllabus chapters
export const SyllabusSchema = z.array(
  z.object({
    name: z.string().trim().min(1, 'Chapter name must not be empty'),
    estimatedHours: z.number().int().positive('Hours must be a positive integer').default(1),
    order: z.number().int().nonnegative().optional()
  })
);

// Schema for generated flashcards
export const FlashcardSchema = z.array(
  z.object({
    front: z.string().trim().min(1, 'Question must not be empty'),
    back: z.string().trim().min(1, 'Answer must not be empty'),
    category: z.string().trim().optional()
  })
);

// Schema for generated quizzes
export const QuizSchema = z.array(
  z.object({
    question: z.string().trim().min(1, 'Question text must not be empty'),
    options: z.array(z.string().trim().min(1)).min(2, 'At least 2 options are required'),
    correctAnswer: z.number().int().nonnegative('Correct answer index must be non-negative'),
    explanation: z.string().trim().optional().default('')
  })
);

// Schema for exam roadmap steps
export const RoadmapSchema = z.array(
  z.object({
    days: z.string().trim().min(1, 'Days interval label is required'),
    focus: z.string().trim().min(1, 'Focus area description is required'),
    description: z.string().trim().min(1, 'Detailed description is required')
  })
);
