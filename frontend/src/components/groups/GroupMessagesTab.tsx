'use client'

import { useState, useEffect, useRef } from 'react'
import { Send, Loader2, MessageCircle, Smile, Reply, X, AtSign } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { EmojiPicker } from '@/components/ui/emoji-picker'
import api from '@/lib/api'
import { useToast } from '@/hooks/use-toast'

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

  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [replyingTo, setReplyingTo] = useState<Message | null>(null)
  const [showEmojiPicker, setShowEmojiPicker] = useState<number | null>(null)
  const [showMentionDropdown, setShowMentionDropdown] = useState(false)
  const [mentionSearch, setMentionSearch] = useState('')
  const [cursorPosition, setCursorPosition] = useState(0)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    fetchMessages()

    // Poll messages every 5 seconds
    const interval = setInterval(fetchMessages, 5000)
    return () => clearInterval(interval)
  }, [groupId])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

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

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    const cursorPos = e.target.selectionStart || 0

    setNewMessage(value)
    setCursorPosition(cursorPos)

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

    let processedContent = content
    mentionedUsers.forEach(user => {
      const mentionRegex = new RegExp(`@${user.username}`, 'gi')
      processedContent = processedContent.replace(
        mentionRegex,
        `<span class="bg-blue-100 text-blue-700 px-1 rounded font-medium">@${user.username}</span>`
      )
    })

    return <span dangerouslySetInnerHTML={{ __html: processedContent }} />
  }

  const filteredMembers = mentionSearch
    ? members.filter(m => m.username.toLowerCase().includes(mentionSearch.toLowerCase()))
    : members

  return (
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

                    {/* Reply Context */}
                    {message.reply_to && (
                      <div className={`text-xs p-2 rounded-t-lg border-l-2 ${
                        isOwnMessage
                          ? 'bg-blue-500 border-blue-300 text-blue-100'
                          : 'bg-gray-50 border-gray-300 text-gray-600'
                      }`}>
                        <div className="flex items-center gap-1 mb-1">
                          <Reply className="h-3 w-3" />
                          <span className="font-medium">{message.reply_to.username}</span>
                        </div>
                        <p className="truncate opacity-75">{message.reply_to.content}</p>
                      </div>
                    )}

                    {/* Message Content */}
                    <div
                      className={`rounded-lg px-4 py-2 ${message.reply_to ? 'rounded-t-none' : ''} ${
                        isOwnMessage
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-900'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap break-words">
                        {renderMessageContent(message.content, message.mentioned_users)}
                      </p>
                      <div className="flex items-center justify-between mt-1 text-xs opacity-70">
                        <span>{formatMessageTime(message.created_at)}</span>
                        {message.is_edited && <span className="ml-2">(modifié)</span>}
                      </div>
                    </div>

                    {/* Reactions */}
                    {message.reactions && message.reactions.length > 0 && (
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
                                  ? 'bg-blue-100 border border-blue-300'
                                  : 'bg-gray-50 border border-gray-200 hover:bg-gray-100'
                              }`}
                            >
                              <span>{reaction.emoji}</span>
                              <span className="font-medium">{reaction.count}</span>
                            </button>
                          )
                        })}
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 mt-1">
                      <button
                        onClick={() => handleReply(message)}
                        className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                      >
                        <Reply className="h-3 w-3" />
                        Répondre
                      </button>

                      <div className="relative">
                        <button
                          onClick={() =>
                            setShowEmojiPicker(showEmojiPicker === message.id ? null : message.id)
                          }
                          className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                        >
                          <Smile className="h-3 w-3" />
                          Réagir
                        </button>

                        {showEmojiPicker === message.id && (
                          <div className="absolute left-0 bottom-full mb-2 z-50">
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
              <Textarea
                ref={textareaRef}
                value={newMessage}
                onChange={handleTextareaChange}
                placeholder="Écrivez votre message... (utilisez @ pour mentionner)"
                className="resize-none"
                rows={2}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSendMessage(e)
                  }
                }}
              />

              {/* Mention Dropdown */}
              {showMentionDropdown && filteredMembers.length > 0 && (
                <div className="absolute bottom-full left-0 mb-2 w-full bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto z-50">
                  {filteredMembers.slice(0, 5).map((member) => (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => handleMentionInsert(member.username)}
                      className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2"
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
          <p className="text-xs text-gray-500 mt-2">
            Appuyez sur Entrée pour envoyer, Shift + Entrée pour une nouvelle ligne, @ pour mentionner
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
