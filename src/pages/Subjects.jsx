import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  GraduationCap,
  PlusCircle,
  Trash2,
  Calendar,
  AlertCircle,
  FolderPlus
} from 'lucide-react';

const Subjects = () => {
  const { subjects, setSubjects, setNotifications } = useOutletContext();

  const [newSubjectName, setNewSubjectName] = useState("");
  const [newSubjectDate, setNewSubjectDate] = useState("");
  const [newSubjectDifficulty, setNewSubjectDifficulty] = useState("Medium");
  const [showAddForm, setShowAddForm] = useState(false);

  // Difficulty badge styling
  const difficultyStyles = {
    Easy: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
    Medium: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
    Hard: "bg-red-500/10 text-red-400 border border-red-500/20",
  };

  // Date Formatter: Formats "2026-07-20" -> "20 July"
  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const day = date.getDate();
    const month = date.toLocaleString('en-US', { month: 'long' });
    return `${day} ${month}`;
  };

  // Add new subject
  const handleAddSubject = (e) => {
    e.preventDefault();
    if (!newSubjectName.trim() || !newSubjectDate) return;

    // Check duplicate
    const exists = subjects.some(s => s.name.toLowerCase() === newSubjectName.trim().toLowerCase());
    if (exists) {
      alert(`Subject "${newSubjectName}" is already in your planner!`);
      return;
    }

    const newSubject = {
      id: Date.now(),
      name: newSubjectName.trim(),
      examDate: newSubjectDate,
      difficulty: newSubjectDifficulty
    };

    setSubjects(prev => [...prev, newSubject]);
    setNotifications(prev => [
      { id: Date.now(), text: `Added new subject: ${newSubject.name} (Exam: ${formatDate(newSubject.examDate)}, Difficulty: ${newSubject.difficulty})`, read: false },
      ...prev
    ]);

    // Reset fields
    setNewSubjectName("");
    setNewSubjectDate("");
    setNewSubjectDifficulty("Medium");
    setShowAddForm(false);
  };

  // Delete subject
  const handleDeleteSubject = (id, name) => {
    setSubjects(prev => prev.filter(s => s.id !== id));
    setNotifications(prev => [
      { id: Date.now(), text: `Removed subject: ${name}`, read: true },
      ...prev
    ]);
  };

  // Analytics
  const totalSubjects = subjects.length;
  const hardSubjects = subjects.filter(s => s.difficulty === "Hard").length;
  
  // Find nearest exam
  const getNextExam = () => {
    if (subjects.length === 0) return null;
    const sorted = [...subjects].sort((a, b) => new Date(a.examDate) - new Date(b.examDate));
    return sorted[0];
  };
  const nextExam = getNextExam();

  return (
    <div className="animate-in fade-in duration-500 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-white flex items-center gap-2">
            <GraduationCap className="w-8 h-8 text-teal-400" />
            Subject Management
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Define your coursework, schedule exams, and adjust target difficulty parameters.
          </p>
        </div>

        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="btn-primary py-2.5 px-5 rounded-xl text-sm flex items-center justify-center gap-2 self-start sm:self-auto cursor-pointer"
        >
          <PlusCircle className="w-4 h-4" />
          {showAddForm ? "Hide Subject Form" : "Add New Subject"}
        </button>
      </div>

      {/* Analytics overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-panel p-5 rounded-2xl border border-white/5 flex items-center gap-4">
          <div className="p-3.5 bg-teal-500/10 text-teal-400 border border-teal-500/20 rounded-xl">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase font-semibold tracking-wider">Coursework Load</p>
            <h4 className="text-2xl font-black text-white mt-1">{totalSubjects} Subjects</h4>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-white/5 flex items-center gap-4">
          <div className="p-3.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase font-semibold tracking-wider">Hard Subjects</p>
            <h4 className="text-2xl font-black text-white mt-1">{hardSubjects} Urgent</h4>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-white/5 flex items-center gap-4">
          <div className="p-3.5 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-xl">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase font-semibold tracking-wider">Next Looming Exam</p>
            <h4 className="text-lg font-extrabold text-white mt-1 truncate max-w-[200px]">
              {nextExam ? `${nextExam.name} (${formatDate(nextExam.examDate)})` : "None scheduled"}
            </h4>
          </div>
        </div>
      </div>

      {/* Add form section */}
      {showAddForm && (
        <div className="glass-panel rounded-2xl p-6 border border-white/10 bg-gradient-to-br from-dark-800 to-teal-950/10 animate-in slide-in-from-top-4 duration-300">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <FolderPlus className="w-5 h-5 text-teal-400" />
            Add New Academic Subject
          </h3>

          <form onSubmit={handleAddSubject} className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Subject Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Physics, Math, Biology"
                value={newSubjectName}
                onChange={(e) => setNewSubjectName(e.target.value)}
                className="input-field text-sm py-2.5"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Exam Date</label>
              <input
                type="date"
                required
                value={newSubjectDate}
                onChange={(e) => setNewSubjectDate(e.target.value)}
                className="w-full bg-dark-900 border border-slate-700 px-4 py-2.5 rounded-lg text-sm font-semibold focus:border-primary-500 outline-none text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Difficulty level</label>
              <div className="flex gap-2">
                <select
                  value={newSubjectDifficulty}
                  onChange={(e) => setNewSubjectDifficulty(e.target.value)}
                  className="flex-1 bg-dark-900 border border-slate-700 px-4 py-2.5 rounded-lg text-sm font-semibold focus:border-primary-500 outline-none text-slate-100"
                >
                  <option value="Easy">Easy</option>
                  <option value="Medium">Medium</option>
                  <option value="Hard">Hard</option>
                </select>

                <button
                  type="submit"
                  className="bg-primary-500 hover:bg-primary-600 text-white font-bold px-6 py-2.5 rounded-lg text-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-[0_0_15px_rgba(20,184,166,0.2)]"
                >
                  Save Subject
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Subjects list */}
      <div className="glass-panel rounded-2xl p-6 border border-white/5">
        <div className="font-bold text-lg text-white mb-6 flex items-center justify-between">
          <span>Active Course List</span>
          <span className="text-xs text-slate-500 font-semibold">{subjects.length} registered</span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-800/80 bg-slate-900/10">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-800/80 bg-slate-850/40 text-slate-400 font-semibold">
                <th className="p-4">Subject</th>
                <th className="p-4">Exam Date</th>
                <th className="p-4">Difficulty</th>
                <th className="p-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map(subject => (
                <tr
                  key={subject.id}
                  className="border-b border-slate-800/40 hover:bg-slate-800/20 transition-all duration-150"
                >
                  <td className="p-4 font-bold text-white flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-primary-500 shadow-[0_0_8px_rgba(20,184,166,0.6)]"></span>
                    {subject.name}
                  </td>
                  <td className="p-4 text-slate-300 font-semibold font-mono">
                    {formatDate(subject.examDate)}
                  </td>
                  <td className="p-4">
                    <span className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-md border ${difficultyStyles[subject.difficulty]}`}>
                      {subject.difficulty}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <button
                      onClick={() => handleDeleteSubject(subject.id, subject.name)}
                      className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                      title={`Delete ${subject.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}

              {subjects.length === 0 && (
                <tr>
                  <td colSpan="4" className="text-center py-12 text-slate-500">
                    <GraduationCap className="w-12 h-12 mx-auto text-slate-700 mb-2" />
                    <p className="font-semibold text-sm">No subjects found</p>
                    <p className="text-xs text-slate-650 mt-1">Add subjects to populate your study planner.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Subjects;
