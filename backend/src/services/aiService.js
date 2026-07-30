import Groq from 'groq-sdk';
import logger from '../utils/logger.js';
import { promptTemplates } from '../utils/promptTemplates.js';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

const DEFAULT_MODEL = 'llama-3.1-8b-instant';

// Helper to wait for exponential backoff
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Call Groq API with retries, timeouts, latency tracking, and exponential backoff
export const callLLM = async ({
  messages,
  maxTokens = 1000,
  model = DEFAULT_MODEL,
  jsonMode = false,
  retries = 3
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

      logger.info(`Sending request to LLM (Model: ${model}, Attempt: ${attempt + 1})`);
      const start = Date.now();
      
      // Set a 15-second timeout limit for Groq API calls to avoid server hangs
      const completion = await groq.chat.completions.create(options, { timeout: 15000 });
      
      const latency = Date.now() - start;
      const usage = completion.usage;
      
      if (usage) {
        logger.info(`LLM Metrics | Prompt Tokens: ${usage.prompt_tokens} | Completion Tokens: ${usage.completion_tokens} | Total Tokens: ${usage.total_tokens} | Latency: ${latency}ms`);
      } else {
        logger.info(`LLM Metrics | Latency: ${latency}ms`);
      }

      return completion.choices[0].message.content;

    } catch (error) {
      attempt++;
      logger.warn(`LLM request failed (Attempt ${attempt}/${retries}): ${error.message}`);
      
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

  const responseText = await callLLM({
    messages,
    maxTokens: 1200,
    jsonMode: true
  });

  // Strict JSON parsing and schema validation
  try {
    const parsed = JSON.parse(responseText);
    const chapters = Array.isArray(parsed) ? parsed : (parsed.chapters || []);
    
    // Schema verification
    return chapters.map((ch, index) => {
      if (!ch.name || typeof ch.name !== 'string') {
        throw new Error('Invalid chapter structure: name missing or not a string');
      }
      return {
        name: ch.name.trim(),
        estimatedHours: Number(ch.estimatedHours) || 1,
        order: index + 1
      };
    });
  } catch (error) {
    logger.error('Failed to parse or validate extracted syllabus JSON schema', { responseText, error: error.message });
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

  const responseText = await callLLM({
    messages,
    maxTokens: 1200,
    jsonMode: true
  });

  try {
    const parsed = JSON.parse(responseText);
    const cards = Array.isArray(parsed) ? parsed : (parsed.flashcards || []);
    
    return cards.map(c => ({
      front: c.front || 'Empty Question',
      back: c.back || 'Empty Answer',
      category: c.category || subject
    }));
  } catch (error) {
    logger.error('Failed to parse generated flashcards JSON', { responseText, error: error.message });
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

  const responseText = await callLLM({
    messages,
    maxTokens: 1500,
    jsonMode: true
  });

  try {
    const parsed = JSON.parse(responseText);
    const questions = Array.isArray(parsed) ? parsed : (parsed.quiz || parsed.questions || []);

    return questions.map(q => {
      const options = Array.isArray(q.options) && q.options.length >= 2 ? q.options : ['Option A', 'Option B', 'Option C', 'Option D'];
      let correctAnswer = Number(q.correctAnswer);
      if (isNaN(correctAnswer) || correctAnswer < 0 || correctAnswer >= options.length) {
        correctAnswer = 0;
      }
      return {
        question: q.question || 'Review Question',
        options,
        correctAnswer,
        explanation: q.explanation || 'Consult material for detailed answers.'
      };
    });
  } catch (error) {
    logger.error('Failed to parse generated quiz JSON', { responseText, error: error.message });
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

  const responseText = await callLLM({
    messages,
    maxTokens: 1000,
    jsonMode: true
  });

  try {
    const parsed = JSON.parse(responseText);
    return Array.isArray(parsed) ? parsed : (parsed.roadmap || parsed.steps || []);
  } catch (error) {
    logger.error('Failed to parse exam mode countdown JSON', { responseText, error: error.message });
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
