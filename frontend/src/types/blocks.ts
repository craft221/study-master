/**
 * Types pour l'éditeur par blocs (Notion-like)
 */

export type BlockType =
  | 'paragraph'
  | 'heading_1'
  | 'heading_2'
  | 'heading_3'
  | 'bulleted_list'
  | 'numbered_list'
  | 'toggle'
  | 'callout'
  | 'quote'
  | 'code'
  | 'math'
  | 'divider'
  | 'image'
  | 'table'

export interface BaseBlock {
  id: string
  type: BlockType
}

export interface ParagraphBlock extends BaseBlock {
  type: 'paragraph'
  content: string
}

export interface HeadingBlock extends BaseBlock {
  type: 'heading_1' | 'heading_2' | 'heading_3'
  content: string
  isToggleable?: boolean
  children?: Block[]
}

export interface BulletedListBlock extends BaseBlock {
  type: 'bulleted_list'
  content: string
  children?: Block[]
}

export interface NumberedListBlock extends BaseBlock {
  type: 'numbered_list'
  content: string
  children?: Block[]
}

export interface ToggleBlock extends BaseBlock {
  type: 'toggle'
  content: string
  children: Block[]
  isOpen?: boolean
}

export interface CalloutBlock extends BaseBlock {
  type: 'callout'
  content: string
  icon: string
  color: 'yellow' | 'blue' | 'green' | 'red' | 'purple' | 'gray'
}

export interface QuoteBlock extends BaseBlock {
  type: 'quote'
  content: string
}

export interface CodeBlock extends BaseBlock {
  type: 'code'
  content: string
  language: string
}

export interface MathBlock extends BaseBlock {
  type: 'math'
  content: string
}

export interface DividerBlock extends BaseBlock {
  type: 'divider'
}

export interface ImageBlock extends BaseBlock {
  type: 'image'
  url: string
  caption?: string
  width?: number
  height?: number
  alignment?: 'left' | 'center' | 'right'
}

export interface TableBlock extends BaseBlock {
  type: 'table'
  rows: string[][]
  hasHeader?: boolean
}

export type Block =
  | ParagraphBlock
  | HeadingBlock
  | BulletedListBlock
  | NumberedListBlock
  | ToggleBlock
  | CalloutBlock
  | QuoteBlock
  | CodeBlock
  | MathBlock
  | DividerBlock
  | ImageBlock
  | TableBlock

// Définition des commandes slash
export interface SlashCommand {
  id: BlockType
  label: string
  description: string
  icon: string
  shortcut?: string
  keywords: string[]
}

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    id: 'paragraph',
    label: 'Texte',
    description: 'Texte simple',
    icon: 'Aa',
    keywords: ['text', 'paragraph', 'texte', 'paragraphe'],
  },
  {
    id: 'heading_1',
    label: 'Titre 1',
    description: 'Grand titre de section',
    icon: 'H1',
    shortcut: '# ',
    keywords: ['h1', 'heading', 'titre', 'header'],
  },
  {
    id: 'heading_2',
    label: 'Titre 2',
    description: 'Titre de sous-section',
    icon: 'H2',
    shortcut: '## ',
    keywords: ['h2', 'heading', 'titre', 'sous-titre'],
  },
  {
    id: 'heading_3',
    label: 'Titre 3',
    description: 'Petit titre',
    icon: 'H3',
    shortcut: '### ',
    keywords: ['h3', 'heading', 'titre'],
  },
  {
    id: 'bulleted_list',
    label: 'Liste',
    description: 'Liste à puces',
    icon: '•',
    shortcut: '- ',
    keywords: ['list', 'bullet', 'liste', 'puces', 'ul'],
  },
  {
    id: 'numbered_list',
    label: 'Liste numérotée',
    description: 'Liste numérotée',
    icon: '1.',
    shortcut: '1. ',
    keywords: ['numbered', 'list', 'numéro', 'ol', 'ordered'],
  },
  {
    id: 'toggle',
    label: 'Toggle',
    description: 'Contenu pliable',
    icon: '▶',
    shortcut: '> ',
    keywords: ['toggle', 'collapse', 'pliable', 'dropdown', 'spoiler'],
  },
  {
    id: 'callout',
    label: 'Callout',
    description: 'Encadré avec icône',
    icon: '💡',
    keywords: ['callout', 'note', 'warning', 'info', 'encadré', 'important'],
  },
  {
    id: 'quote',
    label: 'Citation',
    description: 'Citation ou extrait',
    icon: '"',
    shortcut: '" ',
    keywords: ['quote', 'citation', 'blockquote'],
  },
  {
    id: 'code',
    label: 'Code',
    description: 'Bloc de code',
    icon: '</>',
    shortcut: '```',
    keywords: ['code', 'snippet', 'programming', 'script'],
  },
  {
    id: 'math',
    label: 'Équation',
    description: 'Formule mathématique LaTeX',
    icon: '∑',
    shortcut: '$$',
    keywords: ['math', 'equation', 'latex', 'formule', 'maths'],
  },
  {
    id: 'divider',
    label: 'Séparateur',
    description: 'Ligne de séparation',
    icon: '—',
    shortcut: '---',
    keywords: ['divider', 'separator', 'hr', 'ligne', 'séparateur'],
  },
  {
    id: 'image',
    label: 'Image',
    description: 'Ajouter une image',
    icon: '📷',
    keywords: ['image', 'photo', 'picture', 'img'],
  },
  {
    id: 'table',
    label: 'Tableau',
    description: 'Tableau simple',
    icon: '📊',
    keywords: ['table', 'tableau', 'grid', 'spreadsheet'],
  },
]

