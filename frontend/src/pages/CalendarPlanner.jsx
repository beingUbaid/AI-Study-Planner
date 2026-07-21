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
  CalendarDays,
  Download,
  ExternalLink
} from 'lucide-react';
import { plannerAPI, aiAPI } from '../services/api';

const CalendarPlanner = () => {
  const {
    tasks, setTasks,
    subjects,
    exams, setExams,
    setNotifications
  } = useOutletContext();

  const [plannerSubject, setPlannerSubject] = useState("")
  const [studyLevel, setStudyLevel] = useState("BS")
  const [chaptersInput, setChaptersInput] = useState("")
  const [targetExamDate, setTargetExamDate] = useState("")
  const [dailyHours, setDailyHours] = useState(4)
  const [burnoutWarning, setBurnoutWarning] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [formError, setFormError] = useState("")
  const [successMessage, setSuccessMessage] = useState("")

  // PDF Upload State
  const [isDragging, setIsDragging] = useState(false)
  const [uploadLoading, setUploadLoading] = useState(false)
  const [uploadedFileName, setUploadedFileName] = useState("")

  // Calendar State
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0)
  const [studyPlanEvents, setStudyPlanEvents] = useState([])

  // Set default subject when subjects load
  useEffect(() => {
    if (subjects && subjects.length > 0 && !plannerSubject) {
      setPlannerSubject(subjects[0].name)
      // also set exam date from subject
      if (subjects[0].examDate) {
        setTargetExamDate(subjects[0].examDate.split('T')[0])
      }
    }
  }, [subjects])

  // Update exam date when subject changes
  useEffect(() => {
    if (plannerSubject && subjects) {
      const found = subjects.find(s => s.name === plannerSubject)
      if (found?.examDate) {
        setTargetExamDate(found.examDate.split('T')[0])
      }
    }
  }, [plannerSubject])

  // Load saved events
  useEffect(() => {
    const savedEvents = localStorage.getItem('study_calendar_events')
    if (savedEvents) {
      setStudyPlanEvents(JSON.parse(savedEvents))
    }
  }, [])

  // Burnout detector
  useEffect(() => {
    if (dailyHours > 9) {
      setBurnoutWarning("🚨 Burnout Risk: More than 9 hours/day reduces retention dramatically. Scale back!")
    } else if (dailyHours >= 7) {
      setBurnoutWarning("⚠️ High Load: Consider adding break days every 6 days.")
    } else {
      setBurnoutWarning("")
    }
  }, [dailyHours])

  const saveEvents = (newEvents) => {
    setStudyPlanEvents(newEvents)
    localStorage.setItem('study_calendar_events', JSON.stringify(newEvents))
  }

  // ─────────────────────────────────────────
  // REAL PDF UPLOAD → BACKEND
  // ─────────────────────────────────────────
  const handleFileChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.type !== 'application/pdf') {
      setFormError('Only PDF files are allowed')
      return
    }

    setUploadLoading(true)
    setUploadedFileName(file.name)
    setFormError('')

    try {
      // find selected subject id
      const selectedSubject = subjects.find(s => s.name === plannerSubject) || subjects[0]
      if (!selectedSubject) {
        setFormError('Please add a subject first before uploading PDF')
        setUploadLoading(false)
        return
      }

      // build form data for file upload
      const formData = new FormData()
      formData.append('file', file)
      formData.append('subjectId', selectedSubject.id)

      const { data, ok } = await aiAPI.uploadPDF(formData)

      if (!ok) {
        setFormError(data.message || 'PDF upload failed')
        setUploadLoading(false)
        return
      }

      // fill chapters input with extracted chapters
      const chaptersText = data.chapters
        .map(ch => ch.name)
        .join(', ')
      setChaptersInput(chaptersText)

      setNotifications(prev => [{
        id: Date.now(),
        text: `📄 PDF parsed! Extracted ${data.chapters.length} chapters from "${file.name}"`,
        read: false
      }, ...prev])

    } catch (err) {
      setFormError('PDF upload failed. Try again.')
      console.warn(err)
    } finally {
      setUploadLoading(false)
    }
  }

  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true) }
  const handleDragLeave = () => setIsDragging(false)
  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileChange({ target: { files: [file] } })
  }

  // ─────────────────────────────────────────
  // REAL SCHEDULE GENERATOR → BACKEND
  // ─────────────────────────────────────────
  const handleGenerateSchedule = async (e) => {
    e.preventDefault()
    setFormError('')
    setSuccessMessage('')

    if (!subjects?.length) {
      setFormError('Please add at least one subject first from the Subjects page.')
      return
    }

    if (!chaptersInput.trim()) {
      setFormError('Please enter chapters or upload a PDF syllabus.')
      return
    }

    setIsGenerating(true)

    try {
      // Step 1 — find selected subject
      const selectedSubject = subjects.find(s => s.name === plannerSubject) || subjects[0]

      // Step 2 — add chapters to backend
      const chaptersList = chaptersInput
        .split(',')
        .map(name => ({ name: name.trim(), estimatedHours: 1 }))
        .filter(ch => ch.name.length > 0)

      const { ok: chapOk, data: chapData } = await plannerAPI.addChapters(
        selectedSubject.id,
        { chapters: chaptersList }
      )

      if (!chapOk) {
        setFormError(chapData.message || 'Failed to save chapters')
        return
      }

      // Step 3 — generate full plan
      const startDate = new Date().toISOString().split('T')[0]
      const { data, ok } = await plannerAPI.generate({
        dailyStudyHours: dailyHours,
        startDate
      })

      if (!ok) {
        setFormError(data.message || 'Could not generate schedule. Make sure chapters are added.')
        return
      }

      // Step 4 — convert schedule to calendar events
      const schedule = data.studyPlan?.schedule || []
      const newTasks = []
      const newEvents = []

      schedule.forEach((day) => {
        day.tasks.forEach((task, idx) => {
          const taskId = `${day.date}-${idx}`
          const text = `${task.subjectName || 'Study'}: ${task.chapterName || 'Task'}`

          newTasks.push({
            id: taskId,
            text,
            completed: task.isCompleted || false,
            category: task.subjectName || 'General',
            urgency: task.isRevision ? 'High' : 'Medium'
          })

          newEvents.push({
            id: taskId,
            title: text,
            subject: task.subjectName || 'General',
            color: task.subjectColor || '#667eea',
            date: new Date(day.date).toISOString().split('T')[0],
            completed: task.isCompleted || false,
            isRevision: task.isRevision || false,
            hours: task.estimatedHours || 1
          })
        })
      })

      // Step 5 — check burnout warning from backend
      if (data.burnoutWarning?.hasBurnoutRisk) {
        setBurnoutWarning(`🚨 ${data.burnoutWarning.message}`)
      }

      setTasks(prev => {
        // remove old backend tasks, add new ones
        const filtered = prev.filter(t => !t.id.toString().includes('-'))
        return [...filtered, ...newTasks]
      })
      saveEvents(newEvents)

      setSuccessMessage(`✅ Schedule generated! ${schedule.length} study days planned across ${chaptersList.length} chapters.`)
      setChaptersInput('')

      setNotifications(prev => [{
        id: Date.now(),
        text: `📅 Study schedule generated for ${selectedSubject.name} — ${schedule.length} days planned!`,
        read: false
      }, ...prev])

    } catch (err) {
      console.warn('Error generating schedule:', err)
      setFormError('Something went wrong. Please try again.')
    } finally {
      setIsGenerating(false)
    }
  }

  // Calendar helpers
  const handleToggleEvent = (eventId) => {
    const updated = studyPlanEvents.map(ev =>
      ev.id === eventId ? { ...ev, completed: !ev.completed } : ev
    )
    saveEvents(updated)
    setTasks(prev => prev.map(t =>
      t.id === eventId ? { ...t, completed: !t.completed } : t
    ))
  }

  const handleDeleteEvent = (eventId) => {
    const updated = studyPlanEvents.filter(ev => ev.id !== eventId)
    saveEvents(updated)
    setTasks(prev => prev.filter(t => t.id !== eventId))
  }

  const getDatesForWeek = () => {
    const today = new Date()
    const day = today.getDay()
    const diff = today.getDate() - day + (day === 0 ? -6 : 1)
    const monday = new Date(today)
    monday.setDate(diff + currentWeekOffset * 7)

    const days = []
    for (let i = 0; i < 7; i++) {
      const current = new Date(monday)
      current.setDate(monday.getDate() + i)
      days.push({
        dateStr: current.toISOString().split('T')[0],
        dayName: current.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNum: current.getDate(),
        monthName: current.toLocaleDateString('en-US', { month: 'short' })
      })
    }
    return days
  }

  const weekDays = getDatesForWeek()

  const getEventColor = (event) => {
    if (event.completed) return 'bg-slate-900/40 border-slate-800 text-slate-500 opacity-60'
    if (event.isRevision) return 'bg-purple-500/10 text-purple-400 border-purple-500/30'
    const colors = [
      'bg-teal-500/10 text-teal-400 border-teal-500/30',
      'bg-blue-500/10 text-blue-400 border-blue-500/30',
      'bg-amber-500/10 text-amber-400 border-amber-500/30',
      'bg-rose-500/10 text-rose-400 border-rose-500/30',
    ]
    const index = event.subject?.charCodeAt(0) % colors.length || 0
    return colors[index]
  }

  return (
    <div className="animate-in fade-in duration-500 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-white flex items-center gap-2">
            <CalendarRange className="w-8 h-8 text-teal-400" />
            AI Calendar & Study Planner
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Upload syllabus PDF, generate optimized schedule, and track weekly study plan.
          </p>
        </div>
      </div>

      {burnoutWarning && (
        <div className="p-4 rounded-xl border border-red-500/20 bg-red-950/15 flex items-start gap-3 text-red-400 text-sm shadow-lg">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-extrabold">Burnout Warning:</span>
            <p className="text-xs text-red-300 mt-1">{burnoutWarning}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* LEFT COLUMN */}
        <div className="lg:col-span-5 space-y-8">

          {/* PDF Upload */}
          <div className="glass-panel p-6 rounded-2xl border border-white/5 bg-gradient-to-tr from-dark-900 via-primary-950/5 to-purple-950/5">
            <h3 className="text-base font-bold text-white mb-3 flex items-center gap-2">
              <UploadCloud className="w-5 h-5 text-purple-400" />
              Syllabus PDF Auto-Parser
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Upload your syllabus PDF. AI will extract chapters and auto-fill the planner below.
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
                  <p className="text-xs text-primary-400 font-semibold animate-pulse">
                    Extracting chapters from {uploadedFileName}...
                  </p>
                </div>
              ) : (
                <div className="space-y-2 py-2">
                  <UploadCloud className="w-10 h-10 text-slate-500 mx-auto" />
                  <p className="text-xs text-slate-200 font-bold">
                    {uploadedFileName ? `Re-upload: ${uploadedFileName}` : 'Choose PDF or drag it here'}
                  </p>
                  <p className="text-[10px] text-slate-500">PDF up to 10MB</p>
                </div>
              )}
            </div>

            {uploadedFileName && !uploadLoading && (
              <div className="mt-3 flex items-center gap-2 p-2 bg-[#0c1220] rounded-lg border border-slate-800 text-xs">
                <FileText className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span className="text-slate-300 truncate font-semibold">
                  Active: {uploadedFileName}
                </span>
              </div>
            )}
          </div>

          {/* Schedule Form */}
          <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-5">
            <h3 className="text-base font-bold text-white pb-2 border-b border-slate-850 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary-400" />
              AI Schedule Generator
            </h3>

            <form onSubmit={handleGenerateSchedule} className="space-y-4">
              {formError && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                  {formError}
                </div>
              )}

              {successMessage && (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">
                  {successMessage}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Subject Course
                </label>
                <select
                  value={plannerSubject}
                  onChange={(e) => setPlannerSubject(e.target.value)}
                  className="w-full bg-dark-900 border border-slate-700 px-4 py-3 rounded-lg text-sm font-semibold focus:border-primary-500 outline-none text-slate-100"
                >
                  {subjects.map(s => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Academic Level
                </label>
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
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Chapters / Topics
                </label>
                <textarea
                  rows="3"
                  required
                  placeholder="e.g. Chapter 1: Introduction, Chapter 2: Limits, Chapter 3: Differentiation"
                  value={chaptersInput}
                  onChange={(e) => setChaptersInput(e.target.value)}
                  className="input-field text-xs p-3 leading-relaxed"
                />
                <p className="text-[10px] text-slate-500 mt-1">Separate chapters with commas.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Target Exam Date
                  </label>
                  <input
                    type="date"
                    required
                    value={targetExamDate}
                    onChange={(e) => setTargetExamDate(e.target.value)}
                    className="w-full bg-dark-900 border border-slate-700 px-4 py-2.5 rounded-lg text-xs font-semibold focus:border-primary-500 outline-none text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Daily Hours
                  </label>
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
                disabled={isGenerating || !subjects?.length}
                className="w-full btn-primary py-3 rounded-xl font-bold flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_20px_rgba(20,184,166,0.25)] disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Planning Schedule...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-white" />
                    Generate Optimized Schedule
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* RIGHT COLUMN — Calendar */}
        <div className="lg:col-span-7 space-y-6">

          <div className="glass-panel p-4 rounded-2xl border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-teal-400" />
              <h3 className="text-sm font-bold text-white">Weekly Study Calendar</h3>
              <span className="text-xs text-slate-500">
                ({studyPlanEvents.length} events)
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => plannerAPI.exportICS()}
                className="px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-750 text-slate-200 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                title="Export iCal (.ics) file for Google / Apple / Outlook Calendar"
              >
                <Download className="w-3.5 h-3.5 text-teal-400" />
                Export iCal
              </button>

              <button
                onClick={() => {
                  const title = encodeURIComponent(`AI Study Session: ${plannerSubject || 'General'}`);
                  const details = encodeURIComponent(`Study schedule generated by AI Study Planner for ${plannerSubject || 'Coursework'}`);
                  const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}`;
                  window.open(url, '_blank');
                }}
                className="px-3 py-1.5 rounded-xl bg-primary-500 hover:bg-primary-600 text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                title="Open Google Calendar Event Creator"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Sync Google
              </button>

              <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 p-1 rounded-xl text-xs font-semibold">
                <button
                  onClick={() => setCurrentWeekOffset(prev => prev - 1)}
                  className="px-2 py-1 rounded-lg hover:bg-slate-800 hover:text-white transition-colors cursor-pointer text-slate-400"
                >
                  Prev
                </button>
                <span className="text-slate-300 font-mono px-1">
                  {currentWeekOffset === 0 ? 'This Week' : currentWeekOffset > 0 ? `+${currentWeekOffset}w` : `${currentWeekOffset}w`}
                </span>
                <button
                  onClick={() => setCurrentWeekOffset(prev => prev + 1)}
                  className="px-2 py-1 rounded-lg hover:bg-slate-800 hover:text-white transition-colors cursor-pointer text-slate-400"
                >
                  Next
                </button>
              </div>
            </div>
          </div>

          <div className="glass-panel rounded-2xl border border-white/5 overflow-hidden">
            <div className="grid grid-cols-7 border-b border-slate-850 bg-slate-900/50">
              {weekDays.map(day => (
                <div key={day.dateStr} className="p-3 text-center border-r border-slate-850/60 last:border-r-0">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">{day.dayName}</span>
                  <span className="text-sm font-extrabold text-slate-200 mt-1 block">
                    {day.monthName} {day.dayNum}
                  </span>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 min-h-[420px] bg-dark-900/10">
              {weekDays.map(day => {
                const dayEvents = studyPlanEvents.filter(ev => ev.date === day.dateStr)
                const isToday = day.dateStr === new Date().toISOString().split('T')[0]

                return (
                  <div
                    key={day.dateStr}
                    className={`p-2 border-r border-b border-slate-850/60 last:border-r-0 flex flex-col gap-2 min-h-[140px] transition-colors ${
                      isToday ? 'bg-primary-500/5' : 'hover:bg-slate-800/10'
                    }`}
                  >
                    {isToday && (
                      <span className="text-[8px] font-bold text-primary-400 uppercase tracking-wider">Today</span>
                    )}

                    {dayEvents.map(event => (
                      <div
                        key={event.id}
                        className={`p-2 rounded-xl border flex flex-col justify-between text-[10px] leading-snug transition-all group relative ${getEventColor(event)}`}
                      >
                        <div>
                          <div className="flex justify-between items-start gap-1">
                            <span className="font-extrabold text-[9px] uppercase tracking-wider block">
                              {event.subject}
                              {event.isRevision && ' 📝'}
                            </span>
                            <button
                              onClick={() => handleDeleteEvent(event.id)}
                              className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-opacity cursor-pointer p-0.5 rounded"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                          <p className={`font-semibold mt-1 ${event.completed ? 'line-through' : 'text-slate-100'}`}>
                            {event.title.replace(`${event.subject}: `, '')}
                          </p>
                          <p className="text-[8px] text-slate-500 mt-0.5">{event.hours}h</p>
                        </div>

                        <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-800/30">
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
                        </div>
                      </div>
                    ))}

                    {dayEvents.length === 0 && (
                      <div className="flex-1 flex items-center justify-center text-slate-700 text-[10px] italic">
                        Free
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="glass-panel p-5 rounded-2xl border border-white/5 flex gap-4 items-start bg-gradient-to-tr from-dark-900 to-purple-950/10">
            <Info className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <h4 className="font-bold text-white">How it works</h4>
              <p className="text-slate-400 leading-relaxed">
                Add subjects from the Subjects page first. Then enter chapters here or upload a PDF syllabus. Click Generate and your schedule will appear on the calendar automatically with revision days included.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CalendarPlanner