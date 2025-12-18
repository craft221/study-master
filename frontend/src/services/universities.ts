// Service pour l'API Hipo Universities
// Documentation: https://github.com/Hipo/university-domains-list-api
// API gratuite avec +10,000 universités dans le monde
// On utilise un proxy local pour éviter les problèmes CORS/Mixed Content

const API_BASE_URL = '/api/universities'

export interface UniversityResult {
  name: string
  country: string
  alpha_two_code: string // Code pays ISO (ex: "SN", "FR")
  domains: string[]
  web_pages: string[]
  'state-province': string | null
}

// Cache pour éviter les appels répétés
const cache = new Map<string, { data: UniversityResult[]; timestamp: number }>()
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

/**
 * Recherche des universités par nom
 * @param query - Terme de recherche (min 2 caractères)
 * @param country - Filtrer par pays (optionnel)
 * @returns Liste des universités correspondantes
 */
export async function searchUniversities(
  query: string,
  country?: string
): Promise<UniversityResult[]> {
  if (!query || query.length < 2) {
    return []
  }

  // Construire la clé de cache
  const cacheKey = `${query.toLowerCase()}-${country || 'all'}`

  // Vérifier le cache
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data
  }

  try {
    // Construire l'URL
    let url = `${API_BASE_URL}/search?name=${encodeURIComponent(query)}`
    if (country) {
      url += `&country=${encodeURIComponent(country)}`
    }

    console.log('Recherche université:', url)

    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data: UniversityResult[] = await response.json()

    // Mettre en cache
    cache.set(cacheKey, { data, timestamp: Date.now() })

    // Limiter à 15 résultats et trier par pertinence
    return data
      .sort((a, b) => {
        // Prioriser les correspondances exactes au début du nom
        const aStartsWith = a.name.toLowerCase().startsWith(query.toLowerCase())
        const bStartsWith = b.name.toLowerCase().startsWith(query.toLowerCase())
        if (aStartsWith && !bStartsWith) return -1
        if (!aStartsWith && bStartsWith) return 1
        return a.name.localeCompare(b.name)
      })
      .slice(0, 15)
  } catch (error) {
    console.error('Erreur recherche universités:', error)
    return []
  }
}

/**
 * Recherche des universités par pays
 * @param country - Nom du pays en anglais
 * @returns Liste des universités du pays
 */
export async function getUniversitiesByCountry(
  country: string
): Promise<UniversityResult[]> {
  const cacheKey = `country-${country.toLowerCase()}`

  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/search?country=${encodeURIComponent(country)}`
    )

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data: UniversityResult[] = await response.json()

    cache.set(cacheKey, { data, timestamp: Date.now() })

    return data.sort((a, b) => a.name.localeCompare(b.name))
  } catch (error) {
    console.error('Erreur chargement universités par pays:', error)
    return []
  }
}

// Liste des pays populaires pour le dropdown initial
export const popularCountries = [
  { code: 'SN', name: 'Senegal', nameFr: 'Sénégal' },
  { code: 'CI', name: 'Ivory Coast', nameFr: 'Côte d\'Ivoire' },
  { code: 'MA', name: 'Morocco', nameFr: 'Maroc' },
  { code: 'TN', name: 'Tunisia', nameFr: 'Tunisie' },
  { code: 'CM', name: 'Cameroon', nameFr: 'Cameroun' },
  { code: 'FR', name: 'France', nameFr: 'France' },
  { code: 'BE', name: 'Belgium', nameFr: 'Belgique' },
  { code: 'CH', name: 'Switzerland', nameFr: 'Suisse' },
  { code: 'CA', name: 'Canada', nameFr: 'Canada' },
  { code: 'US', name: 'United States', nameFr: 'États-Unis' },
  { code: 'GB', name: 'United Kingdom', nameFr: 'Royaume-Uni' },
  { code: 'DE', name: 'Germany', nameFr: 'Allemagne' },
]

// Mapping des codes pays vers noms français
export const countryCodeToFrench: Record<string, string> = {
  'SN': 'Sénégal',
  'CI': 'Côte d\'Ivoire',
  'MA': 'Maroc',
  'TN': 'Tunisie',
  'CM': 'Cameroun',
  'FR': 'France',
  'BE': 'Belgique',
  'CH': 'Suisse',
  'CA': 'Canada',
  'US': 'États-Unis',
  'GB': 'Royaume-Uni',
  'DE': 'Allemagne',
  'ES': 'Espagne',
  'IT': 'Italie',
  'PT': 'Portugal',
  'NL': 'Pays-Bas',
  'DZ': 'Algérie',
  'EG': 'Égypte',
  'NG': 'Nigeria',
  'GH': 'Ghana',
  'KE': 'Kenya',
  'ZA': 'Afrique du Sud',
  'ET': 'Éthiopie',
  'ML': 'Mali',
  'BF': 'Burkina Faso',
  'NE': 'Niger',
  'BJ': 'Bénin',
  'TG': 'Togo',
  'GA': 'Gabon',
  'CG': 'Congo',
  'CD': 'RD Congo',
  'MG': 'Madagascar',
  'MU': 'Maurice',
}

/**
 * Obtenir le nom français d'un pays à partir du code ISO
 */
export function getCountryNameFr(alphaCode: string): string {
  return countryCodeToFrench[alphaCode] || alphaCode
}
