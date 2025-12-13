'use client'

import { ReactNode } from 'react'
import { AuthProvider } from '@/store/auth-store'
import { ThemeProvider } from 'next-themes'
import { OfflineProvider } from '@/components/providers/OfflineProvider'
import { LanguageProvider } from '@/contexts/LanguageContext'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <OfflineProvider>
        <AuthProvider>
          <LanguageProvider>
            {children}
          </LanguageProvider>
        </AuthProvider>
      </OfflineProvider>
    </ThemeProvider>
  )
}
