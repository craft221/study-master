'use client'

import { ReactNode } from 'react'
import { AuthProvider } from '@/store/auth-store'
import { ThemeProvider } from 'next-themes'
import { OfflineProvider } from '@/components/providers/OfflineProvider'
import { LanguageProvider } from '@/contexts/LanguageContext'
import { HtmlLangSync } from '@/components/HtmlLangSync'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <OfflineProvider>
        <AuthProvider>
          <LanguageProvider>
            <HtmlLangSync />
            {children}
          </LanguageProvider>
        </AuthProvider>
      </OfflineProvider>
    </ThemeProvider>
  )
}
