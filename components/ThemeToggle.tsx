'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sun, Moon } from 'lucide-react';

interface ThemeToggleProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export default function ThemeToggle({ 
  className = '', 
  size = 'md',
  showLabel = false 
}: ThemeToggleProps) {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Tamaños de icono
  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };

  // Cargar tema al montar
  useEffect(() => {
    setMounted(true);
    
    // Detectar preferencia del sistema si no hay tema guardado
    const savedTheme = localStorage.getItem('findia-theme');
    
    if (!savedTheme) {
      // Detectar preferencia del sistema
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setIsDarkMode(prefersDark);
      
      if (prefersDark) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('findia-theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('findia-theme', 'light');
      }
    } else {
      const shouldUseDark = savedTheme === 'dark';
      setIsDarkMode(shouldUseDark);
      
      if (shouldUseDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }

    // Escuchar cambios en la preferencia del sistema
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      const savedTheme = localStorage.getItem('findia-theme');
      // Solo aplicar si el usuario no ha establecido una preferencia manual
      if (!savedTheme && e.matches !== isDarkMode) {
        setIsDarkMode(e.matches);
        if (e.matches) {
          document.documentElement.classList.add('dark');
          localStorage.setItem('findia-theme', 'dark');
        } else {
          document.documentElement.classList.remove('dark');
          localStorage.setItem('findia-theme', 'light');
        }
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const toggleTheme = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    
    if (newMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('findia-theme', 'dark');
      
      // Actualizar theme-color para PWA
      const themeColorMeta = document.querySelector('meta[name="theme-color"]');
      if (themeColorMeta) {
        themeColorMeta.setAttribute('content', '#1a1a1a');
      }
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('findia-theme', 'light');
      
      // Actualizar theme-color para PWA
      const themeColorMeta = document.querySelector('meta[name="theme-color"]');
      if (themeColorMeta) {
        themeColorMeta.setAttribute('content', '#3b82f6');
      }
    }
  };

  // Evitar flash de contenido sin estilo
  if (!mounted) {
    return (
      <div className={`p-2 rounded-xl bg-gray-100 dark:bg-gray-800 ${className}`}>
        <div className={`${iconSizes[size]} text-gray-400`} />
      </div>
    );
  }

  return (
    <motion.button
      onClick={toggleTheme}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={`
        relative p-2 rounded-xl 
        bg-gray-100 dark:bg-gray-800
        hover:bg-gray-200 dark:hover:bg-gray-700
        transition-all duration-300
        cursor-pointer
        ${className}
      `}
      title={isDarkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      aria-label={isDarkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
    >
      <motion.div
        initial={false}
        animate={{
          rotate: isDarkMode ? 360 : 0,
          scale: 1,
        }}
        transition={{
          type: "spring",
          stiffness: 300,
          damping: 20,
        }}
        className="relative"
      >
        {isDarkMode ? (
          <Sun className={`${iconSizes[size]} text-gray-600 dark:text-gray-400`} />
        ) : (
          <Moon className={`${iconSizes[size]} text-gray-600 dark:text-gray-400`} />
        )}
      </motion.div>
      
      {showLabel && (
        <span className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          {isDarkMode ? 'Claro' : 'Oscuro'}
        </span>
      )}
    </motion.button>
  );
}
