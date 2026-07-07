import React, { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Brain,
  Send,
  MessageSquare,
  History,
  Video,
  Play,
  GraduationCap,
  Cpu,
  ChevronRight,
  Loader2
} from 'lucide-react';

const AIAssistant = () => {
  const { subjects } = useOutletContext();

  // Core Chat State
  const [academicLevel, setAcademicLevel] = useState("BS"); // School, College, BS, MS, PhD
  const [selectedSubject, setSelectedSubject] = useState("Math");
  const [messages, setMessages] = useState([
    {
      sender: "ai",
      text: "Hello! I am your advanced AI Study Assistant. Choose your academic level above, ask me any study concepts, and I'll generate customized breakdowns and suggest online lecture videos tailored for you.",
      level: "BS",
      lectures: []
    }
  ]);
  const [inputVal, setInputVal] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef(null);

  // Chat History Sidebar State
  const [chatHistory, setChatHistory] = useState([
    { id: 1, title: "Calculus Limits & Integrals", level: "BS", subject: "Math" },
    { id: 2, title: "Quantum Physics Introduction", level: "PhD", subject: "Physics" },
    { id: 3, title: "Recursion Stack Call tracing", level: "College", subject: "Computer Science" }
  ]);
  const [activeHistoryId, setActiveHistoryId] = useState(null);

  // Video Lecture Modal State
  const [activeVideoId, setActiveVideoId] = useState(null); // Embedded YouTube ID
  const [activeVideoTitle, setActiveVideoTitle] = useState("");

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  // Curated Lectures Database
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
        { id: "wK93p2e_N0w", title: "Partial Differential Equations - Analytical Solutions", author: "Stanford University", duration: "1h 10m", thumbnail: "https://images.unsplash.com/photo-1518156677180-95a2893f3e9f?w=400&q=80" },
        { id: "u18SjV2_N0w", title: "Numerical Analysis & Error Bounds", author: "Harvard Applied Math", duration: "58m", thumbnail: "https://images.unsplash.com/photo-1453733190148-c44698c26588?w=400&q=80" }
      ],
      PhD: [
        { id: "q93p2e_PhD1", title: "Differential Geometry: Manifolds & curvature tensors", author: "IAS Princeton", duration: "1h 25m", thumbnail: "https://images.unsplash.com/photo-1509228468518-180dd4864904?w=400&q=80" },
        { id: "w28SjV2_PhD2", title: "Topology & Homology Theory Lectures", author: "Oxford Mathematics", duration: "1h 40m", thumbnail: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=400&q=80" }
      ]
    },
    Physics: {
      School: [
        { id: "ObH0PoWBeHM", title: "Newtonian Motion, Forces & Gravity", author: "CrashCourse Physics", duration: "10m", thumbnail: "https://images.unsplash.com/photo-1614064641938-3bbee52942c7?w=400&q=80" },
        { id: "EwY6p-r_hyY", title: "What is Light & Waves?", author: "Kurzgesagt Science", duration: "8m", thumbnail: "https://images.unsplash.com/photo-1507668077129-56e32842fceb?w=400&q=80" }
      ],
      College: [
        { id: "7Zc9NuM90JY", title: "Physics I: Classical Mechanics Lectures", author: "Walter Lewin (MIT)", duration: "50m", thumbnail: "https://images.unsplash.com/photo-1607988795691-3d0147b43231?w=400&q=80" },
        { id: "983SjV2_N0w", title: "Electromagnetism - Gauss's Law", author: "Yale Course Lectures", duration: "55m", thumbnail: "https://images.unsplash.com/photo-1518156677180-95a2893f3e9f?w=400&q=80" }
      ],
      BS: [
        { id: "2h1E3YJMKfA", title: "Modern Physics: Special Relativity", author: "Stanford Susskind", duration: "1h 15m", thumbnail: "https://images.unsplash.com/photo-1614064641938-3bbee52942c7?w=400&q=80" },
        { id: "k18SjV2_N0w", title: "Quantum Physics Foundations & Wave Functions", author: "MIT 8.04", duration: "54m", thumbnail: "https://images.unsplash.com/photo-1507668077129-56e32842fceb?w=400&q=80" }
      ],
      MS: [
        { id: "u28SjV2_MS1", title: "Statistical Mechanics & Thermodynamics", author: "Oxford University", duration: "1h 05m", thumbnail: "https://images.unsplash.com/photo-1607988795691-3d0147b43231?w=400&q=80" },
        { id: "y28SjV2_MS2", title: "Advanced Quantum Field Theory", author: "Perimeter Institute", duration: "1h 20m", thumbnail: "https://images.unsplash.com/photo-1518156677180-95a2893f3e9f?w=400&q=80" }
      ],
      PhD: [
        { id: "x28SjV2_PhD1", title: "General Relativity: Einstein Field Equations", author: "Stanford Susskind", duration: "1h 38m", thumbnail: "https://images.unsplash.com/photo-1614064641938-3bbee52942c7?w=400&q=80" },
        { id: "z28SjV2_PhD2", title: "String Theory & Holographic Duality Concepts", author: "IAS Princeton", duration: "1h 45m", thumbnail: "https://images.unsplash.com/photo-1507668077129-56e32842fceb?w=400&q=80" }
      ]
    },
    "Computer Science": {
      School: [
        { id: "k5E2A5a0Vn0", title: "Programming Basics with Python", author: "Coding for Beginners", duration: "15m", thumbnail: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=400&q=80" },
        { id: "t28SjV2_N0w", title: "What is an Algorithm?", author: "GCF LearnFree", duration: "6m", thumbnail: "https://images.unsplash.com/photo-1607799279861-4dd421887fb3?w=400&q=80" }
      ],
      College: [
        { id: "yOzzT3c3J8o", title: "CS50 Introduction to Computer Science", author: "David J. Malan (Harvard)", duration: "2h 15m", thumbnail: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=400&q=80" },
        { id: "r28SjV2_N0w", title: "Object Oriented Programming (OOP) in Java", author: "freeCodeCamp", duration: "1h 30m", thumbnail: "https://images.unsplash.com/photo-1607799279861-4dd421887fb3?w=400&q=80" }
      ],
      BS: [
        { id: "8hly31x1v1s", title: "Data Structures & Algorithms Full Course", author: "William Fiset", duration: "8h 12m", thumbnail: "https://images.unsplash.com/photo-1607799279861-4dd421887fb3?w=400&q=80" },
        { id: "0n3jM_L-73E", title: "Advanced Algorithms Lectures (CS224)", author: "Harvard University", duration: "1h 12m", thumbnail: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=400&q=80" }
      ],
      MS: [
        { id: "m28SjV2_MS1", title: "Distributed Systems & Cloud Architecture Lectures", author: "MIT 6.824", duration: "1h 22m", thumbnail: "https://images.unsplash.com/photo-1607799279861-4dd421887fb3?w=400&q=80" },
        { id: "n28SjV2_MS2", title: "Machine Learning: Neural Networks & Backprop", author: "Stanford CS229", duration: "1h 18m", thumbnail: "https://images.unsplash.com/photo-1507668077129-56e32842fceb?w=400&q=80" }
      ],
      PhD: [
        { id: "p28SjV2_PhD1", title: "Theory of Computation & Complexity Classes", author: "MIT OpenCourseWare", duration: "1h 20m", thumbnail: "https://images.unsplash.com/photo-1607799279861-4dd421887fb3?w=400&q=80" },
        { id: "q28SjV2_PhD2", title: "Quantum Computing & Quantum Information Algorithms", author: "IAS Princeton", duration: "1h 35m", thumbnail: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=400&q=80" }
      ]
    }
  };

  // Trigger send query
  const handleSend = (e, textOverride = null) => {
    if (e) e.preventDefault();
    const query = (textOverride || inputVal).trim();
    if (!query) return;

    // Add User Message
    const newMsgUser = { sender: "user", text: query, level: academicLevel };
    setMessages(prev => [...prev, newMsgUser]);
    setInputVal("");
    setIsStreaming(true);

    // AI Responses Logic aligned with subject & academic levels
    setTimeout(() => {
      let explanation = "";

      // Retrieve recommended videos
      const currentSubject = selectedSubject || "Math";
      const subjectLectures = lecturesDatabase[currentSubject] || lecturesDatabase.Math;
      const recommendedVideos = subjectLectures[academicLevel] || subjectLectures.BS;

      // 1. CONCEPT EXPLANATION OUTLINES BY LEVEL
      if (academicLevel === "PhD") {
        explanation = `🎓 **[PhD RESEARCH LEVEL SUMMARY - ${currentSubject}]**\n\nTo unpack the advanced dimensions of *"${query}"*:\n\n1. **Theoretical Foundations**: This concept interfaces with quantum operator mechanics and tensor fields. The principal model maps state space transformations via high-dimensional manifolds.\n\n2. **Critical Formalisms & Equations**:\nLet $\\mathcal{H}$ be the Hilbert space. The structural eigenvalues decompose as:\n$$\\hat{H}\\Psi = E\\Psi$$\n\n3. **Current Research Gaps**: Peer-reviewed publications target non-linear boundary constraints and mathematical singularities. Review IAS & Princeton seminar notes for asymptotic proofs.`;
      } else if (academicLevel === "MS") {
        explanation = `🔬 **[GRADUATE LEVEL ANALYSIS - ${currentSubject}]**\n\nAnalyzing *"${query}"* through a rigorous graduate lens:\n\n1. **Core Thesis**: We define this process as a set of differential constraint manifolds requiring numerical convergence.\n\n2. **Applied Math Models**:\nUsing partial differentiation matrices:\n$$\\nabla^2 \\phi = \\frac{1}{v^2} \\frac{\\partial^2 \\phi}{\\partial t^2}$$\n\n3. **Practical Applications**: High-performance computing kernels utilize these boundary models for simulation grids and neural tensor propagation.`;
      } else if (academicLevel === "BS") {
        explanation = `🎓 **[UNDERGRADUATE / BS ROADMAP - ${currentSubject}]**\n\nHere is the university-grade breakdown of *"${query}"*:\n\n1. **Primary Definition**: This topic outlines the relationship between variables (differential equations, system limits, or algorithm complexity classes).\n\n2. **Key Formulas to Memorize**:\n$$\\int u\\,dv = uv - \\int v\\,du$$\n\n3. **Common Exams Pitfalls**: Always check integration bases and coordinate boundaries. For code variables, draw a Call Stack tree to ensure recursive loops reach the base stop conditions cleanly.`;
      } else if (academicLevel === "College") {
        explanation = `🏫 **[COLLEGE LEVEL EXPLAINER - ${currentSubject}]**\n\nLet's break down *"${query}"* for standard exam boards:\n\n1. **Simplifying the Concept**: Think of this as a rules-based machine. You supply input vectors (like forces, equations, or statements), and it applies formulas to produce outputs.\n\n2. **Fundamental Formulas**:\n$$\\Sigma F = m \\cdot a$$\n\n3. **Revision Tip**: Practice 5 past exam board problems. Drawing visual diagrams (forces or flowcharts) makes this much easier.`;
      } else {
        // School level
        explanation = `🎒 **[SCHOOL LEVEL SIMPLE EXPLAINER - ${currentSubject}]**\n\nLet's make *"${query}"* super simple and easy to understand! ✨\n\n1. **What is it?**: Imagine a balance scale. Whatever weight you add to one side, you have to add to the other side to keep it balanced. \n\n2. **Real-world Example**: If you drop a ball, gravity pulls it to the ground. That pull is a force! We can calculate it using simple multiplication: \n$$\\text{Force} = \\text{Weight} \\times \\text{Gravity}$$\n\n3. **Remember**: Always write down your units (like Meters, Seconds, or Kilograms) so you don't lose points in your homework!`;
      }

      setIsStreaming(false);
      setMessages(prev => [
        ...prev,
        {
          sender: "ai",
          text: explanation,
          level: academicLevel,
          lectures: recommendedVideos
        }
      ]);

      // Add to sidebar chat history if it was a new search
      if (!activeHistoryId) {
        const newHist = {
          id: Date.now(),
          title: query.length > 25 ? `${query.slice(0, 22)}...` : query,
          level: academicLevel,
          subject: currentSubject
        };
        setChatHistory(prev => [newHist, ...prev]);
        setActiveHistoryId(newHist.id);
      }
    }, 1300);
  };

  // Load chat from history sidebar
  const loadHistoryItem = (item) => {
    setActiveHistoryId(item.id);
    setAcademicLevel(item.level);
    setSelectedSubject(item.subject);

    // Mock loading conversation
    setMessages([
      {
        sender: "user",
        text: `Explain ${item.title} concepts.`,
        level: item.level
      },
      {
        sender: "ai",
        text: `Loaded conversation archives for **${item.title}** configured for **${item.level}** academic parameters under **${item.subject}**.\n\nYou can review related video lectures below or ask any follow-up questions.`,
        level: item.level,
        lectures: (lecturesDatabase[item.subject] && lecturesDatabase[item.subject][item.level]) || []
      }
    ]);
  };

  // Clear Chat history
  const handleClearHistory = () => {
    setChatHistory([]);
    setActiveHistoryId(null);
    setMessages([
      {
        sender: "ai",
        text: "Conversation history cleared. Ready for your next academic query!",
        level: "BS",
        lectures: []
      }
    ]);
  };

  return (
    <div className="animate-in fade-in duration-500 min-h-[calc(100vh-140px)] flex flex-col lg:flex-row gap-6">
      
      {/* LEFT SIDEBAR: Conversational History Panel (3 cols) */}
      <div className="lg:w-72 bg-dark-900/60 border border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between h-[300px] lg:h-auto">
        <div className="space-y-4 overflow-y-auto pr-1">
          <div className="flex items-center justify-between pb-2 border-b border-slate-850">
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

          <div className="space-y-1.5">
            {chatHistory.map(hist => (
              <button
                key={hist.id}
                onClick={() => loadHistoryItem(hist)}
                className={`w-full flex items-center justify-between text-left p-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                  activeHistoryId === hist.id
                    ? 'bg-primary-500/10 border-primary-500/35 text-white'
                    : 'bg-transparent border-transparent hover:bg-slate-800/40 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <MessageSquare className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                  <span className="truncate">{hist.title}</span>
                </div>
                <span className="text-[8px] bg-slate-850 px-1.5 py-0.5 rounded font-mono uppercase text-slate-500 flex-shrink-0">
                  {hist.level}
                </span>
              </button>
            ))}
            {chatHistory.length === 0 && (
              <p className="text-center text-slate-600 text-[11px] italic py-8">No saved sessions.</p>
            )}
          </div>
        </div>

        <div className="pt-4 border-t border-slate-850/80 hidden lg:block text-[10px] text-slate-500 leading-relaxed">
          <Cpu className="w-4 h-4 text-purple-400 mb-1" />
          Powered by LLM concept engines calibrated for School to PhD math/science coursework.
        </div>
      </div>

      {/* RIGHT WORKSPACE: Chat GPT Console & Lectures Display (9 cols) */}
      <div className="flex-1 bg-dark-900/40 border border-slate-800/50 rounded-2xl flex flex-col justify-between overflow-hidden relative min-h-[500px]">
        
        {/* Chat Control Top bar */}
        <div className="p-4 bg-gradient-to-r from-primary-950/20 via-purple-950/20 to-dark-900/60 border-b border-slate-850 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-tr from-primary-500 to-purple-600 rounded-xl">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-white">Academic Concept Explainer</h3>
              <p className="text-[10px] text-slate-400">Ask questions, read guides, watch lectures</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Level Select */}
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

            {/* Subject Select */}
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="bg-dark-900 border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold outline-none text-slate-100"
            >
              {subjects.map(s => (
                <option key={s.id} value={s.name}>{s.name}</option>
              ))}
              <option value="General">Custom Subject</option>
            </select>
          </div>
        </div>

        {/* Chat Thread Workspace Area */}
        <div className="flex-1 p-4 overflow-y-auto space-y-6">
          {messages.map((msg, index) => {
            const hasLectures = msg.lectures && msg.lectures.length > 0;
            
            return (
              <div key={index} className="space-y-4">
                <div className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] p-4 rounded-2xl border text-xs leading-relaxed ${
                      msg.sender === 'user'
                        ? 'bg-primary-500/10 border-primary-500/20 text-slate-100 rounded-tr-none shadow-md'
                        : 'bg-slate-900/60 border-slate-850 text-slate-200 rounded-tl-none'
                    }`}
                  >
                    {/* Render markdown helper text */}
                    <div className="whitespace-pre-line font-medium leading-relaxed">
                      {msg.text}
                    </div>
                  </div>
                </div>

                {/* DYNAMIC ONLINE LECTURES PANEL (Right under the AI reply!) */}
                {hasLectures && (
                  <div className="pl-0 sm:pl-4 space-y-3 animate-in fade-in duration-300">
                    <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider flex items-center gap-1.5">
                      <Video className="w-3.5 h-3.5 text-purple-400" />
                      Recommended Video Lectures ({msg.level})
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {msg.lectures.map(video => (
                        <div
                          key={video.id}
                          onClick={() => {
                            setActiveVideoId(video.id);
                            setActiveVideoTitle(video.title);
                          }}
                          className="glass-panel border border-slate-850 rounded-xl overflow-hidden hover:border-slate-700 transition-all cursor-pointer flex gap-3 p-2 group bg-slate-900/40"
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
                              <h4 className="font-bold text-slate-200 truncate group-hover:text-primary-400 transition-colors" title={video.title}>
                                {video.title}
                              </h4>
                              <p className="text-slate-500 font-semibold mt-0.5">{video.author}</p>
                            </div>
                            <span className="text-primary-400 font-bold flex items-center gap-0.5 hover:underline">
                              Watch Lecture <ChevronRight className="w-3 h-3" />
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
              <div className="bg-slate-900/60 border border-slate-850 text-slate-400 p-4 rounded-2xl rounded-tl-none text-xs flex items-center gap-2 shadow-md">
                <Loader2 className="w-4 h-4 text-primary-400 animate-spin" />
                <span>AI Tutor is formulating structured concepts & matching lecture resources...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Dynamic Video Lecture Embedded Player (YouTube) */}
        {activeVideoId && (
          <div className="absolute inset-0 bg-dark-900/90 backdrop-blur-md z-45 p-6 flex flex-col justify-center items-center animate-in fade-in duration-300">
            <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
              <div className="p-4 bg-slate-850 flex items-center justify-between border-b border-slate-800">
                <h4 className="font-bold text-xs text-white truncate max-w-[80%]">{activeVideoTitle}</h4>
                <button
                  onClick={() => setActiveVideoId(null)}
                  className="px-2.5 py-1 bg-slate-800 border border-slate-700 hover:bg-slate-700 rounded-lg text-[10px] font-bold text-slate-350 cursor-pointer"
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
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                ></iframe>
              </div>
            </div>
          </div>
        )}

        {/* Input Bar Form */}
        <div className="p-4 border-t border-slate-850 bg-slate-950/20 space-y-3">
          
          {/* Quick Prompts */}
          <div className="flex gap-2 overflow-x-auto whitespace-nowrap scrollbar-none text-[10px] pb-1">
            {[
              { label: "💡 Explain like I'm 5", text: `Explain the concept of ${selectedSubject} integration/equations like I am 5 years old.` },
              { label: "📚 College Revision Exam Guide", text: `Create a college-level revision checklist and study outline for ${selectedSubject}.` },
              { label: "🔬 PhD Theoretical Model Foundations", text: `What are the advanced graduate-level research equations and theoretical models for ${selectedSubject}?` },
              { label: "🎥 Recommend Video lectures", text: `Recommend online video lectures explaining core ${selectedSubject} concepts.` }
            ].map((p, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(null, p.text)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-850 hover:border-slate-700 bg-slate-900/50 hover:bg-slate-800 text-slate-300 font-bold transition-all cursor-pointer"
              >
                {p.label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSend} className="flex gap-3">
            <input
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder={`Ask the AI Study Assistant about ${selectedSubject} (${academicLevel} level)...`}
              className="flex-1 bg-dark-900 border border-slate-700 px-4 py-3 rounded-xl text-xs font-semibold focus:border-primary-500 outline-none text-slate-100"
            />
            <button
              type="submit"
              disabled={isStreaming || !inputVal.trim()}
              className="px-5 py-3 rounded-xl bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white font-bold flex items-center justify-center transition-all shadow-[0_0_15px_rgba(20,184,166,0.3)] cursor-pointer"
            >
              <Send className="w-4 h-4 mr-1.5" />
              Ask GPT
            </button>
          </form>
        </div>

      </div>

    </div>
  );
};

export default AIAssistant;
