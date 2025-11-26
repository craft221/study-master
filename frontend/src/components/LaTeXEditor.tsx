'use client'

import { useState, useRef } from 'react'
import {
  FunctionSquare,
  Type,
  Sigma,
  Infinity,
  X,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import MarkdownRenderer from './MarkdownRenderer'

interface LaTeXEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
  className?: string
}

interface SymbolButton {
  label: string
  latex: string
  description?: string
}

const symbolCategories = {
  operations: {
    title: 'Opérations',
    icon: FunctionSquare,
    symbols: [
      { label: 'x²', latex: 'x^{2}', description: 'Exposant' },
      { label: 'x_n', latex: 'x_{n}', description: 'Indice' },
      { label: '√', latex: '\\sqrt{}', description: 'Racine carrée' },
      { label: '∛', latex: '\\sqrt[3]{}', description: 'Racine cubique' },
      { label: 'a/b', latex: '\\frac{a}{b}', description: 'Fraction' },
      { label: '±', latex: '\\pm', description: 'Plus ou moins' },
      { label: '∓', latex: '\\mp', description: 'Moins ou plus' },
      { label: '×', latex: '\\times', description: 'Multiplication' },
      { label: '÷', latex: '\\div', description: 'Division' },
      { label: '·', latex: '\\cdot', description: 'Point multiplication' },
    ]
  },

  greek: {
    title: 'Lettres grecques',
    icon: Sigma,
    symbols: [
      { label: 'α', latex: '\\alpha', description: 'Alpha' },
      { label: 'β', latex: '\\beta', description: 'Beta' },
      { label: 'γ', latex: '\\gamma', description: 'Gamma' },
      { label: 'δ', latex: '\\delta', description: 'Delta' },
      { label: 'ε', latex: '\\epsilon', description: 'Epsilon' },
      { label: 'θ', latex: '\\theta', description: 'Theta' },
      { label: 'λ', latex: '\\lambda', description: 'Lambda' },
      { label: 'μ', latex: '\\mu', description: 'Mu' },
      { label: 'π', latex: '\\pi', description: 'Pi' },
      { label: 'σ', latex: '\\sigma', description: 'Sigma' },
      { label: 'φ', latex: '\\phi', description: 'Phi' },
      { label: 'ω', latex: '\\omega', description: 'Omega' },
      { label: 'Γ', latex: '\\Gamma', description: 'Gamma maj' },
      { label: 'Δ', latex: '\\Delta', description: 'Delta maj' },
      { label: 'Θ', latex: '\\Theta', description: 'Theta maj' },
      { label: 'Λ', latex: '\\Lambda', description: 'Lambda maj' },
      { label: 'Σ', latex: '\\Sigma', description: 'Sigma maj' },
      { label: 'Ω', latex: '\\Omega', description: 'Omega maj' },
    ]
  },

  relations: {
    title: 'Relations',
    icon: Type,
    symbols: [
      { label: '=', latex: '=', description: 'Égal' },
      { label: '≠', latex: '\\neq', description: 'Différent' },
      { label: '<', latex: '<', description: 'Inférieur' },
      { label: '>', latex: '>', description: 'Supérieur' },
      { label: '≤', latex: '\\leq', description: 'Inférieur ou égal' },
      { label: '≥', latex: '\\geq', description: 'Supérieur ou égal' },
      { label: '≈', latex: '\\approx', description: 'Approximativement' },
      { label: '≡', latex: '\\equiv', description: 'Équivalent' },
      { label: '∝', latex: '\\propto', description: 'Proportionnel' },
      { label: '∞', latex: '\\infty', description: 'Infini' },
    ]
  },

  calculus: {
    title: 'Calcul',
    icon: Infinity,
    symbols: [
      { label: '∫', latex: '\\int', description: 'Intégrale' },
      { label: '∫₀¹', latex: '\\int_{0}^{1}', description: 'Intégrale définie' },
      { label: '∑', latex: '\\sum', description: 'Somme' },
      { label: '∑ᵢ', latex: '\\sum_{i=1}^{n}', description: 'Somme indicée' },
      { label: '∏', latex: '\\prod', description: 'Produit' },
      { label: 'lim', latex: '\\lim_{x \\to \\infty}', description: 'Limite' },
      { label: 'd/dx', latex: '\\frac{d}{dx}', description: 'Dérivée' },
      { label: '∂/∂x', latex: '\\frac{\\partial}{\\partial x}', description: 'Dérivée partielle' },
      { label: '∇', latex: '\\nabla', description: 'Nabla' },
      { label: '∆', latex: '\\Delta', description: 'Delta' },
    ]
  },

  templates: {
    title: 'Templates',
    icon: X,
    symbols: [
      { label: 'Matrice 2×2', latex: '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}', description: 'Matrice' },
      { label: 'Vecteur', latex: '\\vec{v}', description: 'Vecteur' },
      { label: 'Chapeau', latex: '\\hat{x}', description: 'Chapeau' },
      { label: 'Barre', latex: '\\bar{x}', description: 'Barre' },
      { label: 'Tilde', latex: '\\tilde{x}', description: 'Tilde' },
      { label: '{...}', latex: '\\{  \\}', description: 'Accolades' },
      { label: '|...|', latex: '|  |', description: 'Valeur absolue' },
      { label: 'Text', latex: '\\text{texte}', description: 'Texte dans formule' },
      { label: 'Espace', latex: '\\quad', description: 'Espace' },
      {
        label: 'Cases',
        latex: '\\begin{cases} a & \\text{si } x > 0 \\\\ b & \\text{sinon} \\end{cases}',
        description: 'Par cas'
      },
    ]
  }
}

