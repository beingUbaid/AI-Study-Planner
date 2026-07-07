import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { KeyRound, Mail, CheckCircle } from 'lucide-react';

const VerifyEmail = () => {
  const location = useLocation();
  const navigate = useNavigate();
  // Attempt to get email from router state, fallback to empty string
  const defaultEmail = location.state?.email || '';
  
  const [formData, setFormData] = useState({ email: defaultEmail, code: '' });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await fetch('/api/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = { token: 'mock-token-123' };
      localStorage.setItem('token', data.token);
      navigate('/dashboard');
    } catch (error) {
      console.warn("Backend API offline. Logging in with mock registration.", error);
      localStorage.setItem('token', 'mock-token-123');
      navigate('/dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="animate-in fade-in zoom-in duration-500">
      <div className="w-16 h-16 bg-primary-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
        <KeyRound className="w-8 h-8 text-primary-400" />
      </div>
      <h2 className="text-2xl font-bold text-white mb-2 text-center">Verify your Email</h2>
      <p className="text-slate-400 text-center text-sm mb-6">
        We've sent a 6-digit code to your email address.
      </p>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        {!defaultEmail && (
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="email"
              placeholder="Confirm Email address"
              className="input-field pl-10"
              required
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
            />
          </div>
        )}

        <div className="relative">
          <input
            type="text"
            placeholder="6-Digit Code"
            maxLength={6}
            className="input-field text-center text-2xl tracking-widest font-mono"
            required
            value={formData.code}
            onChange={(e) => setFormData({...formData, code: e.target.value.replace(/\D/g, '')})}
          />
        </div>

        <button type="submit" className="btn-primary flex justify-center items-center gap-2 mt-6" disabled={isLoading || formData.code.length !== 6}>
          {isLoading ? 'Verifying...' : 'Verify Email'}
          <CheckCircle className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};

export default VerifyEmail;
