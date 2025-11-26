'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Users, LogOut, Crown, Loader2, ArrowLeft, MessageCircle, FileText, CreditCard, Zap, Brain, Activity } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import GroupMessagesTab from '@/components/groups/GroupMessagesTab'
import GroupNotesTab from '@/components/groups/GroupNotesTab'
import GroupFlashcardsTab from '@/components/groups/GroupFlashcardsTab'
import GroupSessionsTab from '@/components/groups/GroupSessionsTab'
import GroupQuizzesTab from '@/components/groups/GroupQuizzesTab'
import GroupActivityTab from '@/components/groups/GroupActivityTab'
import api from '@/lib/api'
import { useToast } from '@/hooks/use-toast'

interface Member {
  id: number
  user_id: number
  username: string
  avatar_url: string | null
  role: string
  joined_at: string
  contribution_score: number
}

interface GroupDetail {
  id: number
  name: string
  description: string
  creator_id: number
  is_private: boolean
  current_members: number
  max_members: number
  total_study_hours: number
  total_shared_notes: number
  created_at: string
  members: Member[]
}

export default function GroupDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const groupId = params.id as string

  const [loading, setLoading] = useState(true)
  const [group, setGroup] = useState<GroupDetail | null>(null)
  const [currentUserId, setCurrentUserId] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState('messages')

  useEffect(() => {
    fetchGroupData()
    fetchCurrentUser()
  }, [groupId])

  const fetchCurrentUser = async () => {
    try {
      const response = await api.get('/users/me')
      setCurrentUserId(response.data.id)
    } catch (error) {
      console.error('Error fetching current user:', error)
    }
  }

  const fetchGroupData = async () => {
    try {
      setLoading(true)
      const response = await api.get(`/study-groups/${groupId}`)
      setGroup(response.data)
    } catch (error: any) {
      console.error('Error fetching group:', error)
      toast({
        title: 'Erreur',
        description: error.response?.data?.detail || 'Impossible de charger le groupe',
        variant: 'destructive'
      })
      router.push('/groups')
    } finally {
      setLoading(false)
    }
  }

  const handleLeaveGroup = async () => {
    if (!confirm('Êtes-vous sûr de vouloir quitter ce groupe ?')) return

    try {
      await api.post(`/study-groups/${groupId}/leave`)
      toast({
        title: 'Vous avez quitté le groupe',
      })
      router.push('/groups')
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.response?.data?.detail || 'Impossible de quitter le groupe',
        variant: 'destructive'
      })
    }
  }

  const getRoleBadge = (role: string) => {
    const roles: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      owner: { label: 'Créateur', variant: 'default' },
      admin: { label: 'Admin', variant: 'secondary' },
      member: { label: 'Membre', variant: 'outline' }
    }
    const roleConfig = roles[role.toLowerCase()] || roles.member
    return <Badge variant={roleConfig.variant}>{roleConfig.label}</Badge>
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      </div>
    )
  }

  if (!group) return null

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => router.push('/groups')}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour aux groupes
        </Button>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{group.name}</h1>
            <p className="text-gray-600">{group.description || 'Pas de description'}</p>
            <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
              <span className="flex items-center">
                <Users className="h-4 w-4 mr-1" />
                {group.current_members}/{group.max_members} membres
              </span>
              <span className="flex items-center">
                <MessageCircle className="h-4 w-4 mr-1" />
                {group.total_shared_notes} notes partagées
              </span>
            </div>
          </div>

          <Button
            variant="destructive"
            onClick={handleLeaveGroup}
            disabled={group.creator_id === currentUserId}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Quitter
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content with Tabs */}
        <div className="lg:col-span-2">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="messages" className="flex items-center gap-1">
                <MessageCircle className="h-4 w-4" />
                <span className="hidden sm:inline">Messages</span>
              </TabsTrigger>
              <TabsTrigger value="notes" className="flex items-center gap-1">
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">Notes</span>
              </TabsTrigger>
              <TabsTrigger value="flashcards" className="flex items-center gap-1">
                <CreditCard className="h-4 w-4" />
                <span className="hidden sm:inline">Flashcards</span>
              </TabsTrigger>
              <TabsTrigger value="sessions" className="flex items-center gap-1">
                <Zap className="h-4 w-4" />
                <span className="hidden sm:inline">Sessions</span>
              </TabsTrigger>
              <TabsTrigger value="quizzes" className="flex items-center gap-1">
                <Brain className="h-4 w-4" />
                <span className="hidden sm:inline">Quiz</span>
              </TabsTrigger>
              <TabsTrigger value="activity" className="flex items-center gap-1">
                <Activity className="h-4 w-4" />
                <span className="hidden sm:inline">Activité</span>
              </TabsTrigger>
            </TabsList>

            {/* Messages Tab */}
            <TabsContent value="messages" className="mt-4">
              <GroupMessagesTab
                groupId={parseInt(groupId)}
                currentUserId={currentUserId || 0}
                members={group?.members || []}
              />
            </TabsContent>

            {/* Notes Tab */}
            <TabsContent value="notes" className="mt-4">
              <GroupNotesTab groupId={parseInt(groupId)} currentUserId={currentUserId || 0} />
            </TabsContent>

            {/* Flashcards Tab */}
            <TabsContent value="flashcards" className="mt-4">
              <GroupFlashcardsTab groupId={parseInt(groupId)} currentUserId={currentUserId || 0} />
            </TabsContent>

            {/* Sessions Tab */}
            <TabsContent value="sessions" className="mt-4">
              <GroupSessionsTab groupId={parseInt(groupId)} currentUserId={currentUserId || 0} />
            </TabsContent>

            {/* Quizzes Tab */}
            <TabsContent value="quizzes" className="mt-4">
              <GroupQuizzesTab groupId={parseInt(groupId)} currentUserId={currentUserId || 0} />
            </TabsContent>

            {/* Activity Tab */}
            <TabsContent value="activity" className="mt-4">
              <GroupActivityTab groupId={parseInt(groupId)} />
            </TabsContent>
          </Tabs>
        </div>

        {/* Members Sidebar */}
        <div className="lg:col-span-1">
          <Card className="h-[600px] flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Users className="h-5 w-5 mr-2" />
                Membres ({group.members.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto">
              <div className="space-y-3">
                {group.members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-semibold">
                        {member.username.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 flex items-center gap-2">
                          {member.username}
                          {member.user_id === group.creator_id && (
                            <Crown className="h-3 w-3 text-yellow-500" />
                          )}
                        </div>
                        <div className="text-xs text-gray-500">
                          {getRoleBadge(member.role)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Group Stats */}
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-sm">Statistiques</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Heures d'étude</span>
                <span className="font-semibold">{group.total_study_hours}h</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Notes partagées</span>
                <span className="font-semibold">{group.total_shared_notes}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Membres</span>
                <span className="font-semibold">{group.members.length}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
