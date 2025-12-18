'use client'

import * as React from 'react'
import { Check, Search, X, Loader2 } from 'lucide-react'

interface UniversitySelectProps {
  value?: string
  onChange: (value: string) => void
  disabled?: boolean
  className?: string
}

export default function UniversitySelect({ value, onChange, disabled, className }: UniversitySelectProps) {
  const [inputValue, setInputValue] = React.useState(value || '')
  const [options, setOptions] = React.useState<Array<{ name: string; country: string }>>([])
  const [loading, setLoading] = React.useState(false)
  const [showDropdown, setShowDropdown] = React.useState(false)
  const [showCustomInput, setShowCustomInput] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync avec la value externe
  React.useEffect(() => {
    if (value !== undefined) {
      setInputValue(value)
    }
  }, [value])

  // Fermer le dropdown quand on clique ailleurs
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
        setShowCustomInput(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Mapping des codes pays
  const countryNames: Record<string, string> = {
    'SN': 'Sénégal', 'CI': 'Côte d\'Ivoire', 'MA': 'Maroc', 'TN': 'Tunisie',
    'CM': 'Cameroun', 'FR': 'France', 'BE': 'Belgique', 'CH': 'Suisse',
    'CA': 'Canada', 'US': 'États-Unis', 'GB': 'Royaume-Uni', 'DE': 'Allemagne',
    'DZ': 'Algérie', 'EG': 'Égypte', 'NG': 'Nigeria', 'GH': 'Ghana',
    'KE': 'Kenya', 'ZA': 'Afrique du Sud', 'ML': 'Mali', 'BF': 'Burkina Faso'
  }

  // Recherche API
  const fetchUniversities = async (query: string) => {
    try {
      console.log('Fetching universities for:', query)
      const response = await fetch(`/api/universities/search?name=${encodeURIComponent(query)}`)
      console.log('Response status:', response.status)
      if (response.ok) {
        const results = await response.json()
        console.log('Results:', results)
        const mapped = results.map((uni: any) => ({
          name: uni.name,
          country: countryNames[uni.alpha_two_code] || uni.country
        }))
        setOptions(mapped)
      } else {
        setOptions([])
      }
    } catch (error) {
      console.error('Erreur recherche:', error)
      setOptions([])
    } finally {
      setLoading(false)
    }
  }

  // Gestion de la saisie
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value
    setInputValue(query)
    setShowDropdown(true)
    setShowCustomInput(false)

    if (query.length < 2) {
      setOptions([])
      setLoading(false)
      return
    }

    // Debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    setLoading(true)
    debounceRef.current = setTimeout(() => {
      fetchUniversities(query)
    }, 300)
  }

  // Sélection d'une université
  const handleSelect = (name: string) => {
    setInputValue(name)
    onChange(name)
    setShowDropdown(false)
    setOptions([])
  }

  // Clear
  const handleClear = () => {
    setInputValue('')
    onChange('')
    setOptions([])
    setShowDropdown(false)
  }

  // Validation manuelle (quand on quitte le champ)
  const handleBlur = () => {
    // Petite tempo pour permettre le clic sur une option
    setTimeout(() => {
      if (inputValue && inputValue !== value) {
        onChange(inputValue)
      }
    }, 200)
  }

  return (
    <div ref={containerRef} className={`relative ${className || ''}`}>
      {/* Input principal */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => inputValue.length >= 2 && setShowDropdown(true)}
          onBlur={handleBlur}
          disabled={disabled}
          placeholder="Tapez le nom de votre université..."
          className="w-full h-11 pl-11 pr-10 rounded-lg border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50"
        />
        {inputValue && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Dropdown des résultats */}
      {showDropdown && inputValue.length >= 2 && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-64 overflow-y-auto">
          {loading ? (
            <div className="py-6 text-center text-sm text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
              <p>Recherche en cours...</p>
            </div>
          ) : options.length === 0 ? (
            <div className="py-4 text-center">
              <p className="text-sm text-gray-500 mb-3">Aucune université trouvée pour "{inputValue}"</p>
              {!showCustomInput ? (
                <button
                  type="button"
                  onClick={() => setShowCustomInput(true)}
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                >
                  → Utiliser ce nom tel quel
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleSelect(inputValue)}
                  className="px-4 py-2 bg-primary-600 text-white text-sm rounded-md hover:bg-primary-700"
                >
                  Confirmer "{inputValue}"
                </button>
              )}
            </div>
          ) : (
            <>
              {options.map((option, index) => (
                <button
                  key={`${option.name}-${index}`}
                  type="button"
                  onClick={() => handleSelect(option.name)}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-gray-100 border-b border-gray-50 last:border-0 ${option.name === value ? 'bg-primary-50 text-primary-700' : ''}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{option.name}</div>
                    <div className="text-xs text-gray-500">{option.country}</div>
                  </div>
                  {option.name === value && (
                    <Check className="h-4 w-4 text-primary-600 flex-shrink-0" />
                  )}
                </button>
              ))}
              <div className="border-t border-gray-100 p-2">
                <button
                  type="button"
                  onClick={() => handleSelect(inputValue)}
                  className="w-full text-center text-sm text-gray-500 hover:text-primary-600 py-2"
                >
                  Pas dans la liste ? Utiliser "{inputValue}"
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
