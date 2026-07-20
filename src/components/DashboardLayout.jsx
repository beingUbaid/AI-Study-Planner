import React, { useState, useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Brain,
  BarChart3,
  BookOpen,
  Clock,
  LogOut,
  Bell,
  Sparkles,
  GraduationCap,
  CalendarRange,
  Send,
  MessageSquare,
  X,
  Play,
  Loader2
} from 'lucide-react';

const DashboardLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // --- SHARED STATE ---
  // Tasks state
  const [tasks, setTasks] = useState(() => {
    const saved = localStorage.getItem('study_tasks');
    return saved ? JSON.parse(saved) : [];
  });

  // Exams state
  const [exams, setExams] = useState(() => {
    const saved = localStorage.getItem('study_exams');
    return saved ? JSON.parse(saved) : [];
  });

  // Subjects state
  const [subjects, setSubjects] = useState(() => {
    const saved = localStorage.getItem('study_subjects');
    return saved ? JSON.parse(saved) : [];
  });

  // Study Tracker & Hours
  const [todayHours, setTodayHours] = useState(() => {
    const saved = localStorage.getItem('study_today_hours');
    return saved ? parseFloat(saved) : 0.0;
  });
  
  const [streak, setStreak] = useState(() => {
    const saved = localStorage.getItem('study_streak');
    return saved ? parseInt(saved, 10) : 0;
  });

  // Weekly hours logged (Mon-Sun)
  const [weeklyHours, setWeeklyHours] = useState(() => {
    const saved = localStorage.getItem('study_weekly_hours');
    return saved ? JSON.parse(saved) : [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0];
  });

  // Timer State (Pomodoro runs in background layout)
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [timerActive, setTimerActive] = useState(false);
  const [timerMode, setTimerMode] = useState("Study");
  const [customMinutes, setCustomMinutes] = useState(25);

  // Notifications
  const [notifications, setNotifications] = useState(() => {
    const saved = localStorage.getItem('study_notifications');
    return saved ? JSON.parse(saved) : [
      { id: 1, text: "Welcome to StudyPlanner.ai! Get started by adding your first subject course.", read: false }
    ];
  });
  const [showNotifications, setShowNotifications] = useState(false);

  // --- CHATBOT STATE ---
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState(() => {
    const name = localStorage.getItem('user_name') || 'Student';
    return [
      { sender: 'ai', text: `Welcome, ${name}! 📚 I'm your AI Study Assistant. Ask me anything about your current workload, schedules, or specific concepts. I can also generate a revision plan for your upcoming exams.` }
    ];
  });
  const [isTyping, setIsTyping] = useState(false);
  const [playVideoId, setPlayVideoId] = useState(null);
  const [playVideoTitle, setPlayVideoTitle] = useState("");

  // --- STATE SYNCHRONIZATIONS ---
  useEffect(() => {
    localStorage.setItem('study_tasks', JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem('study_exams', JSON.stringify(exams));
  }, [exams]);

  useEffect(() => {
    localStorage.setItem('study_subjects', JSON.stringify(subjects));
  }, [subjects]);

  useEffect(() => {
    localStorage.setItem('study_today_hours', todayHours.toString());
  }, [todayHours]);

  useEffect(() => {
    localStorage.setItem('study_streak', streak.toString());
  }, [streak]);

  useEffect(() => {
    localStorage.setItem('study_notifications', JSON.stringify(notifications));
  }, [notifications]);

  useEffect(() => {
    localStorage.setItem('study_weekly_hours', JSON.stringify(weeklyHours));
  }, [weeklyHours]);

  useEffect(() => {
    const dayIndex = (new Date().getDay() + 6) % 7;
    setWeeklyHours(prev => {
      const copy = [...prev];
      copy[dayIndex] = todayHours;
      return copy;
    });
  }, [todayHours]);

  // --- BG TIMER WORK ---
  useEffect(() => {
    let interval = null;
    if (timerActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(prevTime => {
          if (timerMode === "Study") {
            setTodayHours(h => parseFloat((h + 1 / 3600).toFixed(4)));
          }
          return prevTime - 1;
        });
      }, 1000);
    } else if (timeLeft === 0) {
      setTimerActive(false);
      if (timerMode === "Study") {
        alert("📚 Great job! Your study session is complete. Take a short break!");
        setTodayHours(h => parseFloat((h + (customMinutes / 60)).toFixed(1)));
        setTimeLeft(5 * 60);
        setTimerMode("Break");
      } else {
        alert("⚡ Break is over! Let's get back to studying.");
        setTimeLeft(25 * 60);
        setTimerMode("Study");
      }
    }
    return () => clearInterval(interval);
  }, [timerActive, timeLeft, timerMode, customMinutes]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user_email');
    localStorage.removeItem('user_name');
    localStorage.removeItem('study_tasks');
    localStorage.removeItem('study_exams');
    localStorage.removeItem('study_subjects');
    localStorage.removeItem('study_today_hours');
    localStorage.removeItem('study_streak');
    localStorage.removeItem('study_notifications');
    localStorage.removeItem('study_weekly_hours');
    localStorage.removeItem('study_assessment_completed');
    localStorage.removeItem('last_ai_result');
    localStorage.removeItem('study_calendar_events');
    navigate('/login');
  };

  const chatbotLectures = {
    math: [
      { id: "KfzA4mXGv5k", title: "Introduction to Calculus & Limits", author: "Khan Academy", duration: "12m", thumbnail: "https://images.unsplash.com/photo-1509228468518-180dd4864904?w=400&q=80" },
      { id: "302g4iPmU7A", title: "Algebra Basics: What Is Algebra?", author: "Math Antics", duration: "14m", thumbnail: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=400&q=80" }
    ],
    physics: [
      { id: "ObH0PoWBeHM", title: "Newtonian Motion, Forces & Gravity", author: "CrashCourse Physics", duration: "10m", thumbnail: "https://images.unsplash.com/photo-1614064641938-3bbee52942c7?w=400&q=80" },
      { id: "EwY6p-r_hyY", title: "What is Light & Waves?", author: "Kurzgesagt Science", duration: "8m", thumbnail: "https://images.unsplash.com/photo-1507668077129-56e32842fceb?w=400&q=80" }
    ],
    coding: [
      { id: "k5E2A5a0Vn0", title: "Programming Basics with Python", author: "Coding for Beginners", duration: "15m", thumbnail: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=400&q=80" },
      { id: "yOzzT3c3J8o", title: "CS50 Introduction to Computer Science", author: "David J. Malan (Harvard)", duration: "2h 15m", thumbnail: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=400&q=80" }
    ],
    chemistry: [
      { id: "aOzzT3c3Che", title: "Introduction to Chemistry", author: "CrashCourse Chemistry", duration: "11m", thumbnail: "https://images.unsplash.com/photo-1607988795691-3d0147b43231?w=400&q=80" }
    ]
  };

  // --- AI STUDY CHATBOT RESPONDER ---
  const handleSendMessage = (e, textOverride = null) => {
    if (e) e.preventDefault();
    const query = (textOverride || chatInput).trim();
    if (!query) return;

    // Add user message
    const userMsg = { sender: 'user', text: query };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput("");
    setIsTyping(true);

    // Mock streaming AI response based on matching keywords
    setTimeout(() => {
      let reply = "";
      let lectures = [];
      const qLower = query.toLowerCase();

      if (qLower.includes("what should i study") || qLower.includes("today") || qLower.includes("tasks")) {
        const pending = tasks.filter(t => !t.completed);
        if (pending.length > 0) {
          reply = `Today, you should focus on your pending tasks:\n\n` + 
            pending.map((t, i) => `${i + 1}. **${t.text}** (${t.category})`).join('\n\n') + 
            `\n\nLet's check off at least one target!`;
        } else {
          reply = "All your study tasks for today are fully completed! Excellent streak management. You can schedule new tasks in the Calendar page.";
        }
      } else if (qLower.includes("exam") || qLower.includes("schedule") || qLower.includes("days left") || qLower.includes("upcoming")) {
        if (exams.length > 0) {
          reply = `Here are your upcoming exam schedules:\n\n` + 
            exams.map(ex => {
              const daysLeft = Math.ceil((new Date(ex.date) - new Date("2026-06-23")) / (1000 * 3600 * 24));
              return `- **${ex.name}** (${ex.subject}) in **${daysLeft > 0 ? daysLeft : 0} days** (AI Readiness: ${ex.readiness}%)`;
            }).join('\n\n');
        } else {
          reply = "You don't have any exams scheduled yet! Head over to the Exams page to track your first test date.";
        }
      } else if (qLower.includes("revision") || qLower.includes("plan")) {
        reply = "Here is a high-yield revision roadmap:\n\n1. **First Pass (Days 1-3)**: Active recall flashcards & concept maps for hard chapters.\n2. **Practice Pass (Days 4-6)**: Solve timed mock papers and past questions.\n3. **Final Pass (Exam Eve)**: Focus on low-readiness formulas and sleep 8 hours.";
      } else if (qLower.includes("calculus") || qLower.includes("integration") || qLower.includes("math")) {
        reply = "For Calculus / Integration by Parts, write down the LIATE priority scheme: Logarithmic, Inverse trig, Algebraic, Trigonometric, Exponential. Let 'u' be the one that appears first in LIATE, and 'dv' be the rest. Run the equation: \n\n$$\\int u\\,dv = uv - \\int v\\,du$$";
        lectures = chatbotLectures.math;
      } else if (qLower.includes("physics") || qLower.includes("mechanics") || qLower.includes("force") || qLower.includes("gravity")) {
        reply = "To solve classical mechanics problems:\n\n1. Draw a clean Free Body Diagram (FBD),\n2. Decompose forces into components,\n3. Set up equations using Newton's second law: $\\Sigma F = m \\cdot a$.";
        lectures = chatbotLectures.physics;
      } else if (qLower.includes("computer") || qLower.includes("code") || qLower.includes("recursion") || qLower.includes("java") || qLower.includes("javascript")) {
        reply = "Recursion requires a Base Case to terminate the stack (preventing StackOverflow) and a Recursive Case that reduces problem size.";
        lectures = chatbotLectures.coding;
      } else if (qLower.includes("chemistry") || qLower.includes("reaction") || qLower.includes("redox") || qLower.includes("acid")) {
        reply = "To balance redox reactions in acids: split oxidation and reduction half-reactions, balance atoms except H/O, balance O with H2O, H with H+, and equalise charges using electrons.";
        lectures = chatbotLectures.chemistry;
      } else {
        reply = "Here is my advice: break this topic into simple Feynman points. Explain it as if teaching a child, use visual diagrams, and keep active recall review cycles scheduled.";
        lectures = chatbotLectures.math; // default recommendations
      }

      setIsTyping(false);
      setChatMessages(prev => [...prev, { sender: 'ai', text: reply, lectures }]);
    }, 1250);
  };

  const activePath = location.pathname;

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex relative overflow-hidden">
      {/* Animated Background Blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-primary-500/10 rounded-full mix-blend-multiply filter blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-purple-500/10 rounded-full mix-blend-multiply filter blur-[120px] pointer-events-none"></div>

      {/* --- SIDEBAR NAVIGATION --- */}
      <aside className="w-64 bg-dark-900/80 backdrop-blur-md border-r border-slate-800/80 flex-col justify-between hidden md:flex p-6 z-20">
        <div>
          {/* Logo */}
          <Link to="/dashboard" className="flex items-center gap-3 mb-10 cursor-pointer">
            <div className="p-2.5 bg-gradient-to-tr from-primary-500 to-purple-600 rounded-xl shadow-lg">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-extrabold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary-400 to-purple-400">
                StudyPlanner
              </h1>
              <p className="text-[10px] text-slate-400 tracking-wider uppercase font-semibold">AI Assistant Enabled</p>
            </div>
          </Link>

          {/* Nav Links */}
          <nav className="space-y-2">
            <Link
              to="/dashboard"
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                activePath === '/dashboard'
                  ? 'bg-primary-500/10 text-primary-400 border border-primary-500/20'
                  : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200 border border-transparent'
              }`}
            >
              <BarChart3 className="w-5 h-5" />
              <span>Dashboard</span>
            </Link>

            <Link
              to="/planner"
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                activePath === '/planner'
                  ? 'bg-primary-500/10 text-primary-400 border border-primary-500/20'
                  : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200 border border-transparent'
              }`}
            >
              <CalendarRange className="w-5 h-5" />
              <span>AI Calendar Planner</span>
            </Link>

            <Link
              to="/ai-assistant"
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                activePath === '/ai-assistant'
                  ? 'bg-primary-500/10 text-primary-400 border border-primary-500/20'
                  : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200 border border-transparent'
              }`}
            >
              <MessageSquare className="w-5 h-5" />
              <span>AI Chatbot Tutor</span>
            </Link>
            
            <Link
              to="/exams"
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                activePath === '/exams'
                  ? 'bg-primary-500/10 text-primary-400 border border-primary-500/20'
                  : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200 border border-transparent'
              }`}
            >
              <BookOpen className="w-5 h-5" />
              <span>Exams</span>
            </Link>

            <Link
              to="/subjects"
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                activePath === '/subjects'
                  ? 'bg-primary-500/10 text-primary-400 border border-primary-500/20'
                  : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200 border border-transparent'
              }`}
            >
              <GraduationCap className="w-5 h-5" />
              <span>Subjects</span>
            </Link>

            <Link
              to="/study"
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                activePath === '/study'
                  ? 'bg-primary-500/10 text-primary-400 border border-primary-500/20'
                  : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200 border border-transparent'
              }`}
            >
              <Clock className="w-5 h-5" />
              <span>Study & Tasks</span>
            </Link>
          </nav>

          {/* Running Timer Quick Badge in Sidebar */}
          {timerActive && (
            <div className="mt-8 p-4 rounded-xl bg-purple-500/10 border border-purple-500/20 text-center animate-pulse">
              <span className="text-[10px] text-purple-400 font-bold tracking-widest block mb-1">SESSION RUNNING</span>
              <span className="text-xl font-black text-white font-mono">
                {Math.floor(timeLeft / 60).toString().padStart(2, '0')}:{(timeLeft % 60).toString().padStart(2, '0')}
              </span>
            </div>
          )}
        </div>

        {/* User Card & Logout */}
        <div className="border-t border-slate-800/80 pt-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-primary-400 to-purple-500 flex items-center justify-center font-bold text-white shadow-md border border-slate-700/50">
              U
            </div>
            <div>
              <p className="text-sm font-semibold text-white">User Account</p>
              <p className="text-[11px] text-slate-400 font-medium">user@studyplanner.ai</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-slate-800 hover:border-red-500/30 hover:bg-red-500/5 text-slate-400 hover:text-red-400 text-sm font-semibold transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </aside>

      {/* --- CONTENT AREA AND TOP BAR --- */}
      <div className="flex-1 flex flex-col min-h-screen overflow-y-auto">
        {/* Top Header */}
        <header className="px-6 py-4 bg-dark-900/40 backdrop-blur-md border-b border-slate-800/60 flex justify-between items-center z-20">
          <div className="flex items-center gap-3 md:hidden">
            {/* Mobile Logo */}
            <div className="p-2 bg-gradient-to-tr from-primary-500 to-purple-600 rounded-lg">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <span className="font-extrabold text-sm text-white">StudyPlanner</span>
          </div>

          {/* Desktop/Tablet Breadcrumb */}
          <div className="hidden md:flex items-center gap-2 text-xs font-semibold text-slate-400">
            <span>Dashboard</span>
            <span className="text-slate-600">/</span>
            <span className="text-primary-400 capitalize">{activePath === '/dashboard' ? 'Dashboard' : activePath.replace('/', '')}</span>
          </div>

          <div className="flex items-center gap-4">
            {/* Mobile Nav Links */}
            <nav className="flex md:hidden gap-1 bg-slate-800/40 border border-slate-700/50 p-1 rounded-lg text-[10px] overflow-x-auto max-w-[220px]">
              <Link to="/dashboard" className={`px-2 py-1 rounded ${activePath === '/dashboard' ? 'bg-primary-500 text-white' : 'text-slate-400'}`}>Dashboard</Link>
              <Link to="/planner" className={`px-2 py-1 rounded ${activePath === '/planner' ? 'bg-primary-500 text-white' : 'text-slate-400'}`}>Calendar</Link>
              <Link to="/ai-assistant" className={`px-2 py-1 rounded ${activePath === '/ai-assistant' ? 'bg-primary-500 text-white' : 'text-slate-400'}`}>AI Chat</Link>
              <Link to="/subjects" className={`px-2 py-1 rounded ${activePath === '/subjects' ? 'bg-primary-500 text-white' : 'text-slate-400'}`}>Subjects</Link>
              <Link to="/exams" className={`px-2 py-1 rounded ${activePath === '/exams' ? 'bg-primary-500 text-white' : 'text-slate-400'}`}>Exams</Link>
              <Link to="/study" className={`px-2 py-1 rounded ${activePath === '/study' ? 'bg-primary-500 text-white' : 'text-slate-400'}`}>Study</Link>
            </nav>

            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50 hover:bg-slate-800 transition-colors relative cursor-pointer"
              >
                <Bell className="w-5 h-5 text-slate-300" />
                {notifications.some(n => !n.read) && (
                  <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 border-2 border-slate-900 rounded-full"></span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-3 w-80 glass-panel border border-slate-700/80 rounded-xl p-4 shadow-2xl z-50 animate-in fade-in duration-200">
                  <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-700/50">
                    <h4 className="font-bold text-sm text-white flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-primary-400" />
                      Study Notifications
                    </h4>
                    <button
                      onClick={() => setNotifications(prev => prev.map(n => ({ ...n, read: true })))}
                      className="text-xs text-primary-400 hover:text-primary-300 font-semibold cursor-pointer"
                    >
                      Mark read
                    </button>
                  </div>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {notifications.map(notif => (
                      <div
                        key={notif.id}
                        className={`text-xs p-2.5 rounded-lg border transition-all ${
                          notif.read ? 'bg-slate-900/40 border-slate-800 text-slate-400' : 'bg-primary-500/10 border-primary-500/20 text-slate-200 font-medium'
                        }`}
                      >
                        {notif.text}
                      </div>
                    ))}
                    {notifications.length === 0 && (
                      <p className="text-center text-slate-500 py-4 text-xs">No notifications yet</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Profile Dropdown / Logout for Mobile */}
            <div className="flex items-center gap-2 md:hidden">
              <button onClick={handleLogout} className="p-2.5 rounded-xl bg-slate-850 hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition-all border border-slate-750 cursor-pointer">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        {/* Page Render Slot */}
        <div className="flex-1 p-6 md:p-8">
          <Outlet context={{
            tasks, setTasks,
            exams, setExams,
            subjects, setSubjects,
            todayHours, setTodayHours,
            streak, setStreak,
            notifications, setNotifications,
            timeLeft, setTimeLeft,
            timerActive, setTimerActive,
            timerMode, setTimerMode,
            customMinutes, setCustomMinutes,
            weeklyHours
          }} />
        </div>
      </div>

      {/* --- FLOATING AI STUDY ASSISTANT CHATBOT DRAWER --- */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
        {chatOpen ? (
          <div className="w-80 sm:w-96 h-[500px] glass-panel border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden mb-4 animate-in slide-in-from-bottom-5 duration-300">
            {/* Chat Header */}
            <div className="p-4 bg-gradient-to-r from-primary-950/40 via-purple-950/40 to-dark-900 border-b border-slate-850 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-primary-500 to-purple-600 flex items-center justify-center shadow-lg">
                  <Brain className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-white">AI Study Assistant</h4>
                  <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
                    Online
                  </span>
                </div>
              </div>
              <button
                onClick={() => setChatOpen(false)}
                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 p-4 overflow-y-auto space-y-4 text-xs">
              {chatMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] p-3 rounded-2xl border leading-relaxed whitespace-pre-line ${
                      msg.sender === 'user'
                        ? 'bg-primary-500/10 border-primary-500/20 text-slate-100 rounded-tr-none'
                        : 'bg-slate-900/60 border-slate-800 text-slate-200 rounded-tl-none'
                    }`}
                  >
                    <div>{msg.text}</div>
                    
                    {msg.sender === 'ai' && msg.lectures && msg.lectures.length > 0 && (
                      <div className="mt-3.5 pt-3 border-t border-slate-850 space-y-2">
                        <p className="text-[10px] text-primary-400 font-bold uppercase tracking-wider">Recommended Lectures:</p>
                        <div className="space-y-2">
                          {msg.lectures.map(vid => (
                            <button
                              key={vid.id}
                              onClick={() => {
                                setPlayVideoId(vid.id);
                                setPlayVideoTitle(vid.title);
                              }}
                              className="w-full flex items-center gap-2 p-1.5 rounded-lg bg-slate-950/50 hover:bg-slate-950/80 border border-slate-800 hover:border-slate-700 transition-all text-left cursor-pointer group"
                            >
                              <div className="w-10 h-7 rounded overflow-hidden relative flex-shrink-0">
                                <img src={vid.thumbnail} alt={vid.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                  <Play className="w-2.5 h-2.5 text-white fill-white" />
                                </div>
                              </div>
                              <div className="flex-1 min-w-0 text-[10px]">
                                <h5 className="text-slate-200 font-bold truncate">{vid.title}</h5>
                                <p className="text-[8px] text-slate-500 truncate">{vid.author} • {vid.duration}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-slate-900/60 border border-slate-800 text-slate-400 p-3 rounded-2xl rounded-tl-none flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 text-primary-400 animate-spin" />
                    <span>AI is drafting answer...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Prompts Drawer */}
            <div className="px-4 py-2 border-t border-slate-850 bg-slate-950/20 flex gap-2 overflow-x-auto whitespace-nowrap scrollbar-none text-[10px]">
              {[
                { label: "📅 Today's Tasks", text: "What should I study today?" },
                { label: "📝 Exam Countdown", text: "How many days left for exams?" },
                { label: "🚀 Revision Guide", text: "Create a revision plan." }
              ].map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(null, p.text)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-850 hover:border-slate-700 bg-slate-900/50 hover:bg-slate-800 text-slate-300 font-bold transition-all cursor-pointer"
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Chat Input */}
            <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-850 bg-slate-900/50 flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask about equations, tasks, schedules..."
                className="flex-1 bg-dark-900 border border-slate-700 px-3.5 py-2.5 rounded-xl text-xs font-semibold focus:border-primary-500 outline-none text-slate-100"
              />
              <button
                type="submit"
                disabled={!chatInput.trim()}
                className="p-2.5 rounded-xl bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white font-bold flex items-center justify-center transition-all shadow-[0_0_10px_rgba(20,184,166,0.3)] cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        ) : null}

        {/* Chat Toggle FAB */}
        <button
          onClick={() => setChatOpen(!chatOpen)}
          className="p-4 rounded-full bg-gradient-to-tr from-primary-500 via-primary-600 to-purple-600 text-white shadow-[0_0_20px_rgba(20,184,166,0.45)] hover:scale-105 active:scale-95 transition-all flex items-center justify-center cursor-pointer group"
        >
          <MessageSquare className="w-6 h-6 group-hover:rotate-12 transition-transform" />
          <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 ease-in-out font-bold text-xs pl-0 group-hover:pl-2 whitespace-nowrap">
            AI Assistant
          </span>
        </button>
      </div>

      {/* Dynamic Video Player Modal for Chatbot */}
      {playVideoId && (
        <div className="fixed inset-0 bg-dark-900/90 backdrop-blur-sm z-[60] p-6 flex flex-col justify-center items-center animate-in fade-in duration-300">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
            <div className="p-4 bg-slate-850 flex items-center justify-between border-b border-slate-800">
              <h4 className="font-bold text-xs text-white truncate max-w-[80%]">{playVideoTitle}</h4>
              <button
                onClick={() => setPlayVideoId(null)}
                className="px-2.5 py-1 bg-slate-800 border border-slate-700 hover:bg-slate-700 rounded-lg text-[10px] font-bold text-slate-350 cursor-pointer"
              >
                Close Player
              </button>
            </div>
            <div className="aspect-video w-full">
              <iframe
                className="w-full h-full"
                src={`https://www.youtube.com/embed/${playVideoId}?autoplay=1`}
                title={playVideoTitle}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              ></iframe>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default DashboardLayout;
