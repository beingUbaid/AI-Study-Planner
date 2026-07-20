import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Clock,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  Plus,
  Trash2,
  Check,
  BookMarked,
  Sparkles
} from 'lucide-react';

const StudyTracker = () => {
  const {
    tasks, setTasks,
    subjects,
    todayHours,
    timeLeft, setTimeLeft,
    timerActive, setTimerActive,
    timerMode, setTimerMode,
    customMinutes, setCustomMinutes,
    setNotifications,
    weeklyHours
  } = useOutletContext();

  const [newTaskText, setNewTaskText] = useState("");
  const [newTaskCategory, setNewTaskCategory] = useState(subjects && subjects.length > 0 ? subjects[0].name : "General");
  const [newTaskUrgency, setNewTaskUrgency] = useState("Medium");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("All");

  const targetHours = 6.0;

  // Derive dynamic subject focus distribution percentage based on tasks
  const getSubjectDistribution = () => {
    if (!subjects || subjects.length === 0) return [];
    
    // Count tasks per subject category
    const counts = {};
    subjects.forEach(sub => {
      counts[sub.name] = 0;
    });
    
    let totalCountedTasks = 0;
    tasks.forEach(task => {
      if (counts[task.category] !== undefined) {
        counts[task.category]++;
        totalCountedTasks++;
      }
    });
    
    // If no tasks are assigned to any active subjects, distribute equally
    if (totalCountedTasks === 0) {
      const pct = Math.round(100 / subjects.length);
      return subjects.map((sub, i) => ({
        name: sub.name,
        percentage: i === subjects.length - 1 ? 100 - pct * (subjects.length - 1) : pct
      }));
    }
    
    // Calculate actual task-based percentages
    let acc = 0;
    return subjects.map((sub, i) => {
      const isLast = i === subjects.length - 1;
      const pct = Math.round((counts[sub.name] / totalCountedTasks) * 100);
      acc += pct;
      return {
        name: sub.name,
        percentage: isLast ? 100 - (acc - pct) : pct
      };
    });
  };

  const subjectDistribution = getSubjectDistribution();
  const chartColors = ["#14b8a6", "#a855f7", "#f59e0b", "#3b82f6", "#ec4899", "#6366f1"];
  let dashOffsetAccumulator = 100;

  // Derive progress metrics
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.completed).length;
  const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Add Task
  const handleAddTask = () => {
    if (!newTaskText.trim()) return;

    const newTask = {
      id: Date.now(),
      text: newTaskText,
      completed: false,
      category: newTaskCategory,
      urgency: newTaskUrgency
    };

    setTasks(prev => [...prev, newTask]);
    setNewTaskText("");
    setNotifications(prev => [
      { id: Date.now(), text: `Added task: "${newTaskText}"`, read: true },
      ...prev
    ]);
  };

  // Toggle Checkbox
  const handleToggleTask = (id) => {
    setTasks(prev => prev.map(task =>
      task.id === id ? { ...task, completed: !task.completed } : task
    ));
  };

  // Delete Task
  const handleDeleteTask = (id, text) => {
    setTasks(prev => prev.filter(task => task.id !== id));
    setNotifications(prev => [
      { id: Date.now(), text: `Deleted task: "${text}"`, read: true },
      ...prev
    ]);
  };

  // Timer Formatting
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleResetTimer = () => {
    setTimerActive(false);
    setTimeLeft(customMinutes * 60);
    setTimerMode("Study");
  };

  const handleSetCustomTime = (mins) => {
    setCustomMinutes(mins);
    setTimeLeft(mins * 60);
    setTimerActive(false);
    setTimerMode("Study");
  };

  // Styling maps
  const categoryColors = {
    Math: "bg-teal-500/10 text-teal-400 border border-teal-500/30",
    Physics: "bg-purple-500/10 text-purple-400 border border-purple-500/30",
    English: "bg-blue-500/10 text-blue-400 border border-blue-500/30",
    "Computer Science": "bg-amber-500/10 text-amber-400 border border-amber-500/30",
    General: "bg-slate-500/10 text-slate-400 border border-slate-700",
  };

  const urgencyColors = {
    High: "text-red-400 border-red-500/30 bg-red-500/10",
    Medium: "text-amber-400 border-amber-500/30 bg-amber-500/10",
    Low: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
  };

  // Filters
  const filteredTasks = selectedCategoryFilter === "All"
    ? tasks
    : tasks.filter(t => t.category === selectedCategoryFilter);

  // SVG Chart: Logged study hours week (Mon-Sun) from context
  const maxWeeklyHours = Math.max(...(weeklyHours || [0,0,0,0,0,0,0]), 6.0);
  const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="animate-in fade-in duration-500 space-y-8">
      {/* Page Header */}
      <div>
        <h2 className="text-3xl font-extrabold text-white flex items-center gap-2">
          <Clock className="w-8 h-8 text-purple-400" />
          Study Hours & Tasks
        </h2>
        <p className="text-slate-400 text-sm mt-1">
          Manage your learning checklists, customize timers, and review focus analytics.
        </p>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* LEFT 7 COLUMNS: Study Analytics & Tasks */}
        <div className="lg:col-span-7 space-y-8">
          {/* Trend & Distribution charts */}
          <div className="glass-panel rounded-2xl p-6 border border-white/5">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-lg font-bold text-white">Study Load Analytics</h3>
                <p className="text-slate-400 text-xs mt-0.5">Logs by weekday & Subject focus breakdown</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-primary-500 rounded-full"></span>
                <span className="text-xs text-slate-400 font-medium">Logged hours</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
              {/* SVG Bar Chart (Weekly Hours) */}
              <div className="md:col-span-7 flex flex-col items-center">
                <div className="w-full h-48 relative">
                  <svg className="w-full h-full" viewBox="0 0 350 180">
                    <line x1="30" y1="20" x2="330" y2="20" stroke="#334155" strokeDasharray="3,3" strokeWidth="0.5" />
                    <line x1="30" y1="60" x2="330" y2="60" stroke="#334155" strokeDasharray="3,3" strokeWidth="0.5" />
                    <line x1="30" y1="100" x2="330" y2="100" stroke="#334155" strokeDasharray="3,3" strokeWidth="0.5" />
                    <line x1="30" y1="140" x2="330" y2="140" stroke="#1e293b" strokeWidth="1" />

                    <text x="5" y="24" fill="#64748b" className="text-[10px] font-medium font-mono">6.0h</text>
                    <text x="5" y="64" fill="#64748b" className="text-[10px] font-medium font-mono">4.0h</text>
                    <text x="5" y="104" fill="#64748b" className="text-[10px] font-medium font-mono">2.0h</text>
                    <text x="5" y="144" fill="#64748b" className="text-[10px] font-medium font-mono">0.0h</text>

                    {weeklyHours.map((hours, idx) => {
                      const barHeight = Math.min((hours / maxWeeklyHours) * 120, 120);
                      const xPos = 45 + idx * 40;
                      const yPos = 140 - barHeight;
                      const isToday = idx === (new Date().getDay() + 6) % 7;

                      return (
                        <g key={idx} className="group cursor-pointer">
                          <title>{`${weekdays[idx]}: ${hours.toFixed(1)} Hours`}</title>
                          <rect
                            x={xPos}
                            y={yPos}
                            width="22"
                            height={barHeight}
                            rx="5"
                            fill={isToday ? "url(#trackerTodayGrad)" : "url(#trackerBarGrad)"}
                            className="transition-all duration-300 group-hover:opacity-90"
                          />
                          <text
                            x={xPos + 11}
                            y={yPos - 6}
                            textAnchor="middle"
                            fill={isToday ? "#2dd4bf" : "#ffffff"}
                            className="text-[9px] font-bold opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                          >
                            {hours.toFixed(1)}h
                          </text>
                          <text
                            x={xPos + 11}
                            y="160"
                            textAnchor="middle"
                            fill={isToday ? "#2dd4bf" : "#94a3b8"}
                            className={`text-[9px] font-bold ${isToday ? 'underline underline-offset-4' : ''}`}
                          >
                            {weekdays[idx]}
                          </text>
                        </g>
                      );
                    })}

                    <defs>
                      <linearGradient id="trackerBarGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#14b8a6" />
                        <stop offset="100%" stopColor="#0d9488" stopOpacity="0.4" />
                      </linearGradient>
                      <linearGradient id="trackerTodayGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#a855f7" />
                        <stop offset="100%" stopColor="#7e22ce" stopOpacity="0.4" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
              </div>
              {/* Focus Distribution */}
              <div className="md:col-span-5 flex flex-col items-center justify-center border-t md:border-t-0 md:border-l border-slate-800/85 pt-6 md:pt-0 md:pl-6">
                <h4 className="text-sm font-semibold text-white mb-3">Focus Breakdown</h4>
                <div className="relative w-28 h-28 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15.91" fill="transparent" stroke="#1e293b" strokeWidth="3" />
                    {subjectDistribution.map((dist, idx) => {
                      const color = chartColors[idx % chartColors.length];
                      const dashArray = `${dist.percentage} ${100 - dist.percentage}`;
                      const offset = dashOffsetAccumulator;
                      dashOffsetAccumulator -= dist.percentage;
                      return (
                        <circle
                          key={dist.name}
                          cx="18"
                          cy="18"
                          r="15.91"
                          fill="transparent"
                          stroke={color}
                          strokeWidth="3.2"
                          strokeDasharray={dashArray}
                          strokeDashoffset={offset}
                        />
                      );
                    })}
                  </svg>
                  <div className="absolute flex flex-col items-center">
                    <span className="text-xs font-bold text-white">{subjects ? subjects.length : 0} Subjects</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-4 text-[10px] w-full">
                  {subjectDistribution.map((dist, idx) => {
                    const color = chartColors[idx % chartColors.length];
                    return (
                      <div key={dist.name} className="flex items-center gap-1.5 justify-start">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }}></span>
                        <span className="text-slate-400 truncate max-w-[80px]" title={dist.name}>
                          {dist.name} ({dist.percentage}%)
                        </span>
                      </div>
                    );
                  })}
                  {subjectDistribution.length === 0 && (
                    <div className="col-span-2 text-center text-slate-500">No subjects</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Today's Checklist */}
          <div className="glass-panel rounded-2xl p-6 border border-white/5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-teal-400" />
                  Today's Task Checklist
                </h3>
                <p className="text-slate-400 text-xs mt-0.5">Toggle checkboxes to update dashboard completion progress.</p>
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {["All", ...(subjects || []).map(s => s.name)].map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategoryFilter(cat)}
                    className={`px-3.5 py-2 rounded-xl border transition-all duration-200 cursor-pointer whitespace-nowrap ${
                      selectedCategoryFilter === cat
                        ? 'text-sm font-extrabold bg-gradient-to-r from-primary-500 to-teal-500 text-white shadow-lg border-teal-400 scale-105'
                        : 'text-xs font-bold text-slate-350 bg-slate-800/80 border-slate-700 hover:text-white hover:bg-slate-750'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Checklist Loop */}
            <div className="space-y-3 mb-6 max-h-72 overflow-y-auto pr-1">
              {filteredTasks.map(task => (
                <div
                  key={task.id}
                  className={`flex items-center justify-between p-3.5 rounded-xl border transition-all duration-300 ${
                    task.completed
                      ? 'bg-slate-900/30 border-slate-800/80 text-slate-500 opacity-60'
                      : 'bg-slate-800/35 border-slate-700/60 hover:bg-slate-850/50 hover:border-slate-650'
                  }`}
                >
                  <div className="flex items-center gap-3.5 flex-1 cursor-pointer" onClick={() => handleToggleTask(task.id)}>
                    <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                      task.completed ? 'bg-primary-500 border-primary-500 text-white' : 'border-slate-600 bg-slate-900/40'
                    }`}>
                      {task.completed && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                    <span className={`text-sm font-medium transition-all ${task.completed ? 'line-through' : 'text-slate-200'}`}>
                      {task.text}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${categoryColors[task.category] || categoryColors.General}`}>
                      {task.category}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${urgencyColors[task.urgency]}`}>
                      {task.urgency}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteTask(task.id, task.text);
                      }}
                      className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                      title="Delete Task"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}

              {filteredTasks.length === 0 && (
                <div className="text-center py-8 bg-slate-900/10 border border-dashed border-slate-800 rounded-xl">
                  <BookMarked className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-slate-500 text-sm">No tasks found for category: {selectedCategoryFilter}</p>
                </div>
              )}
            </div>

            {/* Quick Add Form */}
            <div className="bg-slate-900/40 border border-slate-800/80 p-4 rounded-xl space-y-3">
              <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Quick Add New Task</div>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={newTaskText}
                  onChange={(e) => setNewTaskText(e.target.value)}
                  placeholder="Task details (e.g. Solve physics problems)..."
                  className="input-field flex-1 text-sm py-2 px-3 animate-in"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddTask();
                  }}
                />
                
                <div className="flex gap-2">
                  <select
                    value={newTaskCategory}
                    onChange={(e) => setNewTaskCategory(e.target.value)}
                    className="bg-dark-900 text-slate-200 border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-semibold outline-none"
                  >
                    {(subjects || []).map(s => (
                      <option key={s.id} value={s.name}>{s.name}</option>
                    ))}
                    {(!subjects || subjects.length === 0) && (
                      <option value="General">General</option>
                    )}
                  </select>
                  <select
                    value={newTaskUrgency}
                    onChange={(e) => setNewTaskUrgency(e.target.value)}
                    className="bg-dark-900 text-slate-200 border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-semibold outline-none"
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                  <button
                    onClick={handleAddTask}
                    className="bg-primary-500 hover:bg-primary-600 text-white font-bold px-4 py-1.5 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT 5 COLUMNS: Pomodoro Timer & Progress circle */}
        <div className="lg:col-span-5 space-y-8">
          {/* Active Pomodoro */}
          <div className="glass-panel rounded-2xl p-6 border border-white/5 bg-gradient-to-br from-dark-800 to-purple-950/20">
            <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-purple-400" />
              Study Session Helper (Pomodoro)
            </h3>

            <div className="flex flex-col items-center py-4">
              {/* Radial countdown display */}
              <div className="relative w-44 h-44 rounded-full border-4 border-slate-800/80 flex items-center justify-center flex-col shadow-inner bg-dark-900/60">
                {timerActive && (
                  <div className="absolute inset-0 rounded-full border-4 border-purple-500 animate-ping opacity-15"></div>
                )}
                <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
                  {timerMode === "Study" ? "🧠 STUDYING" : "☕ ON BREAK"}
                </span>
                <span className="text-4xl font-extrabold text-white font-mono mt-1 tracking-wider">
                  {formatTime(timeLeft)}
                </span>
                <p className="text-[10px] text-purple-400 mt-2 font-medium tracking-wide">
                  {timerActive ? "Session running..." : "Timer paused"}
                </p>
              </div>

              {/* Pre-sets */}
              <div className="flex gap-2.5 mt-6">
                {[15, 25, 45, 60].map(mins => (
                  <button
                    key={mins}
                    onClick={() => handleSetCustomTime(mins)}
                    className={`px-3.5 py-2 rounded-xl border transition-all cursor-pointer ${
                      customMinutes === mins
                        ? 'text-xs font-extrabold bg-purple-600 border-purple-400 text-white shadow-[0_0_15px_rgba(168,85,247,0.4)] scale-105'
                        : 'text-xs font-bold bg-slate-800 border-slate-700 text-slate-350 hover:bg-slate-700 hover:text-white'
                    }`}
                  >
                    {mins}m
                  </button>
                ))}
              </div>

              {/* Controls */}
              <div className="flex gap-4 mt-6 w-full justify-center">
                <button
                  onClick={() => setTimerActive(!timerActive)}
                  className={`flex-1 max-w-[120px] py-2 px-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer ${
                    timerActive
                      ? 'bg-red-500 hover:bg-red-600 text-white border border-red-600 shadow-lg'
                      : 'bg-primary-500 hover:bg-primary-600 text-white shadow-[0_0_15px_rgba(20,184,166,0.3)]'
                  }`}
                >
                  {timerActive ? (
                    <>
                      <Pause className="w-4 h-4" />
                      <span>Pause</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current" />
                      <span>Start</span>
                    </>
                  )}
                </button>
                
                <button
                  onClick={handleResetTimer}
                  className="py-2 px-4 rounded-xl bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-750 transition-all font-semibold flex items-center gap-1.5 active:scale-95 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Reset</span>
                </button>
              </div>
            </div>
          </div>

          {/* Today's Stats card summary */}
          <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-5 bg-gradient-to-br from-dark-800 to-teal-950/5">
            <h4 className="text-sm font-bold text-white flex items-center gap-1.5 pb-2 border-b border-slate-850">
              <Sparkles className="w-4 h-4 text-teal-400" />
              Daily Study Status
            </h4>
            
            {/* Progress Percentage dial */}
            <div className="flex items-center gap-5">
              <div className="relative w-16 h-16 flex items-center justify-center flex-shrink-0">
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="32" cy="32" r="26" className="stroke-slate-800" strokeWidth="5.5" fill="transparent" />
                  <circle
                    cx="32"
                    cy="32"
                    r="26"
                    className="stroke-primary-500 transition-all duration-500 ease-out"
                    strokeWidth="5.5"
                    fill="transparent"
                    strokeDasharray={2 * Math.PI * 26}
                    strokeDashoffset={2 * Math.PI * 26 * (1 - progressPercentage / 100)}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute font-black text-white text-xs">{progressPercentage}%</span>
              </div>
              
              <div>
                <div className="text-xs text-slate-400 uppercase font-semibold">Today's Progress</div>
                <div className="text-base font-bold text-white mt-0.5">{completedTasks}/{totalTasks} Tasks Completed</div>
              </div>
            </div>

            {/* Study hours target bar */}
            <div className="pt-2 border-t border-slate-800/80">
              <div className="flex justify-between text-xs text-slate-400 mb-1.5 font-semibold">
                <span>Study Hours Target</span>
                <span className="text-white">{todayHours.toFixed(1)}h / {targetHours.toFixed(1)}h</span>
              </div>
              <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-teal-400 to-teal-500 h-full transition-all duration-300 rounded-full"
                  style={{ width: `${Math.min((todayHours / targetHours) * 100, 100)}%` }}
                ></div>
              </div>
              <p className="text-[10px] text-slate-500 mt-2 italic">
                Tip: Keep the Pomodoro timer active while study reading to automatically log hours!
              </p>
            </div>
          </div>

          {/* Cognitive Load / Burnout Meter */}
          <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-4">
            <h4 className="text-sm font-bold text-white flex items-center gap-1.5 pb-2 border-b border-slate-850">
              <Clock className="w-4 h-4 text-purple-400" />
              Cognitive Safety Meter
            </h4>

            {(() => {
              // Calculate cognitive load points: hours + 0.75 * pending tasks
              const pendingCount = tasks.filter(t => !t.completed).length;
              const loadPoints = parseFloat((todayHours + (pendingCount * 0.75)).toFixed(1));
              
              let rating = "Optimal";
              let color = "text-emerald-400";
              let progressColor = "bg-emerald-500";
              let alertDesc = "Your cognitive load is safe. You have a good distribution of tasks and breaks.";
              
              if (loadPoints > 12) {
                rating = "CRITICAL BURNOUT RISK 🚨";
                color = "text-red-400 animate-pulse font-black";
                progressColor = "bg-red-500";
                alertDesc = "Your schedule is too intense! Studying at this intensity triggers severe fatigue. We highly recommend scaling back tasks or taking a break.";
              } else if (loadPoints > 8) {
                rating = "High Workload";
                color = "text-orange-400";
                progressColor = "bg-orange-500";
                alertDesc = "Workload is piling up. Ensure you schedule 10-15 minute hydration and stretch breaks between study blocks.";
              } else if (loadPoints > 5) {
                rating = "Moderate / Productive";
                color = "text-teal-400";
                progressColor = "bg-teal-500";
                alertDesc = "Steady learning load. Perfect pacing for spacing recall cycles.";
              }

              return (
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 font-semibold">Load Index Rating:</span>
                    <span className={`font-bold ${color}`}>{rating}</span>
                  </div>

                  <div className="w-full bg-slate-900 h-3 rounded-full overflow-hidden border border-slate-850">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
                      style={{ width: `${Math.min((loadPoints / 16) * 100, 100)}%` }}
                    ></div>
                  </div>

                  <div className="flex justify-between items-center text-[10px] text-slate-500 font-semibold font-mono">
                    <span>Index: {loadPoints} pts</span>
                    <span>Max Limit: 16 pts</span>
                  </div>

                  <p className="text-[10px] text-slate-400 leading-relaxed bg-[#0b0f19] p-3 rounded-xl border border-slate-850">
                    {alertDesc}
                  </p>
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudyTracker;
