import React, { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Brain, Send, MessageSquare, History, Video, Play,
  GraduationCap, Cpu, ChevronRight, Loader2, Layers, HelpCircle
} from 'lucide-react';
import { aiAPI } from '../services/api';
import FlashcardsQuizModal from '../components/FlashcardsQuizModal';
import VoiceInputButton from '../components/VoiceInputButton';

const STORAGE_KEY = 'ai_chat_messages';
const HISTORY_KEY = 'ai_chat_history';

const AIAssistant = () => {
  const { subjects, setNotifications } = useOutletContext();
  const [academicLevel, setAcademicLevel] = useState("BS");
  const [selectedSubject, setSelectedSubject] = useState("Math");
  const [showLearningModal, setShowLearningModal] = useState(false);
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);

  // ─── PERSIST MESSAGES IN LOCALSTORAGE ───
  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [{
        sender: "ai",
        text: "Hello! I am your advanced AI Study Assistant. Choose your academic level above, ask me any study concepts, and I'll generate customized breakdowns and suggest online lecture videos tailored for you.",
        level: "BS",
        lectures: []
      }];
    } catch {
      return [{
        sender: "ai",
        text: "Hello! I am your AI Study Assistant. Ask me anything!",
        level: "BS",
        lectures: []
      }];
    }
  });

  // ─── PERSIST CHAT HISTORY ───
  const [chatHistory, setChatHistory] = useState(() => {
    try {
      const saved = localStorage.getItem(HISTORY_KEY);
      return saved ? JSON.parse(saved) : [
        { id: 1, title: "Calculus Limits & Integrals", level: "BS", subject: "Math" },
        { id: 2, title: "Quantum Physics Introduction", level: "PhD", subject: "Physics" },
        { id: 3, title: "Recursion Stack Call tracing", level: "College", subject: "Computer Science" }
      ];
    } catch {
      return [];
    }
  });

  const [inputVal, setInputVal] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeHistoryId, setActiveHistoryId] = useState(null);
  const [activeVideoId, setActiveVideoId] = useState(null);
  const [activeVideoTitle, setActiveVideoTitle] = useState("");
  const [assistantLoadingText, setAssistantLoadingText] = useState("AI is thinking...");

  // Save messages to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  // Save history to localStorage
  useEffect(() => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(chatHistory));
  }, [chatHistory]);

  // Auto scroll
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, isStreaming]);

  const lecturesDatabase = {
    Math: {
      School: [
        { id: "KfzA4mXGv5k", title: "Introduction to Calculus & Limits", author: "Khan Academy", duration: "12m", thumbnail: "https://images.unsplash.com/photo-1509228468518-180dd4864904?w=400&q=80" },
        { id: "302g4iPmU7A", title: "Algebra Basics: What Is Algebra?", author: "Math Antics", duration: "14m", thumbnail: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=400&q=80" }
      ],
      College: [
        { id: "F3qC5_Lz0zU", title: "Calculus 1 - Full Course Lecture", author: "Professor Leonard", duration: "2h 45m", thumbnail: "https://images.unsplash.com/photo-1453733190148-c44698c26588?w=400&q=80" }
      ],
      BS: [
        { id: "h7n3p2_uA7s", title: "Linear Algebra: Vector Spaces & Bases", author: "Gilbert Strang", duration: "50m", thumbnail: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=400&q=80" }
      ]
    }
  };

  const handleSend = async (e, textOverride = null) => {
    if (e) e.preventDefault();
    const query = (textOverride || inputVal).trim();
    if (!query) return;

    const newMsgUser = { sender: 'user', text: query, level: academicLevel };
    setMessages(prev => [...prev, newMsgUser]);
    setInputVal('');
    setIsStreaming(true);
    setAssistantLoadingText("Analyzing study query...");
    const ast1 = setTimeout(() => setAssistantLoadingText("Consulting study guides..."), 1000);
    const ast2 = setTimeout(() => setAssistantLoadingText("Synthesizing explanation..."), 2200);
    const ast3 = setTimeout(() => setAssistantLoadingText("Formatting lecture references..."), 3500);

    try {
      const { data, ok } = await aiAPI.chat({
        message: `[Academic Level: ${academicLevel}] [Subject: ${selectedSubject}] ${query}`,
        history: []
      });

      if (ok && data?.response) {
        const subjectLectures = lecturesDatabase[selectedSubject] || lecturesDatabase['Math'];
        const recommendedVideos = subjectLectures?.[academicLevel] || subjectLectures?.['BS'] || [];

        const aiMsg = {
          sender: 'ai',
          text: data.response,
          lectures: recommendedVideos,
          level: academicLevel
        };

        setMessages(prev => [...prev, aiMsg]);

        if (data.rebalanced && setNotifications) {
          setNotifications(prev => [{
            id: Date.now(),
            text: `🤖 AI rebalanced schedule! ${data.rescheduledCount} missed task(s) rescheduled.`,
            read: false
          }, ...prev]);
        }

        const historyTitle = query.length > 40 ? query.substring(0, 40) + '...' : query;
        const newHistory = {
          id: Date.now(),
          title: historyTitle,
          level: academicLevel,
          subject: selectedSubject
        };
        setChatHistory(prev => [newHistory, ...prev.slice(0, 9)]);

      } else {
        setMessages(prev => [...prev, {
          sender: 'ai',
          text: 'Sorry, I could not process that. Please try again.',
          lectures: [],
          level: academicLevel
        }]);
      }
    } catch (error) {
      console.warn('AI chat failed:', error);
      setMessages(prev => [...prev, {
        sender: 'ai',
        text: 'Connection error. Please check your internet and try again.',
        lectures: [],
        level: academicLevel
      }]);
    } finally {
      if (typeof ast1 !== 'undefined') clearTimeout(ast1);
      if (typeof ast2 !== 'undefined') clearTimeout(ast2);
      if (typeof ast3 !== 'undefined') clearTimeout(ast3);
      setIsStreaming(false);
    }
  };

  const loadHistoryItem = (item) => {
    setActiveHistoryId(item.id);
    setAcademicLevel(item.level);
    setSelectedSubject(item.subject);
    setMessages([
      { sender: "user", text: `Explain ${item.title} concepts.`, level: item.level },
      {
        sender: "ai",
        text: `Loaded session: **${item.title}** at **${item.level}** level for **${item.subject}**.\n\nAsk any follow-up questions!`,
        level: item.level,
        lectures: (lecturesDatabase[item.subject] && lecturesDatabase[item.subject][item.level]) || []
      }
    ]);
  };

  const handleClearHistory = () => {
    setChatHistory([]);
    setActiveHistoryId(null);
    localStorage.removeItem(HISTORY_KEY);
  };

  const handleClearChat = () => {
    const initial = [{
      sender: "ai",
      text: "Chat cleared! Ask me anything about your studies.",
      level: "BS",
      lectures: []
    }];
    setMessages(initial);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
  };

  return (
    <div className="animate-in fade-in duration-500 flex flex-col lg:flex-row gap-6 h-[calc(100vh-120px)] overflow-hidden">

      {/* LEFT SIDEBAR - ARCHIVES */}
      <div className="lg:w-72 bg-dark-900/60 border border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between overflow-hidden flex-shrink-0">
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-purple-400" />
              Chat Archives
            </h3>
            <button
              onClick={handleClearHistory}
              className="text-[10px] text-slate-500 hover:text-red-400 font-semibold cursor-pointer"
            >
              Clear
            </button>
          </div>

          <div className="space-y-2 overflow-y-auto flex-1 pr-1">
            {chatHistory.map(hist => (
              <button
                key={hist.id}
                onClick={() => loadHistoryItem(hist)}
                className={`w-full flex items-center justify-between text-left p-3 rounded-xl border transition-all cursor-pointer ${
                  activeHistoryId === hist.id
                    ? 'bg-gradient-to-r from-primary-500/20 to-purple-500/15 border-primary-400 text-white font-extrabold text-sm shadow-md scale-[1.02]'
                    : 'bg-transparent border-transparent hover:bg-slate-800/40 text-slate-350 text-xs font-bold hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <MessageSquare className="w-4 h-4 text-purple-400 flex-shrink-0" />
                  <span className="truncate">{hist.title}</span>
                </div>
                <span className="text-[9px] bg-slate-800 border border-slate-700 px-2 py-0.5 rounded-md font-mono uppercase text-teal-400 font-bold flex-shrink-0 ml-1">
                  {hist.level}
                </span>
              </button>
            ))}
            {chatHistory.length === 0 && (
              <p className="text-center text-slate-600 text-[11px] italic py-8">No saved sessions.</p>
            )}
          </div>

          <div className="pt-4 border-t border-slate-800 mt-3 hidden lg:block text-[10px] text-slate-500 leading-relaxed">
            <Cpu className="w-4 h-4 text-purple-400 mb-1" />
            Powered by Groq LLM — Context-aware Study Tutor.
          </div>
        </div>
      </div>

      {/* RIGHT WORKSPACE */}
      <div className="flex-1 bg-dark-900/40 border border-slate-800/50 rounded-2xl flex flex-col overflow-hidden relative">
        
        {/* Chat Header */}
        <div className="p-4 bg-gradient-to-r from-primary-950/20 via-purple-950/20 to-dark-900/60 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-tr from-primary-500 to-purple-600 rounded-xl">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-white">AI Chat Tutor</h3>
              <p className="text-[10px] text-slate-400">Personal context-aware educational assistant</p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <GraduationCap className="w-4 h-4 text-slate-500" />
              <select
                value={academicLevel}
                onChange={(e) => setAcademicLevel(e.target.value)}
                className="bg-dark-900 border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold outline-none text-slate-100 animate-in fade-in"
              >
                <option value="School">🎒 School</option>
                <option value="College">🏫 College</option>
                <option value="BS">🎓 BS / Undergrad</option>
                <option value="MS">🔬 MS / Graduate</option>
                <option value="PhD">🎓 PhD Research</option>
              </select>
            </div>

            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="bg-dark-900 border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold outline-none text-slate-100"
            >
              {subjects.map(s => (
                <option key={s.id || s.name} value={s.name}>{s.name}</option>
              ))}
              {subjects.length === 0 && (
                <>
                  <option value="Math">Math</option>
                  <option value="Physics">Physics</option>
                  <option value="Computer Science">Computer Science</option>
                </>
              )}
            </select>

            <button
              onClick={() => setShowLearningModal(true)}
              className="text-xs bg-gradient-to-r from-primary-500 to-purple-600 hover:from-primary-600 hover:to-purple-700 text-white font-extrabold cursor-pointer px-3 py-1.5 rounded-lg transition-all shadow-md flex items-center gap-1.5"
            >
              <Layers className="w-3.5 h-3.5" />
              Flashcards & Quiz
            </button>

            <button
              onClick={handleClearChat}
              className="text-[10px] text-slate-500 hover:text-red-400 font-semibold cursor-pointer border border-slate-700 px-2 py-1.5 rounded-lg hover:border-red-500/30 transition-all"
            >
              Clear Chat
            </button>
          </div>
        </div>

        {/* Messages list */}
        <div
          ref={chatContainerRef}
          className="flex-1 p-4 overflow-y-auto space-y-6"
          style={{ minHeight: 0 }}
        >
          {messages.map((msg, index) => (
            <div key={index} className="space-y-4">
              <div className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-4 rounded-2xl border text-xs leading-relaxed ${
                  msg.sender === 'user'
                    ? 'bg-primary-500/10 border-primary-500/20 text-slate-100 rounded-tr-none shadow-md'
                    : 'bg-slate-900/60 border-slate-800 text-slate-200 rounded-tl-none'
                }`}>
                  <div className="whitespace-pre-line font-medium leading-relaxed">
                    {msg.text}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {isStreaming && (
            <div className="flex justify-start">
              <div className="bg-slate-900/60 border border-slate-800 text-slate-400 p-4 rounded-2xl rounded-tl-none text-xs flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-primary-400 animate-spin" />
                <span>{assistantLoadingText}</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Suggested Prompts Row */}
        <div className="px-4 py-2 border-t border-slate-800/80 bg-slate-900/10 flex items-center gap-2 overflow-x-auto whitespace-nowrap scrollbar-none flex-shrink-0">
          <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest mr-1.5 flex-shrink-0">Tutor Prompts:</span>
          {[
            { label: "Explain simply", prompt: "Explain the main logic simply using real-world analogies." },
            { label: "Deep dive details", prompt: "Conduct a deep structural analysis of this topic with formulas." },
            { label: "Give practical examples", prompt: "Give me 2 practical examples of this concept." },
            { label: "Create review summary", prompt: "Create a structured summary of this topic." },
            { label: "Help me study", prompt: "Suggest a study strategy for this module." }
          ].map((item, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSend(null, item.prompt)}
              className="px-3 py-1 rounded-full bg-slate-800/60 hover:bg-slate-750 border border-slate-750 hover:border-slate-650 text-[10px] font-semibold text-slate-300 hover:text-white transition-all cursor-pointer flex-shrink-0"
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Input Form with Voice Button */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/20 flex-shrink-0">
          <form onSubmit={handleSend} className="flex gap-2.5">
            <input
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder={`Ask about ${selectedSubject} (${academicLevel} level)...`}
              className="flex-1 bg-dark-900 border border-slate-700 px-4 py-3 rounded-xl text-xs font-semibold focus:border-primary-500 outline-none text-slate-100"
            />
            
            {/* Context-aware voice mic input button */}
            <VoiceInputButton onTranscript={(text) => setInputVal(text)} />

            <button
              type="submit"
              disabled={isStreaming || !inputVal.trim()}
              className="px-5 py-3 rounded-xl bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white font-bold flex items-center justify-center transition-all cursor-pointer"
            >
              <Send className="w-4 h-4 mr-1.5" />
              Ask
            </button>
          </form>
        </div>
      </div>

      <FlashcardsQuizModal
        isOpen={showLearningModal}
        onClose={() => setShowLearningModal(false)}
        subjects={subjects}
        onQuizCompleted={(score) => {
          if (setNotifications) {
            setNotifications(prev => [{
              id: Date.now(),
              text: `🎯 Quiz Completed! Score: ${score}% (${selectedSubject})`,
              read: false
            }, ...prev]);
          }
        }}
      />
    </div>
  );
};

export default AIAssistant;