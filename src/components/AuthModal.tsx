import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from './Toast';
import { X, Lock, Mail, User, ArrowRight, Sparkles, KeyRound } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'signup';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'login',
}) => {
  const { loginWithEmail, signUpWithEmail, loginWithGoogle, loginAsGuest, resetPassword } = useAuth();
  const { showToast } = useToast();

  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [newPassword, setNewPassword] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setLoading(true);

    try {
      if (mode === 'signup') {
        if (!name.trim()) {
          setErrorMessage('Please enter your full name.');
          setLoading(false);
          return;
        }
        await signUpWithEmail(email, password, name);
        showToast('Account created successfully! Welcome to CogniNote AI.', 'success');
        onClose();
      } else if (mode === 'login') {
        await loginWithEmail(email, password);
        showToast('Signed in successfully!', 'success');
        onClose();
      } else if (mode === 'forgot') {
        await resetPassword(email, newPassword.trim() || undefined);
        showToast(
          newPassword.trim()
            ? 'Password reset successfully!'
            : 'Password recovery sent to your email!',
          'success'
        );
        if (newPassword.trim()) {
          onClose();
        } else {
          setMode('login');
        }
      }
    } catch (err: any) {
      let msg = err.message || 'Authentication error';
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        msg = 'Invalid email or password. Please verify and try again.';
      } else if (err.code === 'auth/email-already-in-use') {
        msg = 'An account with this email already exists. Switch to Log In.';
        setMode('login');
      } else if (err.code === 'auth/weak-password') {
        msg = 'Password should be at least 6 characters.';
      } else if (err.code === 'auth/user-not-found') {
        msg = 'No user found with this email. Please switch to Sign Up.';
      }
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMessage('');
    setLoading(true);
    try {
      await loginWithGoogle();
      showToast('Signed in with Google!', 'success');
      onClose();
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user') {
        if (err.code === 'auth/operation-not-allowed' || err.message?.includes('operation-not-allowed')) {
          setErrorMessage('Google Sign-In is not enabled in Firebase Console. You can click "Try as Guest" below to start immediately!');
        } else {
          setErrorMessage(err.message || 'Google sign-in failed');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGuestSignIn = async () => {
    setErrorMessage('');
    setLoading(true);
    try {
      await loginAsGuest();
      showToast('Welcome to CogniNote AI! Signed in as Guest.', 'info');
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Guest sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-md bg-white border border-neutral-300 shadow-xl rounded-md p-6 sm:p-8 text-neutral-900">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full border border-neutral-200 bg-neutral-50 mb-3">
            <span className="font-serif italic font-bold text-lg">Cg</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-neutral-950 font-serif">
            {mode === 'signup'
              ? 'Create your notebook'
              : mode === 'forgot'
              ? 'Reset your password'
              : 'Welcome back to CogniNote'}
          </h2>
          <p className="text-xs text-neutral-500 mt-1">
            {mode === 'signup'
              ? 'Start capturing ideas with voice, tags, and AI.'
              : mode === 'forgot'
              ? 'Enter your email to receive password reset instructions.'
              : 'Sign in to access your notes, tags, and AI summaries.'}
          </p>
        </div>

        {errorMessage && (
          <div className="mb-4 p-3 text-xs bg-red-50 text-red-700 border border-red-200 rounded">
            {errorMessage}
          </div>
        )}

        {mode !== 'forgot' && (
          <div className="flex border-b border-neutral-200 mb-6 text-sm font-medium">
            <button
              onClick={() => {
                setMode('login');
                setErrorMessage('');
              }}
              className={`flex-1 pb-2.5 text-center transition-colors relative ${
                mode === 'login' ? 'text-neutral-950 font-semibold' : 'text-neutral-400 hover:text-neutral-700'
              }`}
            >
              Log In
              {mode === 'login' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-neutral-950" />
              )}
            </button>
            <button
              onClick={() => {
                setMode('signup');
                setErrorMessage('');
              }}
              className={`flex-1 pb-2.5 text-center transition-colors relative ${
                mode === 'signup' ? 'text-neutral-950 font-semibold' : 'text-neutral-400 hover:text-neutral-700'
              }`}
            >
              Sign Up
              {mode === 'signup' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-neutral-950" />
              )}
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 mb-1">
                Full Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-neutral-400 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ayyappadas"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-neutral-300 rounded focus:outline-none focus:border-neutral-900 bg-[#FCFCFA]"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-neutral-400 absolute left-3 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ayyappadas@example.com"
                className="w-full pl-9 pr-3 py-2 text-sm border border-neutral-300 rounded focus:outline-none focus:border-neutral-900 bg-[#FCFCFA]"
              />
            </div>
          </div>

          {mode === 'forgot' && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 mb-1">
                New Password (Optional - reset credentials now)
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-neutral-400 absolute left-3 top-3" />
                <input
                  type="password"
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New password (optional)"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-neutral-300 rounded focus:outline-none focus:border-neutral-900 bg-[#FCFCFA]"
                />
              </div>
            </div>
          )}

          {mode !== 'forgot' && (
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600">
                  Password
                </label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      setErrorMessage('');
                    }}
                    className="text-xs text-neutral-500 hover:text-neutral-900 underline"
                  >
                    Forgot?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-neutral-400 absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-neutral-300 rounded focus:outline-none focus:border-neutral-900 bg-[#FCFCFA]"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-neutral-900 hover:bg-neutral-800 text-white text-sm font-medium rounded transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <span>Processing...</span>
            ) : mode === 'signup' ? (
              <>
                Create Account <ArrowRight className="w-4 h-4" />
              </>
            ) : mode === 'forgot' ? (
              <>
                Send Reset Link <KeyRound className="w-4 h-4" />
              </>
            ) : (
              <>
                Sign In <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {mode === 'forgot' && (
          <div className="mt-4 text-center">
            <button
              onClick={() => {
                setMode('login');
                setErrorMessage('');
              }}
              className="text-xs text-neutral-600 hover:text-neutral-900 underline"
            >
              Back to Sign In
            </button>
          </div>
        )}

        <div className="mt-6 pt-5 border-t border-neutral-200">
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              disabled={loading}
              onClick={handleGoogleSignIn}
              className="w-full py-2 px-3 border border-neutral-300 hover:border-neutral-900 bg-white text-neutral-800 text-xs font-medium rounded flex items-center justify-center gap-2 transition-colors"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.14z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.17 0 9.99 0 12s.45 3.83 1.25 5.42l4.03-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.93 6.72-4.93z"
                />
              </svg>
              Google
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={handleGuestSignIn}
              className="w-full py-2 px-3 border border-neutral-300 hover:border-neutral-900 bg-neutral-50 text-neutral-800 text-xs font-medium rounded flex items-center justify-center gap-1.5 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-neutral-600" />
              Try as Guest
            </button>

            <div className="pt-2 text-center">
              <span className="text-[10px] font-mono text-neutral-400">
                Created by <strong className="text-neutral-700 font-semibold">AYYAPPADAS TV</strong>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
