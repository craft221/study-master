'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Send, Loader2, MessageCircle, Smile, Reply, X, AtSign, Wifi, WifiOff, MoreVertical, Edit, Trash2, Ban } from 'lucide-react'
// Card components removed - using plain div for better scroll control
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { EmojiPicker } from '@/components/ui/emoji-picker'
import api from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { useWebSocketContext } from '@/components/providers/WebSocketProvider'
import { useRoom, usePresence } from '@/hooks/useWebSocket'
import { useLanguage } from '@/contexts/LanguageContext'

interface ReactionCount {
  emoji: string
  count: number
  user_ids: number[]
}

interface ReplyToMessage {
  id: number
  user_id: number
  username: string
  content: string
}

interface MentionedUser {
  id: number
  username: string
}

interface Message {
  id: number
  group_id: number
  user_id: number
  username: string
  avatar_url: string | null
  content: string
  is_edited: boolean
  is_deleted?: boolean
  reply_to_message_id?: number
  reply_to?: ReplyToMessage
  mentions?: number[]
  mentioned_users?: MentionedUser[]
  reactions?: ReactionCount[]
  created_at: string
  updated_at: string
}

interface Member {
  id: number
  user_id: number
  username: string
}

interface GroupMessagesTabProps {
  groupId: number
  currentUserId: number
  members: Member[]
}

