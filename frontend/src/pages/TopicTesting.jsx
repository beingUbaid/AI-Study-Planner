import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Sparkles,
  Award,
  Layers,
  HelpCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  History,
  TrendingUp,
  Brain,
  Activity,
  FileText
} from 'lucide-react';
import { aiAPI } from '../services/api';

const TopicTesting = () => {
  const { subjects = [], setNotifications } = useOutletContext();

  const [activeTab, setActiveTab] = useState('takeTest'); // 'takeTest' | 'history'
  const [selectedSubject, setSelectedSubject] = useState(subjects[0]?.name || 'Math');
  const [topicInput, setTopicInput] = useState('');
  const [difficulty, setDifficulty] = useState('Medium');
  const [questionCount, setQuestionCount] = useState(5);

  // Test states
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [userAnswers, setUserAnswers] = useState({}); // { questionIndex: optionIndex }
  const [isTestActive, setIsTestActive] = useState(false);
  
  // Results states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeResult, setActiveResult] = useState(null); // completed test object
  
  // History states
  const [testHistory, setTestHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedHistoryTest, setSelectedHistoryTest] = useState(null); // test details modal

  // Load history on mount and when tab changes to 'history'
  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const { data, ok } = await aiAPI.getTopicTests();
      if (ok && data?.topicTests) {
        setTestHistory(data.topicTests);
      }
    } catch (err) {
      console.error('Failed to load test history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory();
    }
  }, [activeTab]);

  // Set default subject if subjects change
  useEffect(() => {
    if (subjects.length > 0 && !selectedSubject) {
      setSelectedSubject(subjects[0].name);
    }
  }, [subjects, selectedSubject]);

  // Generate Topic Test
  const handleGenerateTest = async (e) => {
    if (e) e.preventDefault();
    const topic = topicInput.trim();
    if (!topic) {
      setError('Please specify a topic to test.');
      return;
    }

    setIsLoading(true);
    setError('');
    setQuizQuestions([]);
    setCurrentQuestionIdx(0);
    setUserAnswers({});
    setActiveResult(null);

    try {
      const { data, ok } = await aiAPI.generateQuiz({
        subject: selectedSubject,
        topic,
        difficulty,
        count: Number(questionCount)
      });

      if (!ok || !data.quiz || data.quiz.length === 0) {
        setError('Failed to generate test. Please try a different topic or verify your connection.');
        return;
      }

      setQuizQuestions(data.quiz);
      setIsTestActive(true);
    } catch (err) {
      setError('Connection error. Failed to generate test.');
    } finally {
      setIsLoading(false);
    }
  };

  // Submit Test
  const handleSubmitTest = async () => {
    setIsSubmitting(true);
    setError('');

    // Prepare questions with user answers
    const questionsToSubmit = quizQuestions.map((q, idx) => ({
      question: q.question,
      options: q.options,
      correctAnswer: q.correctAnswer,
      userAnswer: userAnswers[idx] !== undefined ? userAnswers[idx] : -1,
      explanation: q.explanation || ''
    }));

    try {
      const { data, ok } = await aiAPI.submitTopicTest({
        subjectName: selectedSubject,
        topic: topicInput,
        difficulty,
        questions: questionsToSubmit
      });

      if (!ok || !data.topicTest) {
        setError('Failed to evaluate and save test results.');
        return;
      }

      setActiveResult(data.topicTest);
      setIsTestActive(false);

      // Log notification
      if (setNotifications) {
        setNotifications(prev => [
          {
            id: Date.now(),
            text: `🎯 Completed Topic Test on "${topicInput}" with ${data.topicTest.score}% accuracy. Check AI diagnostic report!`,
            read: false
          },
          ...prev
        ]);
      }
    } catch (err) {
      setError('Connection error. Failed to submit test.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-white flex items-center gap-2">
            <Sparkles className="w-7 h-7 text-purple-400" />
            AI Topic-wise Testing Suite
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Test your knowledge of specific subject topics, receive graded marks, and get AI diagnostics detailing your learning weaknesses.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-dark-900 border border-slate-800 p-1.5 rounded-2xl self-start md:self-center">
          <button
            onClick={() => {
              setActiveTab('takeTest');
              setError('');
            }}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'takeTest'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            Take Practice Test
          </button>
          <button
            onClick={() => {
              setActiveTab('history');
              setError('');
            }}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'history'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="w-4 h-4" />
            History & Diagnostics
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-2xl flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* --- TAB 1: TAKE TEST --- */}
      {activeTab === 'takeTest' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Test Parameters Column (Only show if test is not active) */}
          {!isTestActive && !activeResult && (
            <div className="lg:col-span-1 glass-panel border border-white/5 rounded-3xl p-6 space-y-6">
              <div className="flex items-center gap-2.5 pb-4 border-b border-slate-800/80">
                <div className="p-2 bg-purple-500/10 rounded-xl">
                  <Layers className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-white">Configure Test</h4>
                  <p className="text-[10px] text-slate-400">Select parameters to design quiz</p>
                </div>
              </div>

              <form onSubmit={handleGenerateTest} className="space-y-4">
                {/* Subject Selector */}
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Subject</label>
                  <select
                    value={selectedSubject}
                    onChange={(e) => setSelectedSubject(e.target.value)}
                    className="w-full bg-dark-900 border border-slate-700/80 px-4 py-3 rounded-xl text-xs font-bold text-slate-200 outline-none focus:border-purple-500"
                  >
                    {subjects.map((s) => (
                      <option key={s.id || s._id} value={s.name}>{s.name}</option>
                    ))}
                    {subjects.length === 0 && (
                      <>
                        <option value="Math">Math</option>
                        <option value="Physics">Physics</option>
                        <option value="Computer Science">Computer Science</option>
                      </>
                    )}
                  </select>
                </div>

                {/* Topic Input */}
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Topic / Chapter</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Limits & Derivatives"
                    value={topicInput}
                    onChange={(e) => setTopicInput(e.target.value)}
                    className="w-full bg-dark-900 border border-slate-700/80 px-4 py-3 rounded-xl text-xs font-semibold text-slate-200 outline-none focus:border-purple-500"
                  />
                </div>

                {/* Difficulty Selector */}
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Difficulty</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['Easy', 'Medium', 'Hard'].map((diff) => (
                      <button
                        key={diff}
                        type="button"
                        onClick={() => setDifficulty(diff)}
                        className={`py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          difficulty === diff
                            ? 'bg-purple-600 text-white'
                            : 'bg-dark-900 text-slate-400 border border-slate-800 hover:text-slate-200'
                        }`}
                      >
                        {diff}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Question Count Slider */}
                <div className="space-y-1.5 pt-2">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Number of Questions</label>
                    <span className="text-xs font-extrabold text-purple-400">{questionCount}</span>
                  </div>
                  <input
                    type="range"
                    min="3"
                    max="10"
                    value={questionCount}
                    onChange={(e) => setQuestionCount(e.target.value)}
                    className="w-full accent-purple-500"
                  />
                </div>

                {/* Generate Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full btn-primary bg-purple-650 hover:bg-purple-650/90 py-3.5 rounded-xl font-black text-xs transition-all cursor-pointer shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Designing Test...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Generate AI Test
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* Active Testing Panel */}
          {isTestActive && (
            <div className="lg:col-span-3 glass-panel border border-white/5 rounded-3xl p-6 md:p-8 space-y-6 max-w-3xl mx-auto">
              
              {/* Progress & Header */}
              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs font-semibold text-slate-400">
                  <span>Question {currentQuestionIdx + 1} of {quizQuestions.length}</span>
                  <span className="text-purple-400 font-bold uppercase tracking-wider">
                    {selectedSubject}: {topicInput} ({difficulty})
                  </span>
                </div>
                <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden border border-slate-850">
                  <div
                    className="bg-purple-500 h-full rounded-full transition-all duration-300"
                    style={{ width: `${((currentQuestionIdx + 1) / quizQuestions.length) * 100}%` }}
                  ></div>
                </div>
              </div>

              {/* Question Text */}
              <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-6">
                <h4 className="font-extrabold text-white text-base md:text-lg leading-relaxed">
                  {quizQuestions[currentQuestionIdx]?.question}
                </h4>

                {/* Multiple Options */}
                <div className="space-y-3">
                  {quizQuestions[currentQuestionIdx]?.options.map((opt, optIdx) => (
                    <button
                      key={optIdx}
                      onClick={() => setUserAnswers(prev => ({ ...prev, [currentQuestionIdx]: optIdx }))}
                      className={`w-full text-left p-4 rounded-xl border text-xs font-semibold transition-all cursor-pointer flex items-center justify-between group ${
                        userAnswers[currentQuestionIdx] === optIdx
                          ? 'bg-purple-600/20 border-purple-500 text-white shadow-md'
                          : 'bg-slate-950/50 border-slate-850 text-slate-350 hover:bg-slate-850/50'
                      }`}
                    >
                      <span>{opt}</span>
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                        userAnswers[currentQuestionIdx] === optIdx ? 'border-purple-400 bg-purple-500' : 'border-slate-700'
                      }`}>
                        {userAnswers[currentQuestionIdx] === optIdx && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Navigation Controllers */}
              <div className="flex justify-between items-center">
                <button
                  onClick={() => setCurrentQuestionIdx(prev => Math.max(0, prev - 1))}
                  disabled={currentQuestionIdx === 0}
                  className="px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-900 disabled:opacity-30 text-slate-300 text-xs font-bold cursor-pointer"
                >
                  Previous
                </button>

                {currentQuestionIdx < quizQuestions.length - 1 ? (
                  <button
                    onClick={() => setCurrentQuestionIdx(prev => prev + 1)}
                    className="bg-purple-650 hover:bg-purple-600 text-white px-5 py-2.5 text-xs font-bold rounded-xl cursor-pointer"
                  >
                    Next Question
                  </button>
                ) : (
                  <button
                    onClick={handleSubmitTest}
                    disabled={isSubmitting}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2.5 text-xs font-bold rounded-xl cursor-pointer shadow-lg disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Award className="w-4 h-4" />}
                    Submit Test
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Results Analysis View */}
          {activeResult && (
            <div className="lg:col-span-3 space-y-6 max-w-3xl mx-auto">
              
              {/* Score summary panel */}
              <div className="glass-panel p-6 rounded-3xl border border-white/5 bg-gradient-to-br from-dark-900 via-purple-950/10 to-dark-900 text-center space-y-4 shadow-xl">
                <Award className="w-12 h-12 text-amber-400 mx-auto animate-bounce" />
                <div>
                  <h4 className="font-extrabold text-white text-lg">Test Evaluation Finished!</h4>
                  <p className="text-xs text-slate-400 mt-0.5">{activeResult.subjectName}: {activeResult.topic}</p>
                </div>
                <div className="py-2">
                  <span className="text-4xl font-black text-purple-400 font-mono">{activeResult.score}%</span>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1">
                    {activeResult.questions.filter(q => q.userAnswer === q.correctAnswer).length} of {activeResult.totalQuestions} questions correct
                  </p>
                </div>
              </div>

              {/* AI Weakness Diagnostics Report */}
              <div className="p-5 bg-gradient-to-br from-dark-900 via-purple-950/15 to-dark-900 border border-purple-500/20 rounded-2xl space-y-3">
                <h5 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Brain className="w-5 h-5 text-purple-400 animate-pulse" />
                  🧠 AI Diagnostic Report: Weakness Analysis
                </h5>
                <div className="text-xs leading-relaxed text-slate-350 whitespace-pre-line bg-dark-900/60 p-4 border border-slate-800 rounded-xl font-medium">
                  {activeResult.weaknessAnalysis || 'Generating diagnostic insights...'}
                </div>
              </div>

              {/* Detailed answers review */}
              <div className="space-y-4">
                <h5 className="font-bold text-xs uppercase text-slate-400 tracking-wider">Detailed Answer Breakdown</h5>
                {activeResult.questions.map((q, idx) => {
                  const isCorrect = q.userAnswer === q.correctAnswer;
                  return (
                    <div key={idx} className="p-5 bg-slate-900/40 border border-slate-800 rounded-2xl space-y-3 text-xs">
                      <div className="flex items-start gap-2">
                        {isCorrect ? (
                          <CheckCircle2 className="w-4.5 h-4.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                        ) : (
                          <XCircle className="w-4.5 h-4.5 text-red-400 flex-shrink-0 mt-0.5" />
                        )}
                        <p className="font-extrabold text-white leading-relaxed">{idx + 1}. {q.question}</p>
                      </div>

                      {/* Options highlights */}
                      <div className="space-y-1.5 pl-6 font-semibold">
                        {q.options.map((opt, optIdx) => {
                          let optionClass = 'text-slate-400';
                          if (optIdx === q.correctAnswer) {
                            optionClass = 'text-emerald-400 font-bold';
                          } else if (optIdx === q.userAnswer && !isCorrect) {
                            optionClass = 'text-red-400 font-bold';
                          }
                          return (
                            <div key={optIdx} className={`flex items-center justify-between p-2.5 rounded-lg bg-dark-900/40 border border-slate-850/60 ${optionClass}`}>
                              <span>{opt}</span>
                              {optIdx === q.correctAnswer && <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 bg-emerald-500/10 rounded">Correct</span>}
                              {optIdx === q.userAnswer && optIdx !== q.correctAnswer && <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 bg-red-500/10 rounded">Your Pick</span>}
                            </div>
                          );
                        })}
                      </div>

                      {/* Explanation */}
                      <div className="pl-6 pt-1">
                        <div className="text-[11px] text-slate-350 bg-slate-950 p-3.5 border border-slate-850 rounded-xl leading-relaxed italic">
                          <strong>AI explanation:</strong> {q.explanation}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Action buttons */}
              <div className="pt-2">
                <button
                  onClick={() => {
                    setActiveResult(null);
                    setTopicInput('');
                    setQuizQuestions([]);
                  }}
                  className="w-full btn-primary bg-purple-600 hover:bg-purple-700 py-3 rounded-xl text-xs font-bold cursor-pointer transition-all"
                >
                  Configure Another Test
                </button>
              </div>
            </div>
          )}

          {/* Prompt panel instructions (Only show if not active test) */}
          {!isTestActive && !activeResult && (
            <div className="lg:col-span-2 space-y-6">
              {/* Instructions Panel */}
              <div className="glass-panel p-6 border border-white/5 rounded-3xl space-y-4">
                <h4 className="font-extrabold text-sm text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Activity className="w-5 h-5 text-purple-400" />
                  How Topic Tests Work
                </h4>
                <ul className="text-xs text-slate-300 space-y-3 pl-4 list-disc leading-relaxed">
                  <li><strong>Targeted Practice:</strong> Unlike regular quizzes, you specify the exact topic or sub-concept you want to be evaluated on.</li>
                  <li><strong>AI Generation:</strong> Groq LLM designs customized multiple-choice tests matching your selected difficulty level.</li>
                  <li><strong>Weakness Diagnostic:</strong> When you submit, the AI processes your errors to construct a personalized weakness analysis report highlighting conceptual gaps and suggesting revision actions.</li>
                  <li><strong>Progress Log:</strong> All tests are logged to your History so you can check and review weaknesses later.</li>
                </ul>
              </div>

              {/* Info panel */}
              <div className="p-5 bg-gradient-to-br from-primary-950/20 via-slate-900 to-dark-900 border border-slate-800 rounded-3xl flex items-start gap-4">
                <TrendingUp className="w-10 h-10 text-primary-400 flex-shrink-0" />
                <div>
                  <h5 className="font-bold text-xs text-white">Continuous Learning Optimization</h5>
                  <p className="text-[11px] leading-relaxed text-slate-400 mt-1">
                    Studies show that active recall coupled with quick, focused diagnostic feedback improves retention rates by up to 150%. Review your test diagnostics regularly to identify study checklist topics.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- TAB 2: HISTORY --- */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          
          {/* Main Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* List panel */}
            <div className="lg:col-span-1 space-y-4">
              <h4 className="font-bold text-xs uppercase text-slate-400 tracking-wider">Test Log History</h4>
              
              {historyLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
                </div>
              ) : testHistory.length === 0 ? (
                <div className="text-center py-12 bg-dark-900/50 border border-slate-800 rounded-2xl text-slate-450">
                  <FileText className="w-10 h-10 mx-auto text-slate-600 mb-2" />
                  <p className="text-xs font-semibold">No tests taken yet</p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
                  {testHistory.map((test) => (
                    <button
                      key={test._id}
                      onClick={() => setSelectedHistoryTest(test)}
                      className={`w-full text-left p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                        selectedHistoryTest?._id === test._id
                          ? 'bg-purple-600/10 border-purple-500'
                          : 'bg-dark-900/60 border-slate-800 hover:bg-slate-850'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-white leading-none">{test.topic}</span>
                          <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded leading-none ${
                            test.difficulty === 'Hard' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                            test.difficulty === 'Medium' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                            'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          }`}>
                            {test.difficulty}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-450">{test.subjectName} • {new Date(test.createdAt).toLocaleDateString()}</p>
                      </div>
                      <span className="text-sm font-black text-purple-400 font-mono">{test.score}%</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Diagnostic Detailed View Panel */}
            <div className="lg:col-span-2 space-y-4">
              <h4 className="font-bold text-xs uppercase text-slate-400 tracking-wider">AI Diagnostic Report Details</h4>

              {selectedHistoryTest ? (
                <div className="glass-panel border border-white/5 rounded-3xl p-6 space-y-6 animate-in fade-in duration-300">
                  
                  {/* Summary row */}
                  <div className="flex justify-between items-center pb-4 border-b border-slate-800/80">
                    <div className="space-y-1">
                      <h4 className="text-base font-extrabold text-white">{selectedHistoryTest.topic}</h4>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        {selectedHistoryTest.subjectName} • {selectedHistoryTest.difficulty} Difficulty
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-black text-purple-400 font-mono">{selectedHistoryTest.score}%</span>
                      <p className="text-[9px] text-slate-450 mt-0.5">Taken: {new Date(selectedHistoryTest.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>

                  {/* Diagnostic Insight */}
                  <div className="p-4.5 bg-gradient-to-br from-dark-900 via-purple-950/15 to-dark-900 border border-purple-500/20 rounded-2xl space-y-2">
                    <h5 className="text-[11px] font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                      <Brain className="w-4 h-4 text-purple-400" />
                      🧠 AI Weakness Analysis Diagnostics
                    </h5>
                    <p className="text-xs leading-relaxed text-slate-350 whitespace-pre-line bg-dark-900/60 p-3.5 border border-slate-800 rounded-xl">
                      {selectedHistoryTest.weaknessAnalysis || 'No analysis available for this run.'}
                    </p>
                  </div>

                  {/* Question reviews */}
                  <div className="space-y-4">
                    <h5 className="font-bold text-xs uppercase text-slate-400">Questions Review</h5>
                    {selectedHistoryTest.questions.map((q, idx) => {
                      const isCorrect = q.userAnswer === q.correctAnswer;
                      return (
                        <div key={idx} className="p-4.5 bg-slate-900/30 border border-slate-800/80 rounded-xl space-y-2.5 text-xs">
                          <div className="flex items-start gap-2">
                            {isCorrect ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                            )}
                            <p className="font-bold text-white leading-relaxed">{idx + 1}. {q.question}</p>
                          </div>
                          
                          {/* Selected / Correct */}
                          <div className="space-y-1 pl-6">
                            <p className="text-[11px] text-slate-400">
                              Selected: <span className={isCorrect ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                                {q.options[q.userAnswer] || 'Skipped'}
                              </span>
                            </p>
                            {!isCorrect && (
                              <p className="text-[11px] text-emerald-400 font-semibold">
                                Correct: {q.options[q.correctAnswer]}
                              </p>
                            )}
                          </div>

                          <p className="text-[11px] text-slate-400 bg-slate-950 p-2.5 rounded-lg border border-slate-850 pl-3 leading-relaxed mt-2 italic">
                            <strong>AI explanation:</strong> {q.explanation}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-center py-20 bg-dark-900/30 border border-slate-800 border-dashed rounded-3xl text-slate-500">
                  <BookOpen className="w-12 h-12 mx-auto text-slate-650 mb-3" />
                  <p className="text-xs font-semibold">Select a test from the log list to load AI diagnostic details.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TopicTesting;