// Couleurs disponibles pour les callouts
export const CALLOUT_COLORS = {
  yellow: {
    bg: 'bg-yellow-50 dark:bg-yellow-900/30',
    border: 'border-yellow-200 dark:border-yellow-800',
    text: 'text-yellow-800 dark:text-yellow-200',
  },
  blue: {
    bg: 'bg-blue-50 dark:bg-blue-900/30',
    border: 'border-blue-200 dark:border-blue-800',
    text: 'text-blue-800 dark:text-blue-200',
  },
  green: {
    bg: 'bg-green-50 dark:bg-green-900/30',
    border: 'border-green-200 dark:border-green-800',
    text: 'text-green-800 dark:text-green-200',
  },
  red: {
    bg: 'bg-red-50 dark:bg-red-900/30',
    border: 'border-red-200 dark:border-red-800',
    text: 'text-red-800 dark:text-red-200',
  },
  purple: {
    bg: 'bg-purple-50 dark:bg-purple-900/30',
    border: 'border-purple-200 dark:border-purple-800',
    text: 'text-purple-800 dark:text-purple-200',
  },
  gray: {
    bg: 'bg-gray-100 dark:bg-gray-800',
    border: 'border-gray-200 dark:border-gray-700',
    text: 'text-gray-700 dark:text-gray-300',
  },
}

// Emojis rapides pour les callouts
export const CALLOUT_ICONS = ['💡', '⚠️', '📌', '🔥', '✅', '❌', '📝', '🎯', '💪', '🧠', '📚', '🔍']

// Langages de code supportés
export const CODE_LANGUAGES = [
  { id: 'javascript', label: 'JavaScript' },
  { id: 'typescript', label: 'TypeScript' },
  { id: 'python', label: 'Python' },
  { id: 'java', label: 'Java' },
  { id: 'cpp', label: 'C++' },
  { id: 'c', label: 'C' },
  { id: 'csharp', label: 'C#' },
  { id: 'go', label: 'Go' },
  { id: 'rust', label: 'Rust' },
  { id: 'php', label: 'PHP' },
  { id: 'ruby', label: 'Ruby' },
  { id: 'swift', label: 'Swift' },
  { id: 'kotlin', label: 'Kotlin' },
  { id: 'sql', label: 'SQL' },
  { id: 'html', label: 'HTML' },
  { id: 'css', label: 'CSS' },
  { id: 'json', label: 'JSON' },
  { id: 'yaml', label: 'YAML' },
  { id: 'markdown', label: 'Markdown' },
  { id: 'bash', label: 'Bash' },
  { id: 'plaintext', label: 'Texte brut' },
]

// Helper pour créer un nouveau bloc
export function createBlock(type: BlockType, content: string = ''): Block {
  const id = crypto.randomUUID()

  switch (type) {
    case 'paragraph':
      return { id, type, content }
    case 'heading_1':
    case 'heading_2':
    case 'heading_3':
      return { id, type, content }
    case 'bulleted_list':
    case 'numbered_list':
      return { id, type, content, children: [] }
    case 'toggle':
      return { id, type, content, children: [], isOpen: true }
    case 'callout':
      return { id, type, content, icon: '💡', color: 'yellow' }
    case 'quote':
      return { id, type, content }
    case 'code':
      return { id, type, content, language: 'javascript' }
    case 'math':
      return { id, type, content }
    case 'divider':
      return { id, type }
    case 'image':
      return { id, type, url: '', caption: '', alignment: 'center' }
    case 'table':
      return { id, type, rows: [['', ''], ['', '']], hasHeader: true }
    default:
      return { id, type: 'paragraph', content }
  }
}
