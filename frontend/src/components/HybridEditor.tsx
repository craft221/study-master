'use client'

import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import {
  Eye,
  EyeOff,
  Image as ImageIcon,
  Loader2,
  X,
  Code,
  Table,
  Pencil,
  Eraser,
  Download,
  RotateCcw,
  Keyboard
} from 'lucide-react'
import api from '@/lib/api'
import { toast } from 'react-hot-toast'
import 'katex/dist/katex.min.css'
import katex from 'katex'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface HybridEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

// Extended LaTeX symbols for all disciplines
const symbolCategories = [
  { name: 'Base', symbols: [
    { label: '×', latex: '$\\times$' }, { label: '÷', latex: '$\\div$' }, { label: '±', latex: '$\\pm$' },
    { label: '≠', latex: '$\\neq$' }, { label: '≤', latex: '$\\leq$' }, { label: '≥', latex: '$\\geq$' },
    { label: '≈', latex: '$\\approx$' }, { label: '∞', latex: '$\\infty$' },
  ]},
  { name: 'Puissances', symbols: [
    { label: 'x²', latex: '$x^{2}$' }, { label: 'x³', latex: '$x^{3}$' }, { label: 'xⁿ', latex: '$x^{n}$' },
    { label: 'x₁', latex: '$x_{1}$' }, { label: 'xᵢ', latex: '$x_{i}$' }, { label: 'aₙ', latex: '$a_{n}$' },
    { label: 'eˣ', latex: '$e^{x}$' }, { label: '10ⁿ', latex: '$10^{n}$' },
  ]},
  { name: 'Fractions', symbols: [
    { label: 'a/b', latex: '$\\frac{a}{b}$' }, { label: '½', latex: '$\\frac{1}{2}$' },
    { label: 'dx/dy', latex: '$\\frac{dx}{dy}$' }, { label: '∂f/∂x', latex: '$\\frac{\\partial f}{\\partial x}$' },
  ]},
  { name: 'Racines', symbols: [
    { label: '√x', latex: '$\\sqrt{x}$' }, { label: '³√x', latex: '$\\sqrt[3]{x}$' },
    { label: 'ⁿ√x', latex: '$\\sqrt[n]{x}$' }, { label: '√(a²+b²)', latex: '$\\sqrt{a^2+b^2}$' },
  ]},
  { name: 'Grec', symbols: [
    { label: 'α', latex: '$\\alpha$' }, { label: 'β', latex: '$\\beta$' }, { label: 'γ', latex: '$\\gamma$' },
    { label: 'δ', latex: '$\\delta$' }, { label: 'ε', latex: '$\\epsilon$' }, { label: 'θ', latex: '$\\theta$' },
    { label: 'λ', latex: '$\\lambda$' }, { label: 'μ', latex: '$\\mu$' }, { label: 'π', latex: '$\\pi$' },
    { label: 'σ', latex: '$\\sigma$' }, { label: 'φ', latex: '$\\phi$' }, { label: 'ω', latex: '$\\omega$' },
    { label: 'Δ', latex: '$\\Delta$' }, { label: 'Σ', latex: '$\\Sigma$' }, { label: 'Ω', latex: '$\\Omega$' },
    { label: 'Π', latex: '$\\Pi$' }, { label: 'Φ', latex: '$\\Phi$' }, { label: 'Ψ', latex: '$\\Psi$' },
  ]},
  { name: 'Calcul', symbols: [
    { label: '∫', latex: '$\\int$' }, { label: '∫ab', latex: '$\\int_{a}^{b}$' },
    { label: '∬', latex: '$\\iint$' }, { label: '∮', latex: '$\\oint$' },
    { label: '∑', latex: '$\\sum_{i=1}^{n}$' }, { label: '∏', latex: '$\\prod_{i=1}^{n}$' },
    { label: 'lim', latex: '$\\lim_{x \\to \\infty}$' }, { label: 'lim₀', latex: '$\\lim_{x \\to 0}$' },
    { label: '∂', latex: '$\\partial$' }, { label: '∇', latex: '$\\nabla$' },
    { label: "f'", latex: "$f'(x)$" }, { label: 'f"', latex: "$f''(x)$" },
    { label: 'dy/dx', latex: '$\\frac{dy}{dx}$' }, { label: 'd²y/dx²', latex: '$\\frac{d^2y}{dx^2}$' },
  ]},
  { name: 'Matrices', symbols: [
    { label: '[ ]', latex: '$\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}$' },
    { label: '( )', latex: '$\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}$' },
    { label: '| |', latex: '$\\begin{vmatrix} a & b \\\\ c & d \\end{vmatrix}$' },
    { label: '3×3', latex: '$\\begin{bmatrix} a & b & c \\\\ d & e & f \\\\ g & h & i \\end{bmatrix}$' },
    { label: 'I', latex: '$\\begin{bmatrix} 1 & 0 \\\\ 0 & 1 \\end{bmatrix}$' },
  ]},
  { name: 'Ensembles', symbols: [
    { label: '∈', latex: '$\\in$' }, { label: '∉', latex: '$\\notin$' },
    { label: '⊂', latex: '$\\subset$' }, { label: '⊃', latex: '$\\supset$' },
    { label: '∪', latex: '$\\cup$' }, { label: '∩', latex: '$\\cap$' },
    { label: '∅', latex: '$\\emptyset$' }, { label: '\\', latex: '$\\setminus$' },
    { label: 'ℕ', latex: '$\\mathbb{N}$' }, { label: 'ℤ', latex: '$\\mathbb{Z}$' },
    { label: 'ℚ', latex: '$\\mathbb{Q}$' }, { label: 'ℝ', latex: '$\\mathbb{R}$' },
    { label: 'ℂ', latex: '$\\mathbb{C}$' },
  ]},
  { name: 'Logique', symbols: [
    { label: '∀', latex: '$\\forall$' }, { label: '∃', latex: '$\\exists$' }, { label: '∄', latex: '$\\nexists$' },
    { label: '∧', latex: '$\\land$' }, { label: '∨', latex: '$\\lor$' }, { label: '¬', latex: '$\\neg$' },
    { label: '⇒', latex: '$\\Rightarrow$' }, { label: '⇐', latex: '$\\Leftarrow$' }, { label: '⇔', latex: '$\\Leftrightarrow$' },
    { label: '⊢', latex: '$\\vdash$' }, { label: '⊨', latex: '$\\models$' },
  ]},
  { name: 'Trigo', symbols: [
    { label: 'sin', latex: '$\\sin(x)$' }, { label: 'cos', latex: '$\\cos(x)$' }, { label: 'tan', latex: '$\\tan(x)$' },
    { label: 'arcsin', latex: '$\\arcsin(x)$' }, { label: 'arccos', latex: '$\\arccos(x)$' }, { label: 'arctan', latex: '$\\arctan(x)$' },
    { label: 'sinh', latex: '$\\sinh(x)$' }, { label: 'cosh', latex: '$\\cosh(x)$' }, { label: 'tanh', latex: '$\\tanh(x)$' },
  ]},
  { name: 'Stats', symbols: [
    { label: 'x̄', latex: '$\\bar{x}$' }, { label: 'σ²', latex: '$\\sigma^2$' },
    { label: 'P(A)', latex: '$P(A)$' }, { label: 'P(A|B)', latex: '$P(A|B)$' },
    { label: 'E[X]', latex: '$E[X]$' }, { label: 'Var', latex: '$\\text{Var}(X)$' },
    { label: 'Cov', latex: '$\\text{Cov}(X,Y)$' }, { label: 'ρ', latex: '$\\rho_{XY}$' },
    { label: 'nCk', latex: '$\\binom{n}{k}$' }, { label: 'n!', latex: '$n!$' },
  ]},
  { name: 'Physique', symbols: [
    { label: 'ℏ', latex: '$\\hbar$' }, { label: 'Å', latex: '$\\text{\\AA}$' },
    { label: '→v', latex: '$\\vec{v}$' }, { label: '→F', latex: '$\\vec{F}$' },
    { label: '|ψ⟩', latex: '$|\\psi\\rangle$' }, { label: '⟨φ|', latex: '$\\langle\\phi|$' },
    { label: '⟨ψ|φ⟩', latex: '$\\langle\\psi|\\phi\\rangle$' },
    { label: '∇×', latex: '$\\nabla \\times$' }, { label: '∇·', latex: '$\\nabla \\cdot$' },
  ]},
  { name: 'Chimie', symbols: [
    { label: '→', latex: '$\\rightarrow$' }, { label: '⇌', latex: '$\\rightleftharpoons$' },
    { label: 'H₂O', latex: '$\\text{H}_2\\text{O}$' }, { label: 'CO₂', latex: '$\\text{CO}_2$' },
    { label: 'pH', latex: '$\\text{pH}$' }, { label: 'pKa', latex: '$\\text{p}K_a$' },
    { label: 'ΔH', latex: '$\\Delta H$' }, { label: 'ΔG', latex: '$\\Delta G$' },
    { label: '°C', latex: '$^{\\circ}\\text{C}$' }, { label: 'mol/L', latex: '$\\text{mol/L}$' },
  ]},
  { name: 'Médecine', symbols: [
    { label: '♀', latex: '$\\female$' }, { label: '♂', latex: '$\\male$' },
    { label: 'μg', latex: '$\\mu\\text{g}$' }, { label: 'mL', latex: '$\\text{mL}$' },
    { label: 'mg/kg', latex: '$\\text{mg/kg}$' }, { label: 'mmHg', latex: '$\\text{mmHg}$' },
    { label: '±SD', latex: '$\\pm\\text{SD}$' }, { label: 'p<', latex: '$p < 0.05$' },
    { label: 'CI95%', latex: '$\\text{CI}_{95\\%}$' }, { label: 'OR', latex: '$\\text{OR}$' },
  ]},
  { name: 'Info', symbols: [
    { label: 'O(n)', latex: '$O(n)$' }, { label: 'O(n²)', latex: '$O(n^2)$' }, { label: 'O(log n)', latex: '$O(\\log n)$' },
    { label: 'O(n log n)', latex: '$O(n \\log n)$' }, { label: 'Θ', latex: '$\\Theta(n)$' }, { label: 'Ω', latex: '$\\Omega(n)$' },
    { label: '⌊x⌋', latex: '$\\lfloor x \\rfloor$' }, { label: '⌈x⌉', latex: '$\\lceil x \\rceil$' },
    { label: 'mod', latex: '$\\mod$' }, { label: 'log₂', latex: '$\\log_2$' },
  ]},
]

