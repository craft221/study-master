'use client'

import { useState, useEffect, useCallback } from 'react'
import { Bell, Check, CheckCheck, Trash2, Settings, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import notificationsService, {
  Notification,
  NotificationType,
  getNotificationIcon,
  getPriorityColor
} from '@/services/notifications'
import { useTranslation } from '@/contexts/LanguageContext'

// Intervalle de rafraîchissement (30 secondes)
const REFRESH_INTERVAL = 30000

export default function NotificationDropdown() {
  const { t, locale } = useTranslation()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  // Charger les notifications
  const fetchNotifications = useCallback(async () => {
    try {
      const [notifRes, countRes] = await Promise.all([
        notificationsService.getAll(1, 10),
        notificationsService.getUnreadCount()
      ])
      setNotifications(notifRes.notifications)
      setUnreadCount(countRes.unread_count)
    } catch (error) {
      console.error('Error fetching notifications:', error)
    }
  }, [])

  // Charger au montage et à intervalle régulier
  useEffect(() => {
    fetchNotifications()

    const interval = setInterval(fetchNotifications, REFRESH_INTERVAL)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  // Recharger quand on ouvre le dropdown
  useEffect(() => {
    if (open) {
      fetchNotifications()
    }
  }, [open, fetchNotifications])

  // Marquer automatiquement les notifications visibles comme lues après 2 secondes
  useEffect(() => {
    if (open && unreadCount > 0) {
      const timer = setTimeout(async () => {
        try {
          await notificationsService.markAllAsRead()
          setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
          setUnreadCount(0)
        } catch (error) {
          console.error('Error auto-marking notifications as read:', error)
        }
      }, 2000) // 2 secondes

      return () => clearTimeout(timer)
    }
  }, [open, unreadCount])

  // Marquer une notification comme lue
  const handleMarkAsRead = async (notificationId: number, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    try {
      await notificationsService.markAsRead([notificationId])
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }

  // Marquer toutes comme lues
  const handleMarkAllAsRead = async () => {
    setLoading(true)
    try {
      await notificationsService.markAllAsRead()
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
      setUnreadCount(0)
    } catch (error) {
      console.error('Error marking all as read:', error)
    } finally {
      setLoading(false)
    }
  }

  // Supprimer une notification
  const handleDelete = async (notificationId: number, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    try {
      await notificationsService.delete(notificationId)
      const wasUnread = notifications.find(n => n.id === notificationId)?.is_read === false
      setNotifications(prev => prev.filter(n => n.id !== notificationId))
      if (wasUnread) {
        setUnreadCount(prev => Math.max(0, prev - 1))
      }
    } catch (error) {
      console.error('Error deleting notification:', error)
    }
  }

  // Formater la date relative
  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)
    const localeMap: Record<string, string> = { fr: 'fr-FR', en: 'en-US', es: 'es-ES', ar: 'ar-SA' }

    if (diffMins < 1) return t('time.justNow')
    if (diffMins < 60) return t('time.minutesAgo', { count: diffMins })
    if (diffHours < 24) return t('time.hoursAgo', { count: diffHours })
    if (diffDays < 7) return t('time.daysAgo', { count: diffDays })
    return date.toLocaleDateString(localeMap[locale] || 'fr-FR', { day: 'numeric', month: 'short' })
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={`${t('notifications.title')}${unreadCount > 0 ? ` (${unreadCount} ${t('notifications.unread')})` : ''}`}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 rounded-full text-xs text-white flex items-center justify-center font-medium animate-pulse">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 md:w-96">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <DropdownMenuLabel className="p-0 text-base font-semibold">
            {t('notifications.title')}
          </DropdownMenuLabel>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={handleMarkAllAsRead}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <CheckCheck className="h-3 w-3 mr-1" />
                )}
                {t('notifications.markAllRead')}
              </Button>
            )}
            <Link href="/settings#notifications">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Settings className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Liste des notifications */}
        <ScrollArea className="h-[400px]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <Bell className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">{t('notifications.noNotifications')}</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                {t('notifications.receiveHere')}
              </p>
            </div>
          ) : (
            <div className="py-1">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkAsRead={handleMarkAsRead}
                  onDelete={handleDelete}
                  formatRelativeTime={formatRelativeTime}
                  t={t}
                />
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        {notifications.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <div className="p-2">
              <Link href="/notifications" className="block">
                <Button variant="ghost" className="w-full justify-center text-sm">
                  {t('notifications.viewAll')}
                </Button>
              </Link>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// Composant pour une notification individuelle
interface NotificationItemProps {
  notification: Notification
  onMarkAsRead: (id: number, e: React.MouseEvent) => void
  onDelete: (id: number, e: React.MouseEvent) => void
  formatRelativeTime: (date: string) => string
  t: (path: string, params?: Record<string, string | number>) => string
}

function NotificationItem({
  notification,
  onMarkAsRead,
  onDelete,
  formatRelativeTime,
  t
}: NotificationItemProps) {
  const icon = getNotificationIcon(notification.type as NotificationType)
  const priorityColor = getPriorityColor(notification.priority as any)

  const content = (
    <div
      className={cn(
        "flex items-start gap-3 px-4 py-3 hover:bg-muted/50 transition-colors cursor-pointer group relative",
        !notification.is_read && "bg-primary/5"
      )}
    >
      {/* Indicateur non lu */}
      {!notification.is_read && (
        <div className="absolute left-1 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-primary" />
      )}

      {/* Icône */}
      <div className="flex-shrink-0 text-2xl mt-0.5">
        {icon}
      </div>

      {/* Contenu */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={cn(
            "text-sm line-clamp-1",
            !notification.is_read ? "font-semibold" : "font-medium"
          )}>
            {notification.title}
          </p>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {formatRelativeTime(notification.created_at)}
          </span>
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
          {notification.message}
        </p>

        {/* Badges */}
        <div className="flex items-center gap-2 mt-1.5">
          {notification.priority === 'high' || notification.priority === 'urgent' ? (
            <Badge variant="outline" className={cn("text-xs py-0", priorityColor)}>
              {notification.priority === 'urgent' ? t('notifications.urgent') : t('notifications.important')}
            </Badge>
          ) : null}
        </div>
      </div>

      {/* Actions (visibles au hover) */}
      <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {!notification.is_read && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => onMarkAsRead(notification.id, e)}
            title={t('notifications.markAsRead')}
          >
            <Check className="h-4 w-4" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive hover:text-destructive"
          onClick={(e) => onDelete(notification.id, e)}
          title={t('notifications.delete')}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )

  // Si action_url, wrapper dans un Link
  if (notification.action_url) {
    return (
      <Link href={notification.action_url} className="block">
        {content}
      </Link>
    )
  }

  return content
}
