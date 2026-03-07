'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Mail, Send, Eye, MousePointerClick, AlertTriangle, Ban,
  RefreshCw, ChevronLeft, ChevronRight, Search, Filter,
  TrendingUp, Users, BarChart3, Shield
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api'

interface EmailStats {
  period_days: number
  total_emails: number
  unique_recipients: number
  status_breakdown: Record<string, number>
  type_breakdown: Record<string, number>
  rates: {
    delivery_rate: number
    open_rate: number
    click_rate: number
    bounce_rate: number
    complaint_rate: number
    failure_rate: number
  }
  daily_volume: Array<{ date: string; count: number }>
}

interface EmailEvent {
  id: number
  user_id: number | null
  to_email: string
  subject: string
  email_type: string
  status: string
  provider_id: string | null
  created_at: string | null
  opened_at: string | null
  clicked_at: string | null
  bounced_at: string | null
  complained_at: string | null
  bounce_type: string | null
  bounce_reason: string | null
}

const STATUS_COLORS: Record<string, string> = {
  sent: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  delivered: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  opened: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  clicked: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  bounced: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  complained: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  failed: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
}

const TYPE_LABELS: Record<string, string> = {
  verification: 'Vérification',
  welcome: 'Bienvenue',
  password_reset: 'Reset MDP',
  streak_reminder: 'Streak',
  event_reminder: 'Événement',
  daily_digest: 'Digest',
  achievement_unlocked: 'Succès',
  inactivity_reminder: 'Inactivité',
  flashcard_reminder: 'Flashcards',
  duel_challenge: 'Duel',
  onboarding_day_1: 'Onboarding J+1',
  onboarding_day_3: 'Onboarding J+3',
  onboarding_day_7: 'Onboarding J+7',
  general: 'Général',
}

