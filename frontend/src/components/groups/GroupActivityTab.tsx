'use client'

import { useState, useEffect } from 'react'
import { Activity, FileText, CreditCard, Zap, Brain, UserPlus, Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { getGroupActivities, type GroupActivity } from '@/services/groupContent'

interface GroupActivityTabProps {
  groupId: number
}

export default function GroupActivityTab({ groupId }: GroupActivityTabProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [activities, setActivities] = useState<GroupActivity[]>([])

  useEffect(() => {
    fetchActivities(true)
    // Refresh every 30 seconds
    const interval = setInterval(() => fetchActivities(false), 30000)
    return () => clearInterval(interval)
  }, [groupId])

  const fetchActivities = async (showLoader = false) => {
    try {
      if (showLoader) setLoading(true)
      const data = await getGroupActivities(groupId, 50)
      setActivities(data)
    } catch (error: any) {
      console.error('Error fetching activities:', error)
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les activités',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const getActivityIcon = (type: string) => {
    const icons: Record<string, React.ReactNode> = {
      note_shared: <FileText className="h-5 w-5 text-blue-600" />,
      flashcard_shared: <CreditCard className="h-5 w-5 text-purple-600" />,
      session_created: <Zap className="h-5 w-5 text-yellow-600" />,
      quiz_shared: <Brain className="h-5 w-5 text-green-600" />,
      member_joined: <UserPlus className="h-5 w-5 text-gray-600" />
    }
    return icons[type] || <Activity className="h-5 w-5 text-gray-600" />
  }

  const getActivityColor = (type: string) => {
    const colors: Record<string, string> = {
      note_shared: 'bg-blue-50 border-blue-200',
      flashcard_shared: 'bg-purple-50 border-purple-200',
      session_created: 'bg-yellow-50 border-yellow-200',
      quiz_shared: 'bg-green-50 border-green-200',
      member_joined: 'bg-gray-50 border-gray-200'
    }
    return colors[type] || 'bg-gray-50 border-gray-200'
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return 'À l\'instant'
    if (diffMins < 60) return `Il y a ${diffMins} min`
    if (diffHours < 24) return `Il y a ${diffHours}h`
    if (diffDays < 7) return `Il y a ${diffDays}j`
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Fil d'activité</h3>
        <p className="text-sm text-gray-500">
          Activités récentes du groupe • Met à jour toutes les 30s
        </p>
      </div>

      {activities.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Activity className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-500">Aucune activité</p>
            <p className="text-sm text-gray-400 mt-1">
              Les activités du groupe apparaîtront ici
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {activities.map((activity) => (
            <Card
              key={activity.id}
              className={`border-l-4 ${getActivityColor(activity.activity_type)}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className="flex-shrink-0 mt-0.5">
                    {getActivityIcon(activity.activity_type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="text-sm text-gray-900">
                          <span className="font-semibold">{activity.username}</span>{' '}
                          {activity.description}
                        </p>
                        {activity.metadata && (
                          <div className="mt-1 text-xs text-gray-500">
                            {activity.metadata.title && (
                              <span className="italic">"{activity.metadata.title}"</span>
                            )}
                          </div>
                        )}
                      </div>
                      <span className="text-xs text-gray-500 whitespace-nowrap">
                        {formatTime(activity.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
