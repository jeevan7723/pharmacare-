import React, { useState, useEffect, useRef } from 'react';
import {
  Key,
  ShieldAlert,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  ArrowRight,
  X,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

export const SUPER_ADMIN_PASSWORD = 'jeevan@1234';
const AUTH_STORAGE_KEY = 'superadmin_authenticated';

export function isSuperAdminSessionValid(): boolean {
  try {
    return sessionStorage.getItem(AUTH_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setSuperAdminSession(valid: boolean): void {
  try {
    if (valid) {
      sessionStorage.setItem(AUTH_STORAGE_KEY, 'true');
    } else {
      sessionStorage.removeItem(AUTH_STORAGE_KEY);
    }
  } catch (e) {
    console.error('Session storage error:', e);
  }
}

interface SuperAdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const SuperAdminLoginModal: React.FC<SuperAdminLoginModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setError(null);
      setShowPassword(false);
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsVerifying(true);

    if (password === SUPER_ADMIN_PASSWORD) {
      setSuperAdminSession(true);
      setTimeout(() => {
        setIsVerifying(false);
        onSuccess();
        onClose();
      }, 200);
    } else {
      setIsVerifying(false);
      setError('Access Denied: Incorrect Super Admin password. Please try again.');
      setTimeout(() => inputRef.current?.select(), 50);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-amber-500/30 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden text-white animate-in zoom-in-95 duration-150">
        {/* Header with Amber Accent */}
        <div className="bg-gradient-to-r from-amber-950 via-slate-900 to-slate-950 px-6 py-5 border-b border-amber-500/20 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  PLATFORM OWNER
                </span>
              </div>
              <h3 className="text-base font-bold text-white mt-0.5">Super Admin Authentication</h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-xs text-slate-300 leading-relaxed">
            Restricted master portal. Please enter your platform master password to manage client companies, licenses, and module provisioning.
          </p>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-amber-300">
              Master Admin Password *
            </label>
            <div className="relative">
              <input
                ref={inputRef}
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Enter password"
                className={`w-full text-sm bg-slate-950 text-white px-4 py-2.5 pr-10 border rounded-xl font-mono focus:outline-none transition-colors ${
                  error
                    ? 'border-red-500 focus:border-red-400 focus:ring-1 focus:ring-red-500'
                    : 'border-slate-700 focus:border-amber-400 focus:ring-1 focus:ring-amber-400'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors cursor-pointer p-1"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-950/60 border border-red-500/50 rounded-xl text-red-200 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="pt-2 flex items-center justify-end space-x-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isVerifying || !password}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 active:scale-[0.98] text-slate-950 text-xs font-black shadow-lg shadow-amber-500/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>{isVerifying ? 'Authenticating...' : 'Unlock Super Admin'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface SuperAdminLockScreenProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export const SuperAdminLockScreen: React.FC<SuperAdminLockScreenProps> = ({
  onSuccess,
  onCancel,
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsVerifying(true);

    if (password === SUPER_ADMIN_PASSWORD) {
      setSuperAdminSession(true);
      setTimeout(() => {
        setIsVerifying(false);
        onSuccess();
      }, 200);
    } else {
      setIsVerifying(false);
      setError('Access Denied: Incorrect Super Admin password. Please try again.');
      setTimeout(() => inputRef.current?.select(), 50);
    }
  };

  return (
    <div className="min-h-full flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-amber-500/30 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden text-white p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/40 mx-auto flex items-center justify-center text-amber-400 shadow-lg shadow-amber-500/10">
            <Lock className="w-8 h-8" />
          </div>
          <div className="inline-block px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-mono font-bold uppercase tracking-widest mt-2">
            RESTRICTED ACCESS
          </div>
          <h2 className="text-xl font-black text-white tracking-tight">Super Admin Master Portal</h2>
          <p className="text-xs text-slate-300 max-w-xs mx-auto leading-relaxed">
            Please enter your master password to access platform licensing, multi-tenant company accounts, and module management.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-amber-300 text-left">
              Master Admin Password *
            </label>
            <div className="relative">
              <input
                ref={inputRef}
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Enter password"
                className={`w-full text-sm bg-slate-950 text-white px-4 py-3 pr-10 border rounded-xl font-mono focus:outline-none transition-colors ${
                  error
                    ? 'border-red-500 focus:border-red-400 focus:ring-1 focus:ring-red-500'
                    : 'border-slate-700 focus:border-amber-400 focus:ring-1 focus:ring-amber-400'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors cursor-pointer p-1"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-950/60 border border-red-500/50 rounded-xl text-red-200 text-xs flex items-center gap-2 text-left">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-2 pt-2">
            <button
              type="submit"
              disabled={isVerifying || !password}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 active:scale-[0.98] text-slate-950 text-xs font-black shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Unlock className="w-4 h-4" />
              <span>{isVerifying ? 'Authenticating...' : 'Unlock Super Admin Portal'}</span>
            </button>

            <button
              type="button"
              onClick={onCancel}
              className="w-full py-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-400 hover:text-white text-xs font-bold transition-colors cursor-pointer"
            >
              Return to Store Workspace
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