export default function AdminEmailsPage() {
  const [stats, setStats] = useState<EmailStats | null>(null)
  const [emails, setEmails] = useState<EmailEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'emails' | 'bounces'>('overview')

  // Filters
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [filterType, setFilterType] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterEmail, setFilterEmail] = useState('')
  const [days, setDays] = useState(30)

  // Bounces
  const [bounces, setBounces] = useState<EmailEvent[]>([])
  const [bouncesTotal, setBouncesTotal] = useState(0)

  const fetchStats = useCallback(async () => {
    try {
      const response = await api.get(`/admin/emails/stats?days=${days}`)
      setStats(response.data)
    } catch (err: any) {
      if (err.response?.status === 403) {
        toast.error('Accès refusé. Vous devez être administrateur.')
      } else {
        toast.error('Erreur lors du chargement des statistiques')
      }
    }
  }, [days])

  const fetchEmails = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        page_size: '50',
        days: days.toString(),
      })
      if (filterType) params.set('email_type', filterType)
      if (filterStatus) params.set('email_status', filterStatus)
      if (filterEmail) params.set('to_email', filterEmail)

      const response = await api.get(`/admin/emails/list?${params}`)
      setEmails(response.data.emails)
      setTotal(response.data.total)
      setTotalPages(response.data.total_pages)
    } catch (err) {
      toast.error('Erreur lors du chargement des emails')
    }
  }, [page, filterType, filterStatus, filterEmail, days])

  const fetchBounces = useCallback(async () => {
    try {
      const response = await api.get('/admin/emails/bounces?page=1&page_size=100')
      setBounces(response.data.bounces)
      setBouncesTotal(response.data.total)
    } catch (err) {
      toast.error('Erreur lors du chargement des bounces')
    }
  }, [])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      await Promise.all([fetchStats(), fetchEmails(), fetchBounces()])
      setLoading(false)
    }
    load()
  }, [fetchStats, fetchEmails, fetchBounces])

  useEffect(() => {
    if (!loading) fetchEmails()
  }, [page, filterType, filterStatus])

  const handleRefresh = async () => {
    setLoading(true)
    await Promise.all([fetchStats(), fetchEmails(), fetchBounces()])
    setLoading(false)
    toast.success('Données actualisées')
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    const d = new Date(dateStr)
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
          ))}
        </div>
        <div className="h-96 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center space-x-3">
            <Mail className="w-8 h-8 text-primary-600" />
            <span>Dashboard Email</span>
          </h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">
            Monitoring et analytics des emails envoyés
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <select
            value={days}
            onChange={(e) => setDays(parseInt(e.target.value))}
            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
          >
            <option value={7}>7 jours</option>
            <option value={30}>30 jours</option>
            <option value={90}>90 jours</option>
            <option value={365}>1 an</option>
          </select>
          <button
            onClick={handleRefresh}
            className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
            <div className="flex items-center space-x-2 mb-2">
              <Send className="w-5 h-5 text-blue-500" />
              <span className="text-sm text-gray-500 dark:text-gray-400">Envoyés</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total_emails}</p>
            <p className="text-xs text-gray-500">{stats.rates.delivery_rate}% délivrés</p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
            <div className="flex items-center space-x-2 mb-2">
              <Users className="w-5 h-5 text-indigo-500" />
              <span className="text-sm text-gray-500 dark:text-gray-400">Destinataires</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.unique_recipients}</p>
            <p className="text-xs text-gray-500">uniques</p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
            <div className="flex items-center space-x-2 mb-2">
              <Eye className="w-5 h-5 text-green-500" />
              <span className="text-sm text-gray-500 dark:text-gray-400">Ouverts</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.rates.open_rate}%</p>
            <p className="text-xs text-gray-500">taux d'ouverture</p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
            <div className="flex items-center space-x-2 mb-2">
              <MousePointerClick className="w-5 h-5 text-purple-500" />
              <span className="text-sm text-gray-500 dark:text-gray-400">Cliqués</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.rates.click_rate}%</p>
            <p className="text-xs text-gray-500">taux de clic</p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
            <div className="flex items-center space-x-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <span className="text-sm text-gray-500 dark:text-gray-400">Bounces</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.rates.bounce_rate}%</p>
            <p className="text-xs text-gray-500">{stats.status_breakdown['bounced'] || 0} total</p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
            <div className="flex items-center space-x-2 mb-2">
              <Ban className="w-5 h-5 text-orange-500" />
              <span className="text-sm text-gray-500 dark:text-gray-400">Plaintes</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.rates.complaint_rate}%</p>
            <p className="text-xs text-gray-500">{stats.status_breakdown['complained'] || 0} total</p>
          </div>
        </div>
      )}

      {/* Volume Chart + Type Breakdown */}
      {stats && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Daily Volume */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center space-x-2">
              <TrendingUp className="w-5 h-5 text-primary-500" />
              <span>Volume quotidien (7 jours)</span>
            </h3>
            <div className="flex items-end space-x-2 h-40">
              {stats.daily_volume.length > 0 ? stats.daily_volume.map((day, i) => {
                const maxCount = Math.max(...stats.daily_volume.map(d => d.count), 1)
                const height = (day.count / maxCount) * 100
                return (
                  <div key={i} className="flex-1 flex flex-col items-center">
                    <span className="text-xs text-gray-500 mb-1">{day.count}</span>
                    <div
                      className="w-full bg-primary-500 rounded-t-md transition-all"
                      style={{ height: `${Math.max(height, 4)}%` }}
                    ></div>
                    <span className="text-xs text-gray-400 mt-1">
                      {new Date(day.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                    </span>
                  </div>
                )
              }) : (
                <p className="text-gray-400 text-sm w-full text-center py-10">Aucune donnée</p>
              )}
            </div>
          </div>

          {/* Type Breakdown */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center space-x-2">
              <BarChart3 className="w-5 h-5 text-primary-500" />
              <span>Par type</span>
            </h3>
            <div className="space-y-3 max-h-48 overflow-y-auto">
              {Object.entries(stats.type_breakdown).map(([type, count]) => {
                const maxCount = Math.max(...Object.values(stats.type_breakdown), 1)
                const width = (count / maxCount) * 100
                return (
                  <div key={type} className="flex items-center space-x-3">
                    <span className="text-sm text-gray-600 dark:text-gray-300 w-32 truncate">
                      {TYPE_LABELS[type] || type}
                    </span>
                    <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-5">
                      <div
                        className="bg-primary-500 h-5 rounded-full flex items-center justify-end pr-2"
                        style={{ width: `${Math.max(width, 8)}%` }}
                      >
                        <span className="text-xs text-white font-medium">{count}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tabs for Email Log and Bounces */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-6">
          {[
            { id: 'emails' as const, label: 'Journal des emails', icon: Mail },
            { id: 'bounces' as const, label: `Bounces & Plaintes (${bouncesTotal})`, icon: AlertTriangle },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Email Log */}
      {activeTab === 'emails' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow">
          {/* Filters */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={filterEmail}
                onChange={(e) => { setFilterEmail(e.target.value); setPage(1) }}
                placeholder="Rechercher par email..."
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm"
              />
            </div>
            <select
              value={filterType}
              onChange={(e) => { setFilterType(e.target.value); setPage(1) }}
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm"
            >
              <option value="">Tous les types</option>
              {Object.entries(TYPE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value); setPage(1) }}
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm"
            >
              <option value="">Tous les statuts</option>
              <option value="sent">Envoyé</option>
              <option value="delivered">Délivré</option>
              <option value="opened">Ouvert</option>
              <option value="clicked">Cliqué</option>
              <option value="bounced">Bounce</option>
              <option value="complained">Plainte</option>
              <option value="failed">Échoué</option>
            </select>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Destinataire</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Sujet</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Statut</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Ouvert</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Cliqué</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {emails.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">Aucun email trouvé</td>
                  </tr>
                ) : emails.map(email => (
                  <tr key={email.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-3 text-gray-900 dark:text-gray-100 max-w-[200px] truncate">{email.to_email}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300 max-w-[250px] truncate">{email.subject}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                        {TYPE_LABELS[email.email_type] || email.email_type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full ${STATUS_COLORS[email.status] || 'bg-gray-100 text-gray-800'}`}>
                        {email.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">{formatDate(email.created_at)}</td>
                    <td className="px-4 py-3 text-xs">
                      {email.opened_at ? (
                        <span className="text-green-600">{formatDate(email.opened_at)}</span>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {email.clicked_at ? (
                        <span className="text-purple-600">{formatDate(email.clicked_at)}</span>
                      ) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <span className="text-sm text-gray-500">{total} résultats</span>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 disabled:opacity-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-gray-600 dark:text-gray-300">
                Page {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 disabled:opacity-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bounces Tab */}
      {activeTab === 'bounces' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-2">
              <Shield className="w-5 h-5 text-red-500" />
              <span className="font-medium text-gray-900 dark:text-white">
                {bouncesTotal} adresses avec problèmes
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Les emails sont automatiquement désactivés pour les hard bounces et les plaintes.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Raison</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {bounces.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                      Aucun bounce ou plainte. Tout va bien !
                    </td>
                  </tr>
                ) : bounces.map(b => (
                  <tr key={b.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-3 text-gray-900 dark:text-gray-100">{b.to_email}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700">
                        {TYPE_LABELS[b.email_type] || b.email_type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full ${STATUS_COLORS[b.status]}`}>
                        {b.status} {b.bounce_type ? `(${b.bounce_type})` : ''}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs max-w-[300px] truncate">
                      {b.bounce_reason || '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {formatDate(b.bounced_at || b.complained_at || b.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
