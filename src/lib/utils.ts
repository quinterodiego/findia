import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('es-CO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(date))
}

export function generateId(): string {
  return Math.random().toString(36).substr(2, 9)
}

export function calculateProgressPercentage(paid: number, total: number): number {
  if (total === 0) return 0
  return Math.round((paid / total) * 100)
}

export function estimatePayoffDate(remainingDebt: number, monthlyPayment: number): string {
  if (monthlyPayment <= 0) return 'N/A'
  
  const monthsToPayoff = Math.ceil(remainingDebt / monthlyPayment)
  const payoffDate = new Date()
  payoffDate.setMonth(payoffDate.getMonth() + monthsToPayoff)
  
  return formatDate(payoffDate)
}

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export function isAdmin(email: string): boolean {
  const adminEmails = process.env.ADMIN_EMAILS?.split(',') || []
  return adminEmails.includes(email)
}