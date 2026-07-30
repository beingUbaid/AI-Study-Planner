import Groq from 'groq-sdk';
import logger, { requestStore } from '../utils/logger.js';
import { promptTemplates } from '../utils/promptTemplates.js';
import { SyllabusSchema, FlashcardSchema, QuizSchema, RoadmapSchema } from '../utils/schemas.js';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

const DEFAULT_MODEL = 'llama-3.1-8b-instant';
const PROMPT_VERSION = '1.0.0';

// Helper to wait for exponential backoff
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const calculateCost = (model, promptTokens, completionTokens) => {
  // Input: $0.05 / 1M tokens, Output: $0.08 / 1M tokens for Llama 3.1 8b
  if (model.includes('8b')) {
    return ((promptTokens * 0.05) + (completionTokens * 0.08)) / 1000000;
  }
  return ((promptTokens * 0.59) + (completionTokens * 0.79)) / 1000000;
};

// Call Groq API with retries, timeouts, latency tracking, Zod schema validation, and exponential backoff
export const callLLM = async ({
  messages,
  maxTokens = 1000,
  model = DEFAULT_MODEL,
  jsonMode = false,
  retries = 3,
  schema = null
}) => {
  let attempt = 0;
  let delay = 1000; // start with 1 second

  while (attempt < retries) {
    try {
      const options = {
        model,
        messages,
        maxTokens,
        temperature: 0.3
      };

      if (jsonMode) {
        options.response_format = { type: 'json_object' };
      }

      const store = requestStore.getStore();
      const requestId = store?.requestId || 'N/A';

      logger.info('Sending request to LLM (Metadata only logged for privacy)', {
        model,
        promptVersion: PROMPT_VERSION,
        attempt: attempt + 1,
        requestId,
        jsonMode
      });

      const start = Date.now();
      // Set a 15-second timeout limit for Groq API calls to avoid server hangs
      const completion = await groq.chat.completions.create(options, { timeout: 15000 });
      const latency = Date.now() - start;

      const rawContent = completion.choices[0].message.content;
      const usage = completion.usage;
      
      let cost = 0;
      if (usage) {
        cost = calculateCost(model, usage.prompt_tokens, usage.completion_tokens);
      }

      logger.info('LLM Response Metrics', {
        model,
        promptVersion: PROMPT_VERSION,
        promptTokens: usage?.prompt_tokens || 0,
        completionTokens: usage?.completion_tokens || 0,
        totalTokens: usage?.total_tokens || 0,
        latencyMs: latency,
        estimatedCostUSD: cost,
        requestId
      });

      // If schema is provided, parse and validate the response
      if (schema) {
        let parsedJSON;
        try {
          parsedJSON = JSON.parse(rawContent);
        } catch (jsonErr) {
          throw new Error(`JSON parsing failed: ${jsonErr.message}`);
        }

        // Zod validation
        const validationResult = schema.safeParse(parsedJSON);
        if (!validationResult.success) {
          throw new Error(`Schema validation failed: ${validationResult.error.message}`);
        }

        // Return validated and parsed data
        return validationResult.data;
      }

      return rawContent;

    } catch (error) {
      attempt++;
      logger.warn('LLM attempt failed, scheduling retry', {
        attempt,
        maxRetries: retries,
        error: error.message,
        backoffDelayMs: delay
      });
      
      if (attempt >= retries) {
        throw new Error(`LLM call failed after ${retries} attempts: ${error.message}`);
      }

      await wait(delay);
      delay *= 2; // Exponential backoff
    }
  }
};

// Generate AI Schedule Chat Response
export const generateAISchedule = async (message, subjectContext, progressContext) => {
  const messages = [
    {
      role: 'system',
      content: promptTemplates.aiSchedule.system(subjectContext, progressContext)
    },
    {
      role: 'user',
      content: promptTemplates.aiSchedule.user(message)
    }
  ];

  return await callLLM({ messages, maxTokens: 1000 });
};

// Chatbot interactions
export const generateAIChat = async (message, history, context) => {
  const messages = [
    {
      role: 'system',
      content: promptTemplates.aiChat.system(context)
    },
    ...history.map(h => ({
      role: h.role,
      content: h.content
    })),
    {
      role: 'user',
      content: message
    }
  ];

  return await callLLM({ messages, maxTokens: 600 });
};

// Extract Syllabus Chapters from PDF text
export const extractSyllabusChapters = async (pdfText) => {
  const messages = [
    {
      role: 'system',
      content: promptTemplates.syllabusExtraction.system()
    },
    {
      role: 'user',
      content: promptTemplates.syllabusExtraction.user(pdfText.substring(0, 3000))
    }
  ];

  try {
    const chapters = await callLLM({
      messages,
      maxTokens: 1200,
      jsonMode: true,
      schema: SyllabusSchema
    });

    return chapters.map((ch, index) => ({
      name: ch.name.trim(),
      estimatedHours: ch.estimatedHours,
      order: index + 1
    }));
  } catch (error) {
    logger.error('Failed to generate validated chapters, using fallback', { error: error.message });
    throw new Error('AI extraction returned invalid syllabus format. Please try a clearer document.');
  }
};

