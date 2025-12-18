'use client'

import * as React from 'react'
import { Check, ChevronsUpDown, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ComboboxOption {
  value: string
  label: string
  description?: string
  icon?: React.ReactNode
  group?: string
}

interface ComboboxProps {
  options: ComboboxOption[]
  value?: string
  onChange: (value: string) => void
  onSearch?: (query: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  disabled?: boolean
  className?: string
  allowCustomValue?: boolean
  customValueLabel?: string
}

export function Combobox({
  options,
  value,
  onChange,
  onSearch,
  placeholder = 'Sélectionner...',
  searchPlaceholder = 'Rechercher...',
  emptyMessage = 'Aucun résultat.',
  disabled = false,
  className,
  allowCustomValue = false,
  customValueLabel = 'Autre:'
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')
  const [customValue, setCustomValue] = React.useState('')
  const containerRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  // Fermer le dropdown quand on clique ailleurs
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Filtrer les options
  const filteredOptions = React.useMemo(() => {
    if (!search) return options
    const normalizedSearch = search.toLowerCase()
    return options.filter(option =>
      option.label.toLowerCase().includes(normalizedSearch) ||
      option.description?.toLowerCase().includes(normalizedSearch)
    )
  }, [options, search])

  // Grouper les options
  const groupedOptions = React.useMemo(() => {
    const groups: Record<string, ComboboxOption[]> = {}
    filteredOptions.forEach(option => {
      const group = option.group || ''
      if (!groups[group]) groups[group] = []
      groups[group].push(option)
    })
    return groups
  }, [filteredOptions])

  // Trouver l'option sélectionnée
  const selectedOption = options.find(opt => opt.value === value)

  // Gérer la recherche
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value
    setSearch(query)
    onSearch?.(query)
  }

  // Gérer la sélection
  const handleSelect = (optionValue: string) => {
    onChange(optionValue)
    setOpen(false)
    setSearch('')
  }

  // Gérer la valeur personnalisée
  const handleCustomValueSubmit = () => {
    if (customValue.trim()) {
      onChange(`custom:${customValue.trim()}`)
      setOpen(false)
      setCustomValue('')
      setSearch('')
    }
  }

  // Clear selection
  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange('')
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className={cn(
          'flex h-11 w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-4 py-2 text-left text-sm',
          'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent',
          'disabled:cursor-not-allowed disabled:opacity-50',
          open && 'ring-2 ring-primary-500 border-transparent'
        )}
      >
        <span className={cn('truncate', !selectedOption && 'text-gray-400')}>
          {selectedOption
            ? selectedOption.label
            : value?.startsWith('custom:')
              ? value.replace('custom:', '')
              : placeholder
          }
        </span>
        <div className="flex items-center gap-1">
          {value && (
            <X
              className="h-4 w-4 text-gray-400 hover:text-gray-600 cursor-pointer"
              onClick={handleClear}
            />
          )}
          <ChevronsUpDown className="h-4 w-4 text-gray-400" />
        </div>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
          {/* Search Input */}
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={handleSearchChange}
                placeholder={searchPlaceholder}
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                autoFocus
              />
            </div>
          </div>

          {/* Options List */}
          <div className="max-h-60 overflow-y-auto p-1">
            {Object.keys(groupedOptions).length === 0 ? (
              <div className="py-6 text-center text-sm text-gray-500">
                {emptyMessage}
              </div>
            ) : (
              Object.entries(groupedOptions).map(([group, groupOptions]) => (
                <div key={group}>
                  {group && (
                    <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50">
                      {group}
                    </div>
                  )}
                  {groupOptions.map(option => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleSelect(option.value)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm',
                        'hover:bg-gray-100 focus:bg-gray-100 focus:outline-none',
                        option.value === value && 'bg-primary-50 text-primary-700'
                      )}
                    >
                      {option.icon && (
                        <span className="flex-shrink-0">{option.icon}</span>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{option.label}</div>
                        {option.description && (
                          <div className="text-xs text-gray-500 truncate">
                            {option.description}
                          </div>
                        )}
                      </div>
                      {option.value === value && (
                        <Check className="h-4 w-4 text-primary-600 flex-shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              ))
            )}

            {/* Option pour valeur personnalisée */}
            {allowCustomValue && search && filteredOptions.length === 0 && (
              <div className="p-2 border-t border-gray-100">
                <div className="text-xs text-gray-500 mb-2">{customValueLabel}</div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customValue || search}
                    onChange={(e) => setCustomValue(e.target.value)}
                    placeholder="Entrez votre valeur..."
                    className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <button
                    type="button"
                    onClick={handleCustomValueSubmit}
                    className="px-4 py-2 bg-primary-600 text-white text-sm rounded-md hover:bg-primary-700"
                  >
                    OK
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Version avec API pour l'université
interface UniversityComboboxProps {
  value?: string
  onChange: (value: string) => void
  disabled?: boolean
  className?: string
}

export function UniversityCombobox({ value, onChange, disabled, className }: UniversityComboboxProps) {
  const [mounted, setMounted] = React.useState(false)
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')
  const [options, setOptions] = React.useState<ComboboxOption[]>([])
  const [loading, setLoading] = React.useState(false)
  const [showCustomInput, setShowCustomInput] = React.useState(false)
  const [customValue, setCustomValue] = React.useState('')
  const containerRef = React.useRef<HTMLDivElement>(null)
  const debounceRef = React.useRef<NodeJS.Timeout | null>(null)

  // Éviter les erreurs d'hydratation
  React.useEffect(() => {
    setMounted(true)
  }, [])

  // Rendu placeholder côté serveur
  if (!mounted) {
    return (
      <div className={cn('relative', className)}>
        <div className="flex h-11 w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-4 py-2 text-left text-sm text-gray-400">
          Sélectionner une université
        </div>
      </div>
    )
  }

  // Fermer le dropdown quand on clique ailleurs
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
        setShowCustomInput(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Recherche avec debounce via l'API
  const handleSearch = (query: string) => {
    setSearch(query)
    setShowCustomInput(false)

    if (query.length < 2) {
      setOptions([])
      setLoading(false)
      return
    }

    // Debounce de 300ms
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    setLoading(true)

    debounceRef.current = setTimeout(() => {
      fetchUniversities(query)
    }, 300)
  }

  // Fonction séparée pour l'appel API
  const fetchUniversities = async (query: string) => {
    try {
      const response = await fetch(`/api/universities/search?name=${encodeURIComponent(query)}`)

      if (!response.ok) {
        throw new Error('Erreur API')
      }

      const results = await response.json()

      // Mapping des codes pays
      const countryNames: Record<string, string> = {
        'SN': 'Sénégal', 'CI': 'Côte d\'Ivoire', 'MA': 'Maroc', 'TN': 'Tunisie',
        'CM': 'Cameroun', 'FR': 'France', 'BE': 'Belgique', 'CH': 'Suisse',
        'CA': 'Canada', 'US': 'États-Unis', 'GB': 'Royaume-Uni', 'DE': 'Allemagne',
        'DZ': 'Algérie', 'EG': 'Égypte', 'NG': 'Nigeria', 'GH': 'Ghana',
        'KE': 'Kenya', 'ZA': 'Afrique du Sud', 'ML': 'Mali', 'BF': 'Burkina Faso'
      }

      const newOptions: ComboboxOption[] = results.map((uni: any) => ({
        value: uni.name,
        label: uni.name,
        description: countryNames[uni.alpha_two_code] || uni.country
      }))

      setOptions(newOptions)
    } catch (error) {
      console.error('Erreur recherche:', error)
      setOptions([])
    } finally {
      setLoading(false)
    }
  }

  // Gérer la sélection
  const handleSelect = (selectedValue: string) => {
    onChange(selectedValue)
    setOpen(false)
    setSearch('')
    setShowCustomInput(false)
  }

  // Gérer la valeur personnalisée
  const handleCustomSubmit = () => {
    if (customValue.trim()) {
      onChange(customValue.trim())
      setOpen(false)
      setCustomValue('')
      setShowCustomInput(false)
      setSearch('')
    }
  }

  // Clear
  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange('')
    setSearch('')
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className={cn(
          'flex h-11 w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-4 py-2 text-left text-sm',
          'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent',
          'disabled:cursor-not-allowed disabled:opacity-50',
          open && 'ring-2 ring-primary-500 border-transparent'
        )}
      >
        <span className={cn('truncate', !value && 'text-gray-400')}>
          {value || 'Sélectionner une université'}
        </span>
        <div className="flex items-center gap-1">
          {value && (
            <X
              className="h-4 w-4 text-gray-400 hover:text-gray-600 cursor-pointer"
              onClick={handleClear}
            />
          )}
          <ChevronsUpDown className="h-4 w-4 text-gray-400" />
        </div>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
          {/* Search Input */}
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Tapez le nom de votre université..."
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                autoFocus
              />
            </div>
          </div>

          {/* Options List */}
          <div className="max-h-60 overflow-y-auto p-1">
            {loading ? (
              <div className="py-6 text-center text-sm text-gray-500">
                <div className="inline-block w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mb-2" />
                <p>Recherche en cours...</p>
              </div>
            ) : search.length < 2 ? (
              <div className="py-6 text-center text-sm text-gray-500">
                <p>Tapez au moins 2 caractères pour rechercher</p>
              </div>
            ) : options.length === 0 && !showCustomInput ? (
              <div className="py-4 text-center">
                <p className="text-sm text-gray-500 mb-3">Aucune université trouvée</p>
                <button
                  type="button"
                  onClick={() => {
                    setShowCustomInput(true)
                    setCustomValue(search)
                  }}
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                >
                  → Entrer le nom manuellement
                </button>
              </div>
            ) : (
              <>
                {options.map((option, index) => (
                  <button
                    key={`${option.value}-${index}`}
                    type="button"
                    onClick={() => handleSelect(option.value)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm',
                      'hover:bg-gray-100 focus:bg-gray-100 focus:outline-none',
                      option.value === value && 'bg-primary-50 text-primary-700'
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{option.label}</div>
                      {option.description && (
                        <div className="text-xs text-gray-500 truncate">
                          {option.description}
                        </div>
                      )}
                    </div>
                    {option.value === value && (
                      <Check className="h-4 w-4 text-primary-600 flex-shrink-0" />
                    )}
                  </button>
                ))}

                {/* Option pour entrer manuellement */}
                {options.length > 0 && (
                  <div className="border-t border-gray-100 mt-1 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCustomInput(true)
                        setCustomValue(search)
                      }}
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-gray-500 hover:bg-gray-50"
                    >
                      <span>Université non trouvée ?</span>
                      <span className="text-primary-600 font-medium">Entrer manuellement</span>
                    </button>
                  </div>
                )}
              </>
            )}

            {/* Custom Input */}
            {showCustomInput && (
              <div className="p-3 border-t border-gray-100 bg-gray-50">
                <p className="text-xs text-gray-600 mb-2">
                  Entrez le nom exact de votre université :
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customValue}
                    onChange={(e) => setCustomValue(e.target.value)}
                    placeholder="Nom de l'université..."
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleCustomSubmit}
                    disabled={!customValue.trim()}
                    className="px-4 py-2 bg-primary-600 text-white text-sm rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    OK
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Version simplifiée pour les filières
interface MajorComboboxProps {
  value?: string
  onChange: (value: string) => void
  disabled?: boolean
  className?: string
}

export function MajorCombobox({ value, onChange, disabled, className }: MajorComboboxProps) {
  const [mounted, setMounted] = React.useState(false)
  const [options, setOptions] = React.useState<ComboboxOption[]>([])
  const { majors, searchMajors, categoryLabels, getMajorById } = React.useMemo(() => {
    const data = require('@/data/majors')
    return {
      majors: data.majors,
      searchMajors: data.searchMajors,
      categoryLabels: data.categoryLabels,
      getMajorById: data.getMajorById
    }
  }, [])

  // Éviter les erreurs d'hydratation
  React.useEffect(() => {
    setMounted(true)
  }, [])

  // Rendu placeholder côté serveur
  if (!mounted) {
    return (
      <div className={cn('relative', className)}>
        <div className="flex h-11 w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-4 py-2 text-left text-sm text-gray-400">
          Sélectionner une filière
        </div>
      </div>
    )
  }

  // Options par défaut - on stocke le nom, pas l'ID
  React.useEffect(() => {
    const defaultOptions = majors.slice(0, 20).map((major: any) => ({
      value: major.name, // Stocker le nom directement
      label: major.name,
      group: categoryLabels[major.category]
    }))
    setOptions(defaultOptions)
  }, [majors, categoryLabels])

  // Recherche
  const handleSearch = (query: string) => {
    if (query.length < 2) {
      const defaultOptions = majors.slice(0, 20).map((major: any) => ({
        value: major.name,
        label: major.name,
        group: categoryLabels[major.category]
      }))
      setOptions(defaultOptions)
      return
    }

    const results = searchMajors(query)
    const newOptions = results.map((major: any) => ({
      value: major.name,
      label: major.name,
      group: categoryLabels[major.category]
    }))
    setOptions(newOptions)
  }

  return (
    <Combobox
      options={options}
      value={value}
      onChange={onChange}
      onSearch={handleSearch}
      placeholder="Sélectionner une filière"
      searchPlaceholder="Rechercher par domaine ou spécialité..."
      emptyMessage="Aucune filière trouvée"
      disabled={disabled}
      className={className}
      allowCustomValue={true}
      customValueLabel="Filière non listée ?"
    />
  )
}
