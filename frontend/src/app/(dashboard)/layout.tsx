'use client'

import { ReactNode, useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import api from '@/lib/api'
import {
  BookOpen,
  Home,
  FileText,
  CreditCard,
  Brain,
  Trophy,
  Award,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  Search,
  Zap,
  Calendar,
  Target,
  Moon,
  Sun,
  Scan,
  Sparkles,
  User,
  Swords,
  Download,
  FolderOpen,
  Radio,
  Compass,
  GraduationCap
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { SparkProvider } from '@/contexts/SparkContext'
import { PomodoroProvider } from '@/contexts/PomodoroContext'
import SparkWidget from '@/components/SparkWidget'
import FloatingPomodoroTimer from '@/components/FloatingPomodoroTimer'
import ErrorBoundary, { PageErrorFallback } from '@/components/ErrorBoundary'
import { useTranslation } from '@/contexts/LanguageContext'
import { LanguageToggle } from '@/components/ui/LanguageSelector'
import { useSparkPageMessages } from '@/hooks/useSparkPageMessages'
import NotificationDropdown from '@/components/NotificationDropdown'
import { OfflineBanner, OfflineIndicator } from '@/components/offline/OfflineIndicator'
import OnboardingWizard from '@/components/onboarding/OnboardingWizard'

// Navigation organisée par catégories
const navigationCategories = [
  {
    categoryKey: 'nav.category.main',
    items: [
      { key: 'nav.dashboard', href: '/dashboard', icon: Home },
      { key: 'nav.quests', href: '/quests', icon: Target },
      { key: 'nav.explore', href: '/explore', icon: Compass },
    ]
  },
  {
    categoryKey: 'nav.category.study',
    items: [
      { key: 'nav.subjects', href: '/subjects', icon: BookOpen },
      { key: 'nav.notes', href: '/notes', icon: FileText },
      { key: 'nav.flashcards', href: '/flashcards', icon: CreditCard },
      { key: 'nav.quizzes', href: '/quizzes', icon: Brain },
      { key: 'nav.documents', href: '/documents', icon: FolderOpen },
    ]
  },
  {
    categoryKey: 'nav.category.tools',
    items: [
      { key: 'nav.spark', href: '/ai', icon: Sparkles },
      { key: 'documents.upload', href: '/ocr', icon: Scan },
      { key: 'nav.sessions', href: '/sessions', icon: Zap },
      { key: 'nav.calendar', href: '/schedule', icon: Calendar },
      { key: 'nav.focusRooms', href: '/focus-rooms', icon: Radio },
      { key: 'nav.examMode', href: '/exam-mode', icon: GraduationCap },
    ]
  },
  {
    categoryKey: 'nav.category.social',
    items: [
      { key: 'nav.groups', href: '/groups', icon: Users },
      { key: 'nav.duels', href: '/duels', icon: Swords },
      { key: 'nav.leaderboard', href: '/leaderboard', icon: Trophy },
      { key: 'nav.achievements', href: '/achievements', icon: Award },
    ]
  },
  {
    categoryKey: 'nav.category.more',
    items: [
      { key: 'nav.profile', href: '/profile', icon: User },
      { key: 'nav.export', href: '/export', icon: Download },
      { key: 'nav.pricing', href: '/pricing', icon: CreditCard },
    ]
  },
]

function DashboardContent({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { t } = useTranslation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [darkMode, setDarkMode] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [onboardingChecked, setOnboardingChecked] = useState(false)

  // Hook pour les messages contextuels de Spark selon la page
  useSparkPageMessages()

  const [user, setUser] = useState({
    name: 'Utilisateur',
    email: 'user@example.com',
    avatar: null as string | null,
    level: 1,
    total_xp: 0,
    xp_progress: 0,
    xp_needed: 100,
  })

  // Check if user needs onboarding (new user with no subjects)
  const checkOnboarding = useCallback(async () => {
    try {
      // Check localStorage first
      const onboardingCompleted = localStorage.getItem('onboarding_completed')
      if (onboardingCompleted === 'true') {
        setOnboardingChecked(true)
        return
      }

      // Check if user has any subjects
      const response = await api.get('/subjects/')
      const subjects = response.data

      // If no subjects, show onboarding
      if (!subjects || subjects.length === 0) {
        setShowOnboarding(true)
      }
      setOnboardingChecked(true)
    } catch (error) {
      console.error('Error checking onboarding:', error)
      setOnboardingChecked(true)
    }
  }, [])

  const handleOnboardingComplete = useCallback(() => {
    setShowOnboarding(false)
    // Refresh the page to show new subjects
    router.refresh()
  }, [router])

  const fetchUserData = useCallback(async () => {
    try {
      const response = await api.get('/users/me/stats')
      const stats = response.data
      setUser({
        name: stats.username || 'Utilisateur',
        email: stats.email || 'user@example.com',
        avatar: stats.avatar_url,
        level: stats.level || 1,
        total_xp: stats.total_xp || 0,
        xp_progress: stats.xp_progress || 0,
        xp_needed: stats.xp_needed_for_next_level || 100,
      })
    } catch (error) {
      console.error('Error fetching user data:', error)
    }
  }, [])

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      router.push('/login')
      return
    }
    fetchUserData()
    checkOnboarding()
  }, [router, pathname, fetchUserData, checkOnboarding])

  useEffect(() => {
    const savedMode = localStorage.getItem('darkMode')
    if (savedMode === 'true') {
      setDarkMode(true)
      document.documentElement.classList.add('dark')
    }
  }, [])

  const toggleDarkMode = useCallback(() => {
    setDarkMode(prev => {
      const newMode = !prev
      if (newMode) {
        document.documentElement.classList.add('dark')
        localStorage.setItem('darkMode', 'true')
      } else {
        document.documentElement.classList.remove('dark')
        localStorage.setItem('darkMode', 'false')
      }
      return newMode
    })
  }, [])

  const handleLogout = useCallback(() => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    sessionStorage.removeItem('spark_welcome_shown')
    router.push('/login')
  }, [router])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setIsSearchOpen(true)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900" suppressHydrationWarning>
      {/* Onboarding Wizard for new users */}
      {showOnboarding && onboardingChecked && (
        <OnboardingWizard
          onComplete={handleOnboardingComplete}
          userName={user.name}
        />
      )}

      {/* Offline Banner */}
      <OfflineBanner />

      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transform transition-transform duration-300 ease-in-out lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-14 px-4 border-b border-gray-200 dark:border-gray-700">
            <Link href="/dashboard" className="flex items-center space-x-2">
              <BookOpen className="h-7 w-7 text-primary-600 dark:text-primary-400" />
              <span className="text-lg font-bold text-gray-900 dark:text-white">Studera</span>
            </Link>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 p-1"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* User Info */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 rounded-full bg-primary-600 flex items-center justify-center text-white font-bold text-base flex-shrink-0">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{user.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
              </div>
            </div>
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-gray-600 dark:text-gray-400">{t('dashboard.level')} {user.level}</span>
                <span className="text-gray-600 dark:text-gray-400">{user.total_xp} XP</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-primary-600 dark:bg-primary-500 h-1.5 rounded-full transition-all"
                  style={{ width: `${Math.min((user.xp_progress / user.xp_needed) * 100, 100)}%` }}
                />
              </div>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 text-right">
                {user.xp_progress}/{user.xp_needed} → Niv. {user.level + 1}
              </p>
            </div>
          </div>

          {/* Navigation par catégories */}
          <nav className="flex-1 px-3 py-3 overflow-y-auto">
            {navigationCategories.map((category, catIndex) => (
              <div key={category.categoryKey} className={catIndex > 0 ? 'mt-4' : ''}>
                {/* Category header */}
                <p className="px-3 mb-1.5 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                  {t(category.categoryKey)}
                </p>
                {/* Category items */}
                <div className="space-y-0.5">
                  {category.items.map((item) => {
                    const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
                    return (
                      <Link
                        key={item.key}
                        href={item.href}
                        onClick={() => setSidebarOpen(false)}
                        className={cn(
                          'flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors text-sm',
                          isActive
                            ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 font-medium'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                        )}
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{t(item.key)}</span>
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* Bottom Actions */}
          <div className="p-3 border-t border-gray-200 dark:border-gray-700 space-y-0.5">
            <Link
              href="/settings"
              onClick={() => setSidebarOpen(false)}
              className="flex items-center space-x-3 px-3 py-2.5 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm"
            >
              <Settings className="h-4.5 w-4.5" />
              <span>{t('nav.settings')}</span>
            </Link>
            <button
              onClick={handleLogout}
              className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-sm"
            >
              <LogOut className="h-4.5 w-4.5" />
              <span>{t('auth.logout')}</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="lg:pl-64">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between h-14 px-3 sm:px-4 lg:px-6">
            {/* Mobile menu button */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 p-1.5 -ml-1"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Search */}
            <div className="flex-1 max-w-xl mx-2 sm:mx-4">
              <button
                onClick={() => setIsSearchOpen(true)}
                className="w-full flex items-center gap-2 sm:gap-3 px-3 py-1.5 sm:py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg hover:border-primary-500 hover:ring-2 hover:ring-primary-500/20 transition-all text-left"
              >
                <Search className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                <span className="text-sm text-gray-400 dark:text-gray-500 hidden sm:inline">{t('common.search')}...</span>
                <span className="text-sm text-gray-400 dark:text-gray-500 sm:hidden">...</span>
                <kbd className="ml-auto hidden md:inline-flex px-1.5 py-0.5 text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded">Ctrl+K</kbd>
              </button>
            </div>

            {/* Right Actions */}
            <div className="flex items-center space-x-1 sm:space-x-2">
              <OfflineIndicator compact showSyncButton={false} />
              <NotificationDropdown />
              <span className="hidden sm:block"><LanguageToggle /></span>
              <button
                onClick={toggleDarkMode}
                className="p-1.5 sm:p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
                title={darkMode ? t('settings.lightTheme') : t('settings.darkTheme')}
              >
                {darkMode ? <Sun className="h-4 w-4 sm:h-5 sm:w-5" /> : <Moon className="h-4 w-4 sm:h-5 sm:w-5" />}
              </button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-3 sm:p-4 lg:p-6">
          <ErrorBoundary fallback={<PageErrorFallback />}>
            {children}
          </ErrorBoundary>
        </main>
      </div>

      {/* Global Search Modal - Lazy loaded */}
      {isSearchOpen && (
        <DynamicGlobalSearch isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
      )}

      {/* Spark Widget - Mascotte flottante */}
      <SparkWidget position="bottom-right" autoShow={true} showHelpButton={true} />

      {/* Floating Pomodoro Timer - Visible partout sauf sur /sessions */}
      <FloatingPomodoroTimer />
    </div>
  )
}

// Lazy load GlobalSearch pour éviter les problèmes d'hydratation
function DynamicGlobalSearch({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [GlobalSearch, setGlobalSearch] = useState<React.ComponentType<any> | null>(null)

  useEffect(() => {
    import('@/components/GlobalSearch').then((mod) => {
      setGlobalSearch(() => mod.default)
    }).catch((err) => {
      console.error('Failed to load GlobalSearch:', err)
    })
  }, [])

  if (!GlobalSearch) return null
  return <GlobalSearch isOpen={isOpen} onClose={onClose} />
}

// Layout principal - Simplifié sans Spark pour éviter hydratation
export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Loading screen during hydration
  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <BookOpen className="h-12 w-12 text-blue-600 mx-auto animate-pulse" />
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <SparkProvider>
      <PomodoroProvider>
        <DashboardContent>{children}</DashboardContent>
      </PomodoroProvider>
    </SparkProvider>
  )
}
