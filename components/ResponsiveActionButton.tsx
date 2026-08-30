'use client';

import { useState, useEffect } from 'react';
import FloatingActionButton from './FloatingActionButton';
import MobileActionSheet from './MobileActionSheet';

interface ResponsiveActionButtonProps {
  onAction: (type: 'debt' | 'expense' | 'income' | 'goal' | 'shared-expense') => void;
}

export default function ResponsiveActionButton({ onAction }: ResponsiveActionButtonProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  // Mostrar diferentes componentes según el dispositivo
  if (isMobile) {
    return <MobileActionSheet onAction={onAction} />;
  }

  return <FloatingActionButton onAction={onAction} />;
}