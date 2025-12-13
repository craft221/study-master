'use client'

import { useState, useEffect } from 'react'
import { CreditCard, Share2, Copy, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import {
  getSharedFlashcards,
  shareFlashcardsWithGroup,
  copySharedFlashcards,
  type SharedFlashcardDeck
} from '@/services/groupContent'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import api from '@/lib/api'

interface GroupFlashcardsTabProps {
  groupId: number
  currentUserId: number
}

interface Deck {
  id: number | string
  title: string
  total_cards: number
}

export default function GroupFlashcardsTab({ groupId, currentUserId }: GroupFlashcardsTabProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [sharedDecks, setSharedDecks] = useState<SharedFlashcardDeck[]>([])
  const [myDecks, setMyDecks] = useState<Deck[]>([])
  const [selectedDeckId, setSelectedDeckId] = useState<string>('')
  const [sharing, setSharing] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [copying, setCopying] = useState<number | null>(null)

  useEffect(() => {
    fetchData()
  }, [groupId])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [decksData, myDecksData] = await Promise.all([
        getSharedFlashcards(groupId),
        api.get('/flashcards/decks')
      ])
      setSharedDecks(decksData)
      setMyDecks(myDecksData.data)
    } catch (error: any) {
      console.error('Error fetching flashcards:', error)
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les flashcards',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleShareDeck = async () => {
    if (!selectedDeckId) return

    try {
      setSharing(true)
      // selectedDeckId is the deck_name (string), not a numeric ID
      await shareFlashcardsWithGroup(groupId, selectedDeckId)

      toast({
        title: 'Deck partagé',
        description: 'Le deck de flashcards a été partagé avec le groupe (+5 XP)',
      })

      setDialogOpen(false)
      setSelectedDeckId('')
      await fetchData()
    } catch (error: any) {
      console.error('Error sharing deck:', error)
      toast({
        title: 'Erreur',
        description: error.response?.data?.detail || 'Impossible de partager le deck',
        variant: 'destructive'
      })
    } finally {
      setSharing(false)
    }
  }

  const handleCopyDeck = async (sharedDeckId: number, deckName: string) => {
    try {
      setCopying(sharedDeckId)
      await copySharedFlashcards(groupId, sharedDeckId)

      toast({
        title: 'Deck copié',
        description: `"${deckName}" a été ajouté à votre collection`,
      })

      await fetchData()
    } catch (error: any) {
      console.error('Error copying deck:', error)
      toast({
        title: 'Erreur',
        description: error.response?.data?.detail || 'Impossible de copier le deck',
        variant: 'destructive'
      })
    } finally {
      setCopying(null)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
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
      {/* Header with Share Button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Flashcards partagés</h3>
          <p className="text-sm text-gray-500">{sharedDecks.length} deck(s) disponible(s)</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Share2 className="h-4 w-4 mr-2" />
              Partager un deck
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Partager un deck</DialogTitle>
              <DialogDescription>
                Sélectionnez un deck de flashcards à partager avec le groupe
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Select value={selectedDeckId} onValueChange={setSelectedDeckId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un deck" />
                </SelectTrigger>
                <SelectContent>
                  {myDecks.map((deck) => (
                    <SelectItem key={deck.id.toString()} value={deck.id.toString()}>
                      {deck.title}
                      <span className="text-xs text-gray-500 ml-2">
                        ({deck.total_cards} cartes)
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={handleShareDeck}
                disabled={!selectedDeckId || sharing}
                className="w-full"
              >
                {sharing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Partage en cours...
                  </>
                ) : (
                  <>
                    <Share2 className="h-4 w-4 mr-2" />
                    Partager
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Shared Decks List */}
      {sharedDecks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CreditCard className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-500">Aucun deck partagé</p>
            <p className="text-sm text-gray-400 mt-1">
              Soyez le premier à partager un deck!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {sharedDecks.map((deck) => (
            <Card key={deck.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <CreditCard className="h-5 w-5 text-purple-600" />
                      <h4 className="font-semibold text-gray-900">{deck.deck_name}</h4>
                      <Badge variant="secondary">{deck.card_count} cartes</Badge>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>Partagé par {deck.shared_by_username}</span>
                      <span>•</span>
                      <span>{formatDate(deck.shared_at)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <Button
                      size="sm"
                      onClick={() => handleCopyDeck(deck.id, deck.deck_name)}
                      disabled={copying === deck.id}
                    >
                      {copying === deck.id ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Copie...
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4 mr-2" />
                          Copier
                        </>
                      )}
                    </Button>
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