function resolveImageUrl(src: string): string {
  if (src.startsWith('/api/')) return `${API_URL}${src}`
  return src
}

function renderLatex(text: string): string {
  if (!text) return ''
  let result = text

  // Render code blocks
  result = result.replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang, code) => {
    const language = lang || 'text'
    return `<pre class="code-block bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto my-4"><code class="language-${language}">${code.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`
  })

  // Render inline code
  result = result.replace(/`([^`]+)`/g, '<code class="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-sm font-mono text-purple-600">$1</code>')

  // Render tables
  result = result.replace(/\|(.+)\|\n\|[-:\s|]+\|\n((?:\|.+\|\n?)*)/g, (match, header, body) => {
    const headers = header.split('|').filter((h: string) => h.trim())
    const rows = body.trim().split('\n').map((row: string) => row.split('|').filter((c: string) => c.trim()))

    let table = '<table class="min-w-full border-collapse my-4"><thead><tr>'
    headers.forEach((h: string) => {
      table += `<th class="border border-gray-300 dark:border-gray-600 px-4 py-2 bg-gray-100 dark:bg-gray-800">${h.trim()}</th>`
    })
    table += '</tr></thead><tbody>'
    rows.forEach((row: string[]) => {
      table += '<tr>'
      row.forEach((cell: string) => {
        table += `<td class="border border-gray-300 dark:border-gray-600 px-4 py-2">${cell.trim()}</td>`
      })
      table += '</tr>'
    })
    table += '</tbody></table>'
    return table
  })

  // Render display math ($$...$$)
  result = result.replace(/\$\$([^$]+)\$\$/g, (match, latex) => {
    try {
      return `<div class="katex-block my-4 text-center overflow-x-auto">${katex.renderToString(latex.trim(), { displayMode: true, throwOnError: false })}</div>`
    } catch { return match }
  })

  // Render inline math ($...$)
  result = result.replace(/\$([^$\n]+)\$/g, (match, latex) => {
    try {
      return katex.renderToString(latex.trim(), { displayMode: false, throwOnError: false })
    } catch { return match }
  })

  // Render images
  result = result.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, url) => {
    return `<img src="${resolveImageUrl(url)}" alt="${alt}" class="max-w-full rounded-lg shadow-md my-3" style="max-height: 400px;" />`
  })

  // Render headers
  result = result.replace(/^### (.+)$/gm, '<h3 class="text-lg font-bold mt-4 mb-2">$1</h3>')
  result = result.replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold mt-5 mb-3">$1</h2>')
  result = result.replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold mt-6 mb-4">$1</h1>')

  // Render bold and italic
  result = result.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  result = result.replace(/\*([^*]+)\*/g, '<em>$1</em>')

  // Render lists
  result = result.replace(/^- (.+)$/gm, '<li class="ml-4">$1</li>')
  result = result.replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4 list-decimal">$2</li>')

  // Render line breaks
  result = result.replace(/\n/g, '<br>')

  return result
}

// Convert HTML to markdown (for saving)
function htmlToMarkdown(html: string): string {
  let text = html
  // Convert images
  text = text.replace(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi, (_, src) => {
    let cleanSrc = src
    if (src.startsWith(API_URL)) {
      cleanSrc = src.replace(API_URL, '')
    }
    return `![image](${cleanSrc})`
  })
  // Convert <br> and </div><div> to newlines
  text = text.replace(/<br\s*\/?>/gi, '\n')
  text = text.replace(/<\/div><div>/gi, '\n')
  text = text.replace(/<div>/gi, '\n')
  text = text.replace(/<\/div>/gi, '')
  // Remove other tags
  text = text.replace(/<[^>]+>/g, '')
  // Decode HTML entities
  text = text.replace(/&nbsp;/g, ' ')
  text = text.replace(/&lt;/g, '<')
  text = text.replace(/&gt;/g, '>')
  text = text.replace(/&amp;/g, '&')
  return text.trim()
}

// Convert markdown to HTML (for display in editor)
function markdownToHtml(markdown: string): string {
  let html = markdown
  // Convert images to actual img tags
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, url) => {
    const resolvedUrl = resolveImageUrl(url)
    return `<img src="${resolvedUrl}" alt="${alt}" class="inline-block max-w-full rounded-lg shadow-md my-2 cursor-pointer" style="max-height: 300px;" data-url="${url}" />`
  })
  // Convert newlines to <br>
  html = html.replace(/\n/g, '<br>')
  return html
}

export default function HybridEditor({ value, onChange, placeholder = 'Écris ta note ici... Utilise $formule$ pour LaTeX', className = '' }: HybridEditorProps) {
  const [showPreview, setShowPreview] = useState(false)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [selectedImage, setSelectedImage] = useState<HTMLImageElement | null>(null)
  const [showDrawing, setShowDrawing] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [drawingColor, setDrawingColor] = useState('#000000')
  const [brushSize, setBrushSize] = useState(3)

  // Resize state
  const [isResizing, setIsResizing] = useState(false)
  const [resizeHandle, setResizeHandle] = useState<string | null>(null)
  const [startPos, setStartPos] = useState({ x: 0, y: 0 })
  const [startSize, setStartSize] = useState({ width: 0, height: 0 })

  const editorRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const previewHtml = useMemo(() => renderLatex(value), [value])

  // Initialize editor content
  useEffect(() => {
    if (editorRef.current && !editorRef.current.innerHTML && value) {
      editorRef.current.innerHTML = markdownToHtml(value)
    }
  }, [])

  // Sync external value changes
  useEffect(() => {
    if (editorRef.current) {
      const currentMarkdown = htmlToMarkdown(editorRef.current.innerHTML)
      if (currentMarkdown !== value && value !== undefined) {
        const selection = window.getSelection()
        const range = selection?.rangeCount ? selection.getRangeAt(0) : null
        editorRef.current.innerHTML = markdownToHtml(value)
        if (range) {
          try {
            selection?.removeAllRanges()
            selection?.addRange(range)
          } catch {}
        }
      }
    }
  }, [value])

  // Handle resize mouse events
  useEffect(() => {
    if (!isResizing || !selectedImage) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!selectedImage || !resizeHandle) return

      const deltaX = e.clientX - startPos.x
      const deltaY = e.clientY - startPos.y

      let newWidth = startSize.width
      let newHeight = startSize.height

      // Handle based on which handle is being dragged
      switch (resizeHandle) {
        case 'e': // East - only width
          newWidth = Math.max(50, startSize.width + deltaX)
          break
        case 'w': // West - only width
          newWidth = Math.max(50, startSize.width - deltaX)
          break
        case 'n': // North - only height
          newHeight = Math.max(50, startSize.height - deltaY)
          break
        case 's': // South - only height
          newHeight = Math.max(50, startSize.height + deltaY)
          break
        case 'ne': // Northeast - both
          newWidth = Math.max(50, startSize.width + deltaX)
          newHeight = Math.max(50, startSize.height - deltaY)
          break
        case 'nw': // Northwest - both
          newWidth = Math.max(50, startSize.width - deltaX)
          newHeight = Math.max(50, startSize.height - deltaY)
          break
        case 'se': // Southeast - both
          newWidth = Math.max(50, startSize.width + deltaX)
          newHeight = Math.max(50, startSize.height + deltaY)
          break
        case 'sw': // Southwest - both
          newWidth = Math.max(50, startSize.width - deltaX)
          newHeight = Math.max(50, startSize.height + deltaY)
          break
      }

      selectedImage.style.width = `${newWidth}px`
      selectedImage.style.height = `${newHeight}px`
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      setResizeHandle(null)
      handleInput()
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing, resizeHandle, startPos, startSize, selectedImage])

  // Handle content change
  const handleInput = useCallback(() => {
    if (editorRef.current) {
      const markdown = htmlToMarkdown(editorRef.current.innerHTML)
      onChange(markdown)
    }
  }, [onChange])

  // Upload image
  const uploadImage = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) { toast.error('Image trop volumineuse (max 10 MB)'); return }
    setIsUploading(true)
    const formData = new FormData()
    formData.append('file', file)
    try {
      const response = await api.post('/notes/upload-image', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      if (response.data.success && response.data.url) {
        const url = response.data.url
        const resolvedUrl = resolveImageUrl(url)

        // Insert image at cursor position
        const selection = window.getSelection()
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0)
          const img = document.createElement('img')
          img.src = resolvedUrl
          img.alt = 'image'
          img.className = 'inline-block max-w-full rounded-lg shadow-md my-2 cursor-pointer'
          img.style.maxHeight = '300px'
          img.dataset.url = url
          range.insertNode(img)
          range.setStartAfter(img)
          range.collapse(true)
          selection.removeAllRanges()
          selection.addRange(range)
        }

        handleInput()
        toast.success('Image ajoutée!')
      }
    } catch (error: any) { toast.error(error.response?.data?.detail || 'Erreur') }
    finally { setIsUploading(false) }
  }

  // Handle paste
  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (items) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          e.preventDefault()
          const file = items[i].getAsFile()
          if (file) await uploadImage(file)
          return
        }
      }
    }
  }, [])

  // Handle image click for selection with resize handles
  const handleEditorClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.tagName === 'IMG') {
      e.preventDefault()
      // Deselect previous
      if (selectedImage && selectedImage !== target) {
        selectedImage.classList.remove('ring-2', 'ring-blue-500')
        const oldWrapper = selectedImage.parentElement
        if (oldWrapper?.classList.contains('image-resize-wrapper')) {
          oldWrapper.replaceWith(selectedImage)
        }
      }

      const img = target as HTMLImageElement
      setSelectedImage(img)
      img.classList.add('ring-2', 'ring-blue-500')
    } else if (!target.classList.contains('resize-handle')) {
      if (selectedImage) {
        selectedImage.classList.remove('ring-2', 'ring-blue-500')
        setSelectedImage(null)
      }
    }
  }, [selectedImage])

  // Handle key down for deleting selected image and shortcuts
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Delete selected image
    if (selectedImage && (e.key === 'Delete' || e.key === 'Backspace')) {
      e.preventDefault()
      selectedImage.remove()
      setSelectedImage(null)
      handleInput()
      return
    }

    // Keyboard shortcuts
    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case 'm': // Math inline
          e.preventDefault()
          insertLatex('$formule$')
          break
        case 'e': // Equation block
          e.preventDefault()
          insertLatex('\n$$\nformule\n$$\n')
          break
        case 'b': // Bold
          e.preventDefault()
          insertLatex('**gras**')
          break
        case 'i': // Italic
          e.preventDefault()
          insertLatex('*italique*')
          break
        case 'k': // Code inline
          e.preventDefault()
          insertLatex('`code`')
          break
        case 'l': // List
          e.preventDefault()
          insertLatex('\n- item 1\n- item 2\n')
          break
      }
    }
  }, [selectedImage, handleInput])

  // Start resize
  const startResize = (handle: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!selectedImage) return

    setIsResizing(true)
    setResizeHandle(handle)
    setStartPos({ x: e.clientX, y: e.clientY })
    setStartSize({
      width: selectedImage.offsetWidth,
      height: selectedImage.offsetHeight
    })
  }

  // Delete selected image
  const deleteSelectedImage = () => {
    if (selectedImage) {
      selectedImage.remove()
      setSelectedImage(null)
      handleInput()
    }
  }

  // Insert LaTeX
  const insertLatex = (latex: string) => {
    if (editorRef.current) {
      // Focus the editor first
      editorRef.current.focus()

      const selection = window.getSelection()
      if (selection) {
        let range: Range

        if (selection.rangeCount > 0) {
          range = selection.getRangeAt(0)
          // Check if selection is inside the editor
          if (!editorRef.current.contains(range.commonAncestorContainer)) {
            // If not, put cursor at end
            range = document.createRange()
            range.selectNodeContents(editorRef.current)
            range.collapse(false)
          }
        } else {
          // No selection, create one at the end
          range = document.createRange()
          range.selectNodeContents(editorRef.current)
          range.collapse(false)
        }

        const textNode = document.createTextNode(latex)
        range.insertNode(textNode)
        range.setStartAfter(textNode)
        range.collapse(true)
        selection.removeAllRanges()
        selection.addRange(range)
        handleInput()
      }
    }
  }

  // Insert code block
  const insertCodeBlock = () => {
    insertLatex('\n```python\n# Votre code ici\n\n```\n')
  }

  // Insert table
  const insertTable = () => {
    insertLatex('\n| Colonne 1 | Colonne 2 | Colonne 3 |\n|-----------|-----------|------------|\n| Donnée 1  | Donnée 2  | Donnée 3   |\n| Donnée 4  | Donnée 5  | Donnée 6   |\n')
  }

  // Drawing canvas setup
  useEffect(() => {
    if (showDrawing && canvasRef.current) {
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.fillStyle = 'white'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
      }
    }
  }, [showDrawing])

  // Drawing handlers
  const [isDrawing, setIsDrawing] = useState(false)
  const lastPos = useRef({ x: 0, y: 0 })

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    lastPos.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    setIsDrawing(true)
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !canvasRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    ctx.beginPath()
    ctx.moveTo(lastPos.current.x, lastPos.current.y)
    ctx.lineTo(x, y)
    ctx.strokeStyle = drawingColor
    ctx.lineWidth = brushSize
    ctx.lineCap = 'round'
    ctx.stroke()

    lastPos.current = { x, y }
  }

  const stopDrawing = () => {
    setIsDrawing(false)
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  const saveDrawing = async () => {
    const canvas = canvasRef.current
    if (!canvas) return

    canvas.toBlob(async (blob) => {
      if (!blob) return
      const file = new File([blob], 'drawing.png', { type: 'image/png' })
      await uploadImage(file)
      setShowDrawing(false)
    }, 'image/png')
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Quick Actions Bar */}
      <div className="flex flex-wrap items-center gap-2 p-2 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-gray-800 dark:to-gray-700 rounded-lg border">
        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploading}
          className="flex items-center gap-1 px-3 py-1.5 rounded text-sm font-medium bg-white dark:bg-gray-600 shadow-sm hover:shadow transition">
          {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4 text-green-600" />} Image
        </button>
        <button type="button" onClick={insertCodeBlock}
          className="flex items-center gap-1 px-3 py-1.5 rounded text-sm font-medium bg-white dark:bg-gray-600 shadow-sm hover:shadow transition">
          <Code className="h-4 w-4 text-blue-600" /> Code
        </button>
        <button type="button" onClick={insertTable}
          className="flex items-center gap-1 px-3 py-1.5 rounded text-sm font-medium bg-white dark:bg-gray-600 shadow-sm hover:shadow transition">
          <Table className="h-4 w-4 text-orange-600" /> Tableau
        </button>
        <button type="button" onClick={() => setShowDrawing(!showDrawing)}
          className={`flex items-center gap-1 px-3 py-1.5 rounded text-sm font-medium shadow-sm hover:shadow transition ${showDrawing ? 'bg-purple-500 text-white' : 'bg-white dark:bg-gray-600'}`}>
          <Pencil className="h-4 w-4" /> Dessiner
        </button>
        <button type="button" onClick={() => setShowShortcuts(!showShortcuts)}
          className={`flex items-center gap-1 px-3 py-1.5 rounded text-sm font-medium shadow-sm hover:shadow transition ${showShortcuts ? 'bg-gray-700 text-white' : 'bg-white dark:bg-gray-600'}`}>
          <Keyboard className="h-4 w-4" /> Raccourcis
        </button>
        <div className="flex-1" />
        <button type="button" onClick={() => setShowPreview(!showPreview)}
          className={`flex items-center gap-1 px-3 py-1.5 rounded text-sm font-medium shadow-sm transition ${showPreview ? 'bg-purple-500 text-white' : 'bg-white dark:bg-gray-600 hover:shadow'}`}>
          {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4 text-purple-600" />}
          {showPreview ? 'Masquer' : 'Aperçu'}
        </button>
      </div>
      <input type="file" ref={fileInputRef} onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])} accept="image/*" className="hidden" />

      {/* Shortcuts Panel */}
      {showShortcuts && (
        <div className="bg-gray-900 text-white rounded-lg p-4 shadow-lg">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Keyboard className="h-5 w-5" /> Raccourcis clavier
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <kbd className="px-2 py-1 bg-gray-700 rounded text-xs">Ctrl+M</kbd>
              <span>Math inline $...$</span>
            </div>
            <div className="flex items-center gap-2">
              <kbd className="px-2 py-1 bg-gray-700 rounded text-xs">Ctrl+E</kbd>
              <span>Équation bloc $$...$$</span>
            </div>
            <div className="flex items-center gap-2">
              <kbd className="px-2 py-1 bg-gray-700 rounded text-xs">Ctrl+B</kbd>
              <span>**Gras**</span>
            </div>
            <div className="flex items-center gap-2">
              <kbd className="px-2 py-1 bg-gray-700 rounded text-xs">Ctrl+I</kbd>
              <span>*Italique*</span>
            </div>
            <div className="flex items-center gap-2">
              <kbd className="px-2 py-1 bg-gray-700 rounded text-xs">Ctrl+K</kbd>
              <span>`Code inline`</span>
            </div>
            <div className="flex items-center gap-2">
              <kbd className="px-2 py-1 bg-gray-700 rounded text-xs">Ctrl+L</kbd>
              <span>Liste à puces</span>
            </div>
            <div className="flex items-center gap-2">
              <kbd className="px-2 py-1 bg-gray-700 rounded text-xs">Ctrl+V</kbd>
              <span>Coller image</span>
            </div>
            <div className="flex items-center gap-2">
              <kbd className="px-2 py-1 bg-gray-700 rounded text-xs">Delete</kbd>
              <span>Suppr. image sélect.</span>
            </div>
          </div>
        </div>
      )}

      {/* Drawing Canvas */}
      {showDrawing && (
        <div className="bg-white dark:bg-gray-800 border rounded-lg p-4 shadow-lg">
          <div className="flex items-center gap-3 mb-3">
            <h3 className="font-semibold text-gray-900 dark:text-white">🎨 Dessiner</h3>
            <div className="flex items-center gap-2">
              <input type="color" value={drawingColor} onChange={(e) => setDrawingColor(e.target.value)}
                className="w-8 h-8 rounded cursor-pointer" />
              <select value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))}
                className="px-2 py-1 border rounded text-sm">
                <option value={1}>Fin</option>
                <option value={3}>Normal</option>
                <option value={6}>Épais</option>
                <option value={10}>Très épais</option>
              </select>
            </div>
            <div className="flex-1" />
            <button type="button" onClick={clearCanvas}
              className="flex items-center gap-1 px-2 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded">
              <Eraser className="h-4 w-4" /> Effacer
            </button>
            <button type="button" onClick={saveDrawing}
              className="flex items-center gap-1 px-2 py-1 text-sm bg-green-100 text-green-700 hover:bg-green-200 rounded">
              <Download className="h-4 w-4" /> Insérer
            </button>
          </div>
          <canvas
            ref={canvasRef}
            width={700}
            height={300}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            className="border rounded-lg cursor-crosshair w-full"
            style={{ touchAction: 'none' }}
          />
        </div>
      )}

      {/* LaTeX Symbols */}
      <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
        <div className="flex flex-wrap gap-1 mb-2">
          {symbolCategories.map((cat) => (
            <button key={cat.name} type="button"
              onClick={() => setActiveCategory(activeCategory === cat.name ? null : cat.name)}
              className={`px-2 py-1 text-xs rounded transition ${activeCategory === cat.name ? 'bg-purple-500 text-white' : 'bg-white dark:bg-gray-700 border hover:bg-purple-100 dark:hover:bg-gray-600'}`}>
              {cat.name}
            </button>
          ))}
        </div>
        {activeCategory && (
          <div className="flex flex-wrap gap-1 p-2 bg-white dark:bg-gray-900 rounded border max-h-32 overflow-y-auto">
            {symbolCategories.find(c => c.name === activeCategory)?.symbols.map((sym, i) => (
              <button key={i} type="button" onClick={() => insertLatex(sym.latex)}
                className="px-2 py-1 bg-gray-50 dark:bg-gray-800 border rounded hover:bg-purple-100 dark:hover:bg-purple-900 text-base transition" title={sym.latex}>
                {sym.label}
              </button>
            ))}
          </div>
        )}
        <p className="mt-2 text-xs text-gray-500">
          💡 <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">$x^2$</code> = inline |
          <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded ml-1">$$\frac{"{a}{b}"}$$</code> = bloc |
          <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded ml-1">```python```</code> = code
        </p>
      </div>

      {/* Image Resize Handles (when image selected) */}
      {selectedImage && (
        <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg">
          <span className="text-sm text-blue-700 dark:text-blue-300 font-medium">📐 Redimensionner:</span>

          {/* 8 handles visualization */}
          <div className="flex items-center gap-1 p-2 bg-white dark:bg-gray-800 rounded border">
            <div className="grid grid-cols-3 gap-0.5" style={{ width: '48px', height: '48px' }}>
              {/* Top row */}
              <button type="button" onMouseDown={(e) => startResize('nw', e)}
                className="w-4 h-4 bg-blue-500 hover:bg-blue-600 rounded-sm cursor-nw-resize" title="Coin NO (↖)"/>
              <button type="button" onMouseDown={(e) => startResize('n', e)}
                className="w-4 h-4 bg-green-500 hover:bg-green-600 rounded-sm cursor-n-resize" title="Haut (↑)"/>
              <button type="button" onMouseDown={(e) => startResize('ne', e)}
                className="w-4 h-4 bg-blue-500 hover:bg-blue-600 rounded-sm cursor-ne-resize" title="Coin NE (↗)"/>
              {/* Middle row */}
              <button type="button" onMouseDown={(e) => startResize('w', e)}
                className="w-4 h-4 bg-green-500 hover:bg-green-600 rounded-sm cursor-w-resize" title="Gauche (←)"/>
              <div className="w-4 h-4 bg-gray-200 dark:bg-gray-600 rounded-sm" />
              <button type="button" onMouseDown={(e) => startResize('e', e)}
                className="w-4 h-4 bg-green-500 hover:bg-green-600 rounded-sm cursor-e-resize" title="Droite (→)"/>
              {/* Bottom row */}
              <button type="button" onMouseDown={(e) => startResize('sw', e)}
                className="w-4 h-4 bg-blue-500 hover:bg-blue-600 rounded-sm cursor-sw-resize" title="Coin SO (↙)"/>
              <button type="button" onMouseDown={(e) => startResize('s', e)}
                className="w-4 h-4 bg-green-500 hover:bg-green-600 rounded-sm cursor-s-resize" title="Bas (↓)"/>
              <button type="button" onMouseDown={(e) => startResize('se', e)}
                className="w-4 h-4 bg-blue-500 hover:bg-blue-600 rounded-sm cursor-se-resize" title="Coin SE (↘)"/>
            </div>
          </div>

          <div className="text-xs text-gray-500 dark:text-gray-400">
            <span className="inline-flex items-center gap-1"><span className="w-3 h-3 bg-blue-500 rounded-sm"></span> = Les 2 axes</span>
            <span className="inline-flex items-center gap-1 ml-2"><span className="w-3 h-3 bg-green-500 rounded-sm"></span> = 1 axe</span>
          </div>

          <div className="flex-1" />

          <button type="button" onClick={() => { if(selectedImage) { selectedImage.style.width = 'auto'; selectedImage.style.height = 'auto'; handleInput() }}}
            className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 border rounded hover:bg-gray-200">
            <RotateCcw className="h-3 w-3 inline mr-1" /> Reset
          </button>

          <button type="button" onClick={deleteSelectedImage}
            className="px-2 py-1 text-xs bg-red-100 text-red-700 border border-red-200 rounded hover:bg-red-200">
            <X className="h-3 w-3 inline mr-1" /> Supprimer
          </button>
        </div>
      )}

      {/* WYSIWYG Editor - contenteditable */}
      <div
        ref={editorRef}
        contentEditable
        className="border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 min-h-[300px] max-h-[600px] overflow-y-auto p-4 focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 dark:text-gray-100 text-sm leading-relaxed"
        onInput={handleInput}
        onPaste={handlePaste}
        onClick={handleEditorClick}
        onKeyDown={handleKeyDown}
        onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer?.files?.[0]; if (f?.type.startsWith('image/')) uploadImage(f) }}
        onDragOver={(e) => e.preventDefault()}
        data-placeholder={placeholder}
        style={{ whiteSpace: 'pre-wrap' }}
      />

      {isUploading && (
        <div className="p-3 bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-700 rounded-lg flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
          <span className="text-sm text-purple-700 dark:text-purple-300">Upload en cours...</span>
        </div>
      )}

      {/* Preview */}
      {showPreview && (
        <div className="border border-purple-300 dark:border-purple-700 rounded-lg overflow-hidden">
          <div className="bg-purple-100 dark:bg-purple-900/50 px-4 py-2 border-b border-purple-300 dark:border-purple-700">
            <span className="text-sm font-semibold text-purple-700 dark:text-purple-300">📄 Aperçu (LaTeX, code, tableaux)</span>
          </div>
          <div className="p-4 bg-white dark:bg-gray-900 min-h-[150px] max-h-[500px] overflow-y-auto">
            {value ? (
              <div
                className="prose prose-sm max-w-none dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            ) : (
              <p className="text-gray-400 italic">L'aperçu apparaîtra ici...</p>
            )}
          </div>
        </div>
      )}

      <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-2 rounded-lg">
        💡 <strong>Ctrl+M</strong> = formule | <strong>Ctrl+V</strong> = coller image | Clic sur image = redimensionner
      </div>

      <style jsx>{`
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: #9ca3af;
          pointer-events: none;
        }
        .code-block {
          font-family: 'Fira Code', 'Monaco', 'Consolas', monospace;
        }
      `}</style>
    </div>
  )
}
