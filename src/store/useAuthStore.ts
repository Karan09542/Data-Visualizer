import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User {
  id: string;
  email: string;
  username: string;
  photoUrl?: string;
  defaultTargetEmail?: string;
  autoConnectEnabled?: boolean;
}

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthModalOpen: boolean;
  authModalTab: 'login' | 'register';
  isProfileModalOpen: boolean;
  setAuth: (token: string, user: User) => void;
  updateUser: (updates: Partial<User>) => void;
  logout: () => void;
  getIsLoggedIn: () => boolean;
  openLoginModal: (tab?: 'login' | 'register') => void;
  closeLoginModal: () => void;
  openProfileModal: () => void;
  closeProfileModal: () => void;
  toggleProfileModal: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      isAuthModalOpen: false,
      authModalTab: 'login',
      isProfileModalOpen: false,
      setAuth: (token, user) => set({ token, user, isAuthModalOpen: false, isProfileModalOpen: false }),
      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),
      logout: () => set({ token: null, user: null, isProfileModalOpen: false }),
      getIsLoggedIn: () => !!get().token && !!get().user,
      openLoginModal: (tab = 'login') => set({ isAuthModalOpen: true, authModalTab: tab, isProfileModalOpen: false }),
      closeLoginModal: () => set({ isAuthModalOpen: false }),
      openProfileModal: () => set({ isProfileModalOpen: true, isAuthModalOpen: false }),
      closeProfileModal: () => set({ isProfileModalOpen: false }),
      toggleProfileModal: () => set((state) => ({ isProfileModalOpen: !state.isProfileModalOpen, isAuthModalOpen: false })),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ token: state.token, user: state.user }), // only persist token & user
    }
  )
);
