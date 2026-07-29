import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import AuthLayout from './components/AuthLayout';
import GoogleAuthSuccess from './pages/GoogleAuthSuccess';

// Lazy loading components for performance and code splitting
const Signup = lazy(() => import('./pages/Signup'));
const Login = lazy(() => import('./pages/Login'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'));

const DashboardLayout = lazy(() => import('./components/DashboardLayout'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Exams = lazy(() => import('./pages/Exams'));
const StudyTracker = lazy(() => import('./pages/StudyTracker'));
const Subjects = lazy(() => import('./pages/Subjects'));
const CalendarPlanner = lazy(() => import('./pages/CalendarPlanner'));
const AIAssistant = lazy(() => import('./pages/AIAssistant'));

// Premium fullscreen loading spinner for route transitions
const PageLoader = () => (
  <div className="flex h-screen w-screen items-center justify-center bg-gray-50 dark:bg-slate-900 transition-colors duration-300">
    <div className="flex flex-col items-center space-y-4">
      <div className="relative h-12 w-12">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75 dark:bg-indigo-500"></span>
        <span className="relative inline-flex h-12 w-12 rounded-full bg-indigo-500/20 border border-indigo-500"></span>
      </div>
      <p className="text-sm font-medium text-gray-500 dark:text-gray-400 animate-pulse">Loading Planner...</p>
    </div>
  </div>
);

// Protected Route Guard
const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

// Public Route Guard (Redirects to dashboard if already logged in)
const PublicRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  if (token) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
};

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* PUBLIC ROUTES — only for non logged in users */}
            <Route element={
              <PublicRoute>
                <AuthLayout />
              </PublicRoute>
            }>
              <Route path="/" element={<Navigate to="/register" replace />} />
              <Route path="/register" element={<Signup />} />
              <Route path="/login" element={<Login />} />
              <Route path="/verify-email" element={<VerifyEmail />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
            </Route>

            {/* GOOGLE AUTH SUCCESS */}
            <Route path="/auth/success" element={<GoogleAuthSuccess />} />

            {/* PROTECTED ROUTES */}
            <Route element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/exams" element={<Exams />} />
              <Route path="/study" element={<StudyTracker />} />
              <Route path="/subjects" element={<Subjects />} />
              <Route path="/planner" element={<CalendarPlanner />} />
              <Route path="/ai-assistant" element={<AIAssistant />} />
            </Route>

            {/* CATCH ALL */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;