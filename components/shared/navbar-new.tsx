'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, LogOut, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Bell,
  Layers,
  Radar,
  History,
  LineChart,
} from 'lucide-react';
import { User, storageUtils } from '@/lib/localStorage';

export function NavbarNew() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const pathname = usePathname();

  const isActive = (href: string) => {
    return pathname === href || pathname?.startsWith(href);
  };

  useEffect(() => {
    const user = storageUtils.getCurrentUser();
    setCurrentUser(user);
  }, []);

  const mockUsers = [
    {
      id: 'user-1',
      name: 'John Smith',
      email: 'john@moltsense.farm',
      farm: 'Coastal Crabs Farm',
      avatar: '👨‍🌾',
    },
    {
      id: 'user-2',
      name: 'Sarah Johnson',
      email: 'sarah@moltsense.farm',
      farm: 'Blue Horizon Aquaculture',
      avatar: '👩‍🌾',
    },
    {
      id: 'user-3',
      name: 'Mike Chen',
      email: 'mike@moltsense.farm',
      farm: 'Pacific Seafood Co.',
      avatar: '👨‍💼',
    },
  ];

  const switchUser = (user: User) => {
    storageUtils.setCurrentUser(user);
    setCurrentUser(user);
    setShowUserMenu(false);
  };

  const navItems = [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Alerts', href: '/alerts', icon: Bell },
    { label: 'My Sets', href: '/my-racks', icon: Layers },
    { label: 'Discover', href: '/my-cells', icon: Radar },
    { label: 'Molt History', href: '/molt-history', icon: History },
    { label: 'Analytics', href: '/analytics', icon: LineChart },
  ];

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden lg:fixed lg:left-0 lg:top-0 lg:flex lg:w-64 lg:h-screen lg:flex-col lg:bg-gradient-to-b lg:from-slate-900 lg:via-slate-800 lg:to-slate-900 lg:border-r lg:border-cyan-500/20 lg:z-40">
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-6 border-b border-cyan-500/20">
          <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-teal-500 rounded-lg flex items-center justify-center font-bold text-slate-900">
            M
          </div>
          <span className="font-bold text-lg bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent">
            MoltSense
          </span>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <motion.div
                whileHover={{ x: 4 }}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                  isActive(item.href)
                    ? 'text-cyan-400 bg-cyan-400/10 border border-cyan-400/20'
                    : 'text-slate-300 hover:text-cyan-300 hover:bg-slate-700/50'
                }`}
              >
                <item.icon className="w-4 h-4 text-cyan-300" />
                {item.label}
              </motion.div>
            </Link>
          ))}
        </nav>

        {/* User Section */}
        <div className="px-4 py-6 border-t border-cyan-500/20 space-y-4">
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-slate-700/50 hover:bg-slate-600/50 transition-colors"
            >
              <span className="text-2xl">{currentUser?.avatar || '👤'}</span>
              <div className="text-left flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">
                  {currentUser?.name || 'User'}
                </p>
                <p className="text-xs text-slate-400 truncate">
                  {currentUser?.farm || 'Farm'}
                </p>
              </div>
            </button>

            {/* User Dropdown */}
            <AnimatePresence>
              {showUserMenu && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute bottom-full left-0 right-0 mb-2 bg-slate-800 border border-cyan-500/20 rounded-lg overflow-hidden shadow-lg"
                >
                  <div className="max-h-48 overflow-y-auto">
                    {mockUsers.map((user) => (
                      <button
                        key={user.id}
                        onClick={() => switchUser(user)}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-sm text-left transition-colors ${
                          currentUser?.id === user.id
                            ? 'bg-cyan-500/20 text-cyan-300 border-l-2 border-cyan-400'
                            : 'text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        <span className="text-lg">{user.avatar}</span>
                        <div>
                          <p className="font-medium">{user.name}</p>
                          <p className="text-xs text-slate-400">{user.farm}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                  <div className="border-t border-cyan-500/20 p-2 space-y-1">
                    <button className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:text-cyan-300 hover:bg-slate-700/50 rounded transition-colors">
                      <Settings className="w-4 h-4" />
                      Settings
                    </button>
                    <button className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors">
                      <LogOut className="w-4 h-4" />
                      Logout
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Mobile Header */}
      <div className="lg:hidden sticky top-0 z-40 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-cyan-500/20">
        <div className="flex justify-between items-center h-16 px-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-teal-500 rounded-lg flex items-center justify-center font-bold text-slate-900 text-sm">
              M
            </div>
            <span className="font-bold text-sm bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent">
              MoltSense
            </span>
          </Link>

          {/* User Menu Button */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-700/50 hover:bg-slate-600/50 transition-colors"
            >
              <span className="text-lg">{currentUser?.avatar || '👤'}</span>
            </button>

            {/* Mobile User Dropdown */}
            <AnimatePresence>
              {showUserMenu && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute top-full right-0 mt-2 w-56 bg-slate-800 border border-cyan-500/20 rounded-lg overflow-hidden shadow-lg"
                >
                  <div className="max-h-48 overflow-y-auto">
                    {mockUsers.map((user) => (
                      <button
                        key={user.id}
                        onClick={() => switchUser(user)}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-sm text-left transition-colors ${
                          currentUser?.id === user.id
                            ? 'bg-cyan-500/20 text-cyan-300 border-l-2 border-cyan-400'
                            : 'text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        <span className="text-lg">{user.avatar}</span>
                        <div>
                          <p className="font-medium">{user.name}</p>
                          <p className="text-xs text-slate-400">{user.farm}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                  <div className="border-t border-cyan-500/20 p-2 space-y-1">
                    <button className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:text-cyan-300 hover:bg-slate-700/50 rounded transition-colors">
                      <Settings className="w-4 h-4" />
                      Settings
                    </button>
                    <button className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors">
                      <LogOut className="w-4 h-4" />
                      Logout
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Mobile Bottom Tab Navigation */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-gradient-to-t from-slate-900 via-slate-800 to-slate-900 border-t border-cyan-500/20 px-2 py-2">
        <div className="flex items-center h-16 sm:h-20 gap-2 overflow-x-auto justify-center mx-auto max-w-[560px] px-1">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="shrink-0">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsOpen(false)}
                className={`flex flex-col items-center gap-1 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-[10px] sm:text-xs font-medium transition-colors ${
                  isActive(item.href)
                    ? 'text-cyan-400 bg-cyan-400/10'
                    : 'text-slate-400 hover:text-cyan-300'
                }`}
              >
                <item.icon className="w-5 h-5 text-cyan-300 max-[380px]:hidden" />
                <span className="text-[10px] sm:text-xs">
                  {item.label.split(' ')[0]}
                </span>
              </motion.button>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