export default function LaTeXEditor({
  value,
  onChange,
  placeholder = 'Écris du texte avec LaTeX...',
  rows = 6,
  className = ''
}: LaTeXEditorProps) {
  const [showPreview, setShowPreview] = useState(true)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const insertLatex = (latex: string) => {
    if (!textareaRef.current) return
    const textarea = textareaRef.current
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const text = textarea.value

    const before = text.substring(0, start)
    const after = text.substring(end)

    const needsDollar = !before.endsWith('$') && !after.startsWith('$')
    const newValue = needsDollar
      ? `${before}$${latex}$${after}`
      : `${before}${latex}${after}`

    onChange(newValue)

    setTimeout(() => {
      const newPos = needsDollar ? start + latex.length + 1 : start + latex.length
      textarea.focus()
      textarea.setSelectionRange(newPos, newPos)
    }, 0)
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">

        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Éditeur LaTeX</h3>

          <button
            onClick={() => setShowPreview(!showPreview)}
            className="text-xs px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded"
          >
            {showPreview ? 'Masquer' : 'Afficher'} aperçu
          </button>
        </div>

        <div className="space-y-2">
          {Object.entries(symbolCategories).map(([key, category]) => {
            const Icon = category.icon
            const isActive = activeCategory === key

            return (
              <div key={key} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">

                <button
                  onClick={() => setActiveCategory(isActive ? null : key)}
                  className="w-full flex items-center justify-between p-2 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition"
                >
                  <div className="flex items-center space-x-2">
                    <Icon className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {category.title}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      ({category.symbols.length})
                    </span>
                  </div>

                  {isActive ? (
                    <ChevronUp className="h-4 w-4 text-gray-500" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-gray-500" />
                  )}
                </button>

                {isActive && (
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2">
                    {category.symbols.map((symbol, idx) => (
                      <button
                        key={idx}
                        onClick={() => insertLatex(symbol.latex)}
                        className="p-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded hover:bg-purple-50 dark:hover:bg-purple-900/30 hover:border-purple-400 dark:hover:border-purple-600 transition group relative"
                        title={symbol.description}
                      >
                        <span className="text-lg">{symbol.label}</span>

                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                          {symbol.description}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded text-xs text-blue-700 dark:text-blue-400">
          <strong>Astuce :</strong> Utilise <code>$formule$</code> pour inline, ou <code>$$formule$$</code> pour un bloc.
        </div>
      </div>

      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none text-gray-900 dark:text-gray-100 font-mono text-sm"
      />

      {showPreview && value && (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800">
          <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">APERÇU :</div>
          <MarkdownRenderer content={value} />
        </div>
      )}
    </div>
  )
}
