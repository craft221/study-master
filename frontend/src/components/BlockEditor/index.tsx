'use client'

import { useState, useCallback, useRef, useEffect, useMemo, KeyboardEvent } from 'react'
import { Reorder, useDragControls, AnimatePresence, motion } from 'framer-motion'
import {
  GripVertical, Plus, Trash2, ChevronRight, ChevronDown,
  Image as ImageIcon, Loader2, Code, Type, List, ListOrdered,
  Quote, Minus, Calculator, Table, Lightbulb, Eye, EyeOff
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/cjs/styles/prism'

import {
  Block, BlockType, createBlock, SLASH_COMMANDS, CALLOUT_COLORS,
  CALLOUT_ICONS, CODE_LANGUAGES, CalloutBlock, ToggleBlock
} from '@/types/blocks'
import api from '@/lib/api'
import { useTranslation } from '@/contexts/LanguageContext'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.studera.app'

interface BlockEditorProps {
  blocks: Block[]
  onChange: (blocks: Block[]) => void
  placeholder?: string
  className?: string
}

export default function BlockEditor({
  blocks,
  onChange,
  placeholder = 'Tapez / pour les commandes...',
  className = '',
}: BlockEditorProps) {
  const { t } = useTranslation()
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null)
  const [showSlashMenu, setShowSlashMenu] = useState(false)
  const [slashMenuPosition, setSlashMenuPosition] = useState({ top: 0, left: 0 })
  const [slashFilter, setSlashFilter] = useState('')
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0)
  const [showPreview, setShowPreview] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const blockRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pendingImageBlockId = useRef<string | null>(null)

  // Filtrer les commandes slash
  const filteredCommands = useMemo(() => {
    if (!slashFilter) return SLASH_COMMANDS
    const filter = slashFilter.toLowerCase()
    return SLASH_COMMANDS.filter(
      cmd =>
        cmd.label.toLowerCase().includes(filter) ||
        cmd.keywords.some(k => k.includes(filter))
    )
  }, [slashFilter])

  // Initialiser avec un bloc vide si nécessaire
  useEffect(() => {
    if (blocks.length === 0) {
      onChange([createBlock('paragraph')])
    }
  }, [blocks.length, onChange])

  // Ajouter un nouveau bloc
  const addBlock = useCallback((type: BlockType, afterId?: string, content: string = '') => {
    const newBlock = createBlock(type, content)
    const index = afterId ? blocks.findIndex(b => b.id === afterId) + 1 : blocks.length
    const newBlocks = [...blocks]
    newBlocks.splice(index, 0, newBlock)
    onChange(newBlocks)
    setFocusedBlockId(newBlock.id)

    // Focus le nouveau bloc après le render
    setTimeout(() => {
      const el = blockRefs.current.get(newBlock.id)
      if (el) {
        const input = el.querySelector('[contenteditable="true"], input, textarea') as HTMLElement
        if (input) input.focus()
      }
    }, 50)

    return newBlock
  }, [blocks, onChange])

  // Supprimer un bloc
  const deleteBlock = useCallback((id: string) => {
    if (blocks.length <= 1) {
      // Garder au moins un bloc
      onChange([createBlock('paragraph')])
      return
    }
    const index = blocks.findIndex(b => b.id === id)
    const newBlocks = blocks.filter(b => b.id !== id)
    onChange(newBlocks)

    // Focus le bloc précédent
    if (index > 0) {
      setFocusedBlockId(newBlocks[index - 1].id)
    }
  }, [blocks, onChange])

  // Mettre à jour un bloc
  const updateBlock = useCallback((id: string, updates: Partial<Block>) => {
    onChange(blocks.map(b => (b.id === id ? { ...b, ...updates } as Block : b)))
  }, [blocks, onChange])

  // Transformer un bloc en un autre type
  const transformBlock = useCallback((id: string, newType: BlockType) => {
    const block = blocks.find(b => b.id === id)
    if (!block) return

    const content = 'content' in block ? block.content : ''
    const newBlock = createBlock(newType, content)
    newBlock.id = id // Garder le même ID

    onChange(blocks.map(b => (b.id === id ? newBlock : b)))
    setShowSlashMenu(false)
    setSlashFilter('')
  }, [blocks, onChange])

  // Gérer l'ouverture du menu slash
  const openSlashMenu = useCallback((blockId: string, element: HTMLElement) => {
    const rect = element.getBoundingClientRect()
    const containerRect = containerRef.current?.getBoundingClientRect()
    if (containerRect) {
      setSlashMenuPosition({
        top: rect.bottom - containerRect.top + 5,
        left: rect.left - containerRect.left,
      })
    }
    setShowSlashMenu(true)
    setSlashFilter('')
    setSelectedCommandIndex(0)
    setFocusedBlockId(blockId)
  }, [])

  // Gérer la sélection d'une commande
  const selectCommand = useCallback((command: typeof SLASH_COMMANDS[0]) => {
    if (!focusedBlockId) return

    if (command.id === 'image') {
      pendingImageBlockId.current = focusedBlockId
      fileInputRef.current?.click()
    } else {
      transformBlock(focusedBlockId, command.id)
    }
    setShowSlashMenu(false)
    setSlashFilter('')
  }, [focusedBlockId, transformBlock])

  // Gérer les touches dans le menu slash
  const handleSlashMenuKeyDown = useCallback((e: KeyboardEvent) => {
    if (!showSlashMenu) return false

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedCommandIndex(i => (i + 1) % filteredCommands.length)
      return true
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedCommandIndex(i => (i - 1 + filteredCommands.length) % filteredCommands.length)
      return true
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (filteredCommands[selectedCommandIndex]) {
        selectCommand(filteredCommands[selectedCommandIndex])
      }
      return true
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      setShowSlashMenu(false)
      setSlashFilter('')
      return true
    }
    return false
  }, [showSlashMenu, filteredCommands, selectedCommandIndex, selectCommand])

  // Uploader une image
  const uploadImage = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error(t('editor.errors.imageSize'))
      return null
    }
    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const response = await api.post('/notes/upload-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      if (response.data.success) {
        return response.data.url
      }
    } catch (e: any) {
      toast.error(e.response?.data?.detail || t('editor.errors.imageUpload'))
    } finally {
      setIsUploading(false)
    }
    return null
  }

  // Gérer le changement de fichier
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const url = await uploadImage(file)
    if (url && pendingImageBlockId.current) {
      transformBlock(pendingImageBlockId.current, 'image')
      // Attendre que le bloc soit transformé, puis mettre à jour l'URL
      setTimeout(() => {
        if (pendingImageBlockId.current) {
          updateBlock(pendingImageBlockId.current, { url })
        }
        pendingImageBlockId.current = null
      }, 50)
    }
    e.target.value = ''
  }

  // Gérer le collage d'image
  const handlePaste = useCallback(async (e: React.ClipboardEvent, blockId: string) => {
    const items = e.clipboardData?.items
    if (!items) return

    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const file = item.getAsFile()
        if (!file) continue

        const url = await uploadImage(file)
        if (url) {
          const imageBlock = addBlock('image', blockId)
          setTimeout(() => {
            updateBlock(imageBlock.id, { url })
          }, 50)
        }
        return
      }
    }
  }, [addBlock, updateBlock])

  // Générer le HTML de prévisualisation
  const previewHtml = useMemo(() => {
    return blocks.map(block => blockToHtml(block)).join('\n')
  }, [blocks])

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-3 p-2 bg-white dark:bg-gray-800 rounded-lg border shadow-sm">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => addBlock('paragraph')}
            className="flex items-center gap-1 px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition"
            title="Ajouter un bloc"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Ajouter</span>
          </button>
          <div className="w-px h-5 bg-gray-300 dark:bg-gray-600" />
          <span className="text-xs text-gray-500 px-2">
            Tapez <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">/</kbd> pour les commandes
          </span>
        </div>
        <button
          type="button"
          onClick={() => setShowPreview(!showPreview)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition ${
            showPreview
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
              : 'text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
        >
          {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          <span className="hidden sm:inline">{showPreview ? 'Éditer' : 'Aperçu'}</span>
        </button>
      </div>

      {/* Preview Mode */}
      {showPreview ? (
        <div className="min-h-[300px] p-6 bg-white dark:bg-gray-900 rounded-xl border-2 border-blue-200 dark:border-blue-800">
          <div
            className="prose prose-sm max-w-none dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        </div>
      ) : (
        /* Editor */
        <Reorder.Group
          axis="y"
          values={blocks}
          onReorder={onChange}
          className="space-y-1"
        >
          {blocks.map((block, index) => (
            <BlockItem
              key={block.id}
              block={block}
              index={index}
              isFocused={focusedBlockId === block.id}
              onFocus={() => setFocusedBlockId(block.id)}
              onUpdate={(updates) => updateBlock(block.id, updates)}
              onDelete={() => deleteBlock(block.id)}
              onAddAfter={(type, content) => addBlock(type || 'paragraph', block.id, content)}
              onOpenSlashMenu={(el) => openSlashMenu(block.id, el)}
              onSlashFilter={setSlashFilter}
              onSlashMenuKeyDown={handleSlashMenuKeyDown}
              showSlashMenu={showSlashMenu && focusedBlockId === block.id}
              onPaste={(e) => handlePaste(e, block.id)}
              blockRef={(el) => {
                if (el) blockRefs.current.set(block.id, el)
                else blockRefs.current.delete(block.id)
              }}
            />
          ))}
        </Reorder.Group>
      )}

      {/* Slash Commands Menu */}
      <AnimatePresence>
        {showSlashMenu && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute z-50 w-72 max-h-80 overflow-y-auto bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700"
            style={{ top: slashMenuPosition.top, left: slashMenuPosition.left }}
          >
            <div className="p-2 border-b border-gray-100 dark:border-gray-700">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">
                Blocs disponibles
              </p>
            </div>
            <div className="p-1">
              {filteredCommands.length === 0 ? (
                <p className="px-3 py-2 text-sm text-gray-500">Aucun résultat</p>
              ) : (
                filteredCommands.map((cmd, i) => (
                  <button
                    key={cmd.id}
                    type="button"
                    onClick={() => selectCommand(cmd)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition ${
                      i === selectedCommandIndex
                        ? 'bg-purple-100 dark:bg-purple-900/50'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <span className="w-8 h-8 flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded-lg text-lg">
                      {cmd.icon}
                    </span>
                    <div className="text-left">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{cmd.label}</p>
                      <p className="text-xs text-gray-500">{cmd.description}</p>
                    </div>
                    {cmd.shortcut && (
                      <span className="ml-auto text-xs text-gray-400 font-mono">{cmd.shortcut}</span>
                    )}
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />

      {/* Loading overlay */}
      {isUploading && (
        <div className="absolute inset-0 bg-white/50 dark:bg-gray-900/50 flex items-center justify-center rounded-xl">
          <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
        </div>
      )}

      {/* Hint */}
      <p className="mt-2 text-xs text-gray-500 text-center">
        <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">/</kbd> commandes
        • <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">Enter</kbd> nouveau bloc
        • Glisser <GripVertical className="inline h-3 w-3" /> pour réorganiser
      </p>
    </div>
  )
}

// ============== Block Item Component ==============

interface BlockItemProps {
  block: Block
  index: number
  isFocused: boolean
  onFocus: () => void
  onUpdate: (updates: Partial<Block>) => void
  onDelete: () => void
  onAddAfter: (type?: BlockType, content?: string) => void
  onOpenSlashMenu: (element: HTMLElement) => void
  onSlashFilter: (filter: string) => void
  onSlashMenuKeyDown: (e: KeyboardEvent) => boolean
  showSlashMenu: boolean
  onPaste: (e: React.ClipboardEvent) => void
  blockRef: (el: HTMLDivElement | null) => void
}

function BlockItem({
  block,
  index,
  isFocused,
  onFocus,
  onUpdate,
  onDelete,
  onAddAfter,
  onOpenSlashMenu,
  onSlashFilter,
  onSlashMenuKeyDown,
  showSlashMenu,
  onPaste,
  blockRef,
}: BlockItemProps) {
  const controls = useDragControls()
  const [isHovered, setIsHovered] = useState(false)
  const inputRef = useRef<HTMLDivElement>(null)

  // Focus l'input quand le bloc est focused
  useEffect(() => {
    if (isFocused && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isFocused])

  // Gérer les touches
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    // D'abord vérifier si c'est pour le menu slash
    if (onSlashMenuKeyDown(e as any)) return

    // Enter pour créer un nouveau bloc
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onAddAfter()
    }

    // Backspace pour supprimer un bloc vide
    if (e.key === 'Backspace' && 'content' in block && block.content === '') {
      e.preventDefault()
      onDelete()
    }
  }

  // Gérer le changement de contenu
  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    const text = e.currentTarget.textContent || ''

    // Détecter la commande slash
    if (text === '/' || text.trim() === '/') {
      onOpenSlashMenu(e.currentTarget)
    } else if (text.startsWith('/')) {
      onSlashFilter(text.slice(1))
    } else {
      onSlashFilter('')
    }

    // Détecter les raccourcis markdown
    if (text.startsWith('# ') && block.type === 'paragraph') {
      onUpdate({ type: 'heading_1', content: text.slice(2) } as any)
      return
    }
    if (text.startsWith('## ') && block.type === 'paragraph') {
      onUpdate({ type: 'heading_2', content: text.slice(3) } as any)
      return
    }
    if (text.startsWith('### ') && block.type === 'paragraph') {
      onUpdate({ type: 'heading_3', content: text.slice(4) } as any)
      return
    }
    if (text.startsWith('- ') && block.type === 'paragraph') {
      onUpdate({ type: 'bulleted_list', content: text.slice(2) } as any)
      return
    }
    if (text.startsWith('1. ') && block.type === 'paragraph') {
      onUpdate({ type: 'numbered_list', content: text.slice(3) } as any)
      return
    }
    if (text === '---' && block.type === 'paragraph') {
      onUpdate({ type: 'divider' } as any)
      return
    }

    onUpdate({ content: text } as any)
  }

  return (
    <Reorder.Item
      value={block}
      dragListener={false}
      dragControls={controls}
      className="group"
    >
      <div
        ref={blockRef}
        className={`relative flex items-start gap-1 rounded-lg transition ${
          isFocused ? 'bg-purple-50/50 dark:bg-purple-900/20' : ''
        }`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Drag handle & actions */}
        <div
          className={`flex items-center gap-0.5 py-1 transition-opacity ${
            isHovered ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <button
            type="button"
            onClick={() => onAddAfter()}
            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            title="Ajouter un bloc"
          >
            <Plus className="h-4 w-4" />
          </button>
          <div
            onPointerDown={(e) => controls.start(e)}
            className="p-1 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing"
            title="Glisser pour réorganiser"
          >
            <GripVertical className="h-4 w-4" />
          </div>
        </div>

        {/* Block content */}
        <div className="flex-1 min-w-0">
          <BlockContent
            block={block}
            inputRef={inputRef}
            onFocus={onFocus}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            onPaste={onPaste}
            onUpdate={onUpdate}
            showSlashMenu={showSlashMenu}
          />
        </div>

        {/* Delete button */}
        <button
          type="button"
          onClick={onDelete}
          className={`p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-opacity ${
            isHovered ? 'opacity-100' : 'opacity-0'
          }`}
          title="Supprimer"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </Reorder.Item>
  )
}

// ============== Editable Block Component ==============
// Composant qui gère correctement contentEditable avec React

interface EditableBlockProps {
  content: string
  inputRef: React.RefObject<HTMLDivElement>
  onFocus: () => void
  onInput: (e: React.FormEvent<HTMLDivElement>) => void
  onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => void
  onPaste: (e: React.ClipboardEvent) => void
  className: string
  placeholder: string
}

function EditableBlock({
  content,
  inputRef,
  onFocus,
  onInput,
  onKeyDown,
  onPaste,
  className,
  placeholder,
}: EditableBlockProps) {
  const lastContentRef = useRef(content)
  const isTypingRef = useRef(false)

  // Sync content only when it changes externally (not from typing)
  useEffect(() => {
    if (inputRef.current && !isTypingRef.current) {
      if (inputRef.current.textContent !== content) {
        inputRef.current.textContent = content
      }
    }
    lastContentRef.current = content
  }, [content, inputRef])

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    isTypingRef.current = true
    onInput(e)
    // Reset typing flag after a short delay
    setTimeout(() => {
      isTypingRef.current = false
    }, 0)
  }

  return (
    <div
      ref={inputRef}
      contentEditable
      suppressContentEditableWarning
      onFocus={onFocus}
      onInput={handleInput}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
      data-placeholder={placeholder}
      className={className}
    />
  )
}

// ============== Block Content Component ==============

interface BlockContentProps {
  block: Block
  inputRef: React.RefObject<HTMLDivElement>
  onFocus: () => void
  onInput: (e: React.FormEvent<HTMLDivElement>) => void
  onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => void
  onPaste: (e: React.ClipboardEvent) => void
  onUpdate: (updates: Partial<Block>) => void
  showSlashMenu: boolean
}

function BlockContent({
  block,
  inputRef,
  onFocus,
  onInput,
  onKeyDown,
  onPaste,
  onUpdate,
  showSlashMenu,
}: BlockContentProps) {
  const content = 'content' in block ? block.content : ''

  // Props communs pour les blocs éditables
  const editableProps = {
    content,
    inputRef,
    onFocus,
    onInput,
    onKeyDown,
    onPaste,
  }

  switch (block.type) {
    case 'paragraph':
      return (
        <EditableBlock
          {...editableProps}
          placeholder="Tapez / pour les commandes..."
          className="py-1.5 px-2 min-h-[32px] outline-none text-gray-900 dark:text-gray-100 empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400"
        />
      )

    case 'heading_1':
      return (
        <EditableBlock
          {...editableProps}
          placeholder="Titre 1"
          className="py-2 px-2 min-h-[40px] outline-none text-2xl font-bold text-gray-900 dark:text-white empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400"
        />
      )

    case 'heading_2':
      return (
        <EditableBlock
          {...editableProps}
          placeholder="Titre 2"
          className="py-1.5 px-2 min-h-[36px] outline-none text-xl font-bold text-gray-800 dark:text-gray-100 empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400"
        />
      )

    case 'heading_3':
      return (
        <EditableBlock
          {...editableProps}
          placeholder="Titre 3"
          className="py-1 px-2 min-h-[32px] outline-none text-lg font-semibold text-gray-700 dark:text-gray-200 empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400"
        />
      )

    case 'bulleted_list':
      return (
        <div className="flex items-start gap-2 py-1">
          <span className="text-gray-400 mt-0.5">•</span>
          <EditableBlock
            {...editableProps}
            placeholder="Élément de liste"
            className="flex-1 px-1 min-h-[28px] outline-none text-gray-900 dark:text-gray-100 empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400"
          />
        </div>
      )

    case 'numbered_list':
      return (
        <div className="flex items-start gap-2 py-1">
          <span className="text-gray-400 mt-0.5 w-5 text-right">1.</span>
          <EditableBlock
            {...editableProps}
            placeholder="Élément numéroté"
            className="flex-1 px-1 min-h-[28px] outline-none text-gray-900 dark:text-gray-100 empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400"
          />
        </div>
      )

    case 'toggle':
      return (
        <ToggleBlockContent
          block={block as ToggleBlock}
          editableProps={{ ...editableProps, placeholder: 'Toggle...' }}
          content={content}
          onUpdate={onUpdate}
        />
      )

    case 'callout':
      return (
        <CalloutBlockContent
          block={block as CalloutBlock}
          editableProps={{ ...editableProps, placeholder: 'Callout...' }}
          content={content}
          onUpdate={onUpdate}
        />
      )

    case 'quote':
      return (
        <div className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 py-1">
          <EditableBlock
            {...editableProps}
            placeholder="Citation..."
            className="italic text-gray-600 dark:text-gray-400 min-h-[28px] outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400"
          />
        </div>
      )

    case 'code':
      return (
        <CodeBlockContent
          block={block}
          onUpdate={onUpdate}
          onKeyDown={onKeyDown}
        />
      )

    case 'math':
      return (
        <MathBlockContent
          block={block}
          onUpdate={onUpdate}
          onKeyDown={onKeyDown}
        />
      )

    case 'divider':
      return (
        <div className="py-3">
          <hr className="border-gray-200 dark:border-gray-700" />
        </div>
      )

    case 'image':
      return (
        <ImageBlockContent
          block={block}
          onUpdate={onUpdate}
        />
      )

    case 'table':
      return (
        <TableBlockContent
          block={block}
          onUpdate={onUpdate}
        />
      )

    default:
      return null
  }
}

// ============== Specialized Block Components ==============

function ToggleBlockContent({
  block,
  editableProps,
  content,
  onUpdate,
}: {
  block: ToggleBlock
  editableProps: Omit<EditableBlockProps, 'className' | 'placeholder'> & { placeholder: string }
  content: string
  onUpdate: (updates: Partial<Block>) => void
}) {
  return (
    <div className="py-1">
      <div className="flex items-start gap-1">
        <button
          type="button"
          onClick={() => onUpdate({ isOpen: !block.isOpen })}
          className="p-0.5 mt-1 text-gray-400 hover:text-gray-600 rounded"
        >
          {block.isOpen ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>
        <EditableBlock
          {...editableProps}
          className="flex-1 px-1 min-h-[28px] outline-none font-medium text-gray-900 dark:text-gray-100 empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400"
        />
      </div>
      {block.isOpen && (
        <div className="ml-6 mt-1 pl-3 border-l-2 border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500 italic">Contenu du toggle (éditeur imbriqué à venir)</p>
        </div>
      )}
    </div>
  )
}

function CalloutBlockContent({
  block,
  editableProps,
  content,
  onUpdate,
}: {
  block: CalloutBlock
  editableProps: Omit<EditableBlockProps, 'className' | 'placeholder'> & { placeholder: string }
  content: string
  onUpdate: (updates: Partial<Block>) => void
}) {
  const [showIconPicker, setShowIconPicker] = useState(false)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const colors = CALLOUT_COLORS[block.color] || CALLOUT_COLORS.yellow

  return (
    <div className={`relative rounded-lg border p-3 ${colors.bg} ${colors.border}`}>
      <div className="flex items-start gap-3">
        {/* Icon picker */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowIconPicker(!showIconPicker)}
            className="text-2xl hover:bg-white/50 dark:hover:bg-black/20 rounded p-1"
          >
            {block.icon}
          </button>
          {showIconPicker && (
            <div className="absolute top-full left-0 mt-1 p-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border z-10 grid grid-cols-6 gap-1">
              {CALLOUT_ICONS.map(icon => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => {
                    onUpdate({ icon })
                    setShowIconPicker(false)
                  }}
                  className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-lg"
                >
                  {icon}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Content */}
        <EditableBlock
          {...editableProps}
          placeholder="Note importante..."
          className={`flex-1 min-h-[28px] outline-none ${colors.text} empty:before:content-[attr(data-placeholder)] empty:before:opacity-50`}
        />

        {/* Color picker */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowColorPicker(!showColorPicker)}
            className={`w-5 h-5 rounded-full border-2 border-white shadow ${colors.bg}`}
          />
          {showColorPicker && (
            <div className="absolute top-full right-0 mt-1 p-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border z-10 flex gap-1">
              {(Object.keys(CALLOUT_COLORS) as Array<keyof typeof CALLOUT_COLORS>).map(color => (
                <button
                  key={color}
                  type="button"
                  onClick={() => {
                    onUpdate({ color })
                    setShowColorPicker(false)
                  }}
                  className={`w-6 h-6 rounded-full border-2 ${
                    block.color === color ? 'border-gray-900 dark:border-white' : 'border-transparent'
                  } ${CALLOUT_COLORS[color].bg}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function CodeBlockContent({
  block,
  onUpdate,
  onKeyDown,
}: {
  block: Block & { type: 'code'; content: string; language: string }
  onUpdate: (updates: Partial<Block>) => void
  onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => void
}) {
  const [isEditing, setIsEditing] = useState(true)

  return (
    <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
      {/* Language selector */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <select
          value={block.language}
          onChange={(e) => onUpdate({ language: e.target.value })}
          className="text-xs bg-transparent text-gray-600 dark:text-gray-400 outline-none"
        >
          {CODE_LANGUAGES.map(lang => (
            <option key={lang.id} value={lang.id}>{lang.label}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setIsEditing(!isEditing)}
          className="text-xs text-gray-500 hover:text-gray-700"
        >
          {isEditing ? 'Prévisualiser' : 'Éditer'}
        </button>
      </div>

      {/* Code content */}
      {isEditing ? (
        <textarea
          value={block.content}
          onChange={(e) => onUpdate({ content: e.target.value })}
          onKeyDown={(e) => {
            // Tab pour l'indentation
            if (e.key === 'Tab') {
              e.preventDefault()
              const start = e.currentTarget.selectionStart
              const end = e.currentTarget.selectionEnd
              const value = e.currentTarget.value
              onUpdate({ content: value.substring(0, start) + '  ' + value.substring(end) })
            }
          }}
          placeholder="// Votre code ici..."
          className="w-full p-3 bg-gray-900 text-green-400 font-mono text-sm outline-none resize-none min-h-[100px]"
          spellCheck={false}
        />
      ) : (
        <SyntaxHighlighter
          language={block.language}
          style={oneDark}
          customStyle={{ margin: 0, borderRadius: 0 }}
        >
          {block.content || '// Code vide'}
        </SyntaxHighlighter>
      )}
    </div>
  )
}

// Math symbols organized by category
const MATH_SYMBOLS = {
  basic: [
    { label: '+', latex: '+', desc: 'Plus' },
    { label: '−', latex: '-', desc: 'Moins' },
    { label: '×', latex: '\\times', desc: 'Multiplier' },
    { label: '÷', latex: '\\div', desc: 'Diviser' },
    { label: '·', latex: '\\cdot', desc: 'Point multiplication' },
    { label: '=', latex: '=', desc: 'Égal' },
    { label: '≠', latex: '\\neq', desc: 'Différent' },
    { label: '≈', latex: '\\approx', desc: 'Approximativement' },
    { label: '≡', latex: '\\equiv', desc: 'Identique' },
    { label: '∝', latex: '\\propto', desc: 'Proportionnel' },
    { label: '<', latex: '<', desc: 'Inférieur' },
    { label: '>', latex: '>', desc: 'Supérieur' },
    { label: '≤', latex: '\\leq', desc: 'Inférieur ou égal' },
    { label: '≥', latex: '\\geq', desc: 'Supérieur ou égal' },
    { label: '≪', latex: '\\ll', desc: 'Très inférieur' },
    { label: '≫', latex: '\\gg', desc: 'Très supérieur' },
    { label: '±', latex: '\\pm', desc: 'Plus ou moins' },
    { label: '∓', latex: '\\mp', desc: 'Moins ou plus' },
  ],
  structures: [
    { label: 'a/b', latex: '\\frac{a}{b}', desc: 'Fraction' },
    { label: '√', latex: '\\sqrt{x}', desc: 'Racine carrée' },
    { label: '∛', latex: '\\sqrt[3]{x}', desc: 'Racine cubique' },
    { label: 'ⁿ√', latex: '\\sqrt[n]{x}', desc: 'Racine n-ième' },
    { label: 'xⁿ', latex: 'x^{n}', desc: 'Puissance' },
    { label: 'xₙ', latex: 'x_{n}', desc: 'Indice' },
    { label: 'xₙᵐ', latex: 'x_{n}^{m}', desc: 'Indice et puissance' },
    { label: '∑', latex: '\\sum_{i=1}^{n}', desc: 'Somme' },
    { label: '∏', latex: '\\prod_{i=1}^{n}', desc: 'Produit' },
    { label: '∫', latex: '\\int_{a}^{b}', desc: 'Intégrale' },
    { label: '∬', latex: '\\iint', desc: 'Intégrale double' },
    { label: '∭', latex: '\\iiint', desc: 'Intégrale triple' },
    { label: '∮', latex: '\\oint', desc: 'Intégrale curviligne' },
    { label: 'lim', latex: '\\lim_{x \\to a}', desc: 'Limite' },
    { label: '∂', latex: '\\partial', desc: 'Dérivée partielle' },
    { label: '∇', latex: '\\nabla', desc: 'Nabla/Gradient' },
    { label: "f'", latex: "f'(x)", desc: 'Dérivée prime' },
    { label: 'ḟ', latex: '\\dot{x}', desc: 'Dérivée point' },
    { label: 'f̈', latex: '\\ddot{x}', desc: 'Dérivée double point' },
  ],
  brackets: [
    { label: '( )', latex: '\\left( x \\right)', desc: 'Parenthèses' },
    { label: '[ ]', latex: '\\left[ x \\right]', desc: 'Crochets' },
    { label: '{ }', latex: '\\left\\{ x \\right\\}', desc: 'Accolades' },
    { label: '| |', latex: '\\left| x \\right|', desc: 'Valeur absolue' },
    { label: '‖ ‖', latex: '\\left\\| x \\right\\|', desc: 'Norme' },
    { label: '⌊ ⌋', latex: '\\lfloor x \\rfloor', desc: 'Partie entière inf.' },
    { label: '⌈ ⌉', latex: '\\lceil x \\rceil', desc: 'Partie entière sup.' },
    { label: '⟨ ⟩', latex: '\\langle x \\rangle', desc: 'Chevrons' },
  ],
  matrices: [
    { label: '2×2', latex: '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}', desc: 'Matrice 2×2' },
    { label: '3×3', latex: '\\begin{pmatrix} a & b & c \\\\ d & e & f \\\\ g & h & i \\end{pmatrix}', desc: 'Matrice 3×3' },
    { label: '[2×2]', latex: '\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}', desc: 'Matrice crochets' },
    { label: '|2×2|', latex: '\\begin{vmatrix} a & b \\\\ c & d \\end{vmatrix}', desc: 'Déterminant' },
    { label: '‖2×2‖', latex: '\\begin{Vmatrix} a & b \\\\ c & d \\end{Vmatrix}', desc: 'Matrice double barres' },
    { label: 'col', latex: '\\begin{pmatrix} x \\\\ y \\\\ z \\end{pmatrix}', desc: 'Vecteur colonne' },
    { label: 'row', latex: '\\begin{pmatrix} x & y & z \\end{pmatrix}', desc: 'Vecteur ligne' },
    { label: 'I₃', latex: '\\begin{pmatrix} 1 & 0 & 0 \\\\ 0 & 1 & 0 \\\\ 0 & 0 & 1 \\end{pmatrix}', desc: 'Matrice identité' },
    { label: '...', latex: '\\begin{pmatrix} a_{11} & \\cdots & a_{1n} \\\\ \\vdots & \\ddots & \\vdots \\\\ a_{m1} & \\cdots & a_{mn} \\end{pmatrix}', desc: 'Matrice générale' },
    { label: 'aug', latex: '\\left(\\begin{array}{cc|c} a & b & e \\\\ c & d & f \\end{array}\\right)', desc: 'Matrice augmentée' },
  ],
  greek: [
    { label: 'α', latex: '\\alpha', desc: 'Alpha' },
    { label: 'β', latex: '\\beta', desc: 'Bêta' },
    { label: 'γ', latex: '\\gamma', desc: 'Gamma' },
    { label: 'δ', latex: '\\delta', desc: 'Delta' },
    { label: 'ε', latex: '\\epsilon', desc: 'Epsilon' },
    { label: 'ζ', latex: '\\zeta', desc: 'Zêta' },
    { label: 'η', latex: '\\eta', desc: 'Êta' },
    { label: 'θ', latex: '\\theta', desc: 'Thêta' },
    { label: 'ι', latex: '\\iota', desc: 'Iota' },
    { label: 'κ', latex: '\\kappa', desc: 'Kappa' },
    { label: 'λ', latex: '\\lambda', desc: 'Lambda' },
    { label: 'μ', latex: '\\mu', desc: 'Mu' },
    { label: 'ν', latex: '\\nu', desc: 'Nu' },
    { label: 'ξ', latex: '\\xi', desc: 'Xi' },
    { label: 'π', latex: '\\pi', desc: 'Pi' },
    { label: 'ρ', latex: '\\rho', desc: 'Rho' },
    { label: 'σ', latex: '\\sigma', desc: 'Sigma' },
    { label: 'τ', latex: '\\tau', desc: 'Tau' },
    { label: 'υ', latex: '\\upsilon', desc: 'Upsilon' },
    { label: 'φ', latex: '\\phi', desc: 'Phi' },
    { label: 'χ', latex: '\\chi', desc: 'Chi' },
    { label: 'ψ', latex: '\\psi', desc: 'Psi' },
    { label: 'ω', latex: '\\omega', desc: 'Oméga' },
    { label: 'Γ', latex: '\\Gamma', desc: 'Gamma maj.' },
    { label: 'Δ', latex: '\\Delta', desc: 'Delta maj.' },
    { label: 'Θ', latex: '\\Theta', desc: 'Thêta maj.' },
    { label: 'Λ', latex: '\\Lambda', desc: 'Lambda maj.' },
    { label: 'Ξ', latex: '\\Xi', desc: 'Xi maj.' },
    { label: 'Π', latex: '\\Pi', desc: 'Pi maj.' },
    { label: 'Σ', latex: '\\Sigma', desc: 'Sigma maj.' },
    { label: 'Φ', latex: '\\Phi', desc: 'Phi maj.' },
    { label: 'Ψ', latex: '\\Psi', desc: 'Psi maj.' },
    { label: 'Ω', latex: '\\Omega', desc: 'Oméga maj.' },
  ],
  functions: [
    { label: 'sin', latex: '\\sin', desc: 'Sinus' },
    { label: 'cos', latex: '\\cos', desc: 'Cosinus' },
    { label: 'tan', latex: '\\tan', desc: 'Tangente' },
    { label: 'cot', latex: '\\cot', desc: 'Cotangente' },
    { label: 'sec', latex: '\\sec', desc: 'Sécante' },
    { label: 'csc', latex: '\\csc', desc: 'Cosécante' },
    { label: 'arcsin', latex: '\\arcsin', desc: 'Arc sinus' },
    { label: 'arccos', latex: '\\arccos', desc: 'Arc cosinus' },
    { label: 'arctan', latex: '\\arctan', desc: 'Arc tangente' },
    { label: 'sinh', latex: '\\sinh', desc: 'Sinus hyperbolique' },
    { label: 'cosh', latex: '\\cosh', desc: 'Cosinus hyperbolique' },
    { label: 'tanh', latex: '\\tanh', desc: 'Tangente hyperbolique' },
    { label: 'log', latex: '\\log', desc: 'Logarithme' },
    { label: 'ln', latex: '\\ln', desc: 'Log naturel' },
    { label: 'log₂', latex: '\\log_2', desc: 'Log base 2' },
    { label: 'exp', latex: '\\exp', desc: 'Exponentielle' },
    { label: 'eˣ', latex: 'e^{x}', desc: 'e puissance x' },
    { label: 'min', latex: '\\min', desc: 'Minimum' },
    { label: 'max', latex: '\\max', desc: 'Maximum' },
    { label: 'arg', latex: '\\arg', desc: 'Argument' },
    { label: 'det', latex: '\\det', desc: 'Déterminant' },
    { label: 'dim', latex: '\\dim', desc: 'Dimension' },
    { label: 'ker', latex: '\\ker', desc: 'Noyau' },
    { label: 'gcd', latex: '\\gcd', desc: 'PGCD' },
    { label: 'lcm', latex: '\\text{lcm}', desc: 'PPCM' },
    { label: 'mod', latex: '\\mod', desc: 'Modulo' },
  ],
  accents: [
    { label: 'x̂', latex: '\\hat{x}', desc: 'Chapeau' },
    { label: 'x̄', latex: '\\bar{x}', desc: 'Barre (moyenne)' },
    { label: 'x⃗', latex: '\\vec{x}', desc: 'Vecteur' },
    { label: 'x̃', latex: '\\tilde{x}', desc: 'Tilde' },
    { label: 'ẋ', latex: '\\dot{x}', desc: 'Point' },
    { label: 'ẍ', latex: '\\ddot{x}', desc: 'Double point' },
    { label: 'x̆', latex: '\\breve{x}', desc: 'Brève' },
    { label: 'x́', latex: '\\acute{x}', desc: 'Accent aigu' },
    { label: 'x̀', latex: '\\grave{x}', desc: 'Accent grave' },
    { label: 'AB⃗', latex: '\\overrightarrow{AB}', desc: 'Vecteur AB' },
    { label: 'x̅y̅', latex: '\\overline{xy}', desc: 'Surligner' },
    { label: 'x͟y', latex: '\\underline{xy}', desc: 'Souligner' },
    { label: '⏞', latex: '\\overbrace{x+y}^{n}', desc: 'Accolade dessus' },
    { label: '⏟', latex: '\\underbrace{x+y}_{n}', desc: 'Accolade dessous' },
  ],
  sets: [
    { label: '∈', latex: '\\in', desc: 'Appartient' },
    { label: '∉', latex: '\\notin', desc: "N'appartient pas" },
    { label: '∋', latex: '\\ni', desc: 'Contient' },
    { label: '⊂', latex: '\\subset', desc: 'Sous-ensemble strict' },
    { label: '⊃', latex: '\\supset', desc: 'Sur-ensemble strict' },
    { label: '⊆', latex: '\\subseteq', desc: 'Sous-ensemble' },
    { label: '⊇', latex: '\\supseteq', desc: 'Sur-ensemble' },
    { label: '⊄', latex: '\\not\\subset', desc: 'Non sous-ensemble' },
    { label: '∪', latex: '\\cup', desc: 'Union' },
    { label: '∩', latex: '\\cap', desc: 'Intersection' },
    { label: '\\', latex: '\\setminus', desc: 'Différence' },
    { label: '∅', latex: '\\emptyset', desc: 'Ensemble vide' },
    { label: 'ℕ', latex: '\\mathbb{N}', desc: 'Naturels' },
    { label: 'ℤ', latex: '\\mathbb{Z}', desc: 'Entiers' },
    { label: 'ℚ', latex: '\\mathbb{Q}', desc: 'Rationnels' },
    { label: 'ℝ', latex: '\\mathbb{R}', desc: 'Réels' },
    { label: 'ℂ', latex: '\\mathbb{C}', desc: 'Complexes' },
    { label: '𝔽', latex: '\\mathbb{F}', desc: 'Corps fini' },
    { label: '∀', latex: '\\forall', desc: 'Pour tout' },
    { label: '∃', latex: '\\exists', desc: 'Il existe' },
    { label: '∄', latex: '\\nexists', desc: "N'existe pas" },
    { label: '|A|', latex: '|A|', desc: 'Cardinal' },
    { label: '℘', latex: '\\wp', desc: 'Ensemble des parties' },
  ],
  logic: [
    { label: '∧', latex: '\\land', desc: 'Et logique' },
    { label: '∨', latex: '\\lor', desc: 'Ou logique' },
    { label: '¬', latex: '\\neg', desc: 'Négation' },
    { label: '⊕', latex: '\\oplus', desc: 'Ou exclusif' },
    { label: '⊤', latex: '\\top', desc: 'Vrai' },
    { label: '⊥', latex: '\\bot', desc: 'Faux' },
    { label: '⊢', latex: '\\vdash', desc: 'Prouve' },
    { label: '⊨', latex: '\\models', desc: 'Satisfait' },
    { label: '∴', latex: '\\therefore', desc: 'Donc' },
    { label: '∵', latex: '\\because', desc: 'Parce que' },
  ],
  arrows: [
    { label: '→', latex: '\\rightarrow', desc: 'Flèche droite' },
    { label: '←', latex: '\\leftarrow', desc: 'Flèche gauche' },
    { label: '↔', latex: '\\leftrightarrow', desc: 'Flèche double' },
    { label: '⇒', latex: '\\Rightarrow', desc: 'Implique' },
    { label: '⇐', latex: '\\Leftarrow', desc: 'Impliqué par' },
    { label: '⇔', latex: '\\Leftrightarrow', desc: 'Équivalent' },
    { label: '↦', latex: '\\mapsto', desc: 'Mappe vers' },
    { label: '↑', latex: '\\uparrow', desc: 'Flèche haut' },
    { label: '↓', latex: '\\downarrow', desc: 'Flèche bas' },
    { label: '↗', latex: '\\nearrow', desc: 'Flèche NE' },
    { label: '↘', latex: '\\searrow', desc: 'Flèche SE' },
    { label: '↙', latex: '\\swarrow', desc: 'Flèche SO' },
    { label: '↖', latex: '\\nwarrow', desc: 'Flèche NO' },
    { label: '⟶', latex: '\\longrightarrow', desc: 'Longue flèche' },
    { label: '⟹', latex: '\\Longrightarrow', desc: 'Longue implique' },
    { label: '⟺', latex: '\\Longleftrightarrow', desc: 'Long équivalent' },
    { label: '↺', latex: '\\circlearrowleft', desc: 'Rotation gauche' },
    { label: '↻', latex: '\\circlearrowright', desc: 'Rotation droite' },
  ],
  geometry: [
    { label: '∠', latex: '\\angle', desc: 'Angle' },
    { label: '∟', latex: '\\measuredangle', desc: 'Angle mesuré' },
    { label: '⊥', latex: '\\perp', desc: 'Perpendiculaire' },
    { label: '∥', latex: '\\parallel', desc: 'Parallèle' },
    { label: '≅', latex: '\\cong', desc: 'Congruent' },
    { label: '∼', latex: '\\sim', desc: 'Similaire' },
    { label: '△', latex: '\\triangle', desc: 'Triangle' },
    { label: '□', latex: '\\square', desc: 'Carré' },
    { label: '○', latex: '\\circ', desc: 'Cercle' },
    { label: '⊙', latex: '\\odot', desc: 'Cercle point' },
    { label: '°', latex: '^{\\circ}', desc: 'Degré' },
  ],
  misc: [
    { label: '∞', latex: '\\infty', desc: 'Infini' },
    { label: 'ℓ', latex: '\\ell', desc: 'L cursif' },
    { label: 'ℏ', latex: '\\hbar', desc: 'H barré (Planck)' },
    { label: 'ℜ', latex: '\\Re', desc: 'Partie réelle' },
    { label: 'ℑ', latex: '\\Im', desc: 'Partie imaginaire' },
    { label: '†', latex: '\\dagger', desc: 'Dague' },
    { label: '‡', latex: '\\ddagger', desc: 'Double dague' },
    { label: '★', latex: '\\star', desc: 'Étoile' },
    { label: '∗', latex: '\\ast', desc: 'Astérisque' },
    { label: '⊗', latex: '\\otimes', desc: 'Produit tensoriel' },
    { label: '⊕', latex: '\\oplus', desc: 'Somme directe' },
    { label: '∘', latex: '\\circ', desc: 'Composition' },
    { label: '•', latex: '\\bullet', desc: 'Point' },
    { label: '…', latex: '\\ldots', desc: 'Points horizontaux' },
    { label: '⋯', latex: '\\cdots', desc: 'Points centrés' },
    { label: '⋮', latex: '\\vdots', desc: 'Points verticaux' },
    { label: '⋱', latex: '\\ddots', desc: 'Points diagonaux' },
    { label: 'n!', latex: 'n!', desc: 'Factorielle' },
    { label: 'C(n,k)', latex: '\\binom{n}{k}', desc: 'Binomial' },
    { label: 'P(n,k)', latex: 'P_{n}^{k}', desc: 'Permutation' },
    { label: 'Texte', latex: '\\text{texte}', desc: 'Texte normal' },
    { label: 'Espace', latex: '\\quad', desc: 'Grand espace' },
    { label: 'espace', latex: '\\,', desc: 'Petit espace' },
  ],
  stats: [
    { label: 'x̄', latex: '\\bar{x}', desc: 'Moyenne' },
    { label: 'σ²', latex: '\\sigma^2', desc: 'Variance' },
    { label: 'σ', latex: '\\sigma', desc: 'Écart-type' },
    { label: 'μ', latex: '\\mu', desc: 'Moyenne pop.' },
    { label: 'P(A)', latex: 'P(A)', desc: 'Probabilité' },
    { label: 'P(A|B)', latex: 'P(A|B)', desc: 'Prob. conditionnelle' },
    { label: 'E[X]', latex: 'E[X]', desc: 'Espérance' },
    { label: 'Var', latex: '\\text{Var}(X)', desc: 'Variance' },
    { label: 'Cov', latex: '\\text{Cov}(X,Y)', desc: 'Covariance' },
    { label: 'ρ', latex: '\\rho', desc: 'Corrélation' },
    { label: '~', latex: '\\sim', desc: 'Suit la loi' },
    { label: 'N(μ,σ²)', latex: '\\mathcal{N}(\\mu, \\sigma^2)', desc: 'Loi normale' },
  ],
}

const MATH_TEMPLATES = [
  // Texte + formule
  { label: 'Texte + formule', latex: '\\text{La solution est } x = 5' },
  { label: 'Où / tel que', latex: 'f(x) = x^2 \\quad \\text{où} \\quad x \\in \\mathbb{R}' },
  { label: 'Si... alors', latex: '\\text{Si } x > 0 \\text{, alors } f(x) > 0' },
  // Formules classiques
  { label: 'Formule quadratique', latex: 'x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}' },
  { label: 'Pythagore', latex: 'a^2 + b^2 = c^2' },
  { label: 'Identité remarquable', latex: '(a+b)^2 = a^2 + 2ab + b^2' },
  { label: 'Dérivée (définition)', latex: "f'(x) = \\lim_{h \\to 0} \\frac{f(x+h) - f(x)}{h}" },
  { label: 'Intégrale définie', latex: '\\int_{a}^{b} f(x) \\, dx = F(b) - F(a)' },
  { label: 'Somme série géo.', latex: '\\sum_{k=0}^{n} r^k = \\frac{1-r^{n+1}}{1-r}' },
  { label: 'Série infinie', latex: '\\sum_{n=1}^{\\infty} \\frac{1}{n^2} = \\frac{\\pi^2}{6}' },
  { label: "Formule d'Euler", latex: 'e^{i\\pi} + 1 = 0' },
  { label: 'Binôme de Newton', latex: '(x+y)^n = \\sum_{k=0}^{n} \\binom{n}{k} x^{n-k} y^k' },
  { label: 'Matrice 2×2', latex: '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}' },
  { label: 'Matrice 3×3', latex: '\\begin{pmatrix} a & b & c \\\\ d & e & f \\\\ g & h & i \\end{pmatrix}' },
  { label: 'Déterminant 2×2', latex: '\\begin{vmatrix} a & b \\\\ c & d \\end{vmatrix} = ad - bc' },
  { label: 'Système 2 éq.', latex: '\\begin{cases} ax + by = e \\\\ cx + dy = f \\end{cases}' },
  { label: 'Système 3 éq.', latex: '\\begin{cases} x + y + z = a \\\\ x - y + z = b \\\\ x + y - z = c \\end{cases}' },
  { label: 'Limite connue', latex: '\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1' },
  { label: 'Dérivée partielle', latex: '\\frac{\\partial f}{\\partial x}' },
  { label: 'Gradient', latex: '\\nabla f = \\left( \\frac{\\partial f}{\\partial x}, \\frac{\\partial f}{\\partial y} \\right)' },
  { label: 'Laplacien', latex: '\\nabla^2 f = \\frac{\\partial^2 f}{\\partial x^2} + \\frac{\\partial^2 f}{\\partial y^2}' },
  { label: 'Intégrale double', latex: '\\iint_D f(x,y) \\, dA' },
  { label: 'Intégrale triple', latex: '\\iiint_E f(x,y,z) \\, dV' },
  { label: 'Théorème de Stokes', latex: '\\oint_C \\vec{F} \\cdot d\\vec{r} = \\iint_S (\\nabla \\times \\vec{F}) \\cdot d\\vec{S}' },
  { label: 'Produit scalaire', latex: '\\vec{u} \\cdot \\vec{v} = |\\vec{u}| |\\vec{v}| \\cos\\theta' },
  { label: 'Produit vectoriel', latex: '\\vec{u} \\times \\vec{v} = |\\vec{u}| |\\vec{v}| \\sin\\theta \\, \\vec{n}' },
  { label: 'Équation différentielle', latex: "y' + P(x)y = Q(x)" },
  { label: 'Transformée de Laplace', latex: '\\mathcal{L}\\{f(t)\\} = \\int_0^{\\infty} e^{-st} f(t) \\, dt' },
  { label: 'Série de Fourier', latex: 'f(x) = \\frac{a_0}{2} + \\sum_{n=1}^{\\infty} \\left( a_n \\cos(nx) + b_n \\sin(nx) \\right)' },
  { label: 'Loi normale', latex: 'f(x) = \\frac{1}{\\sigma\\sqrt{2\\pi}} e^{-\\frac{(x-\\mu)^2}{2\\sigma^2}}' },
  { label: 'Théorème de Bayes', latex: 'P(A|B) = \\frac{P(B|A) \\cdot P(A)}{P(B)}' },
  { label: 'Variance', latex: '\\text{Var}(X) = E[X^2] - (E[X])^2' },
]

function MathBlockContent({
  block,
  onUpdate,
  onKeyDown,
}: {
  block: Block & { type: 'math'; content: string }
  onUpdate: (updates: Partial<Block>) => void
  onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => void
}) {
  const [isEditing, setIsEditing] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showSymbols, setShowSymbols] = useState(false)
  const [activeCategory, setActiveCategory] = useState<keyof typeof MATH_SYMBOLS>('basic')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const renderedMath = useMemo(() => {
    if (!block.content) return ''
    try {
      setError(null)
      return katex.renderToString(block.content, { displayMode: true, throwOnError: false })
    } catch (e: any) {
      setError(e.message)
      return ''
    }
  }, [block.content])

  const insertSymbol = (latex: string) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const newContent = block.content.slice(0, start) + latex + block.content.slice(end)
    onUpdate({ content: newContent })

    // Set cursor after inserted symbol
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start + latex.length, start + latex.length)
    }, 0)
  }

  const insertTemplate = (latex: string) => {
    onUpdate({ content: latex })
    setShowSymbols(false)
  }

  const categoryLabels: Record<keyof typeof MATH_SYMBOLS, string> = {
    basic: 'Base',
    structures: 'Structures',
    brackets: 'Parenthèses',
    matrices: 'Matrices',
    greek: 'Grec',
    functions: 'Fonctions',
    accents: 'Accents',
    sets: 'Ensembles',
    logic: 'Logique',
    arrows: 'Flèches',
    geometry: 'Géométrie',
    misc: 'Divers',
    stats: 'Stats',
  }

  return (
    <div className="rounded-lg border border-purple-200 dark:border-purple-800 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-purple-50 dark:bg-purple-900/30 border-b border-purple-200 dark:border-purple-800">
        <span className="text-xs text-purple-600 dark:text-purple-400 flex items-center gap-1">
          <Calculator className="h-3 w-3" />
          Équation LaTeX
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowSymbols(!showSymbols)}
            className={`text-xs px-2 py-0.5 rounded ${
              showSymbols
                ? 'bg-purple-200 dark:bg-purple-700 text-purple-700 dark:text-purple-200'
                : 'text-purple-500 hover:text-purple-700'
            }`}
          >
            Σ Symboles
          </button>
          <button
            type="button"
            onClick={() => setIsEditing(!isEditing)}
            className="text-xs text-purple-500 hover:text-purple-700"
          >
            {isEditing ? 'Prévisualiser' : 'Éditer'}
          </button>
        </div>
      </div>

      {/* Symbol Picker */}
      {showSymbols && isEditing && (
        <div className="border-b border-purple-200 dark:border-purple-800 bg-gray-50 dark:bg-gray-800/50">
          {/* Category Tabs */}
          <div className="flex flex-wrap gap-1 px-2 py-1.5 border-b border-purple-100 dark:border-purple-900">
            {Object.keys(MATH_SYMBOLS).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat as keyof typeof MATH_SYMBOLS)}
                className={`text-xs px-2 py-1 rounded ${
                  activeCategory === cat
                    ? 'bg-purple-500 text-white'
                    : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-purple-100 dark:hover:bg-gray-600'
                }`}
              >
                {categoryLabels[cat as keyof typeof MATH_SYMBOLS]}
              </button>
            ))}
          </div>

          {/* Symbols Grid */}
          <div className="p-2">
            <div className="flex flex-wrap gap-1">
              {MATH_SYMBOLS[activeCategory].map((sym, i) => {
                let preview = ''
                try {
                  preview = katex.renderToString(sym.latex, { displayMode: false, throwOnError: false })
                } catch {}
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => insertSymbol(sym.latex)}
                    className="group relative w-9 h-9 flex items-center justify-center rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 hover:bg-purple-50 dark:hover:bg-purple-900/30 hover:border-purple-300 text-lg"
                  >
                    <span dangerouslySetInnerHTML={{ __html: preview }} className="scale-75" />
                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 whitespace-nowrap">
                      {sym.desc}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Templates */}
          <div className="px-2 pb-2">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Modèles :</p>
            <div className="flex flex-wrap gap-1">
              {MATH_TEMPLATES.map((tpl, i) => {
                let preview = ''
                try {
                  preview = katex.renderToString(tpl.latex, { displayMode: false, throwOnError: false })
                } catch {}
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => insertTemplate(tpl.latex)}
                    title={tpl.label}
                    className="group relative text-xs px-2 py-1 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-800/50"
                  >
                    {tpl.label}
                    {/* Tooltip with rendered preview */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 whitespace-nowrap">
                      <div dangerouslySetInnerHTML={{ __html: preview }} className="text-base" />
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {isEditing ? (
        <textarea
          ref={textareaRef}
          value={block.content}
          onChange={(e) => onUpdate({ content: e.target.value })}
          placeholder="Tapez votre équation LaTeX ou utilisez les symboles ci-dessus"
          className="w-full p-3 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-mono text-sm outline-none resize-none min-h-[60px]"
          spellCheck={false}
        />
      ) : (
        <div className="p-4 bg-white dark:bg-gray-900 text-center">
          {error ? (
            <p className="text-red-500 text-sm">{error}</p>
          ) : block.content ? (
            <div dangerouslySetInnerHTML={{ __html: renderedMath }} />
          ) : (
            <p className="text-gray-400 italic">Équation vide</p>
          )}
        </div>
      )}
    </div>
  )
}

function ImageBlockContent({
  block,
  onUpdate,
}: {
  block: Block & { type: 'image'; url: string; caption?: string }
  onUpdate: (updates: Partial<Block>) => void
}) {
  const resolveUrl = (url: string) => {
    if (url.startsWith('/api/')) return `${API_URL}${url}`
    return url
  }

  if (!block.url) {
    return (
      <div className="flex items-center justify-center h-32 bg-gray-100 dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
        <div className="text-center">
          <ImageIcon className="h-8 w-8 text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-500">Aucune image</p>
        </div>
      </div>
    )
  }

  return (
    <figure className="text-center">
      <img
        src={resolveUrl(block.url)}
        alt={block.caption || 'Image'}
        className="max-w-full rounded-lg shadow-md mx-auto"
        style={{ maxHeight: 400 }}
      />
      <input
        type="text"
        value={block.caption || ''}
        onChange={(e) => onUpdate({ caption: e.target.value })}
        placeholder="Ajouter une légende..."
        className="mt-2 text-sm text-gray-500 text-center bg-transparent outline-none w-full"
      />
    </figure>
  )
}

function TableBlockContent({
  block,
  onUpdate,
}: {
  block: Block & { type: 'table'; rows: string[][]; hasHeader?: boolean }
  onUpdate: (updates: Partial<Block>) => void
}) {
  const addRow = () => {
    const cols = block.rows[0]?.length || 2
    onUpdate({ rows: [...block.rows, Array(cols).fill('')] })
  }

  const addColumn = () => {
    onUpdate({ rows: block.rows.map(row => [...row, '']) })
  }

  const updateCell = (rowIndex: number, colIndex: number, value: string) => {
    const newRows = block.rows.map((row, ri) =>
      ri === rowIndex ? row.map((cell, ci) => (ci === colIndex ? value : cell)) : row
    )
    onUpdate({ rows: newRows })
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse border border-gray-200 dark:border-gray-700 rounded-lg">
        <tbody>
          {block.rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, colIndex) => {
                const isHeader = block.hasHeader && rowIndex === 0
                const Tag = isHeader ? 'th' : 'td'
                return (
                  <Tag
                    key={colIndex}
                    className={`border border-gray-200 dark:border-gray-700 p-0 ${
                      isHeader ? 'bg-gray-100 dark:bg-gray-800 font-medium' : ''
                    }`}
                  >
                    <input
                      type="text"
                      value={cell}
                      onChange={(e) => updateCell(rowIndex, colIndex, e.target.value)}
                      className="w-full px-3 py-2 bg-transparent outline-none text-sm"
                      placeholder={isHeader ? 'En-tête' : 'Cellule'}
                    />
                  </Tag>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex gap-2 mt-2">
        <button
          type="button"
          onClick={addRow}
          className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
        >
          <Plus className="h-3 w-3" /> Ligne
        </button>
        <button
          type="button"
          onClick={addColumn}
          className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
        >
          <Plus className="h-3 w-3" /> Colonne
        </button>
      </div>
    </div>
  )
}

// ============== Helpers: HTML sanitization ==============

/**
 * Echappe les caracteres HTML dangereux pour prevenir XSS.
 * A appliquer sur TOUT contenu utilisateur avant injection dans du HTML.
 */
function escapeHtml(input: string): string {
  if (input == null) return ''
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Valide une URL d'image : autorise uniquement http(s) et data:image/*.
 * Bloque javascript:, vbscript:, file:, data:text/html, etc.
 * Retourne une string vide si la protocole n'est pas safe (l'image ne s'affichera pas).
 */
function sanitizeImageUrl(url: string): string {
  if (!url) return ''
  const trimmed = String(url).trim()
  // Data URI : uniquement les images (bloque data:text/html,<script>...)
  if (/^data:image\/(png|jpe?g|gif|webp|svg\+xml);/i.test(trimmed)) {
    return trimmed
  }
  // URLs absolues : uniquement http(s)
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed
  }
  // URLs relatives autorisees (commencent par / ou .)
  if (/^[./]/.test(trimmed)) {
    return trimmed
  }
  return ''
}

// ============== Helper: Block to HTML ==============

function blockToHtml(block: Block): string {
  // Echapper systematiquement le contenu utilisateur avant interpolation HTML.
  // KaTeX et le code sont geres au cas par cas ci-dessous.
  const rawContent = 'content' in block ? block.content : ''
  const content = escapeHtml(rawContent)

  switch (block.type) {
    case 'paragraph':
      return `<p>${content}</p>`
    case 'heading_1':
      return `<h1 class="text-2xl font-bold mt-4 mb-2">${content}</h1>`
    case 'heading_2':
      return `<h2 class="text-xl font-bold mt-3 mb-2">${content}</h2>`
    case 'heading_3':
      return `<h3 class="text-lg font-semibold mt-2 mb-1">${content}</h3>`
    case 'bulleted_list':
      return `<ul class="list-disc ml-4"><li>${content}</li></ul>`
    case 'numbered_list':
      return `<ol class="list-decimal ml-4"><li>${content}</li></ol>`
    case 'toggle':
      return `<details><summary class="cursor-pointer font-medium">${content}</summary></details>`
    case 'callout': {
      const callout = block as CalloutBlock
      const colors = CALLOUT_COLORS[callout.color] || CALLOUT_COLORS.yellow
      // L'icone est aussi user-controlled (emoji ou string libre) → escape
      const icon = escapeHtml(callout.icon || '')
      return `<div class="p-3 rounded-lg border ${colors.bg} ${colors.border}"><span class="mr-2">${icon}</span>${content}</div>`
    }
    case 'quote':
      return `<blockquote class="border-l-4 border-gray-300 pl-4 italic text-gray-600">${content}</blockquote>`
    case 'code':
      // Le code reste dans <pre><code> donc escape suffit (pas d'execution)
      return `<pre class="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto"><code>${content}</code></pre>`
    case 'math':
      try {
        // KaTeX fait son propre echappement interne ; on passe le contenu BRUT
        // (pas escape, sinon les backslashes LaTeX sont cassés).
        // throwOnError: false → KaTeX genere un span d'erreur, pas un throw.
        return `<div class="text-center my-4">${katex.renderToString(rawContent, { displayMode: true, throwOnError: false })}</div>`
      } catch {
        return `<div class="text-red-500">Erreur LaTeX</div>`
      }
    case 'divider':
      return '<hr class="my-4 border-gray-200" />'
    case 'image': {
      const img = block as Block & { type: 'image'; url: string; caption?: string }
      const safeUrl = sanitizeImageUrl(img.url)
      const safeAlt = escapeHtml(img.caption || '')
      const safeCaption = escapeHtml(img.caption || '')
      // safeUrl est deja filtree pour etre un URL whitelistee, mais on escape
      // quand meme pour eviter les cassures de guillemets dans l'attribut
      const urlAttr = escapeHtml(safeUrl)
      return `<figure class="text-center"><img src="${urlAttr}" alt="${safeAlt}" class="max-w-full rounded-lg shadow-md mx-auto" />${img.caption ? `<figcaption class="text-sm text-gray-500 mt-2">${safeCaption}</figcaption>` : ''}</figure>`
    }
    case 'table': {
      const table = block as Block & { type: 'table'; rows: string[][] }
      const rows = table.rows.map((row, i) => {
        const cells = row.map(cell => {
          const safeCell = escapeHtml(cell)
          return i === 0
            ? `<th class="border px-3 py-2 bg-gray-100">${safeCell}</th>`
            : `<td class="border px-3 py-2">${safeCell}</td>`
        }).join('')
        return `<tr>${cells}</tr>`
      }).join('')
      return `<table class="w-full border-collapse border">${rows}</table>`
    }
    default:
      return ''
  }
}
