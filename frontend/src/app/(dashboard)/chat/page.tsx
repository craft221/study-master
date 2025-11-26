'use client'

import { useState, useEffect, useRef } from 'react'
import { Send, Bot, User as UserIcon, Database, Sparkles, FileText, X, Check, Loader2 } from 'lucide-react'
import api from '@/lib/api'
import { toast } from 'react-hot-toast'
import MarkdownRenderer from '@/components/MarkdownRenderer'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp?: string
}

interface Note {
  id: number
  title: string
  subject: string
  content: string
  is_indexed?: boolean
}

interface RagStats {
  indexed_notes: number
  total_chunks: number
  last_indexed: string | null
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [ragStats, setRagStats] = useState<RagStats | null>(null)
  const [showNoteSelector, setShowNoteSelector] = useState(false)
  const [availableNotes, setAvailableNotes] = useState<Note[]>([])
  const [selectedNotes, setSelectedNotes] = useState<number[]>([])
  const [loadingNotes, setLoadingNotes] = useState(false)
  const [indexingNotes, setIndexingNotes] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchRagStats()
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const fetchRagStats = async () => {
    try {
      const response = await api.get('/ai/rag/stats')
      setRagStats(response.data)
    } catch (error) {
      console.error('Erreur lors du chargement des stats RAG')
    }
  }

  const fetchUserNotes = async () => {
    setLoadingNotes(true)
    try {
      const response = await api.get('/notes/')
      setAvailableNotes(response.data.notes || [])
    } catch (error: any) {
      toast.error('Erreur lors du chargement des notes')
    } finally {
      setLoadingNotes(false)
    }
  }

  const handleOpenNoteSelector = () => {
    setShowNoteSelector(true)
    fetchUserNotes()
  }

  const handleToggleNote = (noteId: number) => {
    setSelectedNotes(prev =>
      prev.includes(noteId)
        ? prev.filter(id => id !== noteId)
        : [...prev, noteId]
    )
  }

  const handleToggleAll = () => {
    if (selectedNotes.length === availableNotes.length) {
      setSelectedNotes([])
    } else {
      setSelectedNotes(availableNotes.map(note => note.id))
    }
  }

  const handleIndexSelectedNotes = async () => {
    if (selectedNotes.length === 0) {
      toast.error('Sélectionne au moins une note')
      return
    }

    setIndexingNotes(true)
    try {
      for (const noteId of selectedNotes) {
        await api.post(`/ai/index-note/${noteId}`)
      }
      toast.success(`${selectedNotes.length} note(s) indexée(s) avec succès!`)
      setShowNoteSelector(false)
      setSelectedNotes([])
      fetchRagStats()
    } catch (error: any) {
      toast.error('Erreur lors de l\'indexation des notes')
    } finally {
      setIndexingNotes(false)
    }
  }

