import React, { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Brain, Send, MessageSquare, History, Video, Play,
  GraduationCap, Cpu, ChevronRight, Loader2, Layers
} from 'lucide-react';
import { aiAPI } from '../services/api';
import VoiceInputButton from '../components/VoiceInputButton';
import FlashcardsQuizModal from '../components/FlashcardsQuizModal';

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

  // Save messages to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  // Save history to localStorage
  useEffect(() => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(chatHistory));
  }, [chatHistory]);

  // Auto scroll to bottom — only scroll the chat container not the whole page
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
        { id: "F3qC5_Lz0zU", title: "Calculus 1 - Full Course Lecture", author: "Professor Leonard", duration: "2h 45m", thumbnail: "https://images.unsplash.com/photo-1453733190148-c44698c26588?w=400&q=80" },
        { id: "1XXIPV2S6KA", title: "Matrix Algebra & Determinants", author: "MIT OpenCourseWare", duration: "48m", thumbnail: "https://images.unsplash.com/photo-1518156677180-95a2893f3e9f?w=400&q=80" }
      ],
      BS: [
        { id: "h7n3p2_uA7s", title: "Linear Algebra: Vector Spaces & Bases", author: "Gilbert Strang", duration: "50m", thumbnail: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=400&q=80" },
        { id: "733SjV2_N0w", title: "Multi-Variable Calculus - Triple Integrals", author: "MIT 18.02", duration: "52m", thumbnail: "https://images.unsplash.com/photo-1509228468518-180dd4864904?w=400&q=80" }
      ],
      MS: [
        { id: "wK93p2e_N0w", title: "Partial Differential Equations", author: "Stanford University", duration: "1h 10m", thumbnail: "https://images.unsplash.com/photo-1518156677180-95a2893f3e9f?w=400&q=80" },
        { id: "u18SjV2_N0w", title: "Numerical Analysis & Error Bounds", author: "Harvard Applied Math", duration: "58m", thumbnail: "https://images.unsplash.com/photo-1453733190148-c44698c26588?w=400&q=80" }
      ],
      PhD: [
        { id: "q93p2e_PhD1", title: "Differential Geometry: Manifolds", author: "IAS Princeton", duration: "1h 25m", thumbnail: "https://images.unsplash.com/photo-1509228468518-180dd4864904?w=400&q=80" },
        { id: "w28SjV2_PhD2", title: "Topology & Homology Theory", author: "Oxford Mathematics", duration: "1h 40m", thumbnail: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=400&q=80" }
      ]
    },
    Physics: {
      School: [
        { id: "ObH0PoWBeHM", title: "Newtonian Motion, Forces & Gravity", author: "CrashCourse Physics", duration: "10m", thumbnail: "https://images.unsplash.com/photo-1614064641938-3bbee52942c7?w=400&q=80" },
        { id: "EwY6p-r_hyY", title: "What is Light & Waves?", author: "Kurzgesagt Science", duration: "8m", thumbnail: "https://images.unsplash.com/photo-1507668077129-56e32842fceb?w=400&q=80" }
      ],
      College: [
        { id: "7Zc9NuM90JY", title: "Physics I: Classical Mechanics", author: "Walter Lewin (MIT)", duration: "50m", thumbnail: "https://images.unsplash.com/photo-1607988795691-3d0147b43231?w=400&q=80" },
        { id: "983SjV2_N0w", title: "Electromagnetism - Gauss's Law", author: "Yale Course Lectures", duration: "55m", thumbnail: "https://images.unsplash.com/photo-1518156677180-95a2893f3e9f?w=400&q=80" }
      ],
      BS: [
        { id: "2h1E3YJMKfA", title: "Modern Physics: Special Relativity", author: "Stanford Susskind", duration: "1h 15m", thumbnail: "https://images.unsplash.com/photo-1614064641938-3bbee52942c7?w=400&q=80" },
        { id: "k18SjV2_N0w", title: "Quantum Physics & Wave Functions", author: "MIT 8.04", duration: "54m", thumbnail: "https://images.unsplash.com/photo-1507668077129-56e32842fceb?w=400&q=80" }
      ],
      MS: [
        { id: "u28SjV2_MS1", title: "Statistical Mechanics", author: "Oxford University", duration: "1h 05m", thumbnail: "https://images.unsplash.com/photo-1607988795691-3d0147b43231?w=400&q=80" },
        { id: "y28SjV2_MS2", title: "Advanced Quantum Field Theory", author: "Perimeter Institute", duration: "1h 20m", thumbnail: "https://images.unsplash.com/photo-1518156677180-95a2893f3e9f?w=400&q=80" }
      ],
      PhD: [
        { id: "x28SjV2_PhD1", title: "General Relativity: Einstein Field Equations", author: "Stanford Susskind", duration: "1h 38m", thumbnail: "https://images.unsplash.com/photo-1614064641938-3bbee52942c7?w=400&q=80" },
        { id: "z28SjV2_PhD2", title: "String Theory & Holographic Duality", author: "IAS Princeton", duration: "1h 45m", thumbnail: "https://images.unsplash.com/photo-1507668077129-56e32842fceb?w=400&q=80" }
      ]
    },
    "Computer Science": {
      School: [
        { id: "k5E2A5a0Vn0", title: "Programming Basics with Python", author: "Coding for Beginners", duration: "15m", thumbnail: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=400&q=80" },
        { id: "t28SjV2_N0w", title: "What is an Algorithm?", author: "GCF LearnFree", duration: "6m", thumbnail: "https://images.unsplash.com/photo-1607799279861-4dd421887fb3?w=400&q=80" }
      ],
      College: [
        { id: "yOzzT3c3J8o", title: "CS50 Introduction to Computer Science", author: "David J. Malan (Harvard)", duration: "2h 15m", thumbnail: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=400&q=80" },
        { id: "r28SjV2_N0w", title: "Object Oriented Programming in Java", author: "freeCodeCamp", duration: "1h 30m", thumbnail: "https://images.unsplash.com/photo-1607799279861-4dd421887fb3?w=400&q=80" }
      ],
      BS: [
        { id: "8hly31x1v1s", title: "Data Structures & Algorithms Full Course", author: "William Fiset", duration: "8h 12m", thumbnail: "https://images.unsplash.com/photo-1607799279861-4dd421887fb3?w=400&q=80" },
        { id: "0n3jM_L-73E", title: "Advanced Algorithms Lectures (CS224)", author: "Harvard University", duration: "1h 12m", thumbnail: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=400&q=80" }
      ],
      MS: [
        { id: "m28SjV2_MS1", title: "Distributed Systems & Cloud Architecture", author: "MIT 6.824", duration: "1h 22m", thumbnail: "https://images.unsplash.com/photo-1607799279861-4dd421887fb3?w=400&q=80" },
        { id: "n28SjV2_MS2", title: "Machine Learning: Neural Networks", author: "Stanford CS229", duration: "1h 18m", thumbnail: "https://images.unsplash.com/photo-1507668077129-56e32842fceb?w=400&q=80" }
      ],
      PhD: [
        { id: "p28SjV2_PhD1", title: "Theory of Computation", author: "MIT OpenCourseWare", duration: "1h 20m", thumbnail: "https://images.unsplash.com/photo-1607799279861-4dd421887fb3?w=400&q=80" },
        { id: "q28SjV2_PhD2", title: "Quantum Computing Algorithms", author: "IAS Princeton", duration: "1h 35m", thumbnail: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=400&q=80" }
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

        // save to history sidebar
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
    // ─── FIX 1: use h-full instead of min-h to prevent page expansion ───
    <div className="animate-in fade-in duration-500 flex flex-col lg:flex-row gap-6 h-[calc(100vh-120px)] overflow-hidden">

      {/* LEFT SIDEBAR */}
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

          {/* ─── FIX 2: overflow-y-auto on sidebar list only ─── */}
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
            Powered by Groq LLM — School to PhD level support.
          </div>
        </div>
      </div>

      {/* RIGHT CHAT WORKSPACE */}
      {/* ─── FIX 3: flex-col with fixed height, no page scroll ─── */}
      <div className="flex-1 bg-dark-900/40 border border-slate-800/50 rounded-2xl flex flex-col overflow-hidden relative">

        {/* Top Bar */}
        <div className="p-4 bg-gradient-to-r from-primary-950/20 via-purple-950/20 to-dark-900/60 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-tr from-primary-500 to-purple-600 rounded-xl">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-white">Academic Concept Explainer</h3>
              <p className="text-[10px] text-slate-400">Ask questions, read guides, watch lectures</p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <GraduationCap className="w-4 h-4 text-slate-500" />
              <select
                value={academicLevel}
                onChange={(e) => setAcademicLevel(e.target.value)}
                className="bg-dark-900 border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold outline-none text-slate-100"
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
                <option key={s.id} value={s.name}>{s.name}</option>
              ))}
              <option value="Math">Math</option>
              <option value="Physics">Physics</option>
              <option value="Computer Science">Computer Science</option>
              <option value="General">General</option>
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

        {/* ─── FIX 4: Chat messages scroll INSIDE this div only ─── */}
        <div
          ref={chatContainerRef}
          className="flex-1 p-4 overflow-y-auto space-y-6"
          style={{ minHeight: 0 }}
        >
          {messages.map((msg, index) => {
            const hasLectures = msg.lectures && msg.lectures.length > 0;
            return (
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

                {hasLectures && (
                  <div className="pl-0 sm:pl-4 space-y-3 animate-in fade-in duration-300">
                    <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider flex items-center gap-1.5">
                      <Video className="w-3.5 h-3.5 text-purple-400" />
                      Recommended Lectures ({msg.level})
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {msg.lectures.map(video => (
                        <div
                          key={video.id}
                          onClick={() => { setActiveVideoId(video.id); setActiveVideoTitle(video.title); }}
                          className="glass-panel border border-slate-800 rounded-xl overflow-hidden hover:border-slate-700 transition-all cursor-pointer flex gap-3 p-2 group bg-slate-900/40"
                        >
                          <div className="relative w-20 aspect-video rounded-lg overflow-hidden flex-shrink-0 bg-slate-800">
                            <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center group-hover:bg-black/20 transition-colors">
                              <Play className="w-5 h-5 text-white fill-current" />
                            </div>
                            <span className="absolute bottom-1 right-1 bg-black/75 px-1 py-0.5 rounded text-[8px] font-bold font-mono text-slate-300">
                              {video.duration}
                            </span>
                          </div>
                          <div className="flex-1 flex flex-col justify-between py-0.5 min-w-0 text-[10px]">
                            <div>
                              <h4 className="font-bold text-slate-200 truncate group-hover:text-primary-400 transition-colors">{video.title}</h4>
                              <p className="text-slate-500 font-semibold mt-0.5">{video.author}</p>
                            </div>
                            <span className="text-primary-400 font-bold flex items-center gap-0.5">
                              Watch <ChevronRight className="w-3 h-3" />
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {isStreaming && (
            <div className="flex justify-start">
              <div className="bg-slate-900/60 border border-slate-800 text-slate-400 p-4 rounded-2xl rounded-tl-none text-xs flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-primary-400 animate-spin" />
                <span>AI is thinking...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Video Player Modal */}
        {activeVideoId && (
          <div className="absolute inset-0 bg-dark-900/90 backdrop-blur-md z-50 p-6 flex flex-col justify-center items-center animate-in fade-in duration-300">
            <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
              <div className="p-4 bg-slate-800 flex items-center justify-between border-b border-slate-700">
                <h4 className="font-bold text-xs text-white truncate max-w-[80%]">{activeVideoTitle}</h4>
                <button
                  onClick={() => setActiveVideoId(null)}
                  className="px-2.5 py-1 bg-slate-700 border border-slate-600 hover:bg-slate-600 rounded-lg text-[10px] font-bold text-slate-300 cursor-pointer"
                >
                  Close Player
                </button>
              </div>
              <div className="aspect-video w-full">
                <iframe
                  className="w-full h-full"
                  src={`https://www.youtube.com/embed/${activeVideoId}?autoplay=1`}
                  title={activeVideoTitle}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                ></iframe>
              </div>
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/20 space-y-3 flex-shrink-0">
          <div className="flex gap-2 overflow-x-auto whitespace-nowrap scrollbar-none text-[10px] pb-1">
            {[
              { label: "💡 Explain Simply", text: `Explain ${selectedSubject} like I am 5 years old.` },
              { label: "📚 Revision Guide", text: `Create a revision checklist for ${selectedSubject}.` },
              { label: "🔬 Advanced Theory", text: `What are the advanced theoretical models for ${selectedSubject}?` },
              { label: "🎥 Video Lectures", text: `Recommend video lectures for ${selectedSubject}.` }
            ].map((p, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(null, p.text)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-900/50 hover:bg-slate-800 text-slate-300 font-bold transition-all cursor-pointer"
              >
                {p.label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSend} className="flex gap-2.5">
            <input
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder={`Ask about ${selectedSubject} (${academicLevel} level)...`}
              className="flex-1 bg-dark-900 border border-slate-700 px-4 py-3 rounded-xl text-xs font-semibold focus:border-primary-500 outline-none text-slate-100"
            />
            <VoiceInputButton
              onTranscript={(text) => {
                setInputVal(text);
                handleSend(null, text);
              }}
            />
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