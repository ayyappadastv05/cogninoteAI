import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from './Toast';
import {
  Mic,
  Sparkles,
  Tag,
  Wand2,
  Lock,
  Mail,
  User,
  ArrowRight,
  KeyRound,
  CheckCircle2,
  ShieldCheck,
  Brain,
  Feather,
} from 'lucide-react';

interface LoginPageProps {
  onSuccess?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onSuccess }) => {
  const { loginWithEmail, signUpWithEmail, loginWithGoogle, loginAsGuest, resetPassword } = useAuth();
  const { showToast } = useToast();

  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [newPassword, setNewPassword] = useState('');

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
        showToast('Welcome to CogniNote AI! Account created.', 'success');
        onSuccess?.();
      } else if (mode === 'login') {
        await loginWithEmail(email, password);
        showToast('Welcome back to CogniNote AI!', 'success');
        onSuccess?.();
      } else if (mode === 'forgot') {
        await resetPassword(email, newPassword.trim() || undefined);
        showToast(
          newPassword.trim()
            ? 'Password updated successfully! Welcome back.'
            : 'Password recovery sent to your email!',
          'success'
        );
        if (newPassword.trim()) {
          onSuccess?.();
        } else {
          setMode('login');
        }
      }
    } catch (err: any) {
      let msg = err.message || 'Authentication error';
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        msg = 'Invalid email or password. Please verify and try again.';
      } else if (err.code === 'auth/email-already-in-use') {
        msg = 'An account with this email already exists. Please log in with your password.';
        setMode('login');
      } else if (err.code === 'auth/weak-password') {
        msg = 'Password should be at least 6 characters.';
      } else if (err.code === 'auth/user-not-found') {
        msg = 'No account found with this email. Please click Create Account.';
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
      onSuccess?.();
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user') {
        if (err.code === 'auth/operation-not-allowed' || err.message?.includes('operation-not-allowed')) {
          setErrorMessage('Google Sign-In is not enabled in Firebase Console. You can click "Explore as Guest" below to start immediately!');
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
      showToast('Exploring CogniNote AI as Guest!', 'info');
      onSuccess?.();
    } catch (err: any) {
      setErrorMessage(err.message || 'Guest sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row bg-[#F8F7F4] text-neutral-900 selection:bg-neutral-900 selection:text-white">
      {/* Left Column: Brand Hero & Innovative Value Showcase */}
      <div className="md:w-1/2 p-8 sm:p-12 lg:p-16 flex flex-col justify-between border-b md:border-b-0 md:border-r border-neutral-200 bg-white">
        <div>
          {/* Logo */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded bg-neutral-950 text-white flex items-center justify-center shadow-xs">
              <Brain className="w-5 h-5 text-neutral-100" />
            </div>
            <div>
              <span className="font-serif font-black text-2xl tracking-tight text-neutral-950 flex items-center gap-2">
                COGNINOTE <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-neutral-100 border border-neutral-300 text-neutral-900">AI</span>
              </span>
              <p className="text-[11px] font-mono text-neutral-500 uppercase tracking-widest mt-0.5">
                Created by <span className="font-semibold text-neutral-800">AYYAPPADAS TV</span>
              </p>
            </div>
          </div>

          {/* Value Prop */}
          <div className="max-w-md space-y-4">
            <h1 className="font-serif font-bold text-3xl sm:text-4xl text-neutral-950 leading-tight">
              Capture at the speed of thought. Synthesize with AI.
            </h1>
            <p className="text-sm text-neutral-600 leading-relaxed font-sans">
              CogniNote AI combines distraction-free notebook aesthetics with neural voice capture, automatic Gemini summarization, and smart tagging.
            </p>
          </div>

          {/* Feature Highlights */}
          <div className="mt-10 space-y-4 max-w-md">
            <div className="flex items-start gap-3.5 p-3 rounded-lg border border-neutral-150 bg-[#FAFAFA]">
              <div className="w-8 h-8 rounded bg-white border border-neutral-200 flex items-center justify-center shrink-0 mt-0.5">
                <Mic className="w-4 h-4 text-neutral-800" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-neutral-900 uppercase tracking-wider font-mono">
                  Neural Voice Capture
                </h4>
                <p className="text-xs text-neutral-500 mt-0.5 leading-relaxed">
                  Speak freely. Web Speech + Gemini multimodal transcription converts speech into crisp written notes.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5 p-3 rounded-lg border border-neutral-150 bg-[#FAFAFA]">
              <div className="w-8 h-8 rounded bg-white border border-neutral-200 flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles className="w-4 h-4 text-neutral-800" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-neutral-900 uppercase tracking-wider font-mono">
                  Gemini Summaries & Titles
                </h4>
                <p className="text-xs text-neutral-500 mt-0.5 leading-relaxed">
                  Instantly distill lengthy notes into 3 core takeaways and auto-generate expressive titles.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5 p-3 rounded-lg border border-neutral-150 bg-[#FAFAFA]">
              <div className="w-8 h-8 rounded bg-white border border-neutral-200 flex items-center justify-center shrink-0 mt-0.5">
                <Tag className="w-4 h-4 text-neutral-800" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-neutral-900 uppercase tracking-wider font-mono">
                  Automated Smart Tags
                </h4>
                <p className="text-xs text-neutral-500 mt-0.5 leading-relaxed">
                  AI categorizes your ideas into reusable tag indexes for instant retrieval and search.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="mt-8 pt-6 border-t border-neutral-100 flex items-center justify-between text-[11px] font-mono text-neutral-400">
          <span>Created by <strong className="text-neutral-700 font-semibold">AYYAPPADAS TV</strong></span>
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" /> End-to-End Privacy
          </span>
        </div>
      </div>

      {/* Right Column: Authentication Form */}
      <div className="md:w-1/2 p-6 sm:p-12 lg:p-16 flex items-center justify-center">
        <div className="w-full max-w-md bg-white border border-neutral-300 rounded-lg shadow-sm p-8 sm:p-10">
          {/* Header */}
          <div className="mb-6">
            <h2 className="font-serif font-bold text-2xl sm:text-3xl text-neutral-950">
              {mode === 'signup'
                ? 'Create your notebook'
                : mode === 'forgot'
                ? 'Reset Password'
                : 'Sign In to CogniNote'}
            </h2>
            <p className="text-xs text-neutral-500 mt-1">
              {mode === 'signup'
                ? 'Register to access your notes securely across all devices.'
                : mode === 'forgot'
                ? 'Enter your email to receive recovery instructions.'
                : 'Access your private canvas, voice transcripts, and AI tags.'}
            </p>
          </div>

          {/* Mode Tabs */}
          {mode !== 'forgot' && (
            <div className="flex border-b border-neutral-200 mb-6 text-sm">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setErrorMessage('');
                }}
                className={`flex-1 pb-3 text-center transition-colors relative font-medium ${
                  mode === 'login'
                    ? 'text-neutral-950 font-semibold'
                    : 'text-neutral-400 hover:text-neutral-700'
                }`}
              >
                Log In
                {mode === 'login' && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-neutral-950" />
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setErrorMessage('');
                }}
                className={`flex-1 pb-3 text-center transition-colors relative font-medium ${
                  mode === 'signup'
                    ? 'text-neutral-950 font-semibold'
                    : 'text-neutral-400 hover:text-neutral-700'
                }`}
              >
                Create Account
                {mode === 'signup' && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-neutral-950" />
                )}
              </button>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="mb-4 p-3 text-xs bg-red-50 text-red-700 border border-red-200 rounded">
              {errorMessage}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-neutral-600 mb-1">
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
                    className="w-full pl-9 pr-3 py-2.5 text-sm border border-neutral-300 rounded focus:border-neutral-900 focus:outline-none bg-[#FCFCFA]"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-neutral-600 mb-1">
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
                  className="w-full pl-9 pr-3 py-2.5 text-sm border border-neutral-300 rounded focus:border-neutral-900 focus:outline-none bg-[#FCFCFA]"
                />
              </div>
            </div>

            {mode === 'forgot' && (
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-neutral-600 mb-1">
                  New Password (Optional - reset credentials now)
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-neutral-400 absolute left-3 top-3" />
                  <input
                    type="password"
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="New password (optional)"
                    className="w-full pl-9 pr-3 py-2.5 text-sm border border-neutral-300 rounded focus:border-neutral-900 focus:outline-none bg-[#FCFCFA]"
                  />
                </div>
              </div>
            )}

            {mode !== 'forgot' && (
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-mono uppercase tracking-wider text-neutral-600">
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
                    className="w-full pl-9 pr-3 py-2.5 text-sm border border-neutral-300 rounded focus:border-neutral-900 focus:outline-none bg-[#FCFCFA]"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-neutral-950 hover:bg-neutral-800 text-white text-sm font-medium rounded transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-xs cursor-pointer"
            >
              {loading ? (
                <span>Please wait...</span>
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
                type="button"
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

          {/* Social and Guest login */}
          <div className="mt-6 pt-5 border-t border-neutral-200 space-y-2.5">
            <button
              type="button"
              disabled={loading}
              onClick={handleGoogleSignIn}
              className="w-full py-2.5 px-4 border border-neutral-300 hover:border-neutral-900 bg-white text-neutral-800 text-xs font-medium rounded flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
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
              Continue with Google
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={handleGuestSignIn}
              className="w-full py-2.5 px-4 border border-dashed border-neutral-300 hover:border-neutral-900 bg-neutral-50 hover:bg-neutral-100 text-neutral-800 text-xs font-medium rounded flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-neutral-600" />
              Explore as Guest (Instant Preview)
            </button>

            <div className="pt-3 text-center border-t border-neutral-100">
              <span className="text-[11px] font-mono text-neutral-400">
                Created by <strong className="text-neutral-700 font-semibold">AYYAPPADAS TV</strong>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
