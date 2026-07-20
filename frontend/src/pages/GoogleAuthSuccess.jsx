import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Logo from '../components/Logo';

const GoogleAuthSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [message, setMessage] = useState('Finalizing Google sign-in...');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setMessage('Unable to complete Google sign-in. Redirecting to login...');
      const timer = setTimeout(() => navigate('/login'), 1500);
      return () => clearTimeout(timer);
    }

    localStorage.setItem('token', token);
    setMessage('Google sign-in successful! Redirecting to your dashboard...');
    const timer = setTimeout(() => navigate('/dashboard'), 1000);
    return () => clearTimeout(timer);
  }, [navigate, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#090d16] text-slate-100 px-6">
      <div className="max-w-md w-full rounded-3xl border border-slate-800/70 bg-slate-950/80 p-10 text-center shadow-2xl flex flex-col items-center">
        <Logo size="lg" className="mb-6" />
        <h1 className="text-2xl font-extrabold mb-4">Google Sign-In</h1>
        <p className="text-slate-400 leading-relaxed">{message}</p>
      </div>
    </div>
  );
};

export default GoogleAuthSuccess;
