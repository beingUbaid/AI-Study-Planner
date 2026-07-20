import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Sparkles,
  AlertTriangle,
  UploadCloud,
  FileText,
  Clock,
  CheckCircle,
  Trash2,
  CalendarRange,
  Info,
  CalendarDays
} from 'lucide-react';

const CalendarPlanner = () => {
  const {
    tasks, setTasks,
    subjects,
    exams, setExams,
    setNotifications
  } = useOutletContext();

  // Core Form State
  const [plannerSubject, setPlannerSubject] = useState("");
  const [studyLevel, setStudyLevel] = useState("BS");
  const [chaptersInput, setChaptersInput] = useState("");
  const [targetExamDate, setTargetExamDate] = useState("");
  const [dailyHours, setDailyHours] = useState(4);
  const [burnoutWarning, setBurnoutWarning] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  
  // PDF Upload Mock State
  const [isDragging, setIsDragging] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState("");

  // Calendar View State
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);

  // Dynamic schedules generated locally
  const [studyPlanEvents, setStudyPlanEvents] = useState([]);

  // Initialize subject selection
  useEffect(() => {
    if (subjects && subjects.length > 0 && !plannerSubject) {
      setPlannerSubject(subjects[0].name);
    }
  }, [subjects, plannerSubject]);

  // Load study events from localStorage or generate from tasks
  useEffect(() => {
    const savedEvents = localStorage.getItem('study_calendar_events');
    if (savedEvents) {
      setStudyPlanEvents(JSON.parse(savedEvents));
    } else {
      // Derive starting events from tasks
      const derived = tasks.map((task, index) => {
        // Distribute over the next 7 days
        const date = new Date("2026-06-23");
        date.setDate(date.getDate() + (index % 7));
        return {
          id: task.id,
          title: task.text,
          subject: task.category,
          date: date.toISOString().split('T')[0],
          completed: task.completed,
          urgency: task.urgency || "Medium"
        };
      });
      setStudyPlanEvents(derived);
    }
  }, [tasks]);

  // Sync back to local storage and tasks
  const saveEvents = (newEvents) => {
    setStudyPlanEvents(newEvents);
    localStorage.setItem('study_calendar_events', JSON.stringify(newEvents));
  };

  // --- STUDY BURNOUT DETECTOR ---
  useEffect(() => {
    if (dailyHours > 9) {
      setBurnoutWarning(
        "🚨 Burnout Risk Detected: Scheduling more than 9 hours of studying per day dramatically reduces retention and triggers cognitive fatigue. We highly recommend scaling back or enabling revision breaks."
      );
    } else if (dailyHours + (tasks.length * 0.5) > 12) {
      setBurnoutWarning(
        "⚠️ High Cognitive Load: Your aggregate task count plus daily targets exceeds 12 load units. Consider spacing out your subject targets."
      );
    } else {
      setBurnoutWarning("");
    }
  }, [dailyHours, tasks]);

  // --- PDF UPLOAD PARSER SIMULATION ---
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      simulatePDFParsing(files[0].name);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files.length > 0) {
      simulatePDFParsing(e.target.files[0].name);
    }
  };

  const simulatePDFParsing = (filename) => {
    setUploadLoading(true);
    setUploadedFileName(filename);

    // Simulated 3-stage parser animation
    setTimeout(() => {
      // Stage 2
      setTimeout(() => {
        // Final stage
        const subjectSuggestions = {
          physics: {
            subject: "Physics",
            chapters: "Chapter 1: Wave Mechanics, Chapter 2: Quantum States, Chapter 3: Electromagnetic Flux, Chapter 4: Relativistic Dynamics"
          },
          math: {
            subject: "Math",
            chapters: "Chapter 1: Multi-variable Limits, Chapter 2: Partial Derivatives, Chapter 3: Double Integrals, Chapter 4: Vector Fields"
          },
          biology: {
            subject: "General",
            chapters: "Chapter 1: Cellular Respiration, Chapter 2: DNA Replication, Chapter 3: Mendelian Genetics, Chapter 4: Photosynthesis Processes"
          }
        };

        const nameLower = filename.toLowerCase();
        let parsed = subjectSuggestions.physics; // Default

        if (nameLower.includes("math") || nameLower.includes("calc")) {
          parsed = subjectSuggestions.math;
        } else if (nameLower.includes("bio") || nameLower.includes("chem")) {
          parsed = subjectSuggestions.biology;
        }

        setPlannerSubject(parsed.subject);
        setChaptersInput(parsed.chapters);
        
        // Pick an exam date if not set (14 days from now)
        const d = new Date("2026-06-23");
        d.setDate(d.getDate() + 14);
        setTargetExamDate(d.toISOString().split('T')[0]);

        setUploadLoading(false);
        setNotifications(prev => [
          {
            id: Date.now(),
            text: `📄 AI PDF Extractor: Successfully parsed "${filename}". Detected Subject: ${parsed.subject} with ${parsed.chapters.split(',').length} chapters.`,
            read: false
          },
          ...prev
        ]);
      }, 1000);
    }, 1200);
  };

  // --- STUDY SCHEDULE GENERATOR (MOCK LOGIC) ---
  const handleGenerateSchedule = (e) => {
    e.preventDefault();
    if (!chaptersInput.trim() || !targetExamDate) return;

    setIsGenerating(true);
    
    // Simulate generation delays
    setTimeout(() => {
      const chaptersList = chaptersInput.split(',').map(c => c.trim()).filter(Boolean);
      const newTasks = [];
      const newEvents = [...studyPlanEvents];
      
      const startDate = new Date("2026-06-23");
      const endDate = new Date(targetExamDate);
      const timeDiff = endDate.getTime() - startDate.getTime();
      const daysCount = Math.max(Math.ceil(timeDiff / (1000 * 3600 * 24)), 1);

      // Distribute chapters over available days
      chaptersList.forEach((chapter, index) => {
        const targetDate = new Date("2026-06-23");
        // Distribute sequentially across days leading to the exam
        const offsetDays = index % daysCount;
        targetDate.setDate(targetDate.getDate() + offsetDays);
        const dateStr = targetDate.toISOString().split('T')[0];

        const taskId = Date.now() + index;
        const taskText = `Study ${plannerSubject} [${studyLevel}]: ${chapter}`;

        // 1. Save to tasks state
        newTasks.push({
          id: taskId,
          text: taskText,
          completed: false,
          category: plannerSubject,
          urgency: dailyHours > 8 ? "High" : "Medium"
        });

        // 2. Add to calendar events
        newEvents.push({
          id: taskId,
          title: taskText,
          subject: plannerSubject,
          date: dateStr,
          completed: false,
          urgency: dailyHours > 8 ? "High" : "Medium"
        });
      });

      setTasks(prev => [...prev, ...newTasks]);
      saveEvents(newEvents);
      setIsGenerating(false);

      // Create an exam if it doesn't exist
      const examName = `${plannerSubject} [${studyLevel}] Exam`;
      const examExists = exams.some(ex => ex.name.toLowerCase() === examName.toLowerCase());
      if (!examExists) {
        setExams(prev => [
          ...prev,
          {
            id: Date.now() + 100,
            subject: plannerSubject,
            name: examName,
            date: targetExamDate,
            readiness: 40 // Default starting readiness
          }
        ]);
      }

      setNotifications(prev => [
        {
          id: Date.now(),
          text: `📅 AI Planner: Generated a ${chaptersList.length}-day [${studyLevel}] schedule for ${plannerSubject}. Allocated target: ${dailyHours}h/day.`,
          read: false
        },
        ...prev
      ]);

      // Reset Form Chapter
      setChaptersInput("");
    }, 1500);
  };

  // --- CALENDAR MANAGEMENT ---
  const handleToggleEvent = (eventId) => {
    const updated = studyPlanEvents.map(ev => 
      ev.id === eventId ? { ...ev, completed: !ev.completed } : ev
    );
    saveEvents(updated);

    // Sync back to parent checklist
    setTasks(prev => prev.map(t => 
      t.id === eventId ? { ...t, completed: !t.completed } : t
    ));
  };

  const handleDeleteEvent = (eventId) => {
    const updated = studyPlanEvents.filter(ev => ev.id !== eventId);
    saveEvents(updated);

    // Sync back to parent checklist
    setTasks(prev => prev.filter(t => t.id !== eventId));
  };

  // Calendar Date Utilities
  const getDatesForWeek = () => {
    const base = new Date("2026-06-23"); // Anchor point is Monday, June 22/Tuesday June 23
    // Set to Monday of the week
    const day = base.getDay();
    const diff = base.getDate() - day + (day === 0 ? -6 : 1); 
    const monday = new Date(base.setDate(diff));
    monday.setDate(monday.getDate() + (currentWeekOffset * 7));

    const days = [];
    for (let i = 0; i < 7; i++) {
      const current = new Date(monday);
      current.setDate(monday.getDate() + i);
      days.push({
        dateStr: current.toISOString().split('T')[0],
        dayName: current.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNum: current.getDate(),
        monthName: current.toLocaleDateString('en-US', { month: 'short' })
      });
    }
    return days;
  };

  const weekDays = getDatesForWeek();

  // Color Mapping
  const subjectColorMap = {
    Math: "bg-teal-500/10 text-teal-400 border-teal-500/30",
    Physics: "bg-purple-500/10 text-purple-400 border-purple-500/30",
    English: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    "Computer Science": "bg-amber-500/10 text-amber-400 border-amber-500/30",
    General: "bg-slate-500/10 text-slate-400 border-slate-700",
  };

  return (
    <div className="animate-in fade-in duration-500 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-white flex items-center gap-2">
            <CalendarRange className="w-8 h-8 text-teal-400" />
            AI Calendar & Study Planner
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Upload syllabi to auto-extract schedules, generate optimized routines, and manage your weekly load calendar.
          </p>
        </div>
      </div>

      {/* Burnout Indicator Banner */}
      {burnoutWarning && (
        <div className="p-4 rounded-xl border border-red-500/20 bg-red-950/15 flex items-start gap-3 text-red-400 text-sm animate-bounce shadow-lg">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-extrabold">Burnout Warning:</span>
            <p className="text-xs text-red-300 mt-1">{burnoutWarning}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: Setup Planner Form & Syllabus Upload (5 cols) */}
        <div className="lg:col-span-5 space-y-8">
          
          {/* Syllabus Drag & Drop Upload */}
          <div className="glass-panel p-6 rounded-2xl border border-white/5 bg-gradient-to-tr from-dark-900 via-primary-950/5 to-purple-950/5">
            <h3 className="text-base font-bold text-white mb-3 flex items-center gap-2">
              <UploadCloud className="w-5 h-5 text-purple-400" />
              Syllabus PDF Auto-Parser
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Drag & drop your syllabus PDF. Our AI model will extract chapters, detect course subjects, and pre-populate your study planner.
            </p>

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer relative ${
                isDragging 
                  ? 'border-primary-500 bg-primary-500/5' 
                  : 'border-slate-700 hover:border-slate-600 bg-slate-900/30'
              }`}
            >
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              
              {uploadLoading ? (
                <div className="space-y-3 py-4 flex flex-col items-center">
                  <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-xs text-primary-400 font-semibold animate-pulse">Extracting chapters from {uploadedFileName}...</p>
                </div>
              ) : (
                <div className="space-y-2 py-2">
                  <UploadCloud className="w-10 h-10 text-slate-500 mx-auto" />
                  <p className="text-xs text-slate-200 font-bold">
                    {uploadedFileName ? `Re-upload: ${uploadedFileName}` : 'Choose PDF file or drag it here'}
                  </p>
                  <p className="text-[10px] text-slate-500">PDF documents up to 10MB</p>
                </div>
              )}
            </div>

            {uploadedFileName && !uploadLoading && (
              <div className="mt-3 flex items-center gap-2 p-2 bg-[#0c1220] rounded-lg border border-slate-800 text-xs">
                <FileText className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span className="text-slate-300 truncate font-semibold">Active Syllabus: {uploadedFileName}</span>
              </div>
            )}
          </div>

          {/* Schedule Planner Form */}
          <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-5">
            <h3 className="text-base font-bold text-white pb-2 border-b border-slate-850 flex items-center gap-2">
              <Sparkles className="w-4.5 h-4.5 text-primary-400" />
              AI Schedule Generator
            </h3>

            <form onSubmit={handleGenerateSchedule} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Subject Course</label>
                <select
                  value={plannerSubject}
                  onChange={(e) => setPlannerSubject(e.target.value)}
                  className="w-full bg-dark-900 border border-slate-700 px-4 py-3 rounded-lg text-sm font-semibold focus:border-primary-500 outline-none text-slate-100"
                >
                  {subjects.map(s => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))}
                  <option value="General">General / Custom</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Academic Level</label>
                <select
                  value={studyLevel}
                  onChange={(e) => setStudyLevel(e.target.value)}
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
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Chapters / Topics to Cover</label>
                <textarea
                  rows="3"
                  required
                  placeholder="e.g. Chapter 1: Introduction, Chapter 2: Limits, Chapter 3: Differentiation"
                  value={chaptersInput}
                  onChange={(e) => setChaptersInput(e.target.value)}
                  className="input-field text-xs p-3 leading-relaxed"
                />
                <p className="text-[10px] text-slate-500 mt-1">Separate topics/chapters with commas.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Target Exam Date</label>
                  <input
                    type="date"
                    required
                    value={targetExamDate}
                    onChange={(e) => setTargetExamDate(e.target.value)}
                    className="w-full bg-dark-900 border border-slate-700 px-4 py-2.5 rounded-lg text-xs font-semibold focus:border-primary-500 outline-none text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Daily Hours Goal</label>
                  <div className="flex items-center gap-2 bg-dark-900 border border-slate-700 rounded-lg px-3 py-2.5">
                    <Clock className="w-4 h-4 text-slate-500" />
                    <input
                      type="number"
                      min="1"
                      max="16"
                      required
                      value={dailyHours}
                      onChange={(e) => setDailyHours(Number(e.target.value))}
                      className="w-full bg-transparent border-none text-xs font-semibold focus:outline-none text-slate-100"
                    />
                    <span className="text-[10px] font-bold text-slate-400">Hrs</span>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isGenerating || !chaptersInput.trim() || !targetExamDate}
                className="w-full btn-primary py-3 rounded-xl font-bold flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_20px_rgba(20,184,166,0.25)] disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Planning Schedules...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4.5 h-4.5 text-white" />
                    Generate Optimized Schedule
                  </>
                )}
              </button>
            </form>
          </div>

        </div>

        {/* RIGHT COLUMN: Interactive Weekly Calendar Grid (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Calendar Controller Bar */}
          <div className="glass-panel p-4 rounded-2xl border border-white/5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-teal-400" />
              <h3 className="text-sm font-bold text-white">Study Calendar Overview</h3>
            </div>

            <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 p-1 rounded-xl text-xs font-semibold">
              <button
                onClick={() => setCurrentWeekOffset(prev => prev - 1)}
                className="px-2.5 py-1.5 rounded-lg hover:bg-slate-800 hover:text-white transition-colors cursor-pointer text-slate-400"
              >
                Prev Week
              </button>
              <span className="text-slate-300 font-mono px-1">
                {currentWeekOffset === 0 ? "Current Week" : currentWeekOffset > 0 ? `+${currentWeekOffset} Weeks` : `${currentWeekOffset} Weeks`}
              </span>
              <button
                onClick={() => setCurrentWeekOffset(prev => prev + 1)}
                className="px-2.5 py-1.5 rounded-lg hover:bg-slate-800 hover:text-white transition-colors cursor-pointer text-slate-400"
              >
                Next Week
              </button>
            </div>
          </div>

          {/* Calendar Weekly Grid */}
          <div className="glass-panel rounded-2xl border border-white/5 overflow-hidden">
            
            {/* Week header row */}
            <div className="grid grid-cols-7 border-b border-slate-850 bg-slate-900/50">
              {weekDays.map(day => (
                <div key={day.dateStr} className="p-3 text-center border-r border-slate-850/60 last:border-r-0">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">{day.dayName}</span>
                  <span className="text-sm font-extrabold text-slate-200 mt-1 block">{day.monthName} {day.dayNum}</span>
                </div>
              ))}
            </div>

            {/* Grid days content */}
            <div className="grid grid-cols-7 min-h-[420px] bg-dark-900/10">
              {weekDays.map(day => {
                // Find matching events for this day
                const dayEvents = studyPlanEvents.filter(ev => ev.date === day.dateStr);

                return (
                  <div key={day.dateStr} className="p-2 border-r border-b border-slate-850/60 last:border-r-0 flex flex-col gap-2 min-h-[140px] hover:bg-slate-800/10 transition-colors">
                    
                    {dayEvents.map(event => (
                      <div
                        key={event.id}
                        className={`p-2 rounded-xl border flex flex-col justify-between text-[10px] leading-snug transition-all group relative ${
                          event.completed 
                            ? 'bg-slate-900/40 border-slate-800 text-slate-500 opacity-60' 
                            : subjectColorMap[event.subject] || subjectColorMap.General
                        }`}
                      >
                        <div>
                          <div className="flex justify-between items-start gap-1">
                            <span className="font-extrabold text-[9px] uppercase tracking-wider block">{event.subject}</span>
                            
                            <button
                              onClick={() => handleDeleteEvent(event.id)}
                              className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-opacity cursor-pointer p-0.5 rounded"
                              title="Delete Event"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                          
                          <p className={`font-semibold mt-1 ${event.completed ? 'line-through' : 'text-slate-100'}`}>
                            {event.title.replace(`Study ${event.subject}:`, '').trim()}
                          </p>
                        </div>

                        <div className="flex items-center justify-between mt-3 pt-1 border-t border-slate-800/30">
                          <button
                            onClick={() => handleToggleEvent(event.id)}
                            className={`w-4 h-4 rounded-full border flex items-center justify-center cursor-pointer transition-colors ${
                              event.completed
                                ? 'bg-emerald-500 border-emerald-500 text-white'
                                : 'border-slate-500 hover:border-primary-400 hover:bg-primary-500/10'
                            }`}
                          >
                            {event.completed && <CheckCircle className="w-2.5 h-2.5 stroke-[3]" />}
                          </button>

                          <span className={`text-[8px] font-bold px-1 rounded uppercase ${
                            event.urgency === 'High' ? 'text-red-400 bg-red-500/10' : 'text-slate-400 bg-slate-800'
                          }`}>
                            {event.urgency}
                          </span>
                        </div>
                      </div>
                    ))}

                    {dayEvents.length === 0 && (
                      <div className="flex-1 flex items-center justify-center text-slate-600 text-[10px] italic py-8">
                        Free Day
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

          </div>

          {/* Quick instructions / tips */}
          <div className="glass-panel p-5 rounded-2xl border border-white/5 flex gap-4 items-start bg-gradient-to-tr from-dark-900 to-purple-950/10">
            <Info className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <h4 className="font-bold text-white">Spaced Repetition & Study Calibrations</h4>
              <p className="text-slate-400 leading-relaxed">
                The generator divides chapters across the available days leading to the exam. Completion of tasks in the calendar will automatically update your active dashboard statistics and study percentage indicators.
              </p>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};

export default CalendarPlanner;
