const BASE_URL = import.meta.env.VITE_API_URL || '/api';

// Helper to get access token from localStorage
const getToken = () => localStorage.getItem('token');
const setToken = (t) => localStorage.setItem('token', t);

// Request caching configuration
const getCache = new Map();
const CACHE_TTL = 15000; // 15 seconds cache TTL for heavy analytics

let isRefreshing = false;
let refreshQueue = [];

const processQueue = (error, token = null) => {
  refreshQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  refreshQueue = [];
};

// Main request helper with automatic Token Refresh, retry interceptor, and request caching
const request = async (endpoint, method = 'GET', body = null, bypassCache = false) => {
  const isGet = method === 'GET';
  const cacheKey = `${endpoint}_${JSON.stringify(body)}`;

  // 1. Request Caching for GET endpoints
  if (isGet && !bypassCache && getCache.has(cacheKey)) {
    const cached = getCache.get(cacheKey);
    if (Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }
    getCache.delete(cacheKey);
  }

  const makeFetch = async (accessToken) => {
    const headers = {
      'Content-Type': 'application/json'
    };
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const config = { method, headers };
    if (body) {
      config.body = JSON.stringify(body);
    }

    // Support cookie credentials for HttpOnly Refresh Cookie
    config.credentials = 'include';

    const response = await fetch(`${BASE_URL}${endpoint}`, config);
    
    // In case API returns empty response on success (e.g., logout or delete)
    let responseData = {};
    const text = await response.text();
    if (text) {
      try {
        responseData = JSON.parse(text);
      } catch (err) {
        responseData = { text };
      }
    }

    return { response, responseData };
  };

  try {
    let currentToken = getToken();
    let { response, responseData } = await makeFetch(currentToken);

    // 2. Token Expired Interceptor (401 Unauthorized)
    if (response.status === 401 && currentToken) {
      if (isRefreshing) {
        // Queue the request until token is refreshed
        return new Promise((resolve, reject) => {
          refreshQueue.push({
            resolve: (newToken) => {
              makeFetch(newToken)
                .then(({ response: res2, responseData: dat2 }) => resolve({ data: dat2, ok: res2.ok, status: res2.status }))
                .catch(reject);
            },
            reject
          });
        });
      }

      isRefreshing = true;

      try {
        // Attempt token rotation / refresh
        const refreshResponse = await fetch(`${BASE_URL}/auth/refresh`, {
          method: 'POST',
          credentials: 'include'
        });

        if (refreshResponse.ok) {
          const refreshData = await refreshResponse.json();
          const newToken = refreshData.token;
          setToken(newToken);
          isRefreshing = false;
          processQueue(null, newToken);

          // Retry the original request
          const retryResult = await makeFetch(newToken);
          return { data: retryResult.responseData, ok: retryResult.response.ok, status: retryResult.response.status };
        } else {
          // Refresh failed (refresh token expired/invalid) -> Log user out
          isRefreshing = false;
          processQueue(new Error('Session Expired'));
          localStorage.clear();
          window.location.href = '/login';
          return { data: { message: 'Session expired' }, ok: false, status: 401 };
        }
      } catch (refreshErr) {
        isRefreshing = false;
        processQueue(refreshErr);
        localStorage.clear();
        window.location.href = '/login';
        throw refreshErr;
      }
    }

    const result = { data: responseData, ok: response.ok, status: response.status };

    // 3. Cache the result if request is GET
    if (isGet && response.ok) {
      getCache.set(cacheKey, {
        timestamp: Date.now(),
        data: result
      });
    }

    return result;

  } catch (error) {
    return { data: { message: error.message || 'Network error occurred' }, ok: false, status: 500 };
  }
};

// ─── AUTH ───────────────────────────────
export const authAPI = {
  register: (body) => request('/auth/register', 'POST', body),
  verifyEmail: (body) => request('/auth/verify-email', 'POST', body),
  login: (body) => request('/auth/login', 'POST', body),
  forgotPassword: (body) => request('/auth/forgot-password', 'POST', body),
  resetPassword: (body) => request('/auth/reset-password', 'POST', body),
  logout: () => request('/auth/logout', 'POST'),
  googleLogin: () => window.location.href = `${BASE_URL}/auth/google`
};

// ─── SUBJECTS ───────────────────────────
export const subjectsAPI = {
  getAll: () => request('/subjects'),
  add: (body) => request('/subjects', 'POST', body),
  update: (id, body) => request(`/subjects/${id}`, 'PUT', body),
  delete: (id) => request(`/subjects/${id}`, 'DELETE')
};

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
    const token = getToken();
    const response = await fetch(`${BASE_URL}/planner/export-ics`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) return { ok: false };
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'study_schedule.ics';
    a.click();
    window.URL.revokeObjectURL(url);
    return { ok: true };
  }
};

// ─── DASHBOARD ──────────────────────────
export const dashboardAPI = {
  get: () => request('/dashboard'),
  getProgress: () => request('/progress')
};

// ─── AI ─────────────────────────────────
export const aiAPI = {
  chat: (body) => request('/ai/chat', 'POST', body),
  generateSchedule: (body) => request('/ai/generate-schedule', 'POST', body),
  generateFlashcards: (body) => request('/ai/generate-flashcards', 'POST', body),
  generateQuiz: (body) => request('/ai/generate-quiz', 'POST', body),
  generateExamMode: (body) => request('/ai/generate-exam-mode', 'POST', body),
  getJobStatus: (jobId) => request(`/ai/job/${jobId}`),
  uploadPDF: async (formData) => {
    const token = getToken();
    const response = await fetch(`${BASE_URL}/ai/upload-pdf`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData,
      credentials: 'include'
    });
    const data = await response.json();
    return { data, ok: response.ok };
  }
};

// ─── ANALYTICS ──────────────────────────
export const analyticsAPI = {
  log: () => request('/analytics/log', 'POST'),
  weekly: () => request('/analytics/weekly'),
  summary: () => request('/analytics/summary'),
  insights: () => request('/analytics/insights')
};

// Invalidates the request cache when state modifying actions occur
export const invalidateCache = () => {
  getCache.clear();
};