  const handleSendMessage = async () => {
    if (!input.trim() || loading) return

    const userMessage: Message = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      const response = await api.post('/ai/chat', {
        message: input.trim(),
        conversation_history: messages.map(m => ({
          role: m.role,
          content: m.content
        }))
      })

      const assistantMessage: Message = {
        role: 'assistant',
        content: response.data.response,
        timestamp: new Date().toISOString()
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Erreur lors de l\'envoi du message')

      // Ajouter un message d'erreur de l'assistant
      const errorMessage: Message = {
        role: 'assistant',
        content: "Désolé, une erreur s'est produite. Vérifie que tes notes sont indexées et réessaie.",
        timestamp: new Date().toISOString()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  return (
    <div className="max-w-5xl mx-auto h-[calc(100vh-12rem)] flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 dark:from-purple-800 dark:to-blue-800 rounded-t-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-white/20 rounded-lg">
              <Bot className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Assistant IA Conversationnel</h1>
              <p className="text-purple-100 text-sm">Pose tes questions sur tes notes</p>
            </div>
          </div>

          <div className="text-right">
            <div className="text-sm opacity-90">Notes indexées</div>
            <div className="text-3xl font-bold">{ragStats?.indexed_notes || 0}</div>
          </div>
        </div>

        {/* RAG Stats */}
        <div className="mt-4 flex items-center justify-between bg-white/10 rounded-lg p-3">
          <div className="flex items-center space-x-2">
            <Database className="h-5 w-5" />
            <span className="text-sm">
              {ragStats?.total_chunks || 0} fragments •
              {ragStats?.indexed_notes || 0} notes
            </span>
          </div>

          <button
            onClick={handleOpenNoteSelector}
            className="px-4 py-2 bg-white text-purple-600 rounded-lg hover:bg-purple-50 transition font-medium text-sm flex items-center space-x-2"
          >
            <FileText className="h-4 w-4" />
            <span>Indexer des notes</span>
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900 p-6 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="p-6 bg-purple-100 dark:bg-purple-900/30 rounded-full mb-4">
              <Sparkles className="h-12 w-12 text-purple-600 dark:text-purple-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Commence une conversation
            </h2>
            <p className="text-gray-600 dark:text-gray-400 max-w-md">
              Pose des questions sur tes notes. L'IA utilisera tes notes indexées pour te répondre de manière précise et contextualisée.
            </p>

            {(!ragStats || ragStats.indexed_notes === 0) && (
              <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg max-w-md">
                <p className="text-yellow-800 dark:text-yellow-200 text-sm">
                  👆 Indexe tes notes d'abord !
                </p>
                <button
                  onClick={handleOpenNoteSelector}
                  className="mt-2 text-yellow-600 dark:text-yellow-400 hover:underline text-sm font-medium"
                >
                  → Sélectionne les notes à indexer
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex items-start space-x-3 ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {message.role === 'assistant' && (
                  <div className="flex-shrink-0 p-2 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
                    <Bot className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                )}

                <div
                  className={`max-w-3xl rounded-lg px-4 py-3 ${
                    message.role === 'user'
                      ? 'bg-purple-600 dark:bg-purple-700 text-white'
                      : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700'
                  }`}
                >
                  {message.role === 'user' ? (
                    <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                  ) : (
                    <MarkdownRenderer content={message.content} className="text-sm" />
                  )}
                </div>

                {message.role === 'user' && (
                  <div className="flex-shrink-0 p-2 bg-purple-600 dark:bg-purple-700 rounded-lg">
                    <UserIcon className="h-5 w-5 text-white" />
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 p-2 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
                  <Bot className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg px-4 py-3 border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center space-x-2 text-gray-500 dark:text-gray-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">L'assistant réfléchit...</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input Area */}
      <div className="bg-white dark:bg-gray-800 rounded-b-xl p-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Pose une question sur tes notes..."
            className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 dark:text-gray-100"
            disabled={loading}
          />
          <button
            onClick={handleSendMessage}
            disabled={loading || !input.trim()}
            className="px-6 py-3 bg-purple-600 dark:bg-purple-700 text-white rounded-lg hover:bg-purple-700 dark:hover:bg-purple-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </button>
        </div>

        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          Appuie sur Entrée pour envoyer • Shift + Entrée pour une nouvelle ligne
        </p>
      </div>

      {/* Note Selector Modal */}
      {showNoteSelector && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Sélectionne les notes à indexer
              </h2>
              <button
                onClick={() => setShowNoteSelector(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
              >
                <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {loadingNotes ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-purple-600 dark:text-purple-400" />
                </div>
              ) : availableNotes.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 text-gray-400 dark:text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-600 dark:text-gray-400">Aucune note disponible</p>
                </div>
              ) : (
                <>
                  <div className="mb-4 flex items-center justify-between">
                    <button
                      onClick={handleToggleAll}
                      className="text-sm text-purple-600 dark:text-purple-400 hover:underline font-medium"
                    >
                      {selectedNotes.length === availableNotes.length
                        ? 'Tout désélectionner'
                        : 'Tout sélectionner'}
                    </button>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {selectedNotes.length} / {availableNotes.length} sélectionnée(s)
                    </span>
                  </div>

                  <div className="space-y-2">
                    {availableNotes.map((note) => (
                      <div
                        key={note.id}
                        onClick={() => handleToggleNote(note.id)}
                        className={`p-4 border-2 rounded-lg cursor-pointer transition ${
                          selectedNotes.includes(note.id)
                            ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                            : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-600'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-3 flex-1">
                            <div
                              className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center ${
                                selectedNotes.includes(note.id)
                                  ? 'bg-purple-600 border-purple-600'
                                  : 'border-gray-300 dark:border-gray-600'
                              }`}
                            >
                              {selectedNotes.includes(note.id) && (
                                <Check className="h-3 w-3 text-white" />
                              )}
                            </div>
                            <div className="flex-1">
                              <h3 className="font-semibold text-gray-900 dark:text-white">
                                {note.title}
                              </h3>
                              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                {note.subject}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end space-x-3">
              <button
                onClick={() => setShowNoteSelector(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
              >
                Annuler
              </button>
              <button
                onClick={handleIndexSelectedNotes}
                disabled={selectedNotes.length === 0 || indexingNotes}
                className="px-6 py-2 bg-purple-600 dark:bg-purple-700 text-white rounded-lg hover:bg-purple-700 dark:hover:bg-purple-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {indexingNotes ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Indexation...</span>
                  </>
                ) : (
                  <>
                    <Database className="h-4 w-4" />
                    <span>Indexer {selectedNotes.length} note(s)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
