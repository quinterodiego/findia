'use client'

import { motion } from 'framer-motion'

interface SkeletonProps {
  className?: string
  variant?: 'text' | 'rectangular' | 'circular'
  animation?: 'pulse' | 'wave'
  width?: string | number
  height?: string | number
}

export function Skeleton({ 
  className = '', 
  variant = 'rectangular', 
  animation = 'pulse',
  width,
  height 
}: SkeletonProps) {
  const baseClasses = 'bg-gray-200 dark:bg-gray-700'
  
  const variantClasses = {
    text: 'h-4 rounded',
    rectangular: 'rounded-lg',
    circular: 'rounded-full'
  }

  const animationClasses = {
    pulse: 'animate-pulse',
    wave: 'animate-wave'
  }

  const style = {
    ...(width && { width: typeof width === 'number' ? `${width}px` : width }),
    ...(height && { height: typeof height === 'number' ? `${height}px` : height })
  }

  return (
    <motion.div
      className={`${baseClasses} ${variantClasses[variant]} ${animationClasses[animation]} ${className}`}
      style={style}
      initial={{ opacity: 0.6 }}
      animate={{ opacity: [0.6, 1, 0.6] }}
      transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
    />
  )
}

// Componentes específicos para casos comunes
export function SkeletonCard() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-3 mb-4">
        <Skeleton variant="circular" width={40} height={40} />
        <div className="flex-1">
          <Skeleton width="60%" height={16} className="mb-2" />
          <Skeleton width="40%" height={14} />
        </div>
      </div>
      <Skeleton height={20} className="mb-2" />
      <Skeleton height={20} width="80%" />
    </div>
  )
}

export function SkeletonTable() {
  return (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton width={40} height={40} variant="circular" />
          <div className="flex-1 space-y-2">
            <Skeleton width="70%" height={16} />
            <Skeleton width="50%" height={14} />
          </div>
          <Skeleton width={80} height={20} />
        </div>
      ))}
    </div>
  )
}

export function SkeletonForm() {
  return (
    <div className="space-y-4">
      <div>
        <Skeleton width="30%" height={16} className="mb-2" />
        <Skeleton height={40} />
      </div>
      <div>
        <Skeleton width="25%" height={16} className="mb-2" />
        <Skeleton height={40} />
      </div>
      <div>
        <Skeleton width="35%" height={16} className="mb-2" />
        <Skeleton height={100} />
      </div>
      <Skeleton height={44} width="100%" />
    </div>
  )
}

export function SkeletonStats() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-6">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-xl border border-gray-200/50 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <Skeleton width="60%" height={16} />
            <Skeleton variant="circular" width={24} height={24} />
          </div>
          <Skeleton width="80%" height={24} className="mb-1" />
          <Skeleton width="40%" height={14} />
        </div>
      ))}
    </div>
  )
}
