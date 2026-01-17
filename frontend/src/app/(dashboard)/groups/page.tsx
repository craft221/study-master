'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Users, Plus, Search, Lock, Globe, Crown, MessageCircle, Calendar, Loader2, Mail, Check, X } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import api from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import studyGroupsService, { StudyGroupInvitation } from '@/services/studyGroups'

interface Group {
  id: number
  name: string
  description: string
  is_private: boolean
  current_members: number
  max_members: number
  creator_id: number
  subject_id: number | null
  university: string | null
  promotion: string | null
  created_at: string
  updated_at: string
  total_study_hours: number
  total_shared_notes: number
}

interface Subject {
  id: number
  name: string
}

interface CreateGroupData {
  name: string
  description: string
  subject_id: number | null
  max_members: number
  is_private: boolean
}

export default function GroupsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'my_groups' | 'discover'>('all')
  const [groups, setGroups] = useState<Group[]>([])
  const [myGroupIds, setMyGroupIds] = useState<number[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])

  // Create group dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newGroup, setNewGroup] = useState<CreateGroupData>({
    name: '',
    description: '',
    subject_id: null,
    max_members: 20,
    is_private: false
  })

  // Pending invitations
  const [pendingInvitations, setPendingInvitations] = useState<StudyGroupInvitation[]>([])
  const [processingInvitation, setProcessingInvitation] = useState<number | null>(null)

  useEffect(() => {
    fetchData()
  }, [filter])

  const fetchData = async () => {
    try {
      setLoading(true)

      // Fetch subjects
      const subjectsRes = await api.get('/subjects/')
      setSubjects(subjectsRes.data.subjects || [])

      // Fetch groups based on filter
      const params: any = {}
      if (filter === 'my_groups') {
        params.only_my_groups = true
      }

      const groupsRes = await api.get('/study-groups/', { params })
      setGroups(groupsRes.data.groups || [])

      // Fetch my groups to mark membership
      const myGroupsRes = await api.get('/study-groups/', { params: { only_my_groups: true } })
      const myIds = (myGroupsRes.data.groups || []).map((g: Group) => g.id)
      setMyGroupIds(myIds)

      // Fetch pending invitations
      try {
        const invitations = await studyGroupsService.getMyInvitations()
        setPendingInvitations(invitations)
      } catch (err) {
        console.error('Error fetching invitations:', err)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les groupes',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCreateGroup = async () => {
    if (!newGroup.name.trim()) {
      toast({
        title: 'Erreur',
        description: 'Le nom du groupe est requis',
        variant: 'destructive'
      })
      return
    }

    try {
      setCreating(true)
      await api.post('/study-groups/', newGroup)

      toast({
        title: 'Succès',
        description: 'Groupe créé avec succès (+50 XP)',
      })

      setCreateDialogOpen(false)
      setNewGroup({
        name: '',
        description: '',
        subject_id: null,
        max_members: 20,
        is_private: false
      })

      fetchData()
    } catch (error: any) {
      console.error('Error creating group:', error)
      toast({
        title: 'Erreur',
        description: error.response?.data?.detail || 'Impossible de créer le groupe',
        variant: 'destructive'
      })
    } finally {
      setCreating(false)
    }
  }

  const handleJoinGroup = async (groupId: number) => {
    try {
      await api.post(`/study-groups/${groupId}/join`)

      toast({
        title: 'Succès',
        description: 'Vous avez rejoint le groupe (+10 XP)',
      })

      fetchData()
    } catch (error: any) {
      console.error('Error joining group:', error)
      toast({
        title: 'Erreur',
        description: error.response?.data?.detail || 'Impossible de rejoindre le groupe',
        variant: 'destructive'
      })
    }
  }

  const handleAcceptInvitation = async (invitation: StudyGroupInvitation) => {
    try {
      setProcessingInvitation(invitation.id)
      await studyGroupsService.acceptInvitation(invitation.id)

      toast({
        title: 'Invitation acceptée',
        description: `Vous rejoignez ${invitation.group_name}...`,
      })

      setPendingInvitations(prev => prev.filter(inv => inv.id !== invitation.id))

      // Redirect to group page
      router.push(`/groups/${invitation.group_id}`)
    } catch (error: any) {
      console.error('Error accepting invitation:', error)
      toast({
        title: 'Erreur',
        description: error.response?.data?.detail || 'Erreur lors du traitement de l\'invitation',
        variant: 'destructive'
      })
    } finally {
      setProcessingInvitation(null)
    }
  }

  const handleDeclineInvitation = async (invitation: StudyGroupInvitation) => {
    try {
      setProcessingInvitation(invitation.id)
      await studyGroupsService.declineInvitation(invitation.id)

      toast({
        title: 'Invitation refusée',
        description: 'L\'invitation a été refusée',
      })

      setPendingInvitations(prev => prev.filter(inv => inv.id !== invitation.id))
    } catch (error: any) {
      console.error('Error declining invitation:', error)
      toast({
        title: 'Erreur',
        description: error.response?.data?.detail || 'Erreur lors du traitement de l\'invitation',
        variant: 'destructive'
      })
    } finally {
      setProcessingInvitation(null)
    }
  }

  const filteredGroups = groups.filter((group) => {
    const matchesSearch =
      group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (group.description && group.description.toLowerCase().includes(searchQuery.toLowerCase()))

    if (filter === 'my_groups') {
      return matchesSearch && myGroupIds.includes(group.id)
    } else if (filter === 'discover') {
      return matchesSearch && !myGroupIds.includes(group.id)
    }
    return matchesSearch
  })

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 60) return `Il y a ${diffMins} min`
    if (diffHours < 24) return `Il y a ${diffHours}h`
    if (diffDays < 7) return `Il y a ${diffDays}j`
    return date.toLocaleDateString('fr-FR')
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

  return (
    <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">Groupes d'Étude</h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">Collaborez et apprenez ensemble</p>
        </div>

        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto">
              <Plus className="h-5 w-5 mr-2" />
              Créer un groupe
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl">Créer un groupe</DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                Créez un groupe pour collaborer avec d'autres étudiants
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 sm:space-y-4">
              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="name" className="text-sm">Nom du groupe *</Label>
                <Input
                  id="name"
                  placeholder="Ex: Préparation Examen Math"
                  value={newGroup.name}
                  onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })}
                  className="text-sm sm:text-base"
                />
              </div>

              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="description" className="text-sm">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Décrivez l'objectif du groupe..."
                  value={newGroup.description}
                  onChange={(e) => setNewGroup({ ...newGroup, description: e.target.value })}
                  rows={2}
                  className="text-sm sm:text-base resize-none"
                />
              </div>

              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="subject" className="text-sm">Matière (optionnel)</Label>
                <Select
                  value={newGroup.subject_id?.toString() || ''}
                  onValueChange={(value) => setNewGroup({ ...newGroup, subject_id: value ? parseInt(value) : null })}
                >
                  <SelectTrigger id="subject" className="text-sm sm:text-base">
                    <SelectValue placeholder="Sélectionner une matière" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Aucune matière</SelectItem>
                    {subjects.map(subject => (
                      <SelectItem key={subject.id} value={subject.id.toString()}>
                        {subject.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="max_members" className="text-sm">Max. membres</Label>
                <Input
                  id="max_members"
                  type="number"
                  min={2}
                  max={100}
                  value={newGroup.max_members}
                  onChange={(e) => setNewGroup({ ...newGroup, max_members: parseInt(e.target.value) || 20 })}
                  className="text-sm sm:text-base"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is_private"
                  checked={newGroup.is_private}
                  onCheckedChange={(checked) => setNewGroup({ ...newGroup, is_private: checked as boolean })}
                />
                <Label htmlFor="is_private" className="cursor-pointer text-xs sm:text-sm">
                  Groupe privé (sur invitation)
                </Label>
              </div>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)} className="w-full sm:w-auto order-2 sm:order-1">
                Annuler
              </Button>
              <Button onClick={handleCreateGroup} disabled={creating} className="w-full sm:w-auto order-1 sm:order-2">
                {creating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Création...
                  </>
                ) : (
                  'Créer le groupe'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Pending Invitations */}
      {pendingInvitations.length > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-2 px-4 sm:px-6">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <Mail className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              Invitations ({pendingInvitations.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 sm:px-6">
            <div className="space-y-3">
              {pendingInvitations.map((invitation) => (
                <div
                  key={invitation.id}
                  className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 bg-background rounded-lg shadow-sm"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Avatar className="h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0">
                      <AvatarImage src={invitation.inviter_avatar || undefined} />
                      <AvatarFallback>{invitation.inviter_username.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground truncate">{invitation.group_name}</p>
                      <p className="text-xs sm:text-sm text-muted-foreground truncate">
                        Invité par {invitation.inviter_username}
                      </p>
                      {invitation.message && (
                        <p className="text-xs text-muted-foreground italic truncate">"{invitation.message}"</p>
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
                      <X className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleAcceptInvitation(invitation)}
                      disabled={processingInvitation === invitation.id}
                    >
                      {processingInvitation === invitation.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4 md:gap-6">
        <Card>
          <CardContent className="p-3 sm:p-4 md:p-6">
            <div className="flex items-center justify-center sm:justify-start mb-2 sm:mb-4">
              <div className="p-2 sm:p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Users className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-foreground text-center sm:text-left">{myGroupIds.length}</h3>
            <p className="text-muted-foreground text-xs sm:text-sm text-center sm:text-left truncate">Mes groupes</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 sm:p-4 md:p-6">
            <div className="flex items-center justify-center sm:justify-start mb-2 sm:mb-4">
              <div className="p-2 sm:p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <Globe className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-foreground text-center sm:text-left">{groups.length}</h3>
            <p className="text-muted-foreground text-xs sm:text-sm text-center sm:text-left truncate">Disponibles</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 sm:p-4 md:p-6">
            <div className="flex items-center justify-center sm:justify-start mb-2 sm:mb-4">
              <div className="p-2 sm:p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <Calendar className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-foreground text-center sm:text-left">
              {groups.reduce((acc, g) => acc + g.total_study_hours, 0)}
            </h3>
            <p className="text-muted-foreground text-xs sm:text-sm text-center sm:text-left truncate">Heures</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Rechercher..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 sm:pl-10 text-sm sm:text-base"
              />
            </div>

            {/* Filter Buttons - Scrollable on mobile */}
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
              <Button
                variant={filter === 'all' ? 'default' : 'outline'}
                onClick={() => setFilter('all')}
                size="sm"
                className="flex-shrink-0 text-xs sm:text-sm"
              >
                Tous
              </Button>
              <Button
                variant={filter === 'my_groups' ? 'default' : 'outline'}
                onClick={() => setFilter('my_groups')}
                size="sm"
                className="flex-shrink-0 text-xs sm:text-sm whitespace-nowrap"
              >
                Mes groupes
              </Button>
              <Button
                variant={filter === 'discover' ? 'default' : 'outline'}
                onClick={() => setFilter('discover')}
                size="sm"
                className="flex-shrink-0 text-xs sm:text-sm"
              >
                Découvrir
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Groups List */}
      {filteredGroups.length === 0 ? (
        <Card>
          <CardContent className="p-8 sm:p-12 text-center">
            <Users className="h-12 w-12 sm:h-16 sm:w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg sm:text-xl font-semibold text-foreground mb-2">
              {searchQuery ? 'Aucun groupe trouvé' : 'Aucun groupe disponible'}
            </h3>
            <p className="text-sm sm:text-base text-muted-foreground mb-6">
              {searchQuery
                ? 'Essayez de modifier votre recherche'
                : 'Créez votre premier groupe pour commencer'}
            </p>
            {!searchQuery && (
              <Button onClick={() => setCreateDialogOpen(true)} className="w-full sm:w-auto">
                <Plus className="h-5 w-5 mr-2" />
                Créer un groupe
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {filteredGroups.map((group) => {
            const isMember = myGroupIds.includes(group.id)
            const subjectName = subjects.find(s => s.id === group.subject_id)?.name

            return (
              <Card key={group.id} className="hover:shadow-md transition">
                <CardContent className="p-4 sm:p-6">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3 sm:mb-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center flex-wrap gap-1.5 sm:gap-2 mb-2">
                        <h3 className="text-base sm:text-xl font-bold text-foreground truncate max-w-[180px] sm:max-w-none">
                          {group.name}
                        </h3>
                        {group.is_private ? (
                          <Lock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
                        ) : (
                          <Globe className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-500 flex-shrink-0" />
                        )}
                        {isMember && (
                          <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-primary/10 text-primary text-[10px] sm:text-xs font-medium rounded flex-shrink-0">
                            Membre
                          </span>
                        )}
                      </div>
                      <p className="text-xs sm:text-sm text-muted-foreground mb-2 line-clamp-2">
                        {group.description || 'Pas de description'}
                      </p>
                      {subjectName && (
                        <span className="inline-block px-1.5 sm:px-2 py-0.5 sm:py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-[10px] sm:text-xs font-medium rounded">
                          {subjectName}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center justify-between py-3 sm:py-4 border-t border-b border-border mb-3 sm:mb-4">
                    <div className="flex items-center space-x-1.5 sm:space-x-2 text-muted-foreground">
                      <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      <span className="text-xs sm:text-sm font-medium">
                        {group.current_members}/{group.max_members}
                      </span>
                    </div>
                    <div className="flex items-center space-x-1.5 sm:space-x-2 text-muted-foreground">
                      <MessageCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      <span className="text-xs sm:text-sm">{group.total_shared_notes} notes</span>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] sm:text-xs text-muted-foreground truncate">
                      {getTimeAgo(group.updated_at)}
                    </span>
                    {isMember ? (
                      <Link href={`/groups/${group.id}`}>
                        <Button size="sm" className="text-xs sm:text-sm h-8 sm:h-9">Ouvrir</Button>
                      </Link>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleJoinGroup(group.id)}
                        disabled={group.current_members >= group.max_members}
                        className="text-xs sm:text-sm h-8 sm:h-9"
                      >
                        {group.current_members >= group.max_members ? 'Complet' : 'Rejoindre'}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Info Section */}
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 border-blue-200 dark:border-blue-800">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
            <div className="p-2 sm:p-3 bg-background rounded-lg shadow-sm flex-shrink-0">
              <Users className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-foreground mb-2 text-sm sm:text-base">
                Pourquoi rejoindre un groupe ?
              </h3>
              <ul className="space-y-1 text-xs sm:text-sm text-muted-foreground">
                <li>• Partagez vos notes et ressources</li>
                <li>• Posez des questions et obtenez de l'aide</li>
                <li>• Organisez des sessions d'étude</li>
                <li>• Motivez-vous mutuellement</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
