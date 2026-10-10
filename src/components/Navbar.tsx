import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Search,
  Plus,
  Mic,
  LogIn,
  LogOut,
  User,
  Sparkles,
  X,
  Menu,
  Brain,
} from 'lucide-react';

interface NavbarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onNewNote: () => void;
  onVoiceQuickNote: () => void;
  onOpenAuth: () => void;
  onToggleSidebar?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  searchQuery,
  onSearchChange,
  onNewNote,
  onVoiceQuickNote,
  onOpenAuth,
  onToggleSidebar,
}) => {
  const { currentUser, userProfile, logout } = useAuth();
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 w-full bg-white/95 backdrop-blur-md border-b border-neutral-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3 sm:gap-6">
        {/* Left: Mobile Menu Toggle & Brand Logo */}
        <div className="flex items-center gap-3">
          {onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              className="md:hidden p-1.5 text-neutral-600 hover:text-neutral-900 rounded hover:bg-neutral-100 cursor-pointer"
              aria-label="Toggle navigation"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-neutral-950 text-white flex items-center justify-center shadow-xs">
              <Brain className="w-4 h-4 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="font-serif font-black text-base sm:text-lg tracking-tight text-neutral-950 flex items-center gap-1.5 leading-none">
                COGNINOTE <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-100 border border-neutral-300 text-neutral-900">AI</span>
              </span>
              <span className="text-[10px] font-mono text-neutral-500 hidden sm:inline leading-tight mt-0.5">
                Created by <strong className="font-semibold text-neutral-800">AYYAPPADAS TV</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Center: Search Bar */}
        <div className="flex-1 max-w-md mx-2">
          <div className="relative">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search title, content, or #tags..."
              className="w-full pl-9 pr-8 py-1.5 text-xs sm:text-sm bg-neutral-50 hover:bg-neutral-100/80 focus:bg-white border border-neutral-300 rounded focus:border-neutral-900 focus:outline-none transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 top-2.5 text-neutral-400 hover:text-neutral-700 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Right: Actions & Profile */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Voice Quick-Capture button */}
          <button
            onClick={onVoiceQuickNote}
            className="p-2 sm:px-3 sm:py-1.5 border border-neutral-300 hover:border-neutral-900 text-neutral-800 rounded text-xs font-medium flex items-center gap-1.5 transition-colors bg-white shadow-2xs cursor-pointer"
            title="Create note using voice"
          >
            <Mic className="w-3.5 h-3.5 text-neutral-700" />
            <span className="hidden sm:inline">Voice Note</span>
          </button>

          {/* + New Note button */}
          <button
            onClick={onNewNote}
            className="px-3 sm:px-3.5 py-1.5 bg-neutral-950 hover:bg-neutral-800 text-white rounded text-xs font-medium flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Note</span>
          </button>

          {/* Profile Menu */}
          {currentUser ? (
            <div className="relative">
              <button
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="w-8 h-8 rounded-full border border-neutral-300 bg-neutral-100 flex items-center justify-center text-xs font-medium text-neutral-700 hover:border-neutral-900 transition-colors overflow-hidden cursor-pointer"
                title={userProfile?.displayName || currentUser.email || 'User Profile'}
              >
                {userProfile?.photoURL ? (
                  <img
                    src={userProfile.photoURL}
                    alt={userProfile.displayName || 'Avatar'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>
                    {(userProfile?.displayName || currentUser.email || 'U')
                      .charAt(0)
                      .toUpperCase()}
                  </span>
                )}
              </button>

              {profileDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setProfileDropdownOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-neutral-200 rounded shadow-xl py-2 z-50 text-xs animate-in fade-in duration-100">
                    <div className="px-3.5 py-2 border-b border-neutral-100">
                      <p className="font-semibold text-neutral-900 truncate">
                        {userProfile?.displayName || 'CogniNote User'}
                      </p>
                      <p className="text-[11px] font-mono text-neutral-400 truncate">
                        {currentUser.email || (currentUser.isAnonymous ? 'Guest Mode' : '')}
                      </p>
                    </div>

                    {currentUser.isAnonymous && (
                      <div className="px-3.5 py-2 bg-amber-50/70 border-b border-amber-100 text-[11px] text-amber-800">
                        Guest session. Upgrade to a registered account to keep notes synced.
                      </div>
                    )}

                    {currentUser.isAnonymous && (
                      <button
                        onClick={() => {
                          setProfileDropdownOpen(false);
                          onOpenAuth();
                        }}
                        className="w-full text-left px-3.5 py-2 hover:bg-neutral-50 flex items-center gap-2 text-neutral-700 font-medium cursor-pointer"
                      >
                        <User className="w-3.5 h-3.5" />
                        Upgrade to Full Account
                      </button>
                    )}

                    <button
                      onClick={async () => {
                        setProfileDropdownOpen(false);
                        await logout();
                      }}
                      className="w-full text-left px-3.5 py-2 hover:bg-neutral-50 text-red-600 flex items-center gap-2 font-medium cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Sign Out
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="px-3 py-1.5 border border-neutral-300 hover:border-neutral-900 rounded text-xs font-medium text-neutral-800 flex items-center gap-1.5 transition-colors bg-white cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Log In</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
