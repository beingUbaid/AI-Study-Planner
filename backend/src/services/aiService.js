import Groq from 'groq-sdk';
import logger, { requestStore } from '../utils/logger.js';
import { promptTemplates } from '../utils/promptTemplates.js';
import { SyllabusSchema, FlashcardSchema, QuizSchema, RoadmapSchema } from '../utils/schemas.js';
import { env as appEnv } from '../config/env.js';
import AppError from '../utils/appError.js';

const groq = new Groq({
  apiKey: appEnv.GROQ_API_KEY
});

const DEFAULT_MODEL = appEnv.AI_MODEL;
const PROMPT_VERSION = '1.0.0';

// Helper to wait for exponential backoff
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const calculateCost = (model, promptTokens, completionTokens) => {
  const inputCost = appEnv.AI_INPUT_COST_1M;
  const outputCost = appEnv.AI_OUTPUT_COST_1M;
  return ((promptTokens * inputCost) + (completionTokens * outputCost)) / 1000000;
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
  if (process.env.AI_PROVIDER === 'mock') {
    logger.info('[MOCK AI] Bypassing Groq LLM call and returning mock response', { jsonMode, hasSchema: !!schema });
    if (schema) {
      if (schema === SyllabusSchema) {
        return [
          { name: "Chapter 1: Foundations", estimatedHours: 2, order: 1 },
          { name: "Chapter 2: Core Dynamics", estimatedHours: 3, order: 2 },
          { name: "Chapter 3: Advanced Applications", estimatedHours: 4, order: 3 }
        ];
      }
      if (schema === FlashcardSchema) {
        return [
          { front: "What is Chapter 1 concept?", back: "Description of Chapter 1 core concept.", category: "General" },
          { front: "What is Chapter 2 concept?", back: "Description of Chapter 2 core concept.", category: "General" }
        ];
      }
      if (schema === QuizSchema) {
        return [
          {
            question: "What is the primary unit of force?",
            options: ["Newton", "Joule", "Watt", "Pascal"],
            correctAnswer: 0,
            explanation: "Newton is the SI unit of force."
          }
        ];
      }
      if (schema === RoadmapSchema) {
        return [
          { days: "Days 1-3", focus: "Review Fundamentals", description: "Study core concepts and complete practice worksheets." },
          { days: "Days 4-5", focus: "Complete Exercises", description: "Work through target practice problems and review solutions." }
        ];
      }
    }
    const userPrompt = messages.find(m => m.role === 'user')?.content || '';
    if (userPrompt.toLowerCase().includes('rebalance')) {
      return "Mocked AI explanation: We rescheduled your missed tasks into tomorrow.";
    }
    return "Mocked AI explanation: Your plan has been structured optimally to balance workload and exam dates.";
  }
  let attempt = 0;
  let delay = 1000; // start with 1 second
  const messagesHistory = [...messages];

  while (attempt < retries) {
    let rawContent;
    try {
      const options = {
        model,
        messages: messagesHistory,
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

      rawContent = completion.choices[0].message.content;
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
          const conciseFeedback = validationResult.error.errors
            .map(e => `${e.path.join('.')}: ${e.message}`)
            .join(', ');
          throw new Error(`Schema validation failed: ${conciseFeedback}`);
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
        logger.error('LLM maximum retries exceeded. Throwing controlled operational error.');
        throw new AppError(`LLM processing failed: ${error.message}. Please try again.`, 502);
      }

      // Append concise validation feedback back to history for the next retry attempt
      if (typeof rawContent !== 'undefined') {
        messagesHistory.push({ role: 'assistant', content: rawContent });
        messagesHistory.push({
          role: 'user',
          content: `The previous response failed schema validation. Error details: ${error.message}. Please output the JSON object again, correcting these issues.`
        });
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

// Generate AI Weakness Analysis from incorrect quiz questions
export const generateWeaknessAnalysis = async (subject, topic, incorrectQuestions) => {
  if (!incorrectQuestions || incorrectQuestions.length === 0) {
    return "Outstanding! You got a perfect score, demonstrating full understanding and complete mastery of this topic.";
  }

  // Format incorrect questions for LLM consumption
  const incorrectSummary = incorrectQuestions.map((q, idx) => {
    return `Question ${idx + 1}: "${q.question}"
- Student's Answer: "${q.options[q.userAnswer] || 'Skipped'}"
- Correct Answer: "${q.options[q.correctAnswer]}"
- Explanation: ${q.explanation || 'N/A'}`;
  }).join('\n\n');

  const messages = [
    {
      role: 'system',
      content: `You are an expert subject tutor and academic coach.
Analyze the student's incorrect answers on a practice test for Subject: ${subject}, Topic: ${topic}.
Provide a brief, supportive, and highly actionable diagnostic breakdown (maximum 3 bullet points, under 150 words total):
1. Identify the conceptual gaps or patterns in their errors (e.g. formula mix-ups, conceptual confusion).
2. Pinpoint exactly what sub-topics or rules they need to re-study.
3. Suggest a quick, specific study strategy to improve.
Ensure the tone is motivating and helpful. Do not output any markdown code blocks, just raw markdown bullet points.`
    },
    {
      role: 'user',
      content: `Incorrect questions:\n\n${incorrectSummary}`
    }
  ];

  try {
    return await callLLM({ messages, maxTokens: 400 });
  } catch (err) {
    logger.warn('Groq Weakness Analysis failed, using fallback:', err.message);
    // Generic fallback based on topics
    return `Review the concepts related to: ${incorrectQuestions.slice(0, 3).map(q => `"${q.question.substring(0, 30)}..."`).join(', ')}. Focus on fundamental principles, definitions, and practicing similar step-by-step problems.`;
  }
};