export default function GroupMessagesTab({ groupId, currentUserId, members }: GroupMessagesTabProps) {
  const { toast } = useToast()
  const { isConnected } = useWebSocketContext()
  const { t } = useLanguage()

  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [replyingTo, setReplyingTo] = useState<Message | null>(null)
  const [showEmojiPicker, setShowEmojiPicker] = useState<number | null>(null)
  const [showInputEmojiPicker, setShowInputEmojiPicker] = useState(false)
  const [showMentionDropdown, setShowMentionDropdown] = useState(false)
  const [mentionSearch, setMentionSearch] = useState('')
  const [cursorPosition, setCursorPosition] = useState(0)
  const [showMessageMenu, setShowMessageMenu] = useState<number | null>(null)
  const [editingMessage, setEditingMessage] = useState<Message | null>(null)
  const [editContent, setEditContent] = useState('')

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const isFirstLoadRef = useRef(true)
  const previousMessageCountRef = useRef(0)

  // Real-time room for WebSocket
  const roomId = `group_${groupId}`
  const { messages: wsMessages, typingUsers, setTyping } = useRoom(isConnected ? roomId : null)
  const { presence, onlineCount } = usePresence(isConnected ? roomId : null)

  // Merge WebSocket messages with fetched messages
  useEffect(() => {
    if (wsMessages.length > 0) {
      setMessages(prev => {
        const existingIds = new Set(prev.map(m => m.id))
        const newMessages = wsMessages.filter(m => !existingIds.has(m.id))
        if (newMessages.length > 0) {
          return [...prev, ...newMessages]
        }
        return prev
      })
    }
  }, [wsMessages])

  useEffect(() => {
    fetchMessages()

    // Only poll if WebSocket is not connected (fallback)
    if (!isConnected) {
      const interval = setInterval(fetchMessages, 5000)
      return () => clearInterval(interval)
    }
  }, [groupId, isConnected])

  useEffect(() => {
    // Scroll to bottom only on first load or if user is already near bottom
    const isNearBottom = () => {
      if (!messagesContainerRef.current) return false
      const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current
      return scrollHeight - scrollTop - clientHeight < 100 // Within 100px of bottom
    }

    const hasNewMessages = messages.length > previousMessageCountRef.current
    previousMessageCountRef.current = messages.length

    if (isFirstLoadRef.current) {
      // First load: scroll to bottom
      scrollToBottom()
      isFirstLoadRef.current = false
    } else if (hasNewMessages && isNearBottom()) {
      // New messages and user is near bottom: scroll to bottom
      scrollToBottom()
    }
    // Otherwise: don't scroll (user is reading old messages)
  }, [messages])

  const fetchMessages = async () => {
    try {
      const response = await api.get(`/study-groups/${groupId}/messages`, {
        params: { page: 1, page_size: 100 }
      })
      // Reverse to show oldest first
      setMessages((response.data.messages || []).reverse())
    } catch (error) {
      console.error('Error fetching messages:', error)
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!newMessage.trim()) return

    try {
      setSending(true)

      // Extract mentions from message
      const mentionMatches = newMessage.match(/@(\w+)/g) || []
      const mentionedUserIds: number[] = []

      mentionMatches.forEach((match) => {
        const username = match.substring(1)
        const member = members.find(m => m.username.toLowerCase() === username.toLowerCase())
        if (member) {
          mentionedUserIds.push(member.user_id)
        }
      })

      const payload: any = {
        content: newMessage
      }

      if (replyingTo) {
        payload.reply_to_message_id = replyingTo.id
      }

      if (mentionedUserIds.length > 0) {
        payload.mentions = mentionedUserIds
      }

      await api.post(`/study-groups/${groupId}/messages`, payload)

      setNewMessage('')
      setReplyingTo(null)
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

  const handleAddReaction = async (messageId: number, emoji: string) => {
    try {
      await api.post(`/study-groups/${groupId}/messages/${messageId}/reactions`, { emoji })
      await fetchMessages()
      toast({
        title: 'Réaction ajoutée',
        description: '+1 XP',
      })
    } catch (error: any) {
      console.error('Error adding reaction:', error)
      toast({
        title: 'Erreur',
        description: error.response?.data?.detail || 'Impossible d\'ajouter la réaction',
        variant: 'destructive'
      })
    }
  }

  const handleRemoveReaction = async (messageId: number, emoji: string) => {
    try {
      await api.delete(`/study-groups/${groupId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`)
      await fetchMessages()
    } catch (error: any) {
      console.error('Error removing reaction:', error)
    }
  }

  const handleReply = (message: Message) => {
    setReplyingTo(message)
    setShowMessageMenu(null)
    textareaRef.current?.focus()
  }

  const handleEditMessage = async () => {
    if (!editingMessage || !editContent.trim()) return

    try {
      await api.put(`/study-groups/${groupId}/messages/${editingMessage.id}`, {
        content: editContent
      })
      await fetchMessages()
      setEditingMessage(null)
      setEditContent('')
      toast({
        title: t('groups.messages.messageEdited'),
        description: t('groups.messages.messageEditedDesc'),
      })
    } catch (error: any) {
      console.error('Error editing message:', error)
      toast({
        title: t('errors.generic'),
        description: error.response?.data?.detail || t('groups.messages.editError'),
        variant: 'destructive'
      })
    }
  }

  const handleDeleteMessage = async (messageId: number) => {
    if (!confirm(t('groups.messages.confirmDelete'))) return

    try {
      await api.delete(`/study-groups/${groupId}/messages/${messageId}`)
      await fetchMessages()
      setShowMessageMenu(null)
      toast({
        title: t('groups.messages.messageDeleted'),
      })
    } catch (error: any) {
      console.error('Error deleting message:', error)
      toast({
        title: t('errors.generic'),
        description: error.response?.data?.detail || t('groups.messages.deleteError'),
        variant: 'destructive'
      })
    }
  }

  const startEditMessage = (message: Message) => {
    setEditingMessage(message)
    setEditContent(message.content)
    setShowMessageMenu(null)
  }

  const cancelEdit = () => {
    setEditingMessage(null)
    setEditContent('')
  }

  const handleInputEmojiSelect = (emoji: string) => {
    const before = newMessage.substring(0, cursorPosition)
    const after = newMessage.substring(cursorPosition)
    const newText = before + emoji + after
    setNewMessage(newText)
    setCursorPosition(cursorPosition + emoji.length)
    setShowInputEmojiPicker(false)
    textareaRef.current?.focus()
  }

  const handleMentionInsert = (username: string) => {
    const before = newMessage.substring(0, cursorPosition)
    const after = newMessage.substring(cursorPosition)

    // Find the start of the current mention (last @ before cursor)
    const lastAtIndex = before.lastIndexOf('@')
    const newBefore = before.substring(0, lastAtIndex) + `@${username} `

    setNewMessage(newBefore + after)
    setShowMentionDropdown(false)
    setMentionSearch('')

    // Set cursor after the mention
    setTimeout(() => {
      const newPosition = newBefore.length
      textareaRef.current?.setSelectionRange(newPosition, newPosition)
      textareaRef.current?.focus()
    }, 0)
  }

  // Debounced typing indicator
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    const cursorPos = e.target.selectionStart || 0

    setNewMessage(value)
    setCursorPosition(cursorPos)

    // Send typing indicator (if connected)
    if (isConnected && value.length > 0) {
      setTyping(true)

      // Clear previous timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }

      // Stop typing after 2 seconds of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        setTyping(false)
      }, 2000)
    }

    // Check for @ mention
    const textBeforeCursor = value.substring(0, cursorPos)
    const lastAtIndex = textBeforeCursor.lastIndexOf('@')

    if (lastAtIndex !== -1 && lastAtIndex === textBeforeCursor.length - 1) {
      // Just typed @
      setShowMentionDropdown(true)
      setMentionSearch('')
    } else if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1)
      // Check if there's a space after the @ (mention complete)
      if (textAfterAt.includes(' ')) {
        setShowMentionDropdown(false)
      } else {
        setShowMentionDropdown(true)
        setMentionSearch(textAfterAt)
      }
    } else {
      setShowMentionDropdown(false)
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

  const renderMessageContent = (content: string, mentionedUsers?: MentionedUser[]) => {
    if (!mentionedUsers || mentionedUsers.length === 0) {
      return content
    }

    // Sécurisé: on divise le texte par les mentions et on reconstruit avec des composants React
    const parts: (string | JSX.Element)[] = []
    let lastIndex = 0
    let keyIndex = 0

    mentionedUsers.forEach(user => {
      const mentionRegex = new RegExp(`@${user.username}`, 'gi')
      let match

      while ((match = mentionRegex.exec(content)) !== null) {
        // Ajouter le texte avant la mention
        if (match.index > lastIndex) {
          parts.push(content.substring(lastIndex, match.index))
        }
        // Ajouter la mention stylisée (sécurisé, pas de dangerouslySetInnerHTML)
        parts.push(
          <span key={`mention-${keyIndex++}`} className="bg-blue-100 text-blue-700 px-1 rounded font-medium">
            @{user.username}
          </span>
        )
        lastIndex = match.index + match[0].length
      }
    })

    // Ajouter le reste du texte
    if (lastIndex < content.length) {
      parts.push(content.substring(lastIndex))
    }

    return <>{parts}</>
  }

  const filteredMembers = mentionSearch
    ? members.filter(m => m.username.toLowerCase().includes(mentionSearch.toLowerCase()))
    : members

  // Get typing usernames
  const getTypingNames = () => {
    const typingMemberNames = typingUsers
      .filter(id => id !== currentUserId)
      .map(id => members.find(m => m.user_id === id)?.username)
      .filter(Boolean)

    if (typingMemberNames.length === 0) return null
    if (typingMemberNames.length === 1) return `${typingMemberNames[0]} est en train d'écrire...`
    if (typingMemberNames.length === 2) return `${typingMemberNames[0]} et ${typingMemberNames[1]} écrivent...`
    return `${typingMemberNames.length} personnes écrivent...`
  }

  const typingMessage = getTypingNames()

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm h-[500px] flex flex-col overflow-hidden">
      {/* Real-time status header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 border-b bg-gray-50 rounded-t-lg">
        <div className="flex items-center gap-2">
          {isConnected ? (
            <div className="flex items-center gap-1 text-green-600 text-xs">
              <Wifi className="h-3 w-3" />
              <span>Temps réel</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-orange-500 text-xs">
              <WifiOff className="h-3 w-3" />
              <span>Hors ligne</span>
            </div>
          )}
          {onlineCount > 0 && (
            <span className="text-xs text-gray-500 ml-2">
              {onlineCount} en ligne
            </span>
          )}
        </div>
        {typingMessage && (
          <span className="text-xs text-gray-500 italic animate-pulse">
            {typingMessage}
          </span>
        )}
      </div>

      {/* Messages - container avec scroll et HAUTEUR FIXE */}
      <div
        ref={messagesContainerRef}
        className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4"
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
              const isDeleted = message.is_deleted

              // Edit mode for this message
              if (editingMessage?.id === message.id) {
                return (
                  <div key={message.id} className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
                    <div className="max-w-[85%] sm:max-w-[70%] bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600 p-3">
                      <p className="text-xs text-gray-500 mb-2">{t('groups.messages.editing')}</p>
                      <Textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="resize-none min-h-[60px] text-sm"
                        rows={2}
                      />
                      <div className="flex gap-2 mt-2">
                        <Button size="sm" onClick={handleEditMessage} disabled={!editContent.trim()}>
                          {t('common.save')}
                        </Button>
                        <Button size="sm" variant="outline" onClick={cancelEdit}>
                          {t('common.cancel')}
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              }

              return (
                <div
                  key={message.id}
                  className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[85%] sm:max-w-[70%] ${isOwnMessage ? 'order-2' : 'order-1'}`}>
                    {!isOwnMessage && (
                      <div className="flex items-center mb-1">
                        <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-xs mr-2">
                          {message.username.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                          {message.username}
                        </span>
                      </div>
                    )}

                    {/* Reply Context */}
                    {message.reply_to && !isDeleted && (
                      <div className={`text-xs p-2 rounded-t-lg border-l-2 ${
                        isOwnMessage
                          ? 'bg-blue-500 border-blue-300 text-blue-100'
                          : 'bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-500 text-gray-600 dark:text-gray-300'
                      }`}>
                        <div className="flex items-center gap-1 mb-1">
                          <Reply className="h-3 w-3" />
                          <span className="font-medium">{message.reply_to.username}</span>
                        </div>
                        <p className="truncate opacity-75">{message.reply_to.content}</p>
                      </div>
                    )}

                    {/* Message Content */}
                    {isDeleted ? (
                      <div className={`rounded-lg px-3 sm:px-4 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600`}>
                        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 italic">
                          <Ban className="h-4 w-4" />
                          <p className="text-sm">{t('groups.messages.deletedMessage')}</p>
                        </div>
                        <div className="text-xs opacity-50 mt-1">
                          {formatMessageTime(message.created_at)}
                        </div>
                      </div>
                    ) : (
                      <div
                        className={`rounded-lg px-3 sm:px-4 py-2 ${message.reply_to ? 'rounded-t-none' : ''} ${
                          isOwnMessage
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap break-words">
                          {renderMessageContent(message.content, message.mentioned_users)}
                        </p>
                        <div className="flex items-center justify-between mt-1 text-xs opacity-70">
                          <span>{formatMessageTime(message.created_at)}</span>
                          {message.is_edited && (
                            <span className="ml-2 italic">({t('groups.messages.edited')})</span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Reactions - Only show if not deleted */}
                    {!isDeleted && message.reactions && message.reactions.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {message.reactions.map((reaction) => {
                          const hasReacted = reaction.user_ids.includes(currentUserId)
                          return (
                            <button
                              key={reaction.emoji}
                              onClick={() =>
                                hasReacted
                                  ? handleRemoveReaction(message.id, reaction.emoji)
                                  : handleAddReaction(message.id, reaction.emoji)
                              }
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-colors ${
                                hasReacted
                                  ? 'bg-blue-100 dark:bg-blue-900/50 border border-blue-300 dark:border-blue-600'
                                  : 'bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                              }`}
                            >
                              <span>{reaction.emoji}</span>
                              <span className="font-medium">{reaction.count}</span>
                            </button>
                          )
                        })}
                      </div>
                    )}

                    {/* Action Buttons - Only show if not deleted */}
                    {!isDeleted && (
                      <div className="flex items-center gap-1 sm:gap-2 mt-1">
                        <button
                          onClick={() => handleReply(message)}
                          className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-1 p-1"
                        >
                          <Reply className="h-3 w-3" />
                          <span className="hidden sm:inline">{t('groups.messages.reply')}</span>
                        </button>

                        <div className="relative">
                          <button
                            onClick={() =>
                              setShowEmojiPicker(showEmojiPicker === message.id ? null : message.id)
                            }
                            className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-1 p-1"
                          >
                            <Smile className="h-3 w-3" />
                            <span className="hidden sm:inline">{t('groups.messages.react')}</span>
                          </button>

                          {showEmojiPicker === message.id && (
                            <div className={`absolute ${isOwnMessage ? 'right-0' : 'left-0'} bottom-full mb-2 z-50`}>
                              <EmojiPicker
                                onEmojiSelect={(emoji) => {
                                  handleAddReaction(message.id, emoji)
                                  setShowEmojiPicker(null)
                                }}
                                onClose={() => setShowEmojiPicker(null)}
                              />
                            </div>
                          )}
                        </div>

                        {/* Edit/Delete menu for own messages */}
                        {isOwnMessage && (
                          <div className="relative">
                            <button
                              onClick={() => setShowMessageMenu(showMessageMenu === message.id ? null : message.id)}
                              className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 p-1"
                            >
                              <MoreVertical className="h-3 w-3" />
                            </button>

                            {showMessageMenu === message.id && (
                              <>
                                <div
                                  className="fixed inset-0 z-40"
                                  onClick={() => setShowMessageMenu(null)}
                                />
                                <div className={`absolute ${isOwnMessage ? 'right-0' : 'left-0'} bottom-full mb-2 z-50 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600 py-1 min-w-[120px]`}>
                                  <button
                                    onClick={() => startEditMessage(message)}
                                    className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                                  >
                                    <Edit className="h-4 w-4" />
                                    {t('groups.messages.edit')}
                                  </button>
                                  <button
                                    onClick={() => handleDeleteMessage(message.id)}
                                    className="w-full px-3 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    {t('groups.messages.delete')}
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}
          <div ref={messagesEndRef} />
        </div>

      {/* Message Input - zone fixe en bas */}
      <div className="flex-shrink-0 border-t p-4 bg-white rounded-b-lg">
          {/* Replying To Indicator */}
          {replyingTo && (
            <div className="mb-2 p-2 bg-gray-50 rounded-lg border border-gray-200 flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Reply className="h-3 w-3 text-gray-500" />
                  <span className="text-xs font-medium text-gray-700">
                    Répondre à {replyingTo.username}
                  </span>
                </div>
                <p className="text-xs text-gray-600 truncate">{replyingTo.content}</p>
              </div>
              <button
                onClick={() => setReplyingTo(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          <form onSubmit={handleSendMessage} className="flex gap-2">
            <div className="flex-1 relative">
              <div className="relative">
                <Textarea
                  ref={textareaRef}
                  value={newMessage}
                  onChange={handleTextareaChange}
                  placeholder={t('groups.messages.placeholder')}
                  className="resize-none max-h-32 overflow-y-auto pr-10 text-sm"
                  rows={2}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSendMessage(e)
                    }
                  }}
                />
                {/* Emoji picker button for input */}
                <button
                  type="button"
                  onClick={() => setShowInputEmojiPicker(!showInputEmojiPicker)}
                  className="absolute right-2 top-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1"
                >
                  <Smile className="h-5 w-5" />
                </button>

                {/* Input Emoji Picker */}
                {showInputEmojiPicker && (
                  <div className="absolute right-0 bottom-full mb-2 z-50">
                    <EmojiPicker
                      onEmojiSelect={handleInputEmojiSelect}
                      onClose={() => setShowInputEmojiPicker(false)}
                    />
                  </div>
                )}
              </div>

              {/* Mention Dropdown */}
              {showMentionDropdown && filteredMembers.length > 0 && (
                <div className="absolute bottom-full left-0 mb-2 w-full bg-white dark:bg-gray-800 border dark:border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto z-50">
                  {filteredMembers.slice(0, 5).map((member) => (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => handleMentionInsert(member.username)}
                      className="w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 text-gray-700 dark:text-gray-300"
                    >
                      <AtSign className="h-4 w-4 text-gray-400" />
                      <span className="font-medium">{member.username}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

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
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 hidden sm:block">
            {t('groups.messages.inputHelp')}
          </p>
        </div>
    </div>
  )
}
