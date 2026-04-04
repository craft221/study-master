'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Users, LogOut, Crown, Loader2, ArrowLeft, MessageCircle, FileText, CreditCard, Zap, Brain, Activity, UserPlus, Search, X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import GroupMessagesTab from '@/components/groups/GroupMessagesTab'
import GroupNotesTab from '@/components/groups/GroupNotesTab'
import GroupFlashcardsTab from '@/components/groups/GroupFlashcardsTab'
import GroupSessionsTab from '@/components/groups/GroupSessionsTab'
import GroupQuizzesTab from '@/components/groups/GroupQuizzesTab'
import GroupActivityTab from '@/components/groups/GroupActivityTab'
import api from '@/lib/api'
import { studyGroupsService } from '@/services/studyGroups'
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

  // Invite dialog state
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [allUsers, setAllUsers] = useState<Array<{ id: number; username: string; full_name: string; avatar_url: string | null; level: number }>>([])
  const [inviteMessage, setInviteMessage] = useState('')
  const [invitingUserId, setInvitingUserId] = useState<number | null>(null)

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
      await studyGroupsService.leave(parseInt(groupId))
      toast({
        title: 'Groupe quitté',
        description: 'Vous avez quitté le groupe avec succès',
      })
      router.push('/groups')
    } catch (error: any) {
      console.error('Error leaving group:', error)
      toast({
        title: 'Erreur',
        description: error.response?.data?.detail || 'Impossible de quitter le groupe',
        variant: 'destructive'
      })
    }
  }

  const openInviteDialog = async () => {
    setInviteDialogOpen(true)
    setSearchQuery('')
    setInviteMessage('')
    try {
      const response = await api.get('/users/')
      setAllUsers(Array.isArray(response.data) ? response.data : response.data.users || [])
    } catch (error) {
      console.error('Error fetching users:', error)
    }
  }

  const handleInviteUser = async (userId: number) => {
    try {
      setInvitingUserId(userId)
      await studyGroupsService.inviteUser(parseInt(groupId), userId, inviteMessage || undefined)
      toast({
        title: 'Invitation envoyée',
        description: 'L\'utilisateur recevra une notification',
      })
      setInviteDialogOpen(false)
    } catch (error: any) {
      console.error('Error inviting user:', error)
      toast({
        title: 'Erreur',
        description: error.response?.data?.detail || 'Impossible d\'envoyer l\'invitation',
        variant: 'destructive'
      })
    } finally {
      setInvitingUserId(null)
    }
  }

  const filteredUsers = allUsers.filter(user => {
    if (!searchQuery) return false
    const memberUserIds = group?.members.map(m => m.user_id) || []
    if (user.id === currentUserId || memberUserIds.includes(user.id)) return false
    const query = searchQuery.toLowerCase()
    return user.username.toLowerCase().includes(query) ||
           (user.full_name && user.full_name.toLowerCase().includes(query))
  })

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
    <div className="container mx-auto p-3 sm:p-6 max-w-7xl">
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

        <div className="flex flex-col sm:flex-row gap-3 sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl sm:text-3xl font-bold text-gray-900 mb-2">{group.name}</h1>
            <p className="text-gray-600 text-sm sm:text-base">{group.description || 'Pas de description'}</p>
            <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-3 text-sm text-gray-500">
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

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              onClick={openInviteDialog}
              className="flex-1 sm:flex-none"
              size="sm"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Inviter un ami</span>
              <span className="sm:hidden">Inviter</span>
            </Button>
            <Button
              variant="destructive"
              onClick={handleLeaveGroup}
              disabled={group.creator_id === currentUserId}
              className="flex-1 sm:flex-none"
              size="sm"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Quitter
            </Button>
          </div>
        </div>
      </div>

      {/* Invite User Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Inviter un ami
            </DialogTitle>
            <DialogDescription>
              Recherchez un utilisateur pour l'inviter à rejoindre ce groupe.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Search Input */}
            <div className="space-y-2">
              <Label>Rechercher un utilisateur</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Rechercher par nom d'utilisateur..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                  >
                    <X className="h-4 w-4 text-gray-400" />
                  </button>
                )}
              </div>
            </div>

            {/* Message Input */}
            <div className="space-y-2">
              <Label>Message (optionnel)</Label>
              <Input
                placeholder="Ex: Viens réviser avec nous !"
                value={inviteMessage}
                onChange={(e) => setInviteMessage(e.target.value)}
              />
            </div>

            {/* User Results */}
            <div className="max-h-60 overflow-y-auto space-y-2">
              {filteredUsers.length > 0 ? (
                filteredUsers.map(user => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={user.avatar_url || undefined} />
                        <AvatarFallback>{user.username.charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-gray-900">{user.username}</p>
                        <p className="text-sm text-gray-500">Niveau {user.level}</p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleInviteUser(user.id)}
                      disabled={invitingUserId === user.id}
                    >
                      {invitingUserId === user.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'Inviter'
                      )}
                    </Button>
                  </div>
                ))
              ) : searchQuery ? (
                <p className="text-center text-gray-500 py-4">Aucun utilisateur trouvé</p>
              ) : (
                <p className="text-center text-gray-500 py-4">Tapez pour rechercher des utilisateurs</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Main Content with Tabs */}
        <div className="lg:col-span-2">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="flex w-full overflow-x-auto">
              <TabsTrigger value="messages" className="flex items-center gap-1 flex-shrink-0 flex-1 sm:flex-initial">
                <MessageCircle className="h-4 w-4" />
                <span className="hidden sm:inline">Messages</span>
              </TabsTrigger>
              <TabsTrigger value="notes" className="flex items-center gap-1 flex-shrink-0 flex-1 sm:flex-initial">
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">Notes</span>
              </TabsTrigger>
              <TabsTrigger value="flashcards" className="flex items-center gap-1 flex-shrink-0 flex-1 sm:flex-initial">
                <CreditCard className="h-4 w-4" />
                <span className="hidden sm:inline">Flashcards</span>
              </TabsTrigger>
              <TabsTrigger value="sessions" className="flex items-center gap-1 flex-shrink-0 flex-1 sm:flex-initial">
                <Zap className="h-4 w-4" />
                <span className="hidden sm:inline">Sessions</span>
              </TabsTrigger>
              <TabsTrigger value="quizzes" className="flex items-center gap-1 flex-shrink-0 flex-1 sm:flex-initial">
                <Brain className="h-4 w-4" />
                <span className="hidden sm:inline">Quiz</span>
              </TabsTrigger>
              <TabsTrigger value="activity" className="flex items-center gap-1 flex-shrink-0 flex-1 sm:flex-initial">
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
          <Card className="h-[350px] sm:h-[500px] lg:h-[600px] flex flex-col">
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
