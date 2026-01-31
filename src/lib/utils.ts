import { type ClassValue, clsx } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

// Format currency to Indonesian Rupiah
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// Format number with thousand separators
export function formatNumber(num: number): string {
  return new Intl.NumberFormat('id-ID').format(num);
}

// Format date to Indonesian locale
export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('id-ID', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(date));
}

// Format date to short format
export function formatDateShort(date: string | Date): string {
  return new Intl.DateTimeFormat('id-ID', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date));
}

// Format date and time
export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat('id-ID', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

// Format percentage
export function formatPercentage(value: number, decimals: number = 2): string {
  return `${value.toFixed(decimals)}%`;
}

// Calculate percentage
export function calculatePercentage(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return (numerator / denominator) * 100;
}

// Get month name from date
export function getMonthName(date: string | Date): string {
  return new Intl.DateTimeFormat('id-ID', { month: 'long' }).format(new Date(date));
}

// Get month and year
export function getMonthYear(date: string | Date): string {
  return new Intl.DateTimeFormat('id-ID', {
    year: 'numeric',
    month: 'long',
  }).format(new Date(date));
}

// Generate random color for charts
export function generateChartColor(index: number): string {
  const colors = [
    '#6366f1', // indigo
    '#8b5cf6', // purple
    '#ec4899', // pink
    '#f59e0b', // amber
    '#10b981', // emerald
    '#3b82f6', // blue
    '#ef4444', // red
  ];
  return colors[index % colors.length];
}

// Truncate text
export function truncate(text: string, length: number): string {
  if (text.length <= length) return text;
  return text.substring(0, length) + '...';
}

// Sleep function for testing
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
