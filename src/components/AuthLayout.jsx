import React from 'react';
import { Outlet } from 'react-router-dom';

const AuthLayout = () => {
  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated Background Blobs */}
      <div className="absolute top-0 -left-4 w-72 h-72 bg-primary-500 rounded-full mix-blend-multiply filter blur-2xl opacity-20 animate-blob"></div>
      <div className="absolute top-0 -right-4 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-2xl opacity-20 animate-blob animation-delay-2000"></div>
      <div className="absolute -bottom-8 left-20 w-72 h-72 bg-blue-500 rounded-full mix-blend-multiply filter blur-2xl opacity-20 animate-blob animation-delay-4000"></div>

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-purple-500 drop-shadow-sm">
            AI Study Planner
          </h1>
          <p className="mt-2 text-slate-400 text-sm">Supercharge your learning journey</p>
        </div>
        
        {/* Glow wrapper */}
        <div className="relative group">
          <div className="absolute -inset-[3px] bg-gradient-to-r from-primary-500 via-purple-500 to-primary-500 rounded-2xl blur-md opacity-50 group-hover:opacity-90 transition duration-500 animate-pulse"></div>
          <div className="glass-panel relative rounded-2xl p-8 border border-white/10 glowing-border-light">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
