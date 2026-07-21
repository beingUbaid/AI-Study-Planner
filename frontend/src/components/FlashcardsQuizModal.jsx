import React, { useState } from 'react';
import {
  Sparkles,
  Layers,
  HelpCircle,
  X,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  CheckCircle2,
  XCircle,
  Trophy,
  Loader2
} from 'lucide-react';
import { aiAPI } from '../services/api';

const FlashcardsQuizModal = ({ isOpen, onClose, subjects = [], onQuizCompleted }) => {
  const [activeTab, setActiveTab] = useState('flashcards'); // 'flashcards' | 'quiz'
  const [selectedSubject, setSelectedSubject] = useState(subjects[0]?.name || 'Math');
  const [topicInput, setTopicInput] = useState('');
  const [difficulty, setDifficulty] = useState('Medium');
  
  // State for AI data
  const [flashcards, setFlashcards] = useState([]);
  const [currentCardIdx, setCurrentCardIdx] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [cardMastered, setCardMastered] = useState({});

  const [quiz, setQuiz] = useState([]);
  const [currentQuizIdx, setCurrentQuizIdx] = useState(0);
  const [userAnswers, setUserAnswers] = useState({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  // Generate Flashcards
  const handleGenerateFlashcards = async (e) => {
    if (e) e.preventDefault();
    setIsLoading(true);
    setError('');
    setIsFlipped(false);
    setCurrentCardIdx(0);
    setCardMastered({});

    try {
      const topic = topicInput.trim() || 'Core Definitions & Formulas';
      const { data, ok } = await aiAPI.generateFlashcards({
        subject: selectedSubject,
        topic,
        count: 6
      });

      if (!ok || !data.flashcards || data.flashcards.length === 0) {
        setError('Could not generate flashcards. Please try again.');
        return;
      }

      setFlashcards(data.flashcards);
    } catch (err) {
      setError('Connection error. Failed to generate flashcards.');
    } finally {
      setIsLoading(false);
    }
  };

  // Generate Quiz
  const handleGenerateQuiz = async (e) => {
    if (e) e.preventDefault();
    setIsLoading(true);
    setError('');
    setCurrentQuizIdx(0);
    setUserAnswers({});
    setQuizSubmitted(false);

    try {
      const topic = topicInput.trim() || 'Core Exam Concepts';
      const { data, ok } = await aiAPI.generateQuiz({
        subject: selectedSubject,
        topic,
        difficulty,
        count: 5
      });

      if (!ok || !data.quiz || data.quiz.length === 0) {
        setError('Could not generate quiz. Please try again.');
        return;
      }

      setQuiz(data.quiz);
    } catch (err) {
      setError('Connection error. Failed to generate quiz.');
    } finally {
      setIsLoading(false);
    }
  };

  // Quiz submission calculation
  const getQuizScore = () => {
    let correct = 0;
    quiz.forEach((q, i) => {
      if (userAnswers[i] === q.correctAnswer) correct++;
    });
    return Math.round((correct / quiz.length) * 100);
  };

  const handleFinishQuiz = () => {
    setQuizSubmitted(true);
    const score = getQuizScore();
    if (onQuizCompleted) {
      onQuizCompleted(score);
    }
  };

  return (
    <div className="fixed inset-0 bg-dark-900/85 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="glass-panel border border-white/10 w-full max-w-3xl rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="p-5 bg-gradient-to-r from-primary-950/40 via-purple-950/40 to-dark-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-primary-500 to-purple-600 rounded-xl">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white">AI Learning Suite</h3>
              <p className="text-xs text-slate-400">Active-recall flashcards & self-testing quizzes</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="px-6 py-3 bg-slate-950/40 border-b border-slate-850 flex items-center justify-between gap-4">
          <div className="flex gap-2">
            <button
              onClick={() => { setActiveTab('flashcards'); setError(''); }}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'flashcards'
                  ? 'bg-primary-500 text-white shadow-md scale-105'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              <Layers className="w-4 h-4" />
              AI Flashcards
            </button>

            <button
              onClick={() => { setActiveTab('quiz'); setError(''); }}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'quiz'
                  ? 'bg-purple-600 text-white shadow-md scale-105'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              <HelpCircle className="w-4 h-4" />
              AI Practice Quiz
            </button>
          </div>

          {/* Quick inputs */}
          <div className="flex items-center gap-2">
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="bg-dark-900 border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-200 outline-none"
            >
              {subjects.map(s => <option key={s.id || s.name} value={s.name}>{s.name}</option>)}
              {subjects.length === 0 && (
                <>
                  <option value="Math">Math</option>
                  <option value="Physics">Physics</option>
                  <option value="Computer Science">Computer Science</option>
                </>
              )}
            </select>

            <input
              type="text"
              placeholder="Topic (e.g. Integration)..."
              value={topicInput}
              onChange={(e) => setTopicInput(e.target.value)}
              className="bg-dark-900 border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-200 outline-none max-w-[160px]"
            />

            <button
              onClick={activeTab === 'flashcards' ? handleGenerateFlashcards : handleGenerateQuiz}
              disabled={isLoading}
              className="px-3.5 py-1.5 rounded-lg bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white font-bold text-xs transition-all cursor-pointer shadow-sm flex items-center gap-1.5"
            >
              {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCw className="w-3.5 h-3.5" />}
              Generate
            </button>
          </div>
        </div>

        {/* Content Container */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-xl text-center">
              {error}
            </div>
          )}

          {/* MODE 1: FLASHCARDS */}
          {activeTab === 'flashcards' && (
            <div className="space-y-6">
              {flashcards.length > 0 ? (
                <div className="space-y-6 flex flex-col items-center">
                  {/* Card counter */}
                  <div className="flex justify-between items-center w-full max-w-md text-xs font-semibold text-slate-400">
                    <span>Card {currentCardIdx + 1} of {flashcards.length}</span>
                    <span className="text-primary-400 uppercase font-bold">{selectedSubject}</span>
                  </div>

                  {/* 3D Flip Card Container */}
                  <div
                    onClick={() => setIsFlipped(!isFlipped)}
                    className="w-full max-w-md h-64 bg-dark-900 border border-slate-700/80 rounded-2xl p-6 flex flex-col justify-between items-center text-center cursor-pointer shadow-xl relative hover:border-primary-500/60 transition-all duration-300 group"
                  >
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                      {isFlipped ? 'Answer (Click to flip)' : 'Question (Click to flip)'}
                    </span>

                    <div className="my-auto text-sm md:text-base font-bold text-slate-100 leading-relaxed px-4">
                      {isFlipped ? flashcards[currentCardIdx]?.back : flashcards[currentCardIdx]?.front}
                    </div>

                    <div className="text-[10px] text-primary-400 font-bold tracking-wider flex items-center gap-1 opacity-70 group-hover:opacity-100">
                      <RotateCw className="w-3 h-3" />
                      Click card to flip
                    </div>
                  </div>

                  {/* Controls */}
                  <div className="flex items-center gap-4 w-full max-w-md justify-between">
                    <button
                      onClick={() => {
                        setCurrentCardIdx(prev => Math.max(0, prev - 1));
                        setIsFlipped(false);
                      }}
                      disabled={currentCardIdx === 0}
                      className="p-2.5 rounded-xl border border-slate-700 bg-slate-900 disabled:opacity-30 text-slate-300 hover:text-white cursor-pointer"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>

                    <button
                      onClick={() => setCardMastered(prev => ({ ...prev, [currentCardIdx]: !prev[currentCardIdx] }))}
                      className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        cardMastered[currentCardIdx]
                          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                          : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {cardMastered[currentCardIdx] ? '✓ Mastered' : 'Mark as Mastered'}
                    </button>

                    <button
                      onClick={() => {
                        setCurrentCardIdx(prev => Math.min(flashcards.length - 1, prev + 1));
                        setIsFlipped(false);
                      }}
                      disabled={currentCardIdx === flashcards.length - 1}
                      className="p-2.5 rounded-xl border border-slate-700 bg-slate-900 disabled:opacity-30 text-slate-300 hover:text-white cursor-pointer"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-16 space-y-4">
                  <Layers className="w-12 h-12 text-slate-600 mx-auto" />
                  <div>
                    <h4 className="font-extrabold text-white text-base">Generate Active Recall Flashcards</h4>
                    <p className="text-slate-400 text-xs mt-1">Select a subject and click "Generate" above to create customized flashcard decks.</p>
                  </div>
                  <button
                    onClick={handleGenerateFlashcards}
                    disabled={isLoading}
                    className="btn-primary py-2.5 px-6 rounded-xl text-xs font-bold cursor-pointer inline-flex items-center gap-2"
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    Generate {selectedSubject} Flashcards
                  </button>
                </div>
              )}
            </div>
          )}

          {/* MODE 2: INTERACTIVE QUIZ */}
          {activeTab === 'quiz' && (
            <div className="space-y-6">
              {quiz.length > 0 ? (
                <div className="space-y-6">
                  {!quizSubmitted ? (
                    <div className="space-y-6 max-w-2xl mx-auto">
                      <div className="flex justify-between items-center text-xs font-semibold text-slate-400">
                        <span>Question {currentQuizIdx + 1} of {quiz.length}</span>
                        <span className="text-purple-400 font-bold uppercase">{selectedSubject} ({difficulty})</span>
                      </div>

                      <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-4">
                        <h4 className="font-extrabold text-white text-sm leading-relaxed">
                          {quiz[currentQuizIdx]?.question}
                        </h4>

                        <div className="space-y-2.5">
                          {quiz[currentQuizIdx]?.options.map((opt, optIdx) => (
                            <button
                              key={optIdx}
                              onClick={() => setUserAnswers(prev => ({ ...prev, [currentQuizIdx]: optIdx }))}
                              className={`w-full text-left p-3.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer flex items-center justify-between ${
                                userAnswers[currentQuizIdx] === optIdx
                                  ? 'bg-purple-600/20 border-purple-500 text-white shadow-md'
                                  : 'bg-slate-950/50 border-slate-800 text-slate-300 hover:bg-slate-850'
                              }`}
                            >
                              <span>{opt}</span>
                              <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                userAnswers[currentQuizIdx] === optIdx ? 'border-purple-400 bg-purple-500' : 'border-slate-700'
                              }`}>
                                {userAnswers[currentQuizIdx] === optIdx && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex justify-between items-center">
                        <button
                          onClick={() => setCurrentQuizIdx(prev => Math.max(0, prev - 1))}
                          disabled={currentQuizIdx === 0}
                          className="px-4 py-2 rounded-xl border border-slate-700 bg-slate-900 disabled:opacity-30 text-slate-300 text-xs font-bold cursor-pointer"
                        >
                          Previous Question
                        </button>

                        {currentQuizIdx < quiz.length - 1 ? (
                          <button
                            onClick={() => setCurrentQuizIdx(prev => prev + 1)}
                            className="btn-primary py-2 px-5 text-xs font-bold rounded-xl cursor-pointer"
                          >
                            Next Question
                          </button>
                        ) : (
                          <button
                            onClick={handleFinishQuiz}
                            className="bg-emerald-500 hover:bg-emerald-600 text-white py-2 px-6 text-xs font-bold rounded-xl cursor-pointer shadow-lg"
                          >
                            Submit Quiz
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* Quiz Results Breakdown */
                    <div className="space-y-6 max-w-2xl mx-auto animate-in fade-in duration-300">
                      <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-2xl text-center space-y-3">
                        <Trophy className="w-10 h-10 text-amber-400 mx-auto animate-bounce" />
                        <h4 className="font-extrabold text-white text-xl">Quiz Completed!</h4>
                        <p className="text-2xl font-black text-primary-400">{getQuizScore()}% Score</p>
                      </div>

                      <div className="space-y-4">
                        <h5 className="font-bold text-xs uppercase text-slate-400">Detailed Answer Review</h5>
                        {quiz.map((q, qIdx) => {
                          const isCorrect = userAnswers[qIdx] === q.correctAnswer;
                          return (
                            <div key={qIdx} className="p-4 bg-slate-900/40 border border-slate-800 rounded-xl space-y-2 text-xs">
                              <div className="flex items-start gap-2">
                                {isCorrect ? (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                                ) : (
                                  <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                                )}
                                <p className="font-bold text-white">{qIdx + 1}. {q.question}</p>
                              </div>
                              <p className="text-slate-400 pl-6">
                                Your answer: <span className={isCorrect ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>{q.options[userAnswers[qIdx]] || 'Skipped'}</span>
                              </p>
                              {!isCorrect && (
                                <p className="text-emerald-400 pl-6 font-semibold">
                                  Correct answer: {q.options[q.correctAnswer]}
                                </p>
                              )}
                              <p className="text-[11px] text-slate-400 bg-slate-950 p-2.5 rounded-lg border border-slate-850 pl-3">
                                <strong>AI Explanation:</strong> {q.explanation}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-16 space-y-4">
                  <HelpCircle className="w-12 h-12 text-slate-600 mx-auto" />
                  <div>
                    <h4 className="font-extrabold text-white text-base">Generate AI Practice Quiz</h4>
                    <p className="text-slate-400 text-xs mt-1">Test your knowledge with multiple-choice questions & instant feedback.</p>
                  </div>
                  <button
                    onClick={handleGenerateQuiz}
                    disabled={isLoading}
                    className="bg-purple-600 hover:bg-purple-700 text-white py-2.5 px-6 rounded-xl text-xs font-bold cursor-pointer inline-flex items-center gap-2"
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    Generate {selectedSubject} Quiz
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FlashcardsQuizModal;
