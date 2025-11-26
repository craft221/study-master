'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Users, Plus, Search, Lock, Globe, Crown, MessageCircle, Calendar, Loader2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import api from '@/lib/api'
import { useToast } from '@/hooks/use-toast'

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
    <div className="max-w-6xl mx-auto space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Groupes d'Étude</h1>
          <p className="text-gray-600 mt-1">Collaborez et apprenez ensemble</p>
        </div>

        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-5 w-5 mr-2" />
              Créer un groupe
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Créer un groupe d'étude</DialogTitle>
              <DialogDescription>
                Créez un nouveau groupe pour collaborer avec d'autres étudiants
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nom du groupe *</Label>
                <Input
                  id="name"
                  placeholder="Ex: Préparation Examen Math"
                  value={newGroup.name}
                  onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Décrivez l'objectif du groupe..."
                  value={newGroup.description}
                  onChange={(e) => setNewGroup({ ...newGroup, description: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="subject">Matière (optionnel)</Label>
                <Select
                  value={newGroup.subject_id?.toString() || ''}
                  onValueChange={(value) => setNewGroup({ ...newGroup, subject_id: value ? parseInt(value) : null })}
                >
                  <SelectTrigger id="subject">
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

              <div className="space-y-2">
                <Label htmlFor="max_members">Nombre maximum de membres</Label>
                <Input
                  id="max_members"
                  type="number"
                  min={2}
                  max={100}
                  value={newGroup.max_members}
                  onChange={(e) => setNewGroup({ ...newGroup, max_members: parseInt(e.target.value) || 20 })}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is_private"
                  checked={newGroup.is_private}
                  onCheckedChange={(checked) => setNewGroup({ ...newGroup, is_private: checked as boolean })}
                />
                <Label htmlFor="is_private" className="cursor-pointer">
                  Groupe privé (sur invitation uniquement)
                </Label>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                Annuler
              </Button>
              <Button onClick={handleCreateGroup} disabled={creating}>
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

      {/* Stats */}
      <div className="grid grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-1">{myGroupIds.length}</h3>
            <p className="text-gray-600 text-sm">Mes groupes</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <Globe className="h-6 w-6 text-green-600" />
              </div>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-1">{groups.length}</h3>
            <p className="text-gray-600 text-sm">Groupes disponibles</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Calendar className="h-6 w-6 text-purple-600" />
              </div>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-1">
              {groups.reduce((acc, g) => acc + g.total_study_hours, 0)}
            </h3>
            <p className="text-gray-600 text-sm">Heures d'étude totales</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                type="text"
                placeholder="Rechercher un groupe..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Filter Buttons */}
            <div className="flex gap-2">
              <Button
                variant={filter === 'all' ? 'default' : 'outline'}
                onClick={() => setFilter('all')}
              >
                Tous
              </Button>
              <Button
                variant={filter === 'my_groups' ? 'default' : 'outline'}
                onClick={() => setFilter('my_groups')}
              >
                Mes groupes
              </Button>
              <Button
                variant={filter === 'discover' ? 'default' : 'outline'}
                onClick={() => setFilter('discover')}
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
          <CardContent className="p-12 text-center">
            <Users className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {searchQuery ? 'Aucun groupe trouvé' : 'Aucun groupe disponible'}
            </h3>
            <p className="text-gray-600 mb-6">
              {searchQuery
                ? 'Essayez de modifier votre recherche'
                : 'Créez votre premier groupe pour commencer à collaborer'}
            </p>
            {!searchQuery && (
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="h-5 w-5 mr-2" />
                Créer un groupe
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {filteredGroups.map((group) => {
            const isMember = myGroupIds.includes(group.id)
            const subjectName = subjects.find(s => s.id === group.subject_id)?.name

            return (
              <Card key={group.id} className="hover:shadow-md transition">
                <CardContent className="p-6">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <h3 className="text-xl font-bold text-gray-900">{group.name}</h3>
                        {group.is_private ? (
                          <Lock className="h-4 w-4 text-gray-500" />
                        ) : (
                          <Globe className="h-4 w-4 text-green-500" />
                        )}
                        {isMember && (
                          <span className="px-2 py-1 bg-primary-100 text-primary-700 text-xs font-medium rounded">
                            Membre
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{group.description || 'Pas de description'}</p>
                      {subjectName && (
                        <span className="inline-block px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                          {subjectName}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center justify-between py-4 border-t border-b border-gray-200 mb-4">
                    <div className="flex items-center space-x-2 text-gray-600">
                      <Users className="h-4 w-4" />
                      <span className="text-sm font-medium">
                        {group.current_members}/{group.max_members} membres
                      </span>
                    </div>
                    <div className="flex items-center space-x-2 text-gray-600">
                      <MessageCircle className="h-4 w-4" />
                      <span className="text-sm">{group.total_shared_notes} notes</span>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">
                      Activité: {getTimeAgo(group.updated_at)}
                    </span>
                    {isMember ? (
                      <Link href={`/groups/${group.id}`}>
                        <Button size="sm">Ouvrir</Button>
                      </Link>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleJoinGroup(group.id)}
                        disabled={group.current_members >= group.max_members}
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
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
        <CardContent className="p-6">
          <div className="flex items-start space-x-4">
            <div className="p-3 bg-white rounded-lg shadow-sm">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">
                Pourquoi rejoindre un groupe d'étude?
              </h3>
              <ul className="space-y-1 text-sm text-gray-700">
                <li>• Partagez vos notes et ressources avec d'autres étudiants</li>
                <li>• Posez des questions et obtenez de l'aide rapidement</li>
                <li>• Organisez des sessions d'étude en groupe</li>
                <li>• Motivez-vous mutuellement et progressez ensemble</li>
                <li>• Participez à des défis et compétitions amicales</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
