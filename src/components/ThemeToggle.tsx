'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

const ThemeToggle: React.FC = () => {
  const { theme, setTheme } = useTheme();

  const themes = [
    { key: 'light' as const, icon: Sun, label: 'Claro' },
    { key: 'dark' as const, icon: Moon, label: 'Oscuro' },
    { key: 'system' as const, icon: Monitor, label: 'Sistema' }
  ];

  return (
    <div className="relative">
      <motion.div 
        className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1 shadow-inner"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
      >
        {themes.map((themeOption) => {
          const Icon = themeOption.icon;
          const isActive = theme === themeOption.key;
          
          return (
            <motion.button
              key={themeOption.key}
              onClick={() => setTheme(themeOption.key)}
              className={`relative flex items-center justify-center p-2 rounded-lg transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              title={themeOption.label}
            >
              {isActive && (
                <motion.div
                  layoutId="theme-indicator"
                  className="absolute inset-0 bg-white dark:bg-gray-700 rounded-lg shadow-sm"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
              <Icon className="h-4 w-4 relative z-10" />
            </motion.button>
          );
        })}
      </motion.div>
    </div>
  );
};

export default ThemeToggle;