// Generate Flashcards
export const generateFlashcards = async (subject, topic, count) => {
  const messages = [
    {
      role: 'system',
      content: promptTemplates.flashcardGeneration.system(subject)
    },
    {
      role: 'user',
      content: promptTemplates.flashcardGeneration.user(subject, topic, count)
    }
  ];

  try {
    const cards = await callLLM({
      messages,
      maxTokens: 1200,
      jsonMode: true,
      schema: FlashcardSchema
    });

    return cards.map(c => ({
      front: c.front,
      back: c.back,
      category: c.category || subject
    }));
  } catch (error) {
    logger.error('Failed to generate validated flashcards, using fallback', { error: error.message });
    // Safe Fallback
    return Array.from({ length: count }, (_, i) => ({
      front: `Key concept ${i + 1} regarding ${topic}?`,
      back: `Please review subject material for ${subject} - ${topic}.`,
      category: subject
    }));
  }
};

// Generate Interactive Quiz
export const generateQuiz = async (subject, topic, difficulty, count) => {
  const messages = [
    {
      role: 'system',
      content: promptTemplates.quizGeneration.system(difficulty)
    },
    {
      role: 'user',
      content: `Create exactly ${count} multiple-choice quiz questions for Subject: ${subject}, Topic: ${topic}, Difficulty: ${difficulty}`
    }
  ];

  try {
    const questions = await callLLM({
      messages,
      maxTokens: 1500,
      jsonMode: true,
      schema: QuizSchema
    });

    return questions.map(q => ({
      question: q.question,
      options: q.options,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation || ''
    }));
  } catch (error) {
    logger.error('Failed to generate validated quiz, using fallback', { error: error.message });
    // Safe Fallback
    return [
      {
        question: `What is the core focus of ${topic} in ${subject}?`,
        options: ['Practical application', 'Theoretical frameworks', 'Basic definitions', 'All of the above'],
        correctAnswer: 3,
        explanation: `Topic ${topic} encompasses practical, theoretical, and basic introductory concepts.`
      }
    ];
  }
};

// Generate Countdown Roadmap (Before Exam Mode)
export const generateExamModeRoadmap = async (examDate, subjects, currentPrep, targetScore, availableHours) => {
  const today = new Date();
  const daysUntilExam = Math.ceil((new Date(examDate) - today) / (1000 * 60 * 60 * 24));

  if (daysUntilExam <= 0) {
    throw new Error('Exam date must be in the future.');
  }

  const messages = [
    {
      role: 'system',
      content: promptTemplates.examModeCountdown.system(daysUntilExam, currentPrep, targetScore, availableHours)
    },
    {
      role: 'user',
      content: promptTemplates.examModeCountdown.user(subjects, daysUntilExam)
    }
  ];

  try {
    const steps = await callLLM({
      messages,
      maxTokens: 1000,
      jsonMode: true,
      schema: RoadmapSchema
    });

    return steps;
  } catch (error) {
    logger.error('Failed to generate validated exam mode roadmap, using fallback', { error: error.message });
    return [
      {
        days: 'Phase 1',
        focus: 'Review Core Topics',
        description: 'Read primary lecture notes and complete outstanding practice assignments.'
      },
      {
        days: 'Phase 2',
        focus: 'Mock Exam Practice',
        description: 'Take timed sample exams and study incorrect responses to lock in key learning.'
      }
    ];
  }
};

// Generate Plan Explanation
export const generatePlanExplanation = async (subjectContext, dailyStudyHours, planDays) => {
  const messages = [
    {
      role: 'system',
      content: promptTemplates.planExplanation.system(subjectContext, dailyStudyHours, planDays)
    }
  ];

  try {
    return await callLLM({ messages, maxTokens: 400 });
  } catch (err) {
    logger.warn('Groq AI Explanation failed, using fallback:', err.message);
    return `Plan optimized successfully. Priority given to subjects with closer exam dates. Daily study hours capped at ${dailyStudyHours} hours to prevent burnout, with revision buffers added before exams.`;
  }
};

// Generate Rebalance Explanation
export const generateRebalanceExplanation = async (missedDetails, dailyStudyHours) => {
  const messages = [
    {
      role: 'system',
      content: promptTemplates.rebalanceExplanation.system(missedDetails, dailyStudyHours)
    }
  ];

  try {
    return await callLLM({ messages, maxTokens: 250 });
  } catch (err) {
    logger.warn('Groq Rebalance Explanation failed, using fallback:', err.message);
    return `Your plan has been updated! Missed tasks have been distributed across the upcoming days without exceeding your daily study hour limit of ${dailyStudyHours} hours.`;
  }
};
