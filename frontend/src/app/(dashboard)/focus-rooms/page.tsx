'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Users, Plus, Search, Lock, Globe, Clock, Flame,
  Trophy, Filter, ArrowRight, Loader2, Coffee, Book,
  GraduationCap, Briefcase, Code, Heart, Scale, Sparkles,
  Mail, Check, X, UserPlus
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import api from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { useTranslation } from '@/contexts/LanguageContext'
import focusRoomsService, {
  FocusRoom,
  FocusRoomType,
  FocusRoomCategory,
  CreateRoomRequest,
  RoomFilters,
  UserFocusStats,
  FocusRoomInvitation,
  FocusRoomParticipant
} from '@/services/focusRooms'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

interface Subject {
  id: number
  name: string
}

const CATEGORY_ICONS: Record<FocusRoomCategory, any> = {
  general: Book,
  sciences: Sparkles,
  humanities: Book,
  languages: Globe,
  business: Briefcase,
  technology: Code,
  medicine: Heart,
  law: Scale,
  other: Book
}

// Labels are now translated via t() function

const STATUS_COLORS = {
  focusing: 'bg-green-500',
  break: 'bg-yellow-500',
  idle: 'bg-gray-400',
  away: 'bg-red-500'
}

export default function FocusRoomsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'popular' | 'my_rooms'>('all')
  const [categoryFilter, setCategoryFilter] = useState<FocusRoomCategory | 'all'>('all')
  const [rooms, setRooms] = useState<FocusRoom[]>([])
  const [myStats, setMyStats] = useState<UserFocusStats | null>(null)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [currentRoom, setCurrentRoom] = useState<FocusRoomParticipant | null>(null)

  // Create room dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [creating, setCreating] = useState(false)

  // Invite code dialog for private rooms
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [inviteCode, setInviteCode] = useState('')
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null)
  const [joiningRoom, setJoiningRoom] = useState(false)
  const [newRoom, setNewRoom] = useState<CreateRoomRequest>({
    name: '',
    description: '',
    emoji: '📚',
    room_type: 'public',
    category: 'general',
    max_participants: 100,
    is_private: false
  })

  // Invitations reçues
  const [pendingInvitations, setPendingInvitations] = useState<FocusRoomInvitation[]>([])
  const [processingInvitation, setProcessingInvitation] = useState<number | null>(null)

  useEffect(() => {
    fetchData()
  }, [filter, categoryFilter])

  const fetchData = async () => {
    try {
      setLoading(true)

      // Fetch subjects
      const subjectsRes = await api.get('/subjects/')
      setSubjects(subjectsRes.data.subjects || [])

      // Fetch rooms based on filter
      if (filter === 'my_rooms') {
        // Fetch my rooms (created and recently joined)
        const myRooms = await focusRoomsService.getMyRooms()
        setRooms(myRooms || [])
      } else {
        // Fetch rooms with filters
        const filters: RoomFilters = {
          page: 1,
          page_size: 50,
          sort_by: filter === 'popular' ? 'active_participants' : 'created_at',
          sort_order: 'desc'
        }
        if (categoryFilter !== 'all') {
          filters.category = categoryFilter
        }
        if (searchQuery) {
          filters.search = searchQuery
        }

        const roomsData = await focusRoomsService.getRooms(filters)
        setRooms(roomsData.rooms || [])
      }

      // Fetch my stats
      try {
        const stats = await focusRoomsService.getMyStats()
        setMyStats(stats)
      } catch (e) {
        // Stats not available yet
      }

      // Check if user is in a room
      try {
        const current = await focusRoomsService.getCurrentParticipation()
        setCurrentRoom(current)
      } catch (e) {
        // Not in a room
      }

      // Fetch pending invitations
      try {
        const invitations = await focusRoomsService.getMyInvitations()
        setPendingInvitations(invitations.filter(inv => inv.status === 'pending'))
      } catch (e) {
        // No invitations
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      toast({
        title: t('focusRoom.error'),
        description: t('focusRoom.loadError'),
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCreateRoom = async () => {
    if (!newRoom.name.trim()) {
      toast({
        title: t('focusRoom.error'),
        description: t('focusRoom.roomNameRequired'),
        variant: 'destructive'
      })
      return
    }

    try {
      setCreating(true)
      const room = await focusRoomsService.createRoom(newRoom)

      // Log response for debugging
      console.log('[FocusRooms] Room created:', room)

      // Validate room ID before navigation
      if (!room || typeof room.id !== 'number' || isNaN(room.id)) {
        console.error('[FocusRooms] Invalid room response:', room)
        toast({
          title: t('focusRoom.error'),
          description: t('focusRoom.invalidRoomId'),
          variant: 'destructive'
        })
        return
      }

      toast({
        title: t('focusRoom.success'),
        description: t('focusRoom.roomCreated'),
      })

      setCreateDialogOpen(false)
      setNewRoom({
        name: '',
        description: '',
        emoji: '📚',
        room_type: 'public',
        category: 'general',
        max_participants: 100,
        is_private: false
      })

      // Navigate to the room
      router.push(`/focus-rooms/${room.id}`)
    } catch (error: any) {
      console.error('Error creating room:', error)
      toast({
        title: t('focusRoom.error'),
        description: error.response?.data?.detail || t('focusRoom.loadError'),
        variant: 'destructive'
      })
    } finally {
      setCreating(false)
    }
  }

  const handleJoinRoom = async (roomId: number, providedInviteCode?: string) => {
    // Trouver la room pour vérifier si elle est privée
    const room = rooms.find(r => r.id === roomId)

    // Si la room est privée et qu'on n'a pas encore de code, ouvrir le dialogue
    if (room?.is_private && !providedInviteCode) {
      setSelectedRoomId(roomId)
      setInviteCode('')
      setInviteDialogOpen(true)
      return
    }

    try {
      setJoiningRoom(true)
      await focusRoomsService.joinRoom(roomId, providedInviteCode ? { invite_code: providedInviteCode } : undefined)
      setInviteDialogOpen(false)
      router.push(`/focus-rooms/${roomId}`)
    } catch (error: any) {
      console.error('Error joining room:', error)
      const errorMessage = error.response?.data?.error?.message ||
                          error.response?.data?.detail ||
                          t('focusRoom.joinError')

      // Si l'utilisateur est déjà dans une room, le rediriger
      if (errorMessage.includes('already in a room')) {
        toast({
          title: t('focusRoom.alreadyInSession'),
          description: t('focusRoom.alreadyInRoomRedirect'),
        })
        setInviteDialogOpen(false)
        router.push(`/focus-rooms/${roomId}`)
        return
      }

      toast({
        title: t('focusRoom.error'),
        description: errorMessage,
        variant: 'destructive'
      })
    } finally {
      setJoiningRoom(false)
    }
  }

  const handleJoinWithInviteCode = () => {
    if (selectedRoomId && inviteCode.trim()) {
      handleJoinRoom(selectedRoomId, inviteCode.trim())
    }
  }

  const handleAcceptInvitation = async (invitation: FocusRoomInvitation) => {
    try {
      setProcessingInvitation(invitation.id)
      await focusRoomsService.acceptInvitation(invitation.id)
      toast({
        title: t('focusRoom.invitationAccepted'),
        description: t('focusRoom.joiningRoom', { name: invitation.room_name }),
      })
      setPendingInvitations(prev => prev.filter(inv => inv.id !== invitation.id))
      router.push(`/focus-rooms/${invitation.room_id}`)
    } catch (error: any) {
      console.error('Error accepting invitation:', error)
      toast({
        title: t('focusRoom.error'),
        description: error.response?.data?.detail || t('focusRoom.invitationError'),
        variant: 'destructive'
      })
    } finally {
      setProcessingInvitation(null)
    }
  }

  const handleDeclineInvitation = async (invitation: FocusRoomInvitation) => {
    try {
      setProcessingInvitation(invitation.id)
      await focusRoomsService.declineInvitation(invitation.id)
      toast({
        title: t('focusRoom.invitationDeclined'),
      })
      setPendingInvitations(prev => prev.filter(inv => inv.id !== invitation.id))
    } catch (error: any) {
      console.error('Error declining invitation:', error)
      toast({
        title: t('focusRoom.error'),
        description: error.response?.data?.detail || t('focusRoom.invitationError'),
        variant: 'destructive'
      })
    } finally {
      setProcessingInvitation(null)
    }
  }

  const formatMinutes = (minutes: number) => {
    if (minutes < 60) return `${minutes}min`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`
  }

  const filteredRooms = rooms.filter((room) => {
    const matchesSearch =
      room.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (room.description && room.description.toLowerCase().includes(searchQuery.toLowerCase()))
    return matchesSearch
  })

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6 p-3 sm:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{t('focusRoom.title')}</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">{t('focusRoom.subtitle')}</p>
        </div>

        {/* Action buttons - Stack on mobile */}
        <div className="flex flex-col sm:flex-row gap-2">
          {currentRoom && (
            <Link href={`/focus-rooms/${currentRoom.room_id}`} className="w-full sm:w-auto">
              <Button variant="outline" className="gap-2 w-full sm:w-auto justify-center">
                <div className={`w-2 h-2 rounded-full ${STATUS_COLORS[currentRoom.status as keyof typeof STATUS_COLORS]} animate-pulse`} />
                <span className="truncate">{t('focusRoom.returnToSession')}</span>
              </Button>
            </Link>
          )}

          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto justify-center">
                <Plus className="h-5 w-5 mr-2" />
                {t('focusRoom.createRoom')}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto mx-2 sm:mx-auto">
              <DialogHeader>
                <DialogTitle>{t('focusRoom.createFocusRoom')}</DialogTitle>
                <DialogDescription>
                  {t('focusRoom.createDescription')}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                  <div className="space-y-2 flex-1">
                    <Label htmlFor="name">{t('focusRoom.roomName')} *</Label>
                    <Input
                      id="name"
                      placeholder={t('focusRoom.roomNamePlaceholder')}
                      value={newRoom.name}
                      onChange={(e) => setNewRoom({ ...newRoom, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2 w-full sm:w-24">
                    <Label htmlFor="emoji">{t('focusRoom.emoji')}</Label>
                    <Input
                      id="emoji"
                      placeholder="📚"
                      value={newRoom.emoji}
                      onChange={(e) => setNewRoom({ ...newRoom, emoji: e.target.value })}
                      className="text-center text-xl"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">{t('focusRoom.description')}</Label>
                  <Textarea
                    id="description"
                    placeholder={t('focusRoom.descriptionPlaceholder')}
                    value={newRoom.description}
                    onChange={(e) => setNewRoom({ ...newRoom, description: e.target.value })}
                    rows={2}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="room_type">{t('focusRoom.roomType')}</Label>
                    <Select
                      value={newRoom.room_type || 'public'}
                      onValueChange={(value) => setNewRoom({ ...newRoom, room_type: value as FocusRoomType })}
                    >
                      <SelectTrigger id="room_type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="public">{t('focusRoom.roomTypes.public')}</SelectItem>
                        <SelectItem value="subject">{t('focusRoom.roomTypes.subject')}</SelectItem>
                        <SelectItem value="university">{t('focusRoom.roomTypes.university')}</SelectItem>
                        <SelectItem value="private">{t('focusRoom.roomTypes.private')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="category">{t('focusRoom.category')}</Label>
                    <Select
                      value={newRoom.category || 'general'}
                      onValueChange={(value) => setNewRoom({ ...newRoom, category: value as FocusRoomCategory })}
                    >
                      <SelectTrigger id="category">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(['general', 'sciences', 'humanities', 'languages', 'business', 'technology', 'medicine', 'law', 'other'] as FocusRoomCategory[]).map((key) => (
                          <SelectItem key={key} value={key}>{t(`focusRoom.categories.${key}`)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {newRoom.room_type === 'subject' && (
                  <div className="space-y-2">
                    <Label htmlFor="subject">{t('focusRoom.subject')}</Label>
                    <Select
                      value={newRoom.subject_id?.toString() || ''}
                      onValueChange={(value) => setNewRoom({ ...newRoom, subject_id: value ? parseInt(value) : undefined })}
                    >
                      <SelectTrigger id="subject">
                        <SelectValue placeholder={t('focusRoom.selectSubject')} />
                      </SelectTrigger>
                      <SelectContent>
                        {subjects.map(subject => (
                          <SelectItem key={subject.id} value={subject.id.toString()}>
                            {subject.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="max_participants">{t('focusRoom.maxCapacity')}</Label>
                  <Input
                    id="max_participants"
                    type="number"
                    min={10}
                    max={500}
                    value={newRoom.max_participants}
                    onChange={(e) => setNewRoom({ ...newRoom, max_participants: parseInt(e.target.value) || 100 })}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="is_private"
                    checked={newRoom.is_private}
                    onCheckedChange={(checked) => setNewRoom({ ...newRoom, is_private: checked as boolean })}
                  />
                  <Label htmlFor="is_private" className="cursor-pointer">
                    {t('focusRoom.privateRoom')}
                  </Label>
                </div>
              </div>

              <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)} className="w-full sm:w-auto">
                  {t('common.cancel')}
                </Button>
                <Button onClick={handleCreateRoom} disabled={creating} className="w-full sm:w-auto">
                  {creating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {t('focusRoom.creating')}
                    </>
                  ) : (
                    t('focusRoom.createBtn')
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Invite Code Dialog for Private Rooms */}
          <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
            <DialogContent className="max-w-sm mx-2 sm:mx-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5 text-yellow-500" />
                  {t('focusRoom.privateRoomTitle')}
                </DialogTitle>
                <DialogDescription>
                  {t('focusRoom.enterInviteCode')}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="invite_code">{t('focusRoom.inviteCode')}</Label>
                  <Input
                    id="invite_code"
                    placeholder="XXXXXXXX"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    className="text-center font-mono text-lg tracking-widest"
                    maxLength={10}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && inviteCode.trim()) {
                        handleJoinWithInviteCode()
                      }
                    }}
                  />
                </div>
              </div>

              <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setInviteDialogOpen(false)} className="w-full sm:w-auto">
                  {t('common.cancel')}
                </Button>
                <Button
                  onClick={handleJoinWithInviteCode}
                  disabled={joiningRoom || !inviteCode.trim()}
                  className="w-full sm:w-auto"
                >
                  {joiningRoom ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {t('focusRoom.joining')}
                    </>
                  ) : (
                    t('focusRoom.join')
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Pending Invitations */}
      {pendingInvitations.length > 0 && (
        <Card className="border-purple-200 bg-gradient-to-r from-purple-50 to-indigo-50">
          <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-6">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <Mail className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600" />
              {t('focusRoom.pendingInvitations')} ({pendingInvitations.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            <div className="space-y-3">
              {pendingInvitations.map((invitation) => (
                <div
                  key={invitation.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-white rounded-lg shadow-sm"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xl sm:text-2xl flex-shrink-0">{invitation.room_emoji}</span>
                    <div className="min-w-0">
                      <h4 className="font-semibold text-gray-900 text-sm sm:text-base truncate">{invitation.room_name}</h4>
                      <p className="text-xs sm:text-sm text-gray-600">
                        {t('focusRoom.invitedBy', { username: invitation.inviter_username })}
                      </p>
                      {invitation.message && (
                        <p className="text-xs text-gray-500 italic mt-1 line-clamp-1">"{invitation.message}"</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDeclineInvitation(invitation)}
                      disabled={processingInvitation === invitation.id}
                    >
                      {processingInvitation === invitation.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <X className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleAcceptInvitation(invitation)}
                      disabled={processingInvitation === invitation.id}
                      className="gap-1"
                    >
                      {processingInvitation === invitation.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Check className="h-4 w-4" />
                          <span className="hidden sm:inline">{t('focusRoom.accept')}</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-green-100 rounded-lg flex-shrink-0">
                <Users className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
              </div>
              <div className="min-w-0">
                <p className="text-lg sm:text-2xl font-bold text-gray-900">
                  {rooms.reduce((acc, r) => acc + r.active_participants, 0)}
                </p>
                <p className="text-[10px] sm:text-xs text-gray-600 truncate">{t('focusRoom.onlineNow')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-blue-100 rounded-lg flex-shrink-0">
                <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
              </div>
              <div className="min-w-0">
                <p className="text-lg sm:text-2xl font-bold text-gray-900">
                  {formatMinutes(myStats?.total_focus_room_minutes || 0)}
                </p>
                <p className="text-[10px] sm:text-xs text-gray-600 truncate">{t('focusRoom.myTotalTime')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-orange-100 rounded-lg flex-shrink-0">
                <Flame className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600" />
              </div>
              <div className="min-w-0">
                <p className="text-lg sm:text-2xl font-bold text-gray-900">
                  {myStats?.focus_room_streak_days || 0}
                </p>
                <p className="text-[10px] sm:text-xs text-gray-600 truncate">{t('focusRoom.streakDays')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-purple-100 rounded-lg flex-shrink-0">
                <Trophy className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600" />
              </div>
              <div className="min-w-0">
                <p className="text-lg sm:text-2xl font-bold text-gray-900">
                  {(myStats?.total_xp_earned || 0) + (myStats?.total_xp_bonus || 0)}
                </p>
                <p className="text-[10px] sm:text-xs text-gray-600 truncate">{t('focusRoom.xpEarned')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col gap-3 sm:gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
              <Input
                type="text"
                placeholder={t('focusRoom.searchRoom')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 sm:pl-10 text-sm sm:text-base"
              />
            </div>

            {/* Filters row */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              {/* Category Filter */}
              <Select
                value={categoryFilter}
                onValueChange={(value) => setCategoryFilter(value as FocusRoomCategory | 'all')}
              >
                <SelectTrigger className="w-full sm:w-[180px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder={t('focusRoom.category')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('focusRoom.allCategories')}</SelectItem>
                  {(['general', 'sciences', 'humanities', 'languages', 'business', 'technology', 'medicine', 'law', 'other'] as FocusRoomCategory[]).map((key) => (
                    <SelectItem key={key} value={key}>{t(`focusRoom.categories.${key}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Sort Filter - Scrollable on mobile */}
              <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0 -mx-1 px-1 sm:mx-0 sm:px-0">
                <Button
                  variant={filter === 'all' ? 'default' : 'outline'}
                  onClick={() => setFilter('all')}
                  size="sm"
                  className="flex-shrink-0 text-xs sm:text-sm"
                >
                  {t('focusRoom.recent')}
                </Button>
                <Button
                  variant={filter === 'popular' ? 'default' : 'outline'}
                  onClick={() => setFilter('popular')}
                  size="sm"
                  className="flex-shrink-0 text-xs sm:text-sm"
                >
                  {t('focusRoom.popular')}
                </Button>
                <Button
                  variant={filter === 'my_rooms' ? 'default' : 'outline'}
                  onClick={() => setFilter('my_rooms')}
                  size="sm"
                  className="flex-shrink-0 text-xs sm:text-sm"
                >
                  {t('focusRoom.myRooms')}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rooms Grid */}
      {filteredRooms.length === 0 ? (
        <Card>
          <CardContent className="p-6 sm:p-12 text-center">
            <Users className="h-12 w-12 sm:h-16 sm:w-16 text-gray-400 mx-auto mb-3 sm:mb-4" />
            <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">
              {searchQuery ? t('focusRoom.noRoomFound') : t('focusRoom.noRoomAvailable')}
            </h3>
            <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6">
              {searchQuery
                ? t('focusRoom.modifySearch')
                : t('focusRoom.createFirstRoom')}
            </p>
            {!searchQuery && (
              <Button onClick={() => setCreateDialogOpen(true)} className="w-full sm:w-auto">
                <Plus className="h-5 w-5 mr-2" />
                {t('focusRoom.createRoom')}
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {filteredRooms.map((room) => {
            const CategoryIcon = CATEGORY_ICONS[room.category] || Book
            const isFull = room.active_participants >= room.max_participants

            return (
              <Card key={room.id} className="hover:shadow-lg transition group cursor-pointer active:scale-[0.98]" onClick={() => handleJoinRoom(room.id)}>
                <CardContent className="p-3 sm:p-5">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-2 sm:mb-3">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                      <span className="text-2xl sm:text-3xl flex-shrink-0">{room.emoji}</span>
                      <div className="min-w-0">
                        <h3 className="font-bold text-sm sm:text-base text-gray-900 group-hover:text-primary transition truncate">
                          {room.name}
                        </h3>
                        <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5 sm:mt-1">
                          <Badge variant="secondary" className="text-[10px] sm:text-xs px-1.5 sm:px-2">
                            {t(`focusRoom.categories.${room.category}`)}
                          </Badge>
                          {room.is_private ? (
                            <Lock className="h-3 w-3 text-gray-500 flex-shrink-0" />
                          ) : (
                            <Globe className="h-3 w-3 text-green-500 flex-shrink-0" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {room.description && (
                    <p className="text-xs sm:text-sm text-gray-600 mb-2 sm:mb-3 line-clamp-2">{room.description}</p>
                  )}

                  {/* Stats Row */}
                  <div className="flex items-center justify-between py-2 sm:py-3 border-t border-gray-100">
                    <div className="flex items-center gap-2 sm:gap-4">
                      <div className="flex items-center gap-1 sm:gap-1.5">
                        <div className="flex -space-x-1">
                          {[...Array(Math.min(room.active_participants, 3))].map((_, i) => (
                            <div
                              key={i}
                              className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-gradient-to-br from-green-400 to-green-600 border-2 border-white flex items-center justify-center"
                            >
                              <span className="text-[8px] sm:text-[10px] text-white font-medium">
                                {String.fromCharCode(65 + i)}
                              </span>
                            </div>
                          ))}
                        </div>
                        <span className="text-xs sm:text-sm font-medium text-gray-900">
                          {room.active_participants}
                        </span>
                        <span className="text-[10px] sm:text-xs text-gray-500">
                          /{room.max_participants}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 text-gray-600">
                        <Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                        <span className="text-[10px] sm:text-xs">{formatMinutes(room.today_focus_minutes)}</span>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant={isFull ? "outline" : "default"}
                      disabled={isFull}
                      className="gap-1 text-xs sm:text-sm h-7 sm:h-8 px-2 sm:px-3"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleJoinRoom(room.id)
                      }}
                    >
                      {isFull ? t('focusRoom.full') : t('focusRoom.join')}
                      {!isFull && <ArrowRight className="h-3 w-3" />}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Info Section */}
      <Card className="bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
            <div className="p-2 sm:p-3 bg-white rounded-lg shadow-sm flex-shrink-0">
              <Users className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-sm sm:text-base text-gray-900 mb-1.5 sm:mb-2">
                {t('focusRoom.bodyDoublingTitle')}
              </h3>
              <p className="text-xs sm:text-sm text-gray-700 mb-2 sm:mb-3">
                {t('focusRoom.bodyDoublingDesc')}
              </p>
              <ul className="space-y-1 text-xs sm:text-sm text-gray-700">
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full flex-shrink-0" />
                  {t('focusRoom.xpBonus')}
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full flex-shrink-0" />
                  {t('focusRoom.milestones')}
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-purple-500 rounded-full flex-shrink-0" />
                  {t('focusRoom.streakBonus')}
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
