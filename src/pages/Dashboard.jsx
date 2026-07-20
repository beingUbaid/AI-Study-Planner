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
  ListTodo
} from 'lucide-react';

const Dashboard = () => {
  const {
    tasks, setTasks,
    exams, setExams,
    todayHours,
    streak,
    setNotifications
  } = useOutletContext();

  // --- STATE FOR WIZARD ---
  const [assessmentCompleted, setAssessmentCompleted] = useState(() => {
    const saved = localStorage.getItem('study_assessment_completed');
    return saved === 'false' ? false : true;
  });
  const [wizardStep, setWizardStep] = useState(0); // 0 = Welcome, 1 = Exam details, 2 = Pressure, 3 = Topic details, 4 = Loading, 5 = AI review

  // Form Fields
  const [formExamSubject, setFormExamSubject] = useState("Math");
  const [formExamLevel, setFormExamLevel] = useState("BS");
  const [formExamName, setFormExamName] = useState("");
  const [formExamDate, setFormExamDate] = useState("");
  const [formPressure, setFormPressure] = useState("Medium"); // Low, Medium, High, Critical
  const [formProblems, setFormProblems] = useState("");

  // AI Generated Results
  const [aiResponse, setAiResponse] = useState(null);
  const [loadingStep, setLoadingStep] = useState(1);

  // Derive stats
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.completed).length;
  const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const targetHours = 6.0;

  // Initialize from LocalStorage to persist completion state
  useEffect(() => {
    const isCompleted = localStorage.getItem('study_assessment_completed');
    if (isCompleted === 'true' || isCompleted === null) {
      setAssessmentCompleted(true);
      // Retrieve last saved AI response
      const savedAi = localStorage.getItem('last_ai_result');
      if (savedAi) {
        setAiResponse(JSON.parse(savedAi));
      }
    } else {
      setAssessmentCompleted(false);
    }
  }, []);

  // Days remaining from reference date (2026-06-23)
  const getDaysRemaining = (examDateStr) => {
    const today = new Date("2026-06-23");
    const examDate = new Date(examDateStr);
    const difference = examDate.getTime() - today.getTime();
    const days = Math.ceil(difference / (1000 * 3600 * 24));
    return days;
  };

  // --- WIZARD PROCEDURES ---
  const startWizard = () => {
    setWizardStep(1);
    setFormExamName("");
    setFormExamDate("");
    setFormProblems("");
  };

  const handleNextStep = () => {
    setWizardStep(prev => prev + 1);
  };

  const handlePrevStep = () => {
    setWizardStep(prev => prev - 1);
  };

  const handleTriggerAI = (e) => {
    e.preventDefault();
    setWizardStep(4); // Show Loader
    setLoadingStep(1);

    // Multi-stage loader steps
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

  // Generate Solution and Schedule Calibrated to Stress
  const generateAIResult = () => {
    const probLower = formProblems.toLowerCase();
    let rawExplanation = "";
    let schedule = [];
    let mindsetCoach = "";

    // 1. MATCH TOPIC KEYWORDS FOR EXPLANATION BASED ON ACADEMIC LEVEL
    if (formExamLevel === "School") {
      if (probLower.includes("math") || probLower.includes("calculus") || probLower.includes("integration") || probLower.includes("parts")) {
        rawExplanation = "Imagine slicing a big yummy cake into tiny, thin pieces to measure exactly how much cake you have! That's integration. If it's 'by parts', it's like splitting a big toy puzzle into two easier pieces. We choose one piece to slice down (make simpler) and one piece to build up, following a friendly recipe rule called LIATE!";
      } else if (probLower.includes("physics") || probLower.includes("mechanics") || probLower.includes("force") || probLower.includes("gravity")) {
        rawExplanation = "Think of drawing a secret map for your toy car! We draw simple arrows showing what's pushing or pulling it: gravity pulling it down to the ground, the solid floor pushing it back up, and your hand pulling it forward. By looking at the arrows, we can easily see which way the car will speed up!";
      } else if (probLower.includes("computer") || probLower.includes("code") || probLower.includes("java") || probLower.includes("recursion") || probLower.includes("javascript")) {
        rawExplanation = "Recursion is just like a magical Russian nesting doll! To find the tiny gold prize at the center, you keep opening the bigger dolls one by one (this is the recursive case) until you reach the last, smallest solid doll that doesn't open (this is the base case). Then you close them all back up!";
      } else if (probLower.includes("chemistry") || probLower.includes("reaction") || probLower.includes("redox") || probLower.includes("acid")) {
        rawExplanation = "Balancing a reaction is like making sure two sides of a playground seesaw are perfectly level. We count the atoms (like counting colored marbles) on both sides and add matching puzzle pieces step-by-step until both sides have the exact same weight!";
      } else {
        rawExplanation = "Let's play the Feynman game! Pretend you are a teacher explaining this to your pet puppy or teddy bear. Use the simplest words possible, draw funny stick-figure diagrams on paper, and find a real-world story that matches the concept.";
      }
    } else {
      // General advanced explanations
      if (probLower.includes("math") || probLower.includes("calculus") || probLower.includes("integration") || probLower.includes("parts")) {
        rawExplanation = "To solve Integration by Parts, remember the formula: ∫ u dv = uv - ∫ v du. The core trick lies in picking 'u'. Follow the LIATE priority list (Logarithmic, Inverse trig, Algebraic, Trigonometric, Exponential). Let 'u' be the component that comes first in LIATE, and 'dv' be the rest.";
      } else if (probLower.includes("physics") || probLower.includes("mechanics") || probLower.includes("force") || probLower.includes("gravity")) {
        rawExplanation = "For force mechanics problems, establish a coordinate system and sketch a Free Body Diagram (FBD). Isolate the object and draw arrows for gravity (mg), normal force (N), friction (f), and tension (T). Resolve diagonal vectors into x/y equations: ΣF_x = m*a_x, ΣF_y = m*a_y.";
      } else if (probLower.includes("computer") || probLower.includes("code") || probLower.includes("java") || probLower.includes("recursion") || probLower.includes("javascript")) {
        rawExplanation = "Recursion requires two elements: A Base Case to stop the execution stack (otherwise StackOverflow occurs) and a Recursive Case that reduces the problem size. Draw a call stack tree to map method arguments and trace bubbling returns.";
      } else if (probLower.includes("chemistry") || probLower.includes("reaction") || probLower.includes("redox") || probLower.includes("acid")) {
        rawExplanation = "To balance redox reactions under acidic conditions: 1. Split into half-reactions, 2. Balance elements except H and O, 3. Add H₂O to balance O, 4. Add H⁺ to balance H, 5. Add electrons (e⁻) to balance charge. Equalize electrons in both halves, merge, and simplify.";
      } else {
        rawExplanation = `Try the Feynman technique: break the topic into primary points, write a simple summary as if teaching a child, review gaps in your notes, and connect new details to past modules via a mind-map.`;
      }
    }

    let levelPrefix = "";
    if (formExamLevel === "PhD") {
      levelPrefix = `🔬 **[PhD Level Research Formalism]**\nReview advanced tensors and boundary convergence singular bounds. Theoretical mapping suggests:\n\n`;
    } else if (formExamLevel === "MS") {
      levelPrefix = `🧪 **[MS Graduate Core Analysis]**\nEvaluate multi-variable differential matrices and structural approximations:\n\n`;
    } else if (formExamLevel === "BS") {
      levelPrefix = `🎓 **[BS Undergraduate Standard Roadmap]**\nMemorize core integration rules, coordinate parameters, and standard frameworks:\n\n`;
    } else if (formExamLevel === "College") {
      levelPrefix = `🏫 **[College Board Prep Outline]**\nCore textbook rules and standard exercise templates:\n\n`;
    } else {
      levelPrefix = `🎒 **[School Conceptual Guide]**\nSimple real-world examples and friendly concept outlines:\n\n`;
    }

    const explanation = levelPrefix + rawExplanation;

    // 2. DESIGN SCHEDULE CALIBRATED TO WORKLOAD PRESSURE AND STUDENT LEVEL
    if (formExamLevel === "School") {
      if (formPressure === "Critical" || formPressure === "High") {
        schedule = [
          { text: `Super-Focus game: Read 15 minutes of ${formExamSubject}`, duration: "15m", category: formExamSubject, urgency: "High" },
          { text: "Juice & Stretch break: Move your body and drink water!", duration: "5m", category: "General", urgency: "Low" },
          { text: `Flashcard quest: Answer 5 practice questions on ${formExamSubject}`, duration: "15m", category: formExamSubject, urgency: "High" },
          { text: "Share the story: Tell someone what you learned!", duration: "10m", category: formExamSubject, urgency: "Medium" }
        ];
        mindsetCoach = "Learning is like building with Lego blocks - one small piece at a time! Take short breaks to stretch and play, and always protect your bedtime. You've got this, superstar!";
      } else {
        schedule = [
          { text: `Warm-up game: Draw a simple mind map of ${formExamName}`, duration: "15m", category: formExamSubject, urgency: "Medium" },
          { text: `Practice run: Solve 3 simple exercise questions`, duration: "20m", category: formExamSubject, urgency: "Medium" },
          { text: "Hydration break: Walk around and get fresh air", duration: "5m", category: "General", urgency: "Low" },
          { text: "Sticker review: Mark the concepts you understood!", duration: "10m", category: formExamSubject, urgency: "Low" }
        ];
        mindsetCoach = "Your pressure is low and manageable. Maintain a steady study pace of 30-40 minutes today to stay ahead of your school schedule!";
      }
    } else {
      if (formPressure === "Critical" || formPressure === "High") {
        schedule = [
          { text: `Focus Block: High-yield concepts of ${formExamSubject} (${formExamName})`, duration: "45m", category: formExamSubject, urgency: "High" },
          { text: "Stress Relief: 10-minute deep breathing/stretching break", duration: "10m", category: "General", urgency: "Low" },
          { text: `Active Recall practice: Review past exam questions on ${formExamSubject}`, duration: "35m", category: formExamSubject, urgency: "High" },
          { text: "Feynman technique review: Explain the hardest concept from memory", duration: "20m", category: formExamSubject, urgency: "Medium" }
        ];
        mindsetCoach = "Your pressure is High. Don't panic! Studying in 45-minute blocks with mandatory hydration and stretching breaks will prevent burnout and maximize retention. Protect your sleep; rest is a superpower.";
      } else {
        // Low or Medium stress
        schedule = [
          { text: `Conceptual study: Outline main subtopics of ${formExamName}`, duration: "30m", category: formExamSubject, urgency: "Medium" },
          { text: `Textbook exercises: Complete 5 moderate difficulty problems`, duration: "40m", category: formExamSubject, urgency: "Medium" },
          { text: "Spaced repetition checklist: Review flashcards and definitions", duration: "25m", category: formExamSubject, urgency: "Low" },
          { text: "Self-assessment test: Log a short review quiz", duration: "15m", category: formExamSubject, urgency: "Low" }
        ];
        mindsetCoach = "Your workload pressure is manageable. Maintain a steady study pace of 1.5 - 2 hours today to stay ahead of the schedule curve.";
      }
    }

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

  // Apply Generated schedule and enter normal dashboard overview
  const applyScheduleAndUnlock = () => {
    if (!aiResponse) return;

    // 1. Add generated tasks to active checklist
    const newTasks = aiResponse.schedule.map((step, idx) => ({
      id: Date.now() + idx,
      text: `${step.text} (${step.duration})`,
      completed: false,
      category: step.category,
      urgency: step.urgency
    }));

    setTasks(prev => [...prev, ...newTasks]);

    // 2. Add exam to upcoming exams list
    const newExam = {
      id: Date.now() + 10,
      name: aiResponse.examName,
      subject: aiResponse.examSubject,
      date: aiResponse.examDate,
      readiness: 60 // initial estimation
    };

    // Check if this exam is already added
    const examExists = exams.some(e => e.name.toLowerCase() === newExam.name.toLowerCase());
    if (!examExists) {
      setExams(prev => [...prev, newExam]);
    }

    // 3. Add to notifications
    setNotifications(prev => [
      { id: Date.now(), text: `AI Assessment complete! Loaded schedule & scheduled ${aiResponse.examName}`, read: false },
      ...prev
    ]);

    // 4. Update state to reveal main dashboard summary
    setAssessmentCompleted(true);
    localStorage.setItem('study_assessment_completed', 'true');
    setWizardStep(0);
  };

  // Reset/Retake Questionnaire
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
          
          {/* Welcome Screen */}
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

          {/* Wizard Step 1: Exam details */}
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
                    placeholder="e.g. Calculus II Midterm, Classical Mechanics Final"
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
                  onClick={handleNextStep}
                  disabled={!formExamName.trim() || !formExamDate}
                  className="flex-1 btn-primary py-3 rounded-xl cursor-pointer disabled:opacity-50"
                >
                  Next: Study Workload
                </button>
              </div>
            </div>
          )}

          {/* Wizard Step 2: Workload Stress / Pressure level */}
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
                    { level: "High", label: "High (Intense review pace)", desc: "Workload is piling up. Getting worried.", style: "border-orange-500/25 hover:border-orange-500 text-orange-400 bg-orange-500/5 hover:bg-orange-500/10", icon: <AlertCircle className="w-5 h-5" /> },
                    { level: "Critical", label: "Critical (Cramming / Panic mode)", desc: "Exam is days away! Maximum focus required.", style: "border-red-500/25 hover:border-red-500 text-red-400 bg-red-500/5 hover:bg-red-500/10", icon: <ShieldAlert className="w-5 h-5" /> }
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
                        {formPressure === p.level && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-4 pt-2">
                <button
                  type="button"
                  onClick={handlePrevStep}
                  className="flex-1 py-3 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-350 font-semibold transition-all cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="flex-1 btn-primary py-3 rounded-xl cursor-pointer"
                >
                  Next: Concepts Details
                </button>
              </div>
            </div>
          )}

          {/* Wizard Step 3: Specific Challenges */}
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
                    placeholder="e.g. 'I don't understand how to choose u/dv in calculus integration by parts' or 'I get stack overflow when writing recursive fibonacci logic'"
                    className="input-field text-sm leading-relaxed p-4"
                  />
                  <p className="text-[10px] text-slate-500 mt-1 italic">
                    Tip: Writing keywords like "integration", "recursion", "redox", or "mechanics" yields custom concept guides.
                  </p>
                </div>

                <div className="flex gap-4 pt-2">
                  <button
                    type="button"
                    onClick={handlePrevStep}
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

          {/* Wizard Step 4: Loading Screen */}
          {wizardStep === 4 && (
            <div className="glass-panel p-10 rounded-2xl border border-white/10 text-center space-y-6 flex flex-col items-center justify-center">
              <Loader2 className="w-12 h-12 text-primary-400 animate-spin" />
              <div className="space-y-2">
                <h4 className="font-extrabold text-white text-lg">AI Tutor at Work...</h4>
                {loadingStep === 1 && (
                  <p className="text-slate-400 text-sm animate-pulse">Analyzing upcoming exam timelines and days remaining...</p>
                )}
                {loadingStep === 2 && (
                  <p className="text-slate-400 text-sm animate-pulse">Formulating concept summaries and clarifying textbook solutions...</p>
                )}
                {loadingStep === 3 && (
                  <p className="text-slate-400 text-sm animate-pulse">Drafting schedule intervals aligned to stress indicators...</p>
                )}
              </div>
            </div>
          )}

          {/* Wizard Step 5: AI Review Solutions Screen */}
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

              {/* Input summary */}
              <div className="p-3 bg-slate-900/50 rounded-xl text-xs border border-slate-800 text-slate-400">
                Generated for <strong className="text-white">{aiResponse.examName} ({aiResponse.examSubject})</strong> scheduled on <strong className="text-white">{aiResponse.examDate}</strong> under <strong className="text-primary-400">{aiResponse.pressure}</strong> stress workload.
              </div>

              {/* Conceptual Explanations */}
              <div className="space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Brain className="w-4 h-4 text-primary-400" />
                  AI Conceptual Guide & Advice
                </div>
                <div className="p-4 bg-[#0a0f1b] border border-slate-800 text-slate-200 text-xs rounded-xl leading-relaxed font-medium">
                  {aiResponse.explanation}
                </div>
              </div>

              {/* Stress-Calibrated Schedule */}
              <div className="space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Generated Study Schedule (4 Steps)
                </div>
                <div className="space-y-2.5">
                  {aiResponse.schedule.map((step, idx) => (
                    <div key={idx} className="p-3 bg-slate-900/40 border border-slate-800/50 rounded-xl flex gap-3 text-xs">
                      <div className="w-5 h-5 rounded-full bg-primary-500/10 border border-primary-500/20 text-primary-400 font-bold flex items-center justify-center flex-shrink-0">
                        {idx + 1}
                      </div>
                      <div>
                        <p className="text-slate-200 font-semibold">{step.text}</p>
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Priority: {step.urgency} | Time: {step.duration}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Mindset Coaching */}
              <div className="p-4 rounded-xl border border-purple-500/20 bg-purple-500/5 text-xs text-slate-350 leading-relaxed">
                <strong>Mindset Coach Alert:</strong> {aiResponse.mindsetCoach}
              </div>

              {/* Apply Schedule */}
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
          
          {/* Quick Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="glass-panel p-5 rounded-2xl border border-white/5 flex items-center gap-4 bg-gradient-to-br from-dark-800 to-teal-950/10">
              <div className="relative w-16 h-16 flex-shrink-0 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="32" cy="32" r="26" className="stroke-slate-850" strokeWidth="5" fill="transparent" />
                  <circle
                    cx="32"
                    cy="32"
                    r="26"
                    className="stroke-primary-500 transition-all duration-500 shadow-[0_0_12px_rgba(20,184,166,0.5)]"
                    strokeWidth="5"
                    fill="transparent"
                    strokeDasharray={2 * Math.PI * 26}
                    strokeDashoffset={2 * Math.PI * 26 * (1 - progressPercentage / 100)}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute font-black text-white text-xs">{progressPercentage}%</span>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Today's Progress</p>
                <h4 className="text-base font-extrabold text-white mt-0.5">{completedTasks}/{totalTasks} Tasks Done</h4>
                <Link to="/study" className="text-[11px] text-primary-400 hover:text-primary-300 hover:underline flex items-center gap-0.5 mt-1 font-semibold transition-colors">
                  Open study tracker <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            <div className="glass-panel p-5 rounded-2xl border border-white/5 flex items-center gap-4 bg-gradient-to-br from-dark-800 to-purple-950/10">
              <div className="p-3.5 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-xl shadow-lg">
                <Clock className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Hours Tracked Today</p>
                <h4 className="text-base font-extrabold text-white mt-0.5">{todayHours.toFixed(1)} hrs / {targetHours.toFixed(0)}h</h4>
                <div className="w-28 bg-slate-900 h-1.5 rounded-full mt-2 overflow-hidden border border-slate-800">
                  <div className="bg-purple-400 h-full rounded-full transition-all duration-500" style={{ width: `${Math.min((todayHours / targetHours) * 100, 100)}%` }}></div>
                </div>
              </div>
            </div>

            <div className="glass-panel p-5 rounded-2xl border border-white/5 flex items-center gap-4 bg-gradient-to-br from-dark-800 to-orange-950/10">
              <div className="p-3.5 bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded-xl shadow-lg">
                <Flame className="w-6 h-6 animate-bounce" />
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Study Streak Shield</p>
                <h4 className="text-base font-extrabold text-white mt-0.5">{streak} Days 🔥</h4>
                <p className="text-[10px] text-emerald-400 mt-1 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span>
                  Streak Shield Active
                </p>
              </div>
            </div>
          </div>

          {/* Grid area */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* LEFT 7 COLUMNS: Task checklist and AI blueprints */}
            <div className="lg:col-span-7 space-y-8">
              
              {/* Daily Checklist Tasks Preview */}
              <div className="glass-panel rounded-2xl p-6 border border-white/5 space-y-5">
                <div className="flex justify-between items-center pb-3 border-b border-slate-850">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <ListTodo className="w-5 h-5 text-teal-400" />
                    Today's Study Checklist
                  </h3>
                  <Link to="/study" className="text-xs text-primary-400 hover:text-primary-300 font-semibold flex items-center gap-0.5">
                    View Planner <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>

                <div className="space-y-3.5">
                  {tasks.slice(0, 3).map(task => (
                    <div
                      key={task.id}
                      onClick={() => {
                        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: !t.completed } : t));
                      }}
                      className={`p-3 bg-slate-900/40 border rounded-xl flex items-center justify-between cursor-pointer hover:bg-slate-900/70 transition-all ${
                        task.completed 
                          ? 'border-slate-850 opacity-60 text-slate-500' 
                          : 'border-slate-800 text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                          task.completed 
                            ? 'bg-emerald-500 border-emerald-500 text-white' 
                            : 'border-slate-500 hover:border-teal-400'
                        }`}>
                          {task.completed && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                        <span className={`text-xs font-semibold ${task.completed ? 'line-through' : ''}`}>
                          {task.text}
                        </span>
                      </div>
                      <span className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                        {task.category}
                      </span>
                    </div>
                  ))}
                  {tasks.length === 0 && (
                    <p className="text-slate-500 text-xs py-4 text-center">No tasks scheduled for today.</p>
                  )}
                </div>
              </div>

              {/* Active AI Study Guide explanation */}
              {aiResponse && (
                <div className="glass-panel rounded-2xl p-6 border border-white/5 space-y-4 bg-gradient-to-br from-dark-800 to-purple-950/5">
                  <div className="flex justify-between items-center pb-3 border-b border-slate-850">
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <Brain className="w-5 h-5 text-purple-400 animate-pulse" />
                      Active AI Concept Summary
                    </h3>
                    <span className="text-[10px] font-bold text-teal-450 bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/20">
                      {aiResponse.examSubject}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs text-slate-300 leading-relaxed bg-[#0c1220] p-4 border border-slate-850 rounded-xl font-medium">
                      {aiResponse.explanation}
                    </p>
                  </div>

                  <div className="p-3.5 bg-purple-500/5 rounded-xl border border-purple-500/15 text-xs text-slate-350 leading-relaxed">
                    <strong>Coach advice:</strong> {aiResponse.mindsetCoach}
                  </div>
                </div>
              )}

              {/* Rerun questionnaire banner */}
              <div className="glass-panel p-6 rounded-2xl border border-white/5 bg-gradient-to-tr from-dark-900 via-primary-950/5 to-purple-950/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h4 className="font-bold text-white text-sm">Need a new plan generated?</h4>
                  <p className="text-slate-400 text-xs mt-0.5">Retake the AI evaluation to load custom solutions for another course.</p>
                </div>
                <button
                  onClick={handleResetAssessment}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white font-semibold text-xs flex items-center justify-center gap-2 hover:bg-slate-750 transition-all cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Retake AI Assessment
                </button>
              </div>

            </div>

            {/* RIGHT 5 COLUMNS: Leaderboard and count-down timelines */}
            <div className="lg:col-span-5 space-y-8">
              
              {/* Gamified Leaderboard */}
              <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-4">
                <div className="pb-3 border-b border-slate-850">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    College Consistency Leaderboard
                  </h3>
                  <p className="text-[10px] text-slate-500 mt-0.5">Weekly study streak ranking of your class</p>
                </div>

                <div className="space-y-2.5">
                  {[
                    { rank: 1, name: "Sarah Jenkins", streak: 24, status: "🔥" },
                    { rank: 2, name: "David Kim", streak: 18, status: "🔥" },
                    { rank: 3, name: "Aisha Patel", streak: 14, status: "🔥" },
                    { rank: 4, name: "You (User)", streak: streak, status: "🔥", highlight: true },
                    { rank: 5, name: "Alex Mercer", streak: 7, status: "👍" }
                  ].map(student => (
                    <div
                      key={student.rank}
                      className={`p-2.5 rounded-xl border flex items-center justify-between text-xs transition-all ${
                        student.highlight
                          ? 'bg-primary-500/10 border-primary-500/30 text-white shadow-[0_0_15px_rgba(20,184,166,0.1)]'
                          : 'bg-slate-900/30 border-slate-850 text-slate-350'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                          student.rank === 1 ? 'bg-amber-500 text-dark-900 shadow-md' :
                          student.rank === 2 ? 'bg-slate-300 text-dark-900' :
                          student.rank === 3 ? 'bg-amber-800 text-white' : 'bg-slate-800 text-slate-400'
                        }`}>
                          {student.rank}
                        </span>
                        <span className={`font-semibold ${student.highlight ? 'text-primary-400' : ''}`}>{student.name}</span>
                      </div>
                      <span className="font-bold flex items-center gap-1">
                        {student.streak} Days {student.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Streak Tracker Visual Checklist */}
              <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-4">
                <div className="pb-3 border-b border-slate-850">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Flame className="w-4 h-4 text-orange-400" />
                    Weekly Check-in logs
                  </h3>
                  <p className="text-[10px] text-slate-500 mt-0.5">Study streaks recorded for current week</p>
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

              {/* Exam previews */}
              <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-slate-850">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4 text-teal-400" />
                    Exams List Preview
                  </h3>
                  <Link to="/exams" className="text-xs text-primary-400 hover:text-primary-305 font-semibold flex items-center gap-0.5">
                    View All <ArrowRight className="w-3.5 h-3.5" />
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
                        <span className={`font-bold px-2 py-1 rounded ${
                          isUrgent ? 'bg-red-500/10 text-red-400 border border-red-500/20 animate-pulse' : 'bg-slate-800 text-slate-400'
                        }`}>
                          {daysLeft > 0 ? `${daysLeft} days` : daysLeft === 0 ? "Today" : "Done"}
                        </span>
                      </div>
                    );
                  })}
                  {exams.length === 0 && (
                    <p className="text-slate-500 text-xs py-2 text-center">No exams scheduled.</p>
                  )}
                </div>
              </div>

            </div>
          </div>

        </div>
      )}

    </div>
  );
};

export default Dashboard;
