const BASE_URL = import.meta.env.VITE_API_URL || '/api'

// helper to get token from localStorage
const getToken = () => localStorage.getItem('token')

// helper to make requests
const request = async (endpoint, method = 'GET', body = null) => {
  const headers = {
    'Content-Type': 'application/json',
  }

  // add token if exists
  const token = getToken()
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const config = { method, headers }
  if (body) config.body = JSON.stringify(body)

  const response = await fetch(`${BASE_URL}${endpoint}`, config)
  const data = await response.json()

  // if token expired → logout
  if (response.status === 401) {
    localStorage.clear()
    window.location.href = '/login'
  }

  return { data, ok: response.ok, status: response.status }
}

// ─── AUTH ───────────────────────────────
export const authAPI = {
  register: (body) => request('/auth/register', 'POST', body),
  verifyEmail: (body) => request('/auth/verify-email', 'POST', body),
  login: (body) => request('/auth/login', 'POST', body),
  forgotPassword: (body) => request('/auth/forgot-password', 'POST', body),
  resetPassword: (body) => request('/auth/reset-password', 'POST', body),
  googleLogin: () => window.location.href = '/api/auth/google'
}

// ─── SUBJECTS ───────────────────────────
export const subjectsAPI = {
  getAll: () => request('/subjects'),
  add: (body) => request('/subjects', 'POST', body),
  update: (id, body) => request(`/subjects/${id}`, 'PUT', body),
  delete: (id) => request(`/subjects/${id}`, 'DELETE')
}

// ─── PLANNER ────────────────────────────
export const plannerAPI = {
  addChapters: (subjectId, body) => request(`/planner/chapters/${subjectId}`, 'POST', body),
  getChapters: (subjectId) => request(`/planner/chapters/${subjectId}`),
  generate: (body) => request('/planner/generate', 'POST', body),
  getSchedule: () => request('/planner/schedule'),
  getToday: () => request('/planner/today'),
  markComplete: (body) => request('/planner/complete', 'PATCH', body),
  rebalance: () => request('/planner/rebalance', 'POST'),
  exportICS: async () => {
    const token = getToken()
    const response = await fetch(`${BASE_URL}/planner/export-ics`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (!response.ok) return { ok: false }
    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'study_schedule.ics'
    a.click()
    window.URL.revokeObjectURL(url)
    return { ok: true }
  }
}

// ─── DASHBOARD ──────────────────────────
export const dashboardAPI = {
  get: () => request('/dashboard'),
  getProgress: () => request('/progress')
}

// ─── AI ─────────────────────────────────
export const aiAPI = {
  chat: (body) => request('/ai/chat', 'POST', body),
  generateSchedule: (body) => request('/ai/generate-schedule', 'POST', body),
  generateFlashcards: (body) => request('/ai/generate-flashcards', 'POST', body),
  generateQuiz: (body) => request('/ai/generate-quiz', 'POST', body),
  uploadPDF: async (formData) => {
    const token = getToken()
    const response = await fetch(`${BASE_URL}/ai/upload-pdf`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    })
    const data = await response.json()
    return { data, ok: response.ok }
  }
}

// ─── ANALYTICS ──────────────────────────
export const analyticsAPI = {
  log: () => request('/analytics/log', 'POST'),
  weekly: () => request('/analytics/weekly'),
  summary: () => request('/analytics/summary')
}