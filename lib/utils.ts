import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { Locale } from '@/app/[lang]/dictionaries'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Single place mapping our app locale codes to BCP 47 tags for Intl/toLocale* calls.
const BCP47: Record<Locale, string> = { en: 'en-US', uk: 'uk-UA' }

export function toBCP47(lang: Locale): string {
  return BCP47[lang]
}

export function formatDate(dateStr: string, lang: Locale): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString(BCP47[lang], {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function formatDateTime(dateStr: string, lang: Locale): string {
  const d = new Date(dateStr)
  return d.toLocaleString(BCP47[lang], {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function isLowStock(qty: number, min: number): boolean {
  return qty <= min
}
