'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Users, Send, Settings, LogOut, Shield, Crown, User as UserIcon, Loader2, ArrowLeft, MessageCircle, FileText, CreditCard, Zap, Brain, Activity } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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

interface Message {
  id: number
  group_id: number
  user_id: number
  username: string
  avatar_url: string | null
  content: string
  is_edited: boolean
  created_at: string
  updated_at: string
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
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState('messages')

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchGroupData()
    fetchCurrentUser()

    // Poll messages every 5 seconds
    const interval = setInterval(fetchMessages, 5000)
    return () => clearInterval(interval)
  }, [groupId])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

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
      await fetchMessages()
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

  const fetchMessages = async () => {
    try {
      const response = await api.get(`/study-groups/${groupId}/messages`, {
        params: { page: 1, page_size: 100 }
      })
      // Reverse to show oldest first
      setMessages(response.data.messages.reverse())
    } catch (error) {
      console.error('Error fetching messages:', error)
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!newMessage.trim()) return

    try {
      setSending(true)
      await api.post(`/study-groups/${groupId}/messages`, {
        content: newMessage
      })

      setNewMessage('')
      await fetchMessages()

      toast({
        title: 'Message envoyé',
        description: '+2 XP',
      })
    } catch (error: any) {
      console.error('Error sending message:', error)
      toast({
        title: 'Erreur',
        description: error.response?.data?.detail || 'Impossible d\'envoyer le message',
        variant: 'destructive'
      })
    } finally {
      setSending(false)
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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const formatMessageTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)

    if (diffMins < 1) return 'À l\'instant'
    if (diffMins < 60) return `Il y a ${diffMins} min`
    if (diffHours < 24) return `Il y a ${diffHours}h`
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
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
              <Card className="h-[600px] flex flex-col">
                <CardContent className="flex-1 flex flex-col p-0">
                  {/* Messages */}
                  <div
                    ref={messagesContainerRef}
                    className="flex-1 overflow-y-auto p-4 space-y-4"
                  >
                    {messages.length === 0 ? (
                      <div className="text-center text-gray-500 py-12">
                        <MessageCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p>Aucun message pour le moment</p>
                        <p className="text-sm">Soyez le premier à démarrer la conversation!</p>
                      </div>
                    ) : (
                      messages.map((message) => {
                        const isOwnMessage = message.user_id === currentUserId

                        return (
                          <div
                            key={message.id}
                            className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                          >
                            <div className={`max-w-[70%] ${isOwnMessage ? 'order-2' : 'order-1'}`}>
                              {!isOwnMessage && (
                                <div className="flex items-center mb-1">
                                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-xs mr-2">
                                    {message.username.charAt(0).toUpperCase()}
                                  </div>
                                  <span className="text-xs font-medium text-gray-700">
                                    {message.username}
                                  </span>
                                </div>
                              )}
                              <div
                                className={`rounded-lg px-4 py-2 ${
                                  isOwnMessage
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-100 text-gray-900'
                                }`}
                              >
                                <p className="text-sm whitespace-pre-wrap break-words">
                                  {message.content}
                                </p>
                                <div className="flex items-center justify-between mt-1 text-xs opacity-70">
                                  <span>{formatMessageTime(message.created_at)}</span>
                                  {message.is_edited && <span className="ml-2">(modifié)</span>}
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Message Input */}
                  <div className="border-t p-4">
                    <form onSubmit={handleSendMessage} className="flex gap-2">
                      <Textarea
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Écrivez votre message..."
                        className="resize-none"
                        rows={2}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            handleSendMessage(e)
                          }
                        }}
                      />
                      <Button
                        type="submit"
                        disabled={sending || !newMessage.trim()}
                        size="icon"
                        className="self-end"
                      >
                        {sending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </Button>
                    </form>
                    <p className="text-xs text-gray-500 mt-2">
                      Appuyez sur Entrée pour envoyer, Shift + Entrée pour une nouvelle ligne
                    </p>
                  </div>
                </CardContent>
              </Card>
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
                <span className="text-gray-600">Messages</span>
                <span className="font-semibold">{messages.length}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
