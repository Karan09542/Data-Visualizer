import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { User as UserIcon, LogOut, Camera, X, Upload, Mail, Lock, Eye, EyeOff, Sparkles, CheckCircle2 } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useStore } from '../store/useStore';
import { CameraCaptureModal } from './CameraCaptureModal';

interface UserMenuProps {
  variant?: 'icon' | 'row';
  onAction?: () => void;
}

export default function UserMenu({ variant = 'icon', onAction }: UserMenuProps) {
  const { 
    user, 
    getIsLoggedIn, 
    openLoginModal, 
    toggleProfileModal 
  } = useAuthStore();
  
  const isLoggedIn = getIsLoggedIn();
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLoggedIn) {
      toggleProfileModal();
    } else {
      openLoginModal('login');
    }
    onAction?.();
  };

  if (variant === 'row') {
    return (
      <button
        ref={buttonRef}
        type="button"
        onClick={handleClick}
        className="w-full flex items-center justify-between p-3 bg-white dark:bg-slate-900/90 hover:bg-slate-50 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-800 rounded-xl transition-all shadow-sm text-left group cursor-pointer"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20 flex items-center justify-center font-bold text-sm overflow-hidden flex-shrink-0">
            {isLoggedIn && user?.photoUrl ? (
              <img src={user.photoUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : isLoggedIn && user?.username ? (
              <span className="uppercase">{user.username.charAt(0)}</span>
            ) : (
              <UserIcon size={18} className="text-slate-500 dark:text-slate-400" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                {isLoggedIn ? user?.username : "Sign In / Register"}
              </h4>
              {isLoggedIn && (
                <span className="flex h-1.5 w-1.5 relative flex-shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
              {isLoggedIn ? user?.email : "Sign in to sync & direct transfer"}
            </p>
          </div>
        </div>
        <span className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 group-hover:bg-blue-100 dark:group-hover:bg-blue-500/20 transition-colors flex-shrink-0 ml-2">
          {isLoggedIn ? "Manage" : "Sign In"}
        </span>
      </button>
    );
  }

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={handleClick}
      className={`flex items-center justify-center w-8 h-8 rounded-full transition-all border outline-none cursor-pointer ${
        isLoggedIn 
          ? "border-blue-500/40 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 ring-2 ring-blue-500/20" 
          : "border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
      } overflow-hidden`}
      title={isLoggedIn ? `${user?.username} (${user?.email})` : "Sign In / Register"}
    >
      {isLoggedIn && user?.photoUrl ? (
        <img src={user.photoUrl} alt={user?.username || 'Avatar'} className="w-full h-full object-cover" />
      ) : isLoggedIn && user?.username ? (
        <span className="text-xs font-bold uppercase">{user.username.charAt(0)}</span>
      ) : (
        <UserIcon size={15} />
      )}
    </button>
  );
}

/**
 * Global Modals container mounted at the root of the application
 */
export function AuthModals() {
  const { 
    user, 
    logout, 
    getIsLoggedIn, 
    isAuthModalOpen, 
    authModalTab, 
    closeLoginModal, 
    openLoginModal,
    isProfileModalOpen, 
    closeProfileModal 
  } = useAuthStore();
  
  const setNotification = useStore((state) => state.setNotification);
  
  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isLoggedIn = getIsLoggedIn();

  const handleCameraCapture = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setPhotoUrl(e.target?.result as string);
      setShowCamera(false);
      setNotification({ message: 'Photo captured successfully!', type: 'success' });
    };
    reader.readAsDataURL(file);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 3 * 1024 * 1024) {
        setNotification({ message: 'Image must be less than 3MB', type: 'error' });
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        setPhotoUrl(ev.target?.result as string);
        setNotification({ message: 'Photo selected!', type: 'success' });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const isRegister = authModalTab === 'register';
    
    try {
      const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
      const body = isRegister 
        ? { email: email.trim().toLowerCase(), password, username: username.trim(), photoUrl }
        : { email: email.trim().toLowerCase(), password };

      const baseUrl = import.meta.env.DEV ? '' : 'https://datavisualizer-signalling-server.onrender.com';
      const res = await fetch(`${baseUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Authentication failed');

      useAuthStore.getState().setAuth(data.token, data.user);
      setNotification({ 
        message: isRegister ? 'Account created and logged in!' : 'Logged in successfully!', 
        type: 'success' 
      });
      closeLoginModal();
      setPassword('');
    } catch (err: any) {
      setNotification({ message: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* 1. LOGIN & REGISTER MODAL */}
      {isAuthModalOpen && !isLoggedIn && createPortal(
        <div className="fixed inset-0 z-[999999] flex items-center justify-center p-0 sm:p-6 overflow-y-auto">
          {/* Backdrop (visible only on desktop sm+) */}
          <div 
            className="hidden sm:block fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity animate-in fade-in duration-200" 
            onClick={closeLoginModal} 
          />
          
          {/* Modal Card (Full screen on mobile, max-w-sm rounded card on desktop) */}
          <div 
            className="relative z-[1000000] w-full min-h-[100dvh] sm:min-h-0 sm:max-w-sm bg-white dark:bg-[#0f172a] sm:border border-slate-200 dark:border-slate-800/90 sm:shadow-2xl rounded-none sm:rounded-2xl p-6 sm:p-6 transition-all duration-200 animate-in zoom-in-95 my-auto flex flex-col justify-between sm:justify-start"
          >
            <div className="w-full max-w-sm mx-auto my-auto flex flex-col">
              {/* Header with Title and Close Button */}
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 dark:border-slate-800/70">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center border border-blue-500/20">
                    <Sparkles size={16} />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-sm font-bold text-slate-800 dark:text-slate-100 leading-tight">
                      {authModalTab === 'register' ? 'Create Account' : 'Sign In'}
                    </h3>
                    <span className="text-[11px] sm:text-[10px] text-slate-500 dark:text-slate-400">
                      Data Visualizer Network
                    </span>
                  </div>
                </div>
                <button
                  onClick={closeLoginModal}
                  className="p-2 sm:p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Close"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Segmented Control Tabs */}
              <div className="bg-slate-100 dark:bg-slate-900/90 p-1 rounded-xl flex gap-1 border border-slate-200/60 dark:border-slate-800 mb-4">
                <button
                  type="button"
                  onClick={() => openLoginModal('login')}
                  className={`flex-1 py-2 sm:py-1.5 text-xs font-semibold rounded-lg transition-all text-center cursor-pointer ${
                    authModalTab === 'login'
                      ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm border border-slate-200/40 dark:border-slate-700/60"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => openLoginModal('register')}
                  className={`flex-1 py-2 sm:py-1.5 text-xs font-semibold rounded-lg transition-all text-center cursor-pointer ${
                    authModalTab === 'register'
                      ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm border border-slate-200/40 dark:border-slate-700/60"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  Register
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleAuth} className="flex flex-col gap-3.5 sm:gap-3">
                {/* Profile Photo Section for Registration */}
                {authModalTab === 'register' && (
                  <div className="flex flex-col items-center justify-center p-3.5 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200/60 dark:border-slate-800/80 mb-1">
                    <div className="relative group">
                      <div className="w-18 h-18 sm:w-16 sm:h-16 rounded-full bg-slate-200/70 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 flex items-center justify-center overflow-hidden shadow-inner">
                        {photoUrl ? (
                          <img src={photoUrl} alt="Avatar Preview" className="w-full h-full object-cover" />
                        ) : (
                          <UserIcon className="w-8 h-8 sm:w-7 sm:h-7 text-slate-400" />
                        )}
                      </div>
                      {photoUrl && (
                        <button
                          type="button"
                          onClick={() => setPhotoUrl('')}
                          className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 hover:bg-rose-600 text-white rounded-full flex items-center justify-center shadow-md transition-colors cursor-pointer"
                          title="Remove photo"
                        >
                          <X size={11} />
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-2.5">
                      <button
                        type="button"
                        onClick={() => setShowCamera(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 sm:px-2.5 sm:py-1 text-xs sm:text-[11px] font-semibold bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 border border-blue-200 dark:border-blue-500/30 rounded-lg transition-colors cursor-pointer"
                      >
                        <Camera size={13} />
                        <span>Camera</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-1.5 px-3 py-1.5 sm:px-2.5 sm:py-1 text-xs sm:text-[11px] font-semibold bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 border border-slate-300/80 dark:border-slate-700 rounded-lg transition-colors cursor-pointer"
                      >
                        <Upload size={13} />
                        <span>Upload</span>
                      </button>
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileUpload} 
                        accept="image/*" 
                        className="hidden" 
                      />
                    </div>
                  </div>
                )}

                {/* Username field (Register only) */}
                {authModalTab === 'register' && (
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Username
                    </label>
                    <div className="relative flex items-center">
                      <UserIcon size={15} className="absolute left-3.5 text-slate-400 pointer-events-none" />
                      <input
                        type="text"
                        placeholder="e.g. johndoe"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full pl-10 pr-3 py-2.5 sm:py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl text-sm sm:text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-400"
                        required
                      />
                    </div>
                  </div>
                )}

                {/* Email field */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Email Address
                  </label>
                  <div className="relative flex items-center">
                    <Mail size={15} className="absolute left-3.5 text-slate-400 pointer-events-none" />
                    <input
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-3 py-2.5 sm:py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl text-sm sm:text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-400"
                      required
                    />
                  </div>
                </div>

                {/* Password field */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Password
                  </label>
                  <div className="relative flex items-center">
                    <Lock size={15} className="absolute left-3.5 text-slate-400 pointer-events-none" />
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-10 py-2.5 sm:py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl text-sm sm:text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-400"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="mt-3 w-full py-3 sm:py-2.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold rounded-xl text-sm sm:text-xs transition-all shadow-md shadow-blue-600/25 active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <span>{authModalTab === 'register' ? 'Create Account' : 'Sign In'}</span>
                  )}
                </button>
              </form>

              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/60 text-center">
                <p className="text-xs sm:text-[11px] text-slate-500 dark:text-slate-400">
                  {authModalTab === 'register' ? (
                    <>Already registered? <button type="button" onClick={() => openLoginModal('login')} className="text-blue-500 font-semibold hover:underline cursor-pointer">Sign In</button></>
                  ) : (
                    <>Don't have an account? <button type="button" onClick={() => openLoginModal('register')} className="text-blue-500 font-semibold hover:underline cursor-pointer">Create One</button></>
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 2. LOGGED IN USER PROFILE MODAL */}
      {isProfileModalOpen && isLoggedIn && createPortal(
        <div className="fixed inset-0 z-[999999] flex items-center justify-center p-0 sm:p-6 overflow-y-auto">
          {/* Backdrop */}
          <div 
            className="hidden sm:block fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity animate-in fade-in duration-200" 
            onClick={closeProfileModal} 
          />
          
          <div 
            className="relative z-[1000000] w-full min-h-[100dvh] sm:min-h-0 sm:max-w-xs bg-white dark:bg-[#0f172a] sm:border border-slate-200 dark:border-slate-800 sm:shadow-2xl rounded-none sm:rounded-2xl p-6 sm:p-4 transition-all duration-200 animate-in zoom-in-95 my-auto flex flex-col justify-between sm:justify-start"
          >
            <div className="w-full max-w-xs mx-auto my-auto flex flex-col">
              {/* Header with Close Button */}
              <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-100 dark:border-slate-800/70">
                <span className="text-sm sm:text-xs font-bold text-slate-800 dark:text-slate-200">
                  User Profile
                </span>
                <button
                  onClick={closeProfileModal}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Close"
                >
                  <X size={16} />
                </button>
              </div>

              {/* User Profile Card */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-900/80 rounded-xl border border-slate-100 dark:border-slate-800/80 mb-3 flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-blue-500/10 text-blue-500 flex flex-shrink-0 items-center justify-center overflow-hidden border border-blue-500/20 font-bold text-base">
                  {user?.photoUrl ? (
                    <img src={user.photoUrl} alt={user?.username || 'Avatar'} className="w-full h-full object-cover" />
                  ) : (
                    <span className="uppercase">{user?.username?.charAt(0) || 'U'}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{user?.username}</p>
                    <span className="flex h-2 w-2 relative flex-shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user?.email}</p>
                </div>
              </div>

              {/* Signaling Server Status indicator */}
              <div className="px-3 py-2.5 mb-4 flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 size={14} />
                  <span>Signaling Server Active</span>
                </span>
                <span className="text-[10px] uppercase px-2 py-0.5 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded font-bold">
                  Online
                </span>
              </div>
              
              {/* Sign Out Button */}
              <button
                onClick={() => {
                  logout();
                  closeProfileModal();
                  setNotification({ message: 'Logged out successfully', type: 'success' });
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 hover:bg-rose-50 dark:hover:bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-xl transition-colors text-xs font-semibold cursor-pointer border border-rose-500/20"
              >
                <LogOut size={15} />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Camera Capture Modal */}
      {showCamera && (
        <CameraCaptureModal
          onClose={() => setShowCamera(false)}
          onCapture={handleCameraCapture}
        />
      )}
    </>
  );
}
