import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { User as UserIcon, LogOut, Camera, X, Upload, Mail, Lock, Eye, EyeOff, Sparkles, CheckCircle2, Edit2, Trash2 } from 'lucide-react';
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
    token,
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
  
  const isLoggedIn = getIsLoggedIn();

  // Login states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Profile Edit State
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editUsername, setEditUsername] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [editPhotoFile, setEditPhotoFile] = useState<File | null>(null);
  const [editPhotoPreview, setEditPhotoPreview] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isDeletingProfile, setIsDeletingProfile] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEditCamera, setShowEditCamera] = useState(false);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  const startEditing = () => {
    setEditUsername(user?.username || "");
    setEditPassword("");
    setEditPhotoFile(null);
    setEditPhotoPreview(user?.photoUrl || null);
    setIsEditingProfile(true);
    setShowDeleteConfirm(false);
  };

  const handleEditPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setNotification({ message: 'Image must be less than 5MB', type: 'error' });
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        setEditPhotoPreview(ev.target?.result as string);
        setEditPhotoFile(file);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleEditCameraCapture = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setEditPhotoPreview(e.target?.result as string);
      setEditPhotoFile(file);
      setShowEditCamera(false);
      setNotification({ message: 'Photo captured successfully!', type: 'success' });
    };
    reader.readAsDataURL(file);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    
    setIsSavingProfile(true);
    try {
      const formData = new FormData();
      if (editUsername && editUsername !== user?.username) {
        formData.append('username', editUsername);
      }
      if (editPassword) {
        formData.append('password', editPassword);
      }
      if (editPhotoFile) {
        formData.append('photo', editPhotoFile);
      }

      const baseUrl = import.meta.env.DEV ? '' : 'https://datavisualizer-signalling-server.onrender.com';
      const response = await fetch(`${baseUrl}/api/users/me`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (response.ok) {
        const updatedUser = await response.json();
        useAuthStore.getState().updateUser(updatedUser);
        setNotification({ message: 'Profile updated successfully!', type: 'success' });
        setIsEditingProfile(false);
      } else {
        const err = await response.json();
        setNotification({ message: err.error || 'Failed to update profile', type: 'error' });
      }
    } catch (err) {
      setNotification({ message: 'Network error', type: 'error' });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleDeleteProfile = async () => {
    if (!token) return;
    setIsDeletingProfile(true);
    try {
      const baseUrl = import.meta.env.DEV ? '' : 'https://datavisualizer-signalling-server.onrender.com';
      const response = await fetch(`${baseUrl}/api/users/me`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        setNotification({ message: 'Account deleted successfully', type: 'success' });
        logout();
        closeProfileModal();
      } else {
        const err = await response.json();
        setNotification({ message: err.error || 'Failed to delete account', type: 'error' });
      }
    } catch (err) {
      setNotification({ message: 'Network error', type: 'error' });
    } finally {
      setIsDeletingProfile(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const baseUrl = import.meta.env.DEV ? '' : 'https://datavisualizer-signalling-server.onrender.com';
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Authentication failed');

      useAuthStore.getState().setAuth(data.token, data.user);
      setNotification({ message: 'Logged in successfully!', type: 'success' });
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
                      Sign In
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

              <form onSubmit={handleAuth} className="flex flex-col gap-3.5 sm:gap-3">
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
                    <span>Sign In</span>
                  )}
                </button>
              </form>

              <div className="mt-4 mb-2 flex flex-col gap-2.5">
                  <div className="flex items-center gap-3 my-0.5">
                    <div className="h-px bg-slate-200 dark:bg-slate-700/60 flex-1"></div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">OR</span>
                    <div className="h-px bg-slate-200 dark:bg-slate-700/60 flex-1"></div>
                  </div>
                  
                  <a href={`${import.meta.env.DEV ? '' : 'https://datavisualizer-signalling-server.onrender.com'}/api/auth/google`} className="w-full py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold rounded-xl text-xs transition-colors border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-2 cursor-pointer shadow-sm">
                    <svg className="w-4 h-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                    Continue with Google
                  </a>
                  
                  <a href={`${import.meta.env.DEV ? '' : 'https://datavisualizer-signalling-server.onrender.com'}/api/auth/github`} className="w-full py-2.5 bg-[#24292F] hover:bg-[#1b1f23] text-white font-semibold rounded-xl text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm">
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
                    Continue with GitHub
                  </a>
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

              {/* Profile View / Edit Toggle */}
              {isEditingProfile ? (
                <form onSubmit={handleUpdateProfile} className="mb-4">
                  <div className="flex flex-col items-center mb-4">
                    <div 
                      onClick={() => editFileInputRef.current?.click()}
                      className="relative w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden border-2 border-dashed border-slate-300 dark:border-slate-700 cursor-pointer group mb-2 hover:border-blue-500 transition-colors"
                    >
                      {editPhotoPreview ? (
                        <img src={editPhotoPreview} alt="Preview" className="w-full h-full object-cover group-hover:opacity-50 transition-opacity" />
                      ) : (
                        <Camera className="w-6 h-6 text-slate-400 group-hover:text-blue-500 transition-colors" />
                      )}
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Upload className="w-5 h-5 text-white" />
                      </div>
                    </div>
                    
                    <div className="flex gap-2 mb-3">
                      <button
                        type="button"
                        onClick={() => setShowEditCamera(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 border border-blue-200 dark:border-blue-500/30 rounded-lg transition-colors cursor-pointer"
                      >
                        <Camera size={13} />
                        <span>Camera</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => editFileInputRef.current?.click()}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 border border-slate-300/80 dark:border-slate-700 rounded-lg transition-colors cursor-pointer"
                      >
                        <Upload size={13} />
                        <span>Upload</span>
                      </button>
                    </div>

                    <input 
                      type="file" 
                      ref={editFileInputRef} 
                      className="hidden" 
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      onChange={handleEditPhotoUpload}
                    />
                    
                    <div className="w-full relative">
                      <input
                        type="text"
                        required
                        value={editUsername}
                        onChange={(e) => setEditUsername(e.target.value)}
                        placeholder="Username"
                        className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/50 rounded-xl outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-sm font-semibold text-slate-800 dark:text-slate-100"
                      />
                      <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    </div>

                    <div className="w-full relative mt-2">
                      <input
                        type={showEditPassword ? "text" : "password"}
                        value={editPassword}
                        onChange={(e) => setEditPassword(e.target.value)}
                        placeholder="New Password (optional)"
                        className="w-full pl-9 pr-10 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/50 rounded-xl outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-sm font-semibold text-slate-800 dark:text-slate-100"
                      />
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                      <button
                        type="button"
                        onClick={() => setShowEditPassword(!showEditPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                      >
                        {showEditPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setIsEditingProfile(false)}
                      className="flex-1 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingProfile || (!editPhotoFile && editUsername === user?.username && !editPassword)}
                      className="flex-1 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center justify-center"
                    >
                      {isSavingProfile ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        'Save'
                      )}
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-900/80 rounded-xl border border-slate-100 dark:border-slate-800/80 mb-3 flex items-center gap-3 relative group">
                    <div className="w-12 h-12 rounded-full bg-blue-500/10 text-blue-500 flex flex-shrink-0 items-center justify-center overflow-hidden border border-blue-500/20 font-bold text-base">
                      {user?.photoUrl ? (
                        <img src={user.photoUrl} alt={user?.username || 'Avatar'} className="w-full h-full object-cover" />
                      ) : (
                        <span className="uppercase">{user?.username?.charAt(0) || 'U'}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 pr-8">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{user?.username}</p>
                        <span className="flex h-2 w-2 relative flex-shrink-0">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user?.email}</p>
                    </div>
                    
                    <button
                      onClick={startEditing}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-blue-500 hover:border-blue-500/50 rounded-lg shadow-sm opacity-100 sm:opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                      title="Edit Profile"
                    >
                      <Edit2 size={14} />
                    </button>
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
                </>
              )}
              
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

              {/* Delete Account */}
              {!isEditingProfile && (
                showDeleteConfirm ? (
                  <div className="mt-3 p-3 border border-rose-500/30 bg-rose-500/5 rounded-xl">
                    <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 mb-2 text-center">Are you sure? This cannot be undone.</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowDeleteConfirm(false)}
                        className="flex-1 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleDeleteProfile}
                        disabled={isDeletingProfile}
                        className="flex-1 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center justify-center"
                      >
                        {isDeletingProfile ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Delete'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2 hover:bg-rose-500/10 text-rose-500/70 hover:text-rose-500 dark:text-rose-400/50 dark:hover:text-rose-400 rounded-xl transition-colors text-[11px] font-semibold cursor-pointer border border-transparent hover:border-rose-500/20"
                  >
                    <Trash2 size={13} />
                    <span>Delete Account</span>
                  </button>
                )
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Camera Capture Modal for Profile Edit */}
      {showEditCamera && (
        <CameraCaptureModal
          onClose={() => setShowEditCamera(false)}
          onCapture={handleEditCameraCapture}
        />
      )}
    </>
  );
}
