import React, { useState, useEffect } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import {
  Brain,
  Sparkles,
  Flame,
  Clock,
  Calendar as CalendarIcon,
  AlertCircle,
  Loader2,
  Check,
  ArrowRight,
  TrendingUp,
  Activity,
  Smile,
  ShieldAlert,
  HelpCircle,
  RefreshCw,
  ListTodo,
  Award,
  Printer,
  BookOpen,
  Trophy,
  BrainCircuit
} from 'lucide-react';
import { plannerAPI, analyticsAPI } from '../services/api';
import { SkeletonCard, SkeletonList } from '../components/Skeleton';

const Dashboard = () => {
  const {
    tasks, setTasks,
    exams, setExams,
    subjects, setSubjects,
    todayHours,
    streak,
    setNotifications,
    userName
  } = useOutletContext();

  // --- STATE FOR ACTIVE DATABASE SCHEDULE ---
  const [activePlan, setActivePlan] = useState(null);
  const [loadingPlan, setLoadingPlan] = useState(true);
  const [aiInsights, setAiInsights] = useState([]);
  const [loadingInsights, setLoadingInsights] = useState(true);
  const [rebalanceResult, setRebalanceResult] = useState({ isOpen: false, title: "", explanation: "" });

  // --- SaaS SUMMARY & ANALYTICS STATE ---
  const [summaryData, setSummaryData] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(true);

  // --- STATE FOR WIZARD BACKWARD COMPATIBILITY ---
  const [assessmentCompleted, setAssessmentCompleted] = useState(() => {
    const saved = localStorage.getItem('study_assessment_completed');
    return saved === 'false' ? false : true;
  });
  const [wizardStep, setWizardStep] = useState(0); 

  // Wizard Fields
  const [formExamSubject, setFormExamSubject] = useState("Math");
  const [formExamLevel, setFormExamLevel] = useState("BS");
  const [formExamName, setFormExamName] = useState("");
  const [formExamDate, setFormExamDate] = useState("");
  const [formPressure, setFormPressure] = useState("Medium");
  const [formProblems, setFormProblems] = useState("");
  const [aiResponse, setAiResponse] = useState(null);
  const [loadingStep, setLoadingStep] = useState(1);

  // Load Real Schedule and AI Insights from Database
  const fetchDashboardData = async () => {
    try {
      setLoadingPlan(true);
      const { data, ok } = await plannerAPI.getSchedule();
      if (ok && data?.studyPlan) {
        setActivePlan(data.studyPlan);
        // Automatically bypass onboarding wizard if active plan exists
        setAssessmentCompleted(true);
        localStorage.setItem('study_assessment_completed', 'true');
      }
    } catch (err) {
      console.warn("Failed to fetch schedule in Dashboard:", err);
    } finally {
      setLoadingPlan(false);
    }
  };

  const fetchInsightsData = async () => {
    try {
      setLoadingInsights(true);
      const { data, ok } = await analyticsAPI.insights();
      if (ok && data?.insights) {
        setAiInsights(data.insights);
      }
    } catch (err) {
      console.warn("Failed to fetch insights in Dashboard:", err);
    } finally {
      setLoadingInsights(false);
    }
  };

  const fetchSummaryData = async () => {
    try {
      setLoadingSummary(true);
      const { data, ok } = await analyticsAPI.summary();
      if (ok && data) {
        setSummaryData(data);
      }
    } catch (err) {
      console.warn("Failed to fetch summary data in Dashboard:", err);
    } finally {
      setLoadingSummary(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    fetchInsightsData();
    fetchSummaryData();

    // Check onboarding cache
    const isCompleted = localStorage.getItem('study_assessment_completed');
    if (isCompleted === 'true') {
      setAssessmentCompleted(true);
      const savedAi = localStorage.getItem('last_ai_result');
      if (savedAi) {
        setAiResponse(JSON.parse(savedAi));
      }
    } else if (isCompleted === 'false') {
      setAssessmentCompleted(false);
    }
  }, []);

  // Sync assessment completed state to bypass wizard
  useEffect(() => {
    if (activePlan) {
      setAssessmentCompleted(true);
    }
  }, [activePlan]);

  // Days remaining calculation
  const getDaysRemaining = (examDateStr) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const examDate = new Date(examDateStr);
    examDate.setHours(0, 0, 0, 0);
    const difference = examDate.getTime() - today.getTime();
    const days = Math.ceil(difference / (1000 * 3600 * 24));
    return days;
  };

  // --- STATS DERIVATIONS (DB Schedule or Wizard fallback) ---
  const todayDateStr = new Date().toDateString();
  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);

  // Find today's plan in DB schedule
  const todayPlanDay = activePlan?.schedule?.find(day => {
    return new Date(day.date).toDateString() === todayDateStr;
  });

  const todayDbTasks = todayPlanDay?.tasks || [];
  const todayPlannedHours = todayDbTasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0);
  const todayCompletedHours = todayDbTasks.filter(t => t.isCompleted).reduce((sum, t) => sum + (t.estimatedHours || 0), 0);

  // Fallback to local wizard tasks if no active DB plan
  const activeTasksList = activePlan ? todayDbTasks : tasks.slice(0, 5);
  const totalTasksCount = activePlan ? activeTasksList.length : tasks.length;
  const completedTasksCount = activePlan ? activeTasksList.filter(t => t.isCompleted).length : tasks.filter(t => t.completed).length;
  
  const allPlanTasks = activePlan?.schedule?.flatMap(day => day.tasks) || [];
  const totalPlanTasksCount = allPlanTasks.length;
  const completedPlanTasksCount = allPlanTasks.filter(t => t.isCompleted).length;
  
  const progressPercentage = totalPlanTasksCount > 0 
    ? Math.round((completedPlanTasksCount / totalPlanTasksCount) * 100)
    : (tasks.length > 0 ? Math.round((tasks.filter(t => t.completed).length / tasks.length) * 100) : 0);

  // Missed sessions (uncompleted tasks from past days)
  const missedSessions = activePlan?.schedule?.filter(day => {
    const dayDate = new Date(day.date);
    dayDate.setHours(0, 0, 0, 0);
    return dayDate < todayMidnight;
  }).flatMap(day => day.tasks.filter(t => !t.isCompleted)) || [];

  // Upcoming study sessions (pending tasks from today/tomorrow)
  const upcomingSessions = allPlanTasks.filter(t => !t.isCompleted).slice(0, 3);

  // --- HANDLERS ---
  const handleToggleTask = async (task, idx) => {
    if (activePlan) {
      const dayIndex = activePlan.schedule.findIndex(day => new Date(day.date).toDateString() === todayDateStr);
      if (dayIndex !== -1) {
        // Optimistic update of task completion
        const previousPlan = { ...activePlan };
        const updatedSchedule = [...activePlan.schedule];
        const updatedTasks = [...updatedSchedule[dayIndex].tasks];
        
        updatedTasks[idx] = { 
          ...updatedTasks[idx], 
          isCompleted: !updatedTasks[idx].isCompleted 
        };
        updatedSchedule[dayIndex] = {
          ...updatedSchedule[dayIndex],
          tasks: updatedTasks
        };

        setActivePlan({
          ...activePlan,
          schedule: updatedSchedule
        });

        try {
          const { ok } = await plannerAPI.markComplete({ dayIndex, taskIndex: idx });
          if (!ok) {
            // Revert local state if request failed
            setActivePlan(previousPlan);
          } else {
            // Track session logs asynchronously
            await analyticsAPI.log();
            fetchSummaryData();
          }
        } catch (err) {
          console.error("Failed to sync task toggle on dashboard:", err);
          setActivePlan(previousPlan);
        }
      }
    } else {
      // Wizard local fallback
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: !t.completed } : t));
    }
  };

  const handleDashboardRebalance = async () => {
    try {
      setLoadingPlan(true);
      const { data, ok } = await plannerAPI.rebalance();
      if (ok && data?.studyPlan) {
        setActivePlan(data.studyPlan);
        setRebalanceResult({
          isOpen: true,
          title: "AI Plan Updated",
          explanation: data.explanation || "Your unfinished study tasks have been redistributed across future days."
        });
      } else {
        setRebalanceResult({
          isOpen: true,
          title: "AI Service Offline",
          explanation: "AI service is temporarily unavailable. Please try again."
        });
      }
    } catch (err) {
      console.error("Dashboard rebalance failed:", err);
      setRebalanceResult({
        isOpen: true,
        title: "AI Service Offline",
        explanation: "AI service is temporarily unavailable. Please try again."
      });
    } finally {
      setLoadingPlan(false);
    }
  };

  // Onboarding Wizard triggers
  const startWizard = () => {
    setWizardStep(1);
    setFormExamName("");
    setFormExamDate("");
    setFormProblems("");
  };

  const handleTriggerAI = (e) => {
    e.preventDefault();
    setWizardStep(4);
    setLoadingStep(1);

    setTimeout(() => {
      setLoadingStep(2);
      setTimeout(() => {
        setLoadingStep(3);
        setTimeout(() => {
          generateAIResult();
        }, 1000);
      }, 1000);
    }, 1000);
  };

  const generateAIResult = () => {
    const probLower = formProblems.toLowerCase();
    let rawExplanation = "";
    let schedule = [];
    let mindsetCoach = "";

    if (formExamLevel === "School") {
      if (probLower.includes("math") || probLower.includes("calculus") || probLower.includes("integration")) {
        rawExplanation = "Imagine slicing a big yummy cake into tiny, thin pieces to measure exactly how much cake you have! That's integration.";
      } else {
        rawExplanation = "Let's play the Feynman game! Pretend you are a teacher explaining this to your pet puppy or teddy bear.";
      }
    } else {
      rawExplanation = "To solve Integration by Parts, remember the formula: ∫ u dv = uv - ∫ v du.";
    }

    const explanation = `🎓 **[Standard Blueprint]**\n${rawExplanation}`;

    schedule = [
      { text: `Focus Block: High-yield concepts of ${formExamSubject}`, duration: "45m", category: formExamSubject, urgency: "High" },
      { text: "Spaced repetition checklist: Review flashcards", duration: "25m", category: formExamSubject, urgency: "Low" }
    ];
    mindsetCoach = "Your pressure is manageable. Maintain a steady study pace today to stay ahead!";

    const newResult = {
      examName: formExamName,
      examSubject: formExamSubject,
      examDate: formExamDate,
      pressure: formPressure,
      explanation,
      schedule,
      mindsetCoach
    };

    setAiResponse(newResult);
    localStorage.setItem('last_ai_result', JSON.stringify(newResult));
    setWizardStep(5);
  };

  const applyScheduleAndUnlock = () => {
    if (!aiResponse) return;

    const newTasks = aiResponse.schedule.map((step, idx) => ({
      id: Date.now() + idx,
      text: `${step.text} (${step.duration})`,
      completed: false,
      category: step.category,
      urgency: step.urgency
    }));

    setTasks(prev => [...prev, ...newTasks]);

    const newExam = {
      id: Date.now() + 10,
      name: aiResponse.examName,
      subject: aiResponse.examSubject,
      date: aiResponse.examDate,
      readiness: 60
    };

    const examExists = exams.some(e => e.name.toLowerCase() === newExam.name.toLowerCase());
    if (!examExists) {
      setExams(prev => [...prev, newExam]);
    }

    setAssessmentCompleted(true);
    localStorage.setItem('study_assessment_completed', 'true');
    setWizardStep(0);
  };

  const handleResetAssessment = () => {
    setAssessmentCompleted(false);
    localStorage.setItem('study_assessment_completed', 'false');
    localStorage.removeItem('last_ai_result');
    setAiResponse(null);
    setWizardStep(0);
  };

  return (
    <div className="animate-in fade-in duration-500 space-y-8">

      {/* --- RENDER 1: WIZARD/ONBOARDING NOT COMPLETED --- */}
      {!assessmentCompleted && (
        <div className="max-w-2xl mx-auto space-y-6 pt-4">
          {wizardStep === 0 && (
            <div className="glass-panel p-8 rounded-2xl border border-white/10 text-center space-y-6 bg-gradient-to-br from-dark-800 via-primary-950/10 to-purple-950/10">
              <div className="w-16 h-16 bg-gradient-to-tr from-primary-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto shadow-xl">
                <Brain className="w-9 h-9 text-white" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">Custom AI Planner Setup</h2>
                <p className="text-slate-400 text-sm max-w-md mx-auto leading-relaxed">
                  Welcome! Before generating schedules, we need to analyze your exam schedule, workload stress, and primary challenges.
                </p>
              </div>
              <button
                onClick={startWizard}
                className="btn-primary py-3.5 px-8 rounded-xl font-bold flex items-center justify-center gap-2 mx-auto shadow-[0_0_20px_rgba(20,184,166,0.3)] cursor-pointer"
              >
                Start AI Study Setup
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          )}

          {wizardStep === 1 && (
            <div className="glass-panel p-6 md:p-8 rounded-2xl border border-white/10 space-y-6">
              <div className="flex justify-between items-center pb-4 border-b border-slate-800/80">
                <h3 className="font-extrabold text-lg text-white flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5 text-teal-400" />
                  Step 1: Upcoming Exam details
                </h3>
                <span className="text-xs text-slate-500 font-semibold">Step 1 of 3</span>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Subject Category</label>
                  <select
                    value={formExamSubject}
                    onChange={(e) => setFormExamSubject(e.target.value)}
                    className="w-full bg-dark-900 border border-slate-700 px-4 py-3 rounded-lg text-sm font-semibold focus:border-primary-500 outline-none text-slate-100"
                  >
                    <option value="Math">Math</option>
                    <option value="Physics">Physics</option>
                    <option value="English">English</option>
                    <option value="Computer Science">Computer Science</option>
                    <option value="General">General</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Academic Level</label>
                  <select
                    value={formExamLevel}
                    onChange={(e) => setFormExamLevel(e.target.value)}
                    className="w-full bg-dark-900 border border-slate-700 px-4 py-3 rounded-lg text-sm font-semibold focus:border-primary-500 outline-none text-slate-100"
                  >
                    <option value="School">🎒 School</option>
                    <option value="College">🏫 College</option>
                    <option value="BS">🎓 BS / Undergrad</option>
                    <option value="MS">🔬 MS / Graduate</option>
                    <option value="PhD">🎓 PhD Research</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Exam Name / Details</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Calculus II Midterm"
                    value={formExamName}
                    onChange={(e) => setFormExamName(e.target.value)}
                    className="input-field text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Exam Date</label>
                  <input
                    type="date"
                    required
                    value={formExamDate}
                    onChange={(e) => setFormExamDate(e.target.value)}
                    className="w-full bg-dark-900 border border-slate-700 px-4 py-3 rounded-lg text-sm font-semibold focus:border-primary-500 outline-none text-slate-100"
                  />
                </div>
              </div>
              <div className="flex gap-4 pt-2">
                <button
                  type="button"
                  onClick={() => setWizardStep(0)}
                  className="flex-1 py-3 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-350 font-semibold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => setWizardStep(2)}
                  disabled={!formExamName.trim() || !formExamDate}
                  className="flex-1 btn-primary py-3 rounded-xl cursor-pointer disabled:opacity-50"
                >
                  Next: Study Workload
                </button>
              </div>
            </div>
          )}

          {wizardStep === 2 && (
            <div className="glass-panel p-6 md:p-8 rounded-2xl border border-white/10 space-y-6">
              <div className="flex justify-between items-center pb-4 border-b border-slate-800/80">
                <h3 className="font-extrabold text-lg text-white flex items-center gap-2">
                  <Activity className="w-5 h-5 text-purple-400" />
                  Step 2: Study Workload & Pressure
                </h3>
                <span className="text-xs text-slate-500 font-semibold">Step 2 of 3</span>
              </div>
              <div className="space-y-4">
                <p className="text-xs text-slate-400">
                  Select your current workload stress level. The AI planner will calibrate the pacing and breaks of your study schedule.
                </p>
                <div className="grid grid-cols-1 gap-3">
                  {[
                    { level: "Low", label: "Low (Chilled / Spaced pace)", desc: "Exams are far. Plenty of prep room.", style: "border-emerald-500/25 hover:border-emerald-500 text-emerald-400 bg-emerald-500/5 hover:bg-emerald-500/10", icon: <Smile className="w-5 h-5" /> },
                    { level: "Medium", label: "Medium (Moderate pace)", desc: "Consistent tasks. Standard focus blocks.", style: "border-teal-500/25 hover:border-teal-500 text-teal-400 bg-teal-500/5 hover:bg-teal-500/10", icon: <TrendingUp className="w-5 h-5" /> },
                    { level: "High", label: "High (Intense review pace)", desc: "Workload is piling up.", style: "border-orange-500/25 hover:border-orange-500 text-orange-400 bg-orange-500/5 hover:bg-orange-500/10", icon: <AlertCircle className="w-5 h-5" /> },
                    { level: "Critical", label: "Critical (Cramming / Panic mode)", desc: "Exam is days away!", style: "border-red-500/25 hover:border-red-500 text-red-400 bg-red-500/5 hover:bg-red-500/10", icon: <ShieldAlert className="w-5 h-5" /> }
                  ].map(p => (
                    <button
                      key={p.level}
                      type="button"
                      onClick={() => setFormPressure(p.level)}
                      className={`p-4 rounded-xl border flex items-center justify-between transition-all cursor-pointer text-left ${p.style} ${
                        formPressure === p.level ? 'ring-2 ring-primary-500 bg-slate-900/80 shadow-lg' : ''
                      }`}
                    >
                      <div className="flex gap-3 items-center">
                        {p.icon}
                        <div>
                          <div className="font-bold text-sm text-white">{p.label}</div>
                          <div className="text-[11px] text-slate-400 mt-0.5">{p.desc}</div>
                        </div>
                      </div>
                      <div className={`w-4.5 h-4.5 rounded-full border flex items-center justify-center ${formPressure === p.level ? 'bg-primary-500 border-primary-500 text-white' : 'border-slate-600'}`}>
                        {formPressure === p.level && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-4 pt-2">
                <button
                  type="button"
                  onClick={() => setWizardStep(1)}
                  className="flex-1 py-3 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-350 font-semibold transition-all cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setWizardStep(3)}
                  className="flex-1 btn-primary py-3 rounded-xl cursor-pointer"
                >
                  Next: Concepts Details
                </button>
              </div>
            </div>
          )}

          {wizardStep === 3 && (
            <div className="glass-panel p-6 md:p-8 rounded-2xl border border-white/10 space-y-6">
              <div className="flex justify-between items-center pb-4 border-b border-slate-800/80">
                <h3 className="font-extrabold text-lg text-white flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-teal-400 animate-pulse" />
                  Step 3: Conceptual Problems & Struggles
                </h3>
                <span className="text-xs text-slate-500 font-semibold">Step 3 of 3</span>
              </div>
              <form onSubmit={handleTriggerAI} className="space-y-4">
                <p className="text-xs text-slate-400">
                  Briefly describe the specific problem, topic, or logic you are struggling to comprehend. Our AI will formulate explanations and custom schedule steps.
                </p>
                <div>
                  <textarea
                    rows="4"
                    required
                    value={formProblems}
                    onChange={(e) => setFormProblems(e.target.value)}
                    placeholder="e.g. 'I don't understand integration by parts'"
                    className="input-field text-sm leading-relaxed p-4"
                  />
                </div>
                <div className="flex gap-4 pt-2">
                  <button
                    type="button"
                    onClick={() => setWizardStep(2)}
                    className="flex-1 py-3 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-350 font-semibold transition-all cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={!formProblems.trim()}
                    className="flex-1 btn-primary py-3 rounded-xl cursor-pointer disabled:opacity-50"
                  >
                    Analyze & Generate Schedule
                  </button>
                </div>
              </form>
            </div>
          )}

          {wizardStep === 4 && (
            <div className="glass-panel p-10 rounded-2xl border border-white/10 text-center space-y-6 flex flex-col items-center justify-center">
              <Loader2 className="w-12 h-12 text-primary-400 animate-spin" />
              <div className="space-y-2">
                <h4 className="font-extrabold text-white text-lg">AI Tutor at Work...</h4>
                {loadingStep === 1 && <p className="text-slate-400 text-sm animate-pulse">Analyzing upcoming exam timelines...</p>}
                {loadingStep === 2 && <p className="text-slate-400 text-sm animate-pulse">Formulating concept summaries...</p>}
                {loadingStep === 3 && <p className="text-slate-400 text-sm animate-pulse">Drafting study intervals...</p>}
              </div>
            </div>
          )}

          {wizardStep === 5 && aiResponse && (
            <div className="glass-panel p-6 md:p-8 rounded-2xl border border-white/10 space-y-6">
              <div className="flex justify-between items-center pb-4 border-b border-slate-800/80">
                <h3 className="font-black text-xl text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary-400" />
                  Your Custom AI Study Blueprint
                </h3>
                <span className="text-xs uppercase font-extrabold text-primary-400 bg-primary-500/10 px-2 py-0.5 rounded border border-primary-500/20">
                  Ready
                </span>
              </div>
              <div className="p-3 bg-slate-900/50 rounded-xl text-xs border border-slate-880 text-slate-400">
                Generated for <strong className="text-white">{aiResponse.examName} ({aiResponse.examSubject})</strong>.
              </div>
              <div className="space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Brain className="w-4 h-4 text-primary-400" />
                  AI Conceptual Guide & Advice
                </div>
                <div className="p-4 bg-[#0a0f1b] border border-slate-800 text-slate-200 text-xs rounded-xl leading-relaxed font-medium">
                  {aiResponse.explanation}
                </div>
              </div>
              <button
                onClick={applyScheduleAndUnlock}
                className="w-full btn-primary py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_20px_rgba(20,184,166,0.3)]"
              >
                Apply Schedule & Unlock Dashboard Overview
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* --- RENDER 2: ONBOARDING COMPLETED (DASHBOARD SCREEN) --- */}
      {assessmentCompleted && (
        <div className="space-y-8 animate-in fade-in duration-500">
          
          {/* Welcome Panel & Quick Actions Row */}
          <div className="glass-panel p-6 md:p-8 rounded-3xl border border-white/5 bg-gradient-to-r from-dark-900 via-[#191135]/30 to-dark-900 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-2">
                Welcome back, {userName}! <span className="wave-hand animate-bounce">👋</span>
              </h2>
              <p className="text-slate-400 text-sm max-w-lg leading-relaxed">
                Your study plan is fully active. The AI scheduler continues to calibrate your workload according to your progress and exam deadlines.
              </p>
              <div className="text-xs text-primary-400 font-bold flex items-center gap-1.5 pt-1">
                <span className="w-2 h-2 rounded-full bg-primary-500 animate-pulse"></span>
                Status: Dynamic Adaptation Mode Enabled
              </div>
            </div>

            {/* Quick Action Buttons Grid */}
            <div className="grid grid-cols-2 gap-3 max-w-sm w-full">
              <Link to="/study" className="flex flex-col items-center justify-center p-3.5 bg-slate-900/60 border border-slate-800/80 hover:bg-slate-800/60 rounded-2xl hover:border-teal-500/40 text-center transition-all cursor-pointer group">
                <BrainCircuit className="w-5 h-5 text-teal-400 group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-bold text-white mt-1">Calendar Planner</span>
              </Link>
              <Link to="/exams" className="flex flex-col items-center justify-center p-3.5 bg-slate-900/60 border border-slate-800/80 hover:bg-slate-800/60 rounded-2xl hover:border-purple-500/40 text-center transition-all cursor-pointer group">
                <BookOpen className="w-5 h-5 text-purple-400 group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-bold text-white mt-1">Exam Prep Mode</span>
              </Link>
              <Link to="/study" className="flex flex-col items-center justify-center p-3.5 bg-slate-900/60 border border-slate-800/80 hover:bg-slate-800/60 rounded-2xl hover:border-orange-500/40 text-center transition-all cursor-pointer group">
                <Clock className="w-5 h-5 text-orange-400 group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-bold text-white mt-1">Syllabus Upload</span>
              </Link>
              <button 
                onClick={handleResetAssessment}
                className="flex flex-col items-center justify-center p-3.5 bg-slate-900/60 border border-slate-800/80 hover:bg-slate-800/60 rounded-2xl hover:border-slate-650 text-center transition-all cursor-pointer group"
              >
                <RefreshCw className="w-5 h-5 text-slate-400 group-hover:rotate-45 transition-transform" />
                <span className="text-[10px] font-bold text-white mt-1">Retake Stress AI</span>
              </button>
            </div>
          </div>

          {/* Core Performance Analytics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* 1. Today's Planned vs Completed Time */}
            <div className="glass-panel p-5 rounded-2xl border border-white/5 bg-gradient-to-br from-dark-800 to-teal-950/5 flex items-center gap-4.5">
              <div className="p-3.5 bg-teal-500/10 text-teal-400 border border-teal-500/20 rounded-2xl">
                <Clock className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Today's Study Load</p>
                <h4 className="text-lg font-black text-white">{todayCompletedHours}h / {todayPlannedHours}h</h4>
                <p className="text-[10px] text-slate-500 font-semibold">Planned Hours vs. Completed</p>
              </div>
            </div>

            {/* 2. Today's Study Progress */}
            <div className="glass-panel p-5 rounded-2xl border border-white/5 bg-gradient-to-br from-dark-800 to-primary-950/5 flex items-center gap-4.5">
              <div className="relative w-14 h-14 flex-shrink-0 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="28" cy="28" r="23" className="stroke-slate-850" strokeWidth="4.5" fill="transparent" />
                  <circle
                    cx="28"
                    cy="28"
                    r="23"
                    className="stroke-primary-500 transition-all duration-500"
                    strokeWidth="4.5"
                    fill="transparent"
                    strokeDasharray={2 * Math.PI * 23}
                    strokeDashoffset={2 * Math.PI * 23 * (1 - (totalTasksCount > 0 ? (completedTasksCount / totalTasksCount) : 0))}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute font-black text-white text-[11px]">
                  {totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0}%
                </span>
              </div>
              <div className="space-y-0.5">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Today's Progress</p>
                <h4 className="text-base font-extrabold text-white">{completedTasksCount}/{totalTasksCount} Tasks Done</h4>
                <p className="text-[10px] text-slate-500 font-semibold">Completion of today's workload</p>
              </div>
            </div>

            {/* 3. Overall Study Progress */}
            <div className="glass-panel p-5 rounded-2xl border border-white/5 bg-gradient-to-br from-dark-800 to-purple-950/5 flex items-center gap-4.5">
              <div className="p-3.5 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-2xl">
                <Trophy className="w-6 h-6 text-purple-400" />
              </div>
              <div className="space-y-1.5 flex-1">
                <div className="flex justify-between items-center">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Overall Plan Progress</p>
                  <span className="text-[10px] text-purple-400 font-mono font-black">{progressPercentage}%</span>
                </div>
                <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden border border-slate-850">
                  <div className="bg-purple-400 h-full rounded-full transition-all duration-500" style={{ width: `${progressPercentage}%` }}></div>
                </div>
                <p className="text-[9px] text-slate-500 font-semibold">Completion across whole schedule</p>
              </div>
            </div>

            {/* 4. Active Study Streak */}
            <div className="glass-panel p-5 rounded-2xl border border-white/5 bg-gradient-to-br from-dark-800 to-orange-950/5 flex items-center gap-4.5">
              <div className="p-3.5 bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded-2xl">
                <Flame className="w-6 h-6 animate-pulse" />
              </div>
              <div className="space-y-1">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Study Streak Shield</p>
                <h4 className="text-base font-extrabold text-white mt-0.5">{summaryData?.streak?.current ?? streak} Days 🔥</h4>
                <p className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span>
                  Active Shield Enabled
                </p>
              </div>
            </div>
          </div>

          {/* Primary Layout Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* LEFT 7 COLUMNS: Schedule, Missed Session Banner & AI Recommendations */}
            <div className="lg:col-span-7 space-y-8">
              
              {/* Missed Sessions Adaptive Shield Banner */}
              {missedSessions.length > 0 && (
                <div className="glass-panel p-6 rounded-2xl border border-red-500/20 bg-gradient-to-r from-red-500/5 via-[#1a0808]/20 to-red-500/5 space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl">
                      <ShieldAlert className="w-6 h-6 text-red-400 animate-pulse" />
                    </div>
                    <div className="space-y-1 flex-1">
                      <h4 className="font-extrabold text-sm text-red-300">Missed Study Sessions Detected</h4>
                      <p className="text-xs text-slate-355 leading-relaxed">
                        You have <strong>{missedSessions.length} uncompleted study task(s)</strong> from previous days. The AI scheduler can automatically rebalance your remaining workload to preserve deadlines without exceeding daily hours limit.
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-red-500/10">
                    <div className="text-[10px] text-slate-500 font-mono font-semibold">
                      Missed topics: {missedSessions.slice(0, 2).map(t => t.chapterName).join(", ")}{missedSessions.length > 2 ? '...' : ''}
                    </div>
                    <button
                      onClick={handleDashboardRebalance}
                      disabled={loadingPlan}
                      className="px-3.5 py-2 rounded-xl bg-red-650 hover:bg-red-600 border border-red-500/30 text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                    >
                      {loadingPlan ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5 text-white" />
                      )}
                      🤖 AI Auto-Rebalance Plan
                    </button>
                  </div>
                </div>
              )}

              {/* Today's Schedule Tasks Checklist */}
              <div className="glass-panel rounded-2xl p-6 border border-white/5 space-y-5">
                <div className="flex justify-between items-center pb-3 border-b border-slate-850">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <ListTodo className="w-5 h-5 text-teal-400" />
                    Today's Study Checklist
                  </h3>
                  <span className="text-[10px] font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-700">
                    {completedTasksCount} / {totalTasksCount} Complete
                  </span>
                </div>

                <div className="space-y-3">
                  {loadingPlan ? (
                    <div className="space-y-2 py-4">
                      <div className="h-10 bg-slate-800/40 rounded-xl animate-pulse"></div>
                      <div className="h-10 bg-slate-800/40 rounded-xl animate-pulse"></div>
                    </div>
                  ) : activeTasksList.length > 0 ? (
                    activeTasksList.map((task, idx) => {
                      const isDone = activePlan ? task.isCompleted : task.completed;
                      
                      return (
                        <div
                          key={task.id || idx}
                          onClick={() => handleToggleTask(task, idx)}
                          className={`p-3.5 bg-slate-900/40 border rounded-xl flex items-center justify-between cursor-pointer hover:bg-slate-900/70 transition-all group ${
                            isDone 
                              ? 'border-slate-850 opacity-60 text-slate-500 bg-[#0e1610]/10' 
                              : 'border-slate-800 text-slate-200 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                              isDone 
                                ? 'bg-emerald-500 border-emerald-500 text-white' 
                                : 'border-slate-500 group-hover:border-teal-400'
                            }`}>
                              {isDone && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                            </div>
                            <div className="text-xs">
                              <span className={`font-semibold ${isDone ? 'line-through' : ''}`}>
                                {task.text || task.chapterName}
                              </span>
                              {task.estimatedHours && (
                                <span className="text-[10px] text-slate-500 block font-semibold mt-0.5">Duration: {task.estimatedHours} hour(s)</span>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex gap-2">
                            {task.isRevision && (
                              <span className="text-[9px] uppercase tracking-wider font-extrabold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                                Revision
                              </span>
                            )}
                            <span className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                              {task.category || task.subjectName || "Study"}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-8 bg-slate-950/20 border border-dashed border-slate-850 rounded-xl space-y-2">
                      <Smile className="w-8 h-8 text-slate-500 mx-auto" />
                      <p className="text-slate-500 text-xs font-semibold">No tasks scheduled for today! Enjoy your break day. 🎉</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Dynamic AI Study Recommendations & Insights */}
              <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-5">
                <div className="flex justify-between items-center pb-3 border-b border-slate-850">
                  <div>
                    <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                      <Brain className="w-5 h-5 text-purple-400" />
                      🤖 AI Study recommendations
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">Real-time coaching recommendations based on mastery and quiz accuracy.</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {loadingInsights ? (
                    <div className="space-y-3">
                      <div className="h-16 bg-slate-800/40 rounded-xl animate-pulse"></div>
                      <div className="h-16 bg-slate-800/40 rounded-xl animate-pulse"></div>
                    </div>
                  ) : aiInsights.length > 0 ? (
                    aiInsights.map((insight, idx) => {
                      const isWarning = insight.level === 'warning';
                      const isTip = insight.level === 'tip';
                      
                      return (
                        <div
                          key={idx}
                          className={`p-4 rounded-xl border text-xs flex gap-3.5 transition-all ${
                            isWarning 
                              ? 'bg-red-500/5 border-red-500/10 text-red-300' 
                              : isTip 
                              ? 'bg-purple-500/5 border-purple-500/10 text-purple-300' 
                              : 'bg-emerald-500/5 border-emerald-500/10 text-emerald-300'
                          }`}
                        >
                          <div className={`p-2 rounded-xl flex-shrink-0 ${
                            isWarning ? 'bg-red-500/10 text-red-400' : isTip ? 'bg-purple-500/10 text-purple-400' : 'bg-emerald-500/10 text-emerald-400'
                          }`}>
                            <Sparkles className="w-4.5 h-4.5" />
                          </div>
                          <div>
                            <h5 className="font-extrabold text-white mb-0.5">{insight.title}</h5>
                            <p className="leading-relaxed font-semibold text-slate-350">{insight.advice}</p>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-4 bg-slate-900/30 border border-slate-850 rounded-xl text-center text-slate-500">
                      AI is compiling study metrics. Log a quiz or complete checklist items to activate tips.
                    </div>
                  )}
                </div>
              </div>

            </div>
            
            {/* RIGHT 5 COLUMNS: Upcoming Exams, Streaks & Gamification */}
            <div className="lg:col-span-5 space-y-8">
              
              {/* Upcoming Exams Countdown Timeline */}
              <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-slate-850">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <CalendarIcon className="w-4 h-4 text-teal-400" />
                      Upcoming Exams Timeline
                    </h3>
                    <p className="text-[10px] text-slate-500 mt-0.5">Days remaining count to examination day</p>
                  </div>
                  <Link to="/exams" className="text-xs text-primary-400 hover:text-primary-350 font-semibold flex items-center gap-0.5">
                    Exam Mode <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                <div className="space-y-3">
                  {exams.slice(0, 3).map(exam => {
                    const daysLeft = getDaysRemaining(exam.date);
                    const isUrgent = daysLeft <= 3 && daysLeft >= 0;
                    
                    return (
                      <div key={exam.id} className="p-3 bg-slate-900/30 border border-slate-800/80 rounded-xl flex justify-between items-center text-xs">
                        <div>
                          <span className="text-[9px] font-bold text-teal-400 bg-teal-500/5 px-2 py-0.5 rounded border border-teal-500/20">{exam.subject}</span>
                          <p className="font-semibold text-slate-200 mt-1">{exam.name}</p>
                        </div>
                        <span className={`font-bold px-2.5 py-1 rounded text-[11px] ${
                          isUrgent 
                            ? 'bg-red-500/10 text-red-400 border border-red-500/25 animate-pulse' 
                            : daysLeft < 0 
                            ? 'bg-slate-850 text-slate-500' 
                            : 'bg-slate-800 text-slate-300'
                        }`}>
                          {daysLeft > 0 ? `${daysLeft} Days Left` : daysLeft === 0 ? "Today" : "Completed"}
                        </span>
                      </div>
                    );
                  })}
                  {exams.length === 0 && (
                    <div className="text-center py-4 text-xs text-slate-500">
                      No exams configured. Add them in Exam Mode!
                    </div>
                  )}
                </div>
              </div>

              {/* Weakest Subjects / Mastery Logs */}
              <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-4">
                <div className="pb-3 border-b border-slate-850">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-amber-400" />
                    Subject Mastery Monitor
                  </h3>
                  <p className="text-[10px] text-slate-500 mt-0.5">Average progress percentage per active course</p>
                </div>

                <div className="space-y-3.5">
                  {loadingSummary ? (
                    <SkeletonList count={3} />
                  ) : summaryData?.subjectMastery && summaryData.subjectMastery.length > 0 ? (
                    summaryData.subjectMastery.map(subj => (
                      <div key={subj.name} className="space-y-1.5 text-xs">
                        <div className="flex justify-between items-center text-slate-350">
                          <span className="font-semibold">{subj.name}</span>
                          <span className="font-bold text-[10px] font-mono">{subj.mastery}% Mastery</span>
                        </div>
                        <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden border border-slate-850">
                          <div 
                            className="h-full rounded-full transition-all duration-500" 
                            style={{ 
                              width: `${subj.mastery}%`, 
                              backgroundColor: subj.color || '#a855f7' 
                            }}
                          ></div>
                        </div>
                        <div className="flex justify-between text-[9px] text-slate-500">
                          <span>Completion: {subj.completionRate}%</span>
                          {subj.quizAverage !== null && <span>Quiz Avg: {subj.quizAverage}%</span>}
                        </div>
                      </div>
                    ))
                  ) : subjects.length > 0 ? (
                    subjects.slice(0, 3).map(subj => {
                      const subjTasks = allPlanTasks.filter(t => t.subjectName === subj.name);
                      const subjCompleted = subjTasks.filter(t => t.isCompleted).length;
                      const subjProgress = subjTasks.length > 0 ? Math.round((subjCompleted / subjTasks.length) * 100) : 40;
                      
                      return (
                        <div key={subj.id || subj.name} className="space-y-1.5 text-xs">
                          <div className="flex justify-between items-center text-slate-350">
                            <span className="font-semibold">{subj.name}</span>
                            <span className="font-bold text-[10px] font-mono">{subjProgress}% Mastery</span>
                          </div>
                          <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden border border-slate-850">
                            <div 
                              className="h-full rounded-full transition-all duration-500" 
                              style={{ 
                                width: `${subjProgress}%`, 
                                backgroundColor: subj.color || '#a855f7' 
                              }}
                            ></div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-4 text-xs text-slate-500">
                      No course subjects loaded. Add them in Subjects tab!
                    </div>
                  )}
                </div>
              </div>

              {/* AI Learning Forecast & Wellness */}
              <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-4">
                <div className="pb-3 border-b border-slate-850">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Activity className="w-4 h-4 text-teal-400" />
                    AI Learning Forecast & Wellness
                  </h3>
                  <p className="text-[10px] text-slate-500 mt-0.5">Predictive forecasting based on study metrics</p>
                </div>
                {loadingSummary ? (
                  <div className="h-24 bg-slate-800/40 rounded-xl animate-pulse"></div>
                ) : (
                  <div className="space-y-3.5 text-xs">
                    <div className="flex justify-between items-center bg-slate-900/30 p-2.5 rounded-xl border border-slate-800/50">
                      <div>
                        <p className="text-slate-400 text-[10px] font-semibold">Forecasted Completion</p>
                        <p className="font-extrabold text-white mt-0.5">
                          {summaryData?.forecasting?.forecastedCompletionDate 
                            ? new Date(summaryData.forecasting.forecastedCompletionDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                            : 'N/A'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-slate-400 text-[10px] font-semibold">Current Velocity</p>
                        <p className="font-extrabold text-white mt-0.5">{summaryData?.forecasting?.velocity || '0'}h / day</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/30 border border-slate-800/50">
                      <div className="flex-1 pr-2">
                        <p className="text-slate-400 text-[10px] font-semibold">Burnout Risk Indicator</p>
                        <p className="text-slate-500 text-[9px] font-medium leading-tight mt-0.5">{summaryData?.burnout?.message}</p>
                      </div>
                      <span className={`font-black text-[10px] uppercase px-2 py-0.5 rounded border flex-shrink-0 ${
                        summaryData?.burnout?.risk === 'High' 
                          ? 'bg-red-500/10 text-red-400 border-red-500/20' 
                          : summaryData?.burnout?.risk === 'Medium' 
                          ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' 
                          : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      }`}>
                        {summaryData?.burnout?.risk || 'Low'}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Gamified Weekly Consistency Grid */}
              <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-4">
                <div className="pb-3 border-b border-slate-850">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Award className="w-4 h-4 text-purple-400" />
                    Weekly Check-in logs
                  </h3>
                  <p className="text-[10px] text-slate-500 mt-0.5">Consistency streaks recorded for current week</p>
                </div>
                <div className="grid grid-cols-7 gap-2 text-center text-[10px]">
                  {[
                    { label: "M", done: true },
                    { label: "T", done: true },
                    { label: "W", done: true },
                    { label: "T", done: true },
                    { label: "F", done: true },
                    { label: "S", done: false },
                    { label: "S", done: false }
                  ].map((day, idx) => (
                    <div key={idx} className="space-y-1.5">
                      <div className={`w-full aspect-square rounded-lg flex items-center justify-center font-extrabold ${
                        day.done 
                          ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30 shadow-[0_0_8px_rgba(249,115,22,0.15)] animate-pulse' 
                          : 'bg-slate-900/50 border border-slate-800 text-slate-600'
                      }`}>
                        {day.done ? "🔥" : "✓"}
                      </div>
                      <span className="text-[8px] font-bold uppercase tracking-wider text-slate-500">{day.label}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>

        </div>
      )}

      {/* AI Rebalance Results Alert Modal */}
      {rebalanceResult.isOpen && (
        <div className="fixed inset-0 bg-dark-900/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-300">
          <div className="glass-panel border border-white/10 p-6 rounded-2xl w-full max-w-md relative z-10 shadow-2xl animate-in zoom-in-95 duration-200 space-y-4 bg-gradient-to-tr from-dark-950 via-[#13072e]/20 to-dark-900">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-xl">
                <Sparkles className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">{rebalanceResult.title}</h3>
                <p className="text-xs text-slate-400">Adaptive AI Schedule Updates</p>
              </div>
            </div>

            <p className="text-xs text-slate-350 bg-[#0c1220] p-4 border border-slate-850 rounded-xl leading-relaxed font-semibold">
              {rebalanceResult.explanation}
            </p>

            <button
              onClick={() => setRebalanceResult(prev => ({ ...prev, isOpen: false }))}
              className="w-full btn-primary py-2.5 rounded-xl text-xs font-bold cursor-pointer"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default Dashboard;
