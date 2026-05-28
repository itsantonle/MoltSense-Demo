'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, Bell } from 'lucide-react';
import { motion } from 'framer-motion';

interface NavbarProps {
  unreadAlerts?: number;
}

export function Navbar({ unreadAlerts = 0 }: NavbarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  const isActive = (href: string) => {
    return pathname === href || pathname?.startsWith(href);
  };

  const navItems = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Alerts', href: '/alerts' },
    { label: 'Undiscovered', href: '/undiscovered' },
    { label: 'Molt History', href: '/molt-history' },
    { label: 'Analytics', href: '/analytics' },
    { label: 'Hubs', href: '/hubs' },
  ];

  return (
    <nav className="sticky top-0 z-50 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-cyan-500/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="flex items-center gap-2"
            >
              <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-teal-500 rounded-lg flex items-center justify-center font-bold text-slate-900">
                M
              </div>
              <span className="hidden sm:block font-bold text-lg bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent">
                MoltSense
              </span>
            </motion.div>
          </Link>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href}>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive(item.href)
                      ? 'text-cyan-400 bg-cyan-400/10'
                      : 'text-slate-300 hover:text-cyan-300'
                  }`}
                >
                  {item.label}
                </motion.div>
              </Link>
            ))}
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-4">
            {/* Alerts Bell */}
            <Link href="/alerts" className="relative">
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className="relative p-2 text-slate-300 hover:text-cyan-400 transition-colors"
              >
                <Bell className="w-5 h-5" />
                {unreadAlerts > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold"
                  >
                    {unreadAlerts > 9 ? '9+' : unreadAlerts}
                  </motion.span>
                )}
              </motion.button>
            </Link>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="md:hidden p-2 rounded-md text-slate-300 hover:text-cyan-400"
            >
              {isOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="md:hidden pb-4 border-t border-cyan-500/20"
          >
            {navItems.map((item) => (
              <Link key={item.href} href={item.href}>
                <button
                  className={`block w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive(item.href)
                      ? 'text-cyan-400 bg-cyan-400/10'
                      : 'text-slate-300 hover:text-cyan-300'
                  }`}
                  onClick={() => setIsOpen(false)}
                >
                  {item.label}
                </button>
              </Link>
            ))}
          </motion.div>
        )}
      </div>
    </nav>
  );
}
