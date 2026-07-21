import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Calendar,
  AlertCircle,
  Trash2,
  BookOpen,
  PlusCircle,
  TrendingUp,
  Sparkles
} from 'lucide-react';

const Exams = () => {
  const { exams, setExams, subjects, setNotifications } = useOutletContext();

  const [showAddExamModal, setShowAddExamModal] = useState(false);
  const [newExamName, setNewExamName] = useState("");
  const [newExamSubject, setNewExamSubject] = useState("General");
  const [newExamDate, setNewExamDate] = useState("");
  const [newExamReadiness, setNewExamReadiness] = useState(50);
  const [subjectFilter, setSubjectFilter] = useState("All");

  // Subject Colors Map
  const subjectColors = {
    Math: "bg-teal-500/10 text-teal-400 border border-teal-500/30",
    Physics: "bg-purple-500/10 text-purple-400 border border-purple-500/30",
    English: "bg-blue-500/10 text-blue-400 border border-blue-500/30",
    "Computer Science": "bg-amber-500/10 text-amber-400 border border-amber-500/30",
    General: "bg-slate-500/10 text-slate-400 border border-slate-700",
  };

  // Helper: Calculate Days Remaining from current date
  const getDaysRemaining = (examDateStr) => {
    if (!examDateStr) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const examDate = new Date(examDateStr);
    examDate.setHours(0, 0, 0, 0);
    const difference = examDate.getTime() - today.getTime();
    return Math.ceil(difference / (1000 * 3600 * 24));
  };

  // Form submit handler
  const handleAddExam = (e) => {
    e.preventDefault();
    if (!newExamName.trim() || !newExamDate) return;

    const newExam = {
      id: Date.now(),
      name: newExamName,
      subject: newExamSubject,
      date: newExamDate,
      readiness: Number(newExamReadiness)
    };

    setExams(prev => [...prev, newExam]);
    setNotifications(prev => [
      { id: Date.now(), text: `Scheduled new exam: ${newExamName} (${newExamSubject}) on ${newExamDate}`, read: false },
      ...prev
    ]);

    // Reset Form
    setNewExamName("");
    setNewExamDate("");
    setNewExamReadiness(50);
    setShowAddExamModal(false);
  };

  // Delete handler
  const handleDeleteExam = (id, name) => {
    setExams(prev => prev.filter(exam => exam.id !== id));
    setNotifications(prev => [
      { id: Date.now(), text: `Removed exam: ${name}`, read: true },
      ...prev
    ]);
  };

  // Filter exams
  const filteredExams = subjectFilter === "All"
    ? exams
    : exams.filter(e => e.subject === subjectFilter);

  // Compute average readiness
  const avgReadiness = exams.length > 0
    ? Math.round(exams.reduce((sum, e) => sum + e.readiness, 0) / exams.length)
    : 0;

  return (
    <div className="animate-in fade-in duration-500 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-white flex items-center gap-2">
            <BookOpen className="w-8 h-8 text-teal-400" />
            Upcoming Exams
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Track exam schedules, countdown clocks, and AI-predicted exam readiness.
          </p>
        </div>

        <button
          onClick={() => {
            setNewExamSubject(subjects && subjects.length > 0 ? subjects[0].name : "General");
            setShowAddExamModal(true);
          }}
          className="btn-primary py-2.5 px-5 rounded-xl text-sm flex items-center justify-center gap-2 self-start sm:self-auto cursor-pointer"
        >
          <PlusCircle className="w-4 h-4" />
          Add Upcoming Exam
        </button>
      </div>

      {/* Overview stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-panel p-5 rounded-2xl border border-white/5 flex items-center gap-4">
          <div className="p-3.5 bg-teal-500/10 text-teal-400 border border-teal-500/20 rounded-xl">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase font-semibold tracking-wider">Total Scheduled</p>
            <h4 className="text-2xl font-black text-white mt-1">{exams.length} Exams</h4>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-white/5 flex items-center gap-4">
          <div className="p-3.5 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-xl">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase font-semibold tracking-wider">Avg Readiness</p>
            <h4 className="text-2xl font-black text-white mt-1">{avgReadiness}%</h4>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-white/5 flex items-center gap-4">
          <div className="p-3.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase font-semibold tracking-wider">Urgent Focus (≤3 Days)</p>
            <h4 className="text-2xl font-black text-white mt-1">
              {exams.filter(e => getDaysRemaining(e.date) <= 3 && getDaysRemaining(e.date) >= 0).length} Exams
            </h4>
          </div>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="glass-panel rounded-2xl p-6 border border-white/5">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-6 border-b border-slate-800/80">
          <div className="font-bold text-lg text-white">Scheduled Exams</div>
          
          <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1">
            {["All", ...(subjects || []).map(s => s.name)].map(subj => (
              <button
                key={subj}
                onClick={() => setSubjectFilter(subj)}
                className={`px-3.5 py-2 rounded-xl border transition-all duration-200 cursor-pointer whitespace-nowrap ${
                  subjectFilter === subj
                    ? 'text-sm font-extrabold bg-gradient-to-r from-primary-500 to-teal-500 text-white shadow-lg border-teal-400 scale-105'
                    : 'text-xs font-bold text-slate-350 bg-slate-800/80 border-slate-700 hover:text-white hover:bg-slate-750'
                }`}
              >
                {subj}
              </button>
            ))}
          </div>
        </div>

        {/* Exams List Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredExams.map(exam => {
            const daysLeft = getDaysRemaining(exam.date);
            const isUrgent = daysLeft <= 3 && daysLeft >= 0;
            const isOverdue = daysLeft < 0;

            return (
              <div
                key={exam.id}
                className={`p-5 rounded-2xl bg-slate-850/45 border transition-all duration-300 relative group flex flex-col justify-between h-56 ${
                  isUrgent
                    ? 'border-red-500/40 shadow-[0_0_20px_rgba(239,68,68,0.15)] bg-red-950/5'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Subject badge and Delete button */}
                <div className="flex justify-between items-start">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${subjectColors[exam.subject] || subjectColors.General}`}>
                    {exam.subject}
                  </span>
                  
                  <button
                    onClick={() => handleDeleteExam(exam.id, exam.name)}
                    className="p-1 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                    title="Delete Exam"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Exam Info */}
                <div className="mt-3">
                  <h4 className="text-base font-bold text-white leading-snug">{exam.name}</h4>
                  
                  <div className="flex items-center gap-2 text-slate-400 text-xs mt-2.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    <span>{new Date(exam.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                </div>

                {/* Countdown Badge & Readiness Gauge */}
                <div className="mt-4 pt-3.5 border-t border-slate-800/80">
                  {/* Gauge */}
                  <div className="flex justify-between items-center text-[10px] text-slate-400 mb-1">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3 text-primary-400" />
                      AI Readiness
                    </span>
                    <span className="font-bold text-white">{exam.readiness}%</span>
                  </div>
                  
                  <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden mb-3">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        exam.readiness >= 80
                          ? 'bg-emerald-500'
                          : exam.readiness >= 50
                          ? 'bg-amber-500'
                          : 'bg-red-500'
                      }`}
                      style={{ width: `${exam.readiness}%` }}
                    ></div>
                  </div>

                  {/* Countdown Text */}
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider">Countdown</span>
                    <span className={`text-xs font-extrabold px-2.5 py-0.5 rounded-lg border ${
                      isOverdue
                        ? 'bg-slate-900 border-slate-800 text-slate-500'
                        : isUrgent
                        ? 'bg-red-500/10 border-red-500/20 text-red-400 animate-pulse'
                        : 'bg-teal-500/10 border-teal-500/20 text-teal-400'
                    }`}>
                      {isOverdue ? "Exam Completed" : daysLeft === 0 ? "EXAM TODAY!" : `${daysLeft} days remaining`}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          {filteredExams.length === 0 && (
            <div className="col-span-full text-center py-12 border border-dashed border-slate-800 rounded-2xl">
              <Calendar className="w-10 h-10 text-slate-600 mx-auto mb-2" />
              <p className="text-slate-400 font-semibold text-sm">No upcoming exams found</p>
              <p className="text-slate-500 text-xs mt-1">Try scheduling a new exam using the 'Add Upcoming Exam' button.</p>
            </div>
          )}
        </div>
      </div>

      {/* --- ADD EXAM MODAL --- */}
      {showAddExamModal && (
        <div className="fixed inset-0 bg-dark-900/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-300">
          <div className="glass-panel border border-white/10 p-6 rounded-2xl w-full max-w-md relative z-10 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-teal-400" />
              Add Upcoming Exam
            </h3>
            
            <form onSubmit={handleAddExam} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Exam Name / Description</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Calculus Midterm, Chemistry Final"
                  value={newExamName}
                  onChange={(e) => setNewExamName(e.target.value)}
                  className="input-field text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Subject</label>
                  <select
                    value={newExamSubject}
                    onChange={(e) => setNewExamSubject(e.target.value)}
                    className="w-full bg-dark-900 border border-slate-700 px-3 py-2.5 rounded-lg text-sm font-semibold focus:border-primary-500 outline-none text-slate-100"
                  >
                    {(subjects || []).map(s => (
                      <option key={s.id} value={s.name}>{s.name}</option>
                    ))}
                    {(!subjects || subjects.length === 0) && (
                      <option value="General">General</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Date</label>
                  <input
                    type="date"
                    required
                    value={newExamDate}
                    onChange={(e) => setNewExamDate(e.target.value)}
                    className="w-full bg-dark-900 border border-slate-700 px-3 py-2.5 rounded-lg text-sm font-semibold focus:border-primary-500 outline-none text-slate-100"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  <span>Est. AI Readiness Score</span>
                  <span className="text-teal-400 font-bold">{newExamReadiness}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={newExamReadiness}
                  onChange={(e) => setNewExamReadiness(e.target.value)}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-primary-500"
                />
                <p className="text-[10px] text-slate-500 mt-1">Estimate your current confidence level on this topic.</p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddExamModal(false)}
                  className="flex-1 py-2.5 rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-300 font-semibold text-sm transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 btn-primary py-2.5 text-sm cursor-pointer"
                >
                  Save Exam
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Exams;
