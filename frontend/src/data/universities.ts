// Base de données des universités avec noms normalisés et alias pour la recherche
// Les utilisateurs sélectionnent depuis cette liste pour garantir la cohérence des filtres

export interface University {
  id: string
  name: string // Nom officiel
  shortName?: string // Acronyme
  aliases: string[] // Alias pour la recherche
  country: string
  city?: string
  type: 'public' | 'private' | 'international'
}

export const universities: University[] = [
  // ============ SÉNÉGAL ============
  {
    id: 'ucad',
    name: 'Université Cheikh Anta Diop de Dakar',
    shortName: 'UCAD',
    aliases: ['ucad', 'cheikh anta diop', 'université dakar', 'ucad dakar'],
    country: 'Sénégal',
    city: 'Dakar',
    type: 'public'
  },
  {
    id: 'ugb',
    name: 'Université Gaston Berger de Saint-Louis',
    shortName: 'UGB',
    aliases: ['ugb', 'gaston berger', 'saint louis', 'saint-louis'],
    country: 'Sénégal',
    city: 'Saint-Louis',
    type: 'public'
  },
  {
    id: 'uasz',
    name: 'Université Assane Seck de Ziguinchor',
    shortName: 'UASZ',
    aliases: ['uasz', 'assane seck', 'ziguinchor'],
    country: 'Sénégal',
    city: 'Ziguinchor',
    type: 'public'
  },
  {
    id: 'uadb',
    name: 'Université Alioune Diop de Bambey',
    shortName: 'UADB',
    aliases: ['uadb', 'alioune diop', 'bambey'],
    country: 'Sénégal',
    city: 'Bambey',
    type: 'public'
  },
  {
    id: 'uth',
    name: 'Université de Thiès',
    shortName: 'UT',
    aliases: ['ut', 'université thiès', 'thies'],
    country: 'Sénégal',
    city: 'Thiès',
    type: 'public'
  },
  {
    id: 'uvs',
    name: 'Université Virtuelle du Sénégal',
    shortName: 'UVS',
    aliases: ['uvs', 'virtuelle', 'université virtuelle'],
    country: 'Sénégal',
    type: 'public'
  },
  {
    id: 'ussein',
    name: 'Université du Sine Saloum El Hadji Ibrahima Niasse',
    shortName: 'USSEIN',
    aliases: ['ussein', 'sine saloum', 'kaolack', 'el hadji ibrahima niasse'],
    country: 'Sénégal',
    city: 'Kaolack',
    type: 'public'
  },
  {
    id: 'esp-dakar',
    name: 'École Supérieure Polytechnique de Dakar',
    shortName: 'ESP',
    aliases: ['esp', 'polytechnique dakar', 'esp dakar'],
    country: 'Sénégal',
    city: 'Dakar',
    type: 'public'
  },
  {
    id: 'ism',
    name: 'Institut Supérieur de Management',
    shortName: 'ISM',
    aliases: ['ism', 'management dakar'],
    country: 'Sénégal',
    city: 'Dakar',
    type: 'private'
  },
  {
    id: 'iam',
    name: 'Institut Africain de Management',
    shortName: 'IAM',
    aliases: ['iam', 'africain management'],
    country: 'Sénégal',
    city: 'Dakar',
    type: 'private'
  },
  {
    id: 'supdeco',
    name: 'Sup de Co Dakar',
    shortName: 'SUPDECO',
    aliases: ['supdeco', 'sup de co', 'supco'],
    country: 'Sénégal',
    city: 'Dakar',
    type: 'private'
  },
  {
    id: 'ucao-dakar',
    name: 'Université Catholique de l\'Afrique de l\'Ouest - Dakar',
    shortName: 'UCAO',
    aliases: ['ucao', 'catholique afrique ouest', 'ucao dakar'],
    country: 'Sénégal',
    city: 'Dakar',
    type: 'private'
  },
  {
    id: 'isep-thies',
    name: 'Institut Supérieur d\'Enseignement Professionnel de Thiès',
    shortName: 'ISEP Thiès',
    aliases: ['isep', 'isep thiès', 'enseignement professionnel'],
    country: 'Sénégal',
    city: 'Thiès',
    type: 'public'
  },

  // ============ CÔTE D'IVOIRE ============
  {
    id: 'ufhb',
    name: 'Université Félix Houphouët-Boigny',
    shortName: 'UFHB',
    aliases: ['ufhb', 'felix houphouet', 'cocody', 'abidjan'],
    country: 'Côte d\'Ivoire',
    city: 'Abidjan',
    type: 'public'
  },
  {
    id: 'ujlg',
    name: 'Université Jean Lorougnon Guédé',
    shortName: 'UJLG',
    aliases: ['ujlg', 'daloa', 'lorougnon guede'],
    country: 'Côte d\'Ivoire',
    city: 'Daloa',
    type: 'public'
  },
  {
    id: 'uao',
    name: 'Université Alassane Ouattara',
    shortName: 'UAO',
    aliases: ['uao', 'bouake', 'alassane ouattara'],
    country: 'Côte d\'Ivoire',
    city: 'Bouaké',
    type: 'public'
  },
  {
    id: 'inphb',
    name: 'Institut National Polytechnique Félix Houphouët-Boigny',
    shortName: 'INP-HB',
    aliases: ['inphb', 'inp-hb', 'polytechnique yamoussoukro'],
    country: 'Côte d\'Ivoire',
    city: 'Yamoussoukro',
    type: 'public'
  },

  // ============ MAROC ============
  {
    id: 'um5',
    name: 'Université Mohammed V de Rabat',
    shortName: 'UM5',
    aliases: ['um5', 'mohammed v', 'mohammed 5', 'rabat'],
    country: 'Maroc',
    city: 'Rabat',
    type: 'public'
  },
  {
    id: 'um6p',
    name: 'Université Mohammed VI Polytechnique',
    shortName: 'UM6P',
    aliases: ['um6p', 'mohammed vi', 'mohammed 6', 'benguerir'],
    country: 'Maroc',
    city: 'Benguerir',
    type: 'private'
  },
  {
    id: 'uca-marrakech',
    name: 'Université Cadi Ayyad de Marrakech',
    shortName: 'UCA',
    aliases: ['uca', 'cadi ayyad', 'marrakech'],
    country: 'Maroc',
    city: 'Marrakech',
    type: 'public'
  },
  {
    id: 'uir',
    name: 'Université Internationale de Rabat',
    shortName: 'UIR',
    aliases: ['uir', 'internationale rabat'],
    country: 'Maroc',
    city: 'Rabat',
    type: 'private'
  },
  {
    id: 'emines',
    name: 'EMINES - School of Industrial Management',
    shortName: 'EMINES',
    aliases: ['emines', 'industrial management'],
    country: 'Maroc',
    city: 'Benguerir',
    type: 'private'
  },

  // ============ TUNISIE ============
  {
    id: 'utunis',
    name: 'Université de Tunis',
    shortName: 'UT',
    aliases: ['ut', 'université tunis', 'tunis'],
    country: 'Tunisie',
    city: 'Tunis',
    type: 'public'
  },
  {
    id: 'ult-tunis',
    name: 'Université Libre de Tunis',
    shortName: 'ULT',
    aliases: ['ult', 'libre tunis'],
    country: 'Tunisie',
    city: 'Tunis',
    type: 'private'
  },
  {
    id: 'esprit',
    name: 'ESPRIT - École Supérieure Privée d\'Ingénierie et de Technologies',
    shortName: 'ESPRIT',
    aliases: ['esprit', 'ingénierie technologies'],
    country: 'Tunisie',
    city: 'Tunis',
    type: 'private'
  },

  // ============ CAMEROUN ============
  {
    id: 'uy1',
    name: 'Université de Yaoundé I',
    shortName: 'UY1',
    aliases: ['uy1', 'yaoundé 1', 'yaounde'],
    country: 'Cameroun',
    city: 'Yaoundé',
    type: 'public'
  },
  {
    id: 'uy2',
    name: 'Université de Yaoundé II',
    shortName: 'UY2',
    aliases: ['uy2', 'yaoundé 2', 'soa'],
    country: 'Cameroun',
    city: 'Yaoundé',
    type: 'public'
  },
  {
    id: 'udla',
    name: 'Université de Douala',
    shortName: 'UDla',
    aliases: ['udla', 'douala'],
    country: 'Cameroun',
    city: 'Douala',
    type: 'public'
  },

  // ============ FRANCE ============
  {
    id: 'sorbonne',
    name: 'Sorbonne Université',
    shortName: 'SU',
    aliases: ['sorbonne', 'paris 4', 'paris 6', 'su'],
    country: 'France',
    city: 'Paris',
    type: 'public'
  },
  {
    id: 'psl',
    name: 'Université PSL (Paris Sciences & Lettres)',
    shortName: 'PSL',
    aliases: ['psl', 'dauphine', 'ens', 'mines'],
    country: 'France',
    city: 'Paris',
    type: 'public'
  },
  {
    id: 'polytechnique-paris',
    name: 'École Polytechnique',
    shortName: 'X',
    aliases: ['x', 'polytechnique', 'palaiseau'],
    country: 'France',
    city: 'Palaiseau',
    type: 'public'
  },
  {
    id: 'hec',
    name: 'HEC Paris',
    shortName: 'HEC',
    aliases: ['hec', 'hec paris', 'jouy en josas'],
    country: 'France',
    city: 'Jouy-en-Josas',
    type: 'private'
  },
  {
    id: 'essec',
    name: 'ESSEC Business School',
    shortName: 'ESSEC',
    aliases: ['essec', 'cergy'],
    country: 'France',
    city: 'Cergy',
    type: 'private'
  },
  {
    id: 'lyon1',
    name: 'Université Claude Bernard Lyon 1',
    shortName: 'Lyon 1',
    aliases: ['lyon 1', 'claude bernard', 'ucbl'],
    country: 'France',
    city: 'Lyon',
    type: 'public'
  },
  {
    id: 'toulouse1',
    name: 'Université Toulouse 1 Capitole',
    shortName: 'UT1',
    aliases: ['toulouse 1', 'capitole', 'ut1'],
    country: 'France',
    city: 'Toulouse',
    type: 'public'
  },

  // ============ BELGIQUE ============
  {
    id: 'ulb',
    name: 'Université Libre de Bruxelles',
    shortName: 'ULB',
    aliases: ['ulb', 'libre bruxelles'],
    country: 'Belgique',
    city: 'Bruxelles',
    type: 'public'
  },
  {
    id: 'ucl',
    name: 'Université Catholique de Louvain',
    shortName: 'UCLouvain',
    aliases: ['ucl', 'uclouvain', 'louvain'],
    country: 'Belgique',
    city: 'Louvain-la-Neuve',
    type: 'private'
  },

  // ============ SUISSE ============
  {
    id: 'epfl',
    name: 'École Polytechnique Fédérale de Lausanne',
    shortName: 'EPFL',
    aliases: ['epfl', 'lausanne', 'polytechnique suisse'],
    country: 'Suisse',
    city: 'Lausanne',
    type: 'public'
  },
  {
    id: 'eth',
    name: 'ETH Zürich',
    shortName: 'ETH',
    aliases: ['eth', 'zurich', 'eth zurich'],
    country: 'Suisse',
    city: 'Zürich',
    type: 'public'
  },
  {
    id: 'unige',
    name: 'Université de Genève',
    shortName: 'UNIGE',
    aliases: ['unige', 'genève', 'geneva'],
    country: 'Suisse',
    city: 'Genève',
    type: 'public'
  },

  // ============ CANADA ============
  {
    id: 'udem',
    name: 'Université de Montréal',
    shortName: 'UdeM',
    aliases: ['udem', 'montreal', 'montréal'],
    country: 'Canada',
    city: 'Montréal',
    type: 'public'
  },
  {
    id: 'mcgill',
    name: 'McGill University',
    shortName: 'McGill',
    aliases: ['mcgill', 'mc gill'],
    country: 'Canada',
    city: 'Montréal',
    type: 'public'
  },
  {
    id: 'ulaval',
    name: 'Université Laval',
    shortName: 'ULaval',
    aliases: ['ulaval', 'laval', 'quebec'],
    country: 'Canada',
    city: 'Québec',
    type: 'public'
  },
  {
    id: 'hec-montreal',
    name: 'HEC Montréal',
    shortName: 'HEC Mtl',
    aliases: ['hec montreal', 'hec montréal', 'hec mtl'],
    country: 'Canada',
    city: 'Montréal',
    type: 'public'
  },
  {
    id: 'uottawa',
    name: 'Université d\'Ottawa',
    shortName: 'uOttawa',
    aliases: ['uottawa', 'ottawa', 'ontario'],
    country: 'Canada',
    city: 'Ottawa',
    type: 'public'
  },

  // ============ ÉTATS-UNIS ============
  {
    id: 'mit',
    name: 'Massachusetts Institute of Technology',
    shortName: 'MIT',
    aliases: ['mit', 'massachusetts', 'boston tech'],
    country: 'États-Unis',
    city: 'Cambridge',
    type: 'private'
  },
  {
    id: 'stanford',
    name: 'Stanford University',
    shortName: 'Stanford',
    aliases: ['stanford', 'palo alto'],
    country: 'États-Unis',
    city: 'Stanford',
    type: 'private'
  },
  {
    id: 'harvard',
    name: 'Harvard University',
    shortName: 'Harvard',
    aliases: ['harvard', 'cambridge'],
    country: 'États-Unis',
    city: 'Cambridge',
    type: 'private'
  },
  {
    id: 'berkeley',
    name: 'University of California, Berkeley',
    shortName: 'UC Berkeley',
    aliases: ['berkeley', 'uc berkeley', 'cal'],
    country: 'États-Unis',
    city: 'Berkeley',
    type: 'public'
  },

  // ============ ROYAUME-UNI ============
  {
    id: 'oxford',
    name: 'University of Oxford',
    shortName: 'Oxford',
    aliases: ['oxford', 'oxbridge'],
    country: 'Royaume-Uni',
    city: 'Oxford',
    type: 'public'
  },
  {
    id: 'cambridge',
    name: 'University of Cambridge',
    shortName: 'Cambridge',
    aliases: ['cambridge', 'cam'],
    country: 'Royaume-Uni',
    city: 'Cambridge',
    type: 'public'
  },
  {
    id: 'imperial',
    name: 'Imperial College London',
    shortName: 'Imperial',
    aliases: ['imperial', 'imperial college', 'icl'],
    country: 'Royaume-Uni',
    city: 'Londres',
    type: 'public'
  },

  // ============ AUTRES AFRIQUE ============
  {
    id: 'addis-ababa',
    name: 'Addis Ababa University',
    shortName: 'AAU',
    aliases: ['aau', 'addis ababa', 'ethiopie'],
    country: 'Éthiopie',
    city: 'Addis-Abeba',
    type: 'public'
  },
  {
    id: 'uct',
    name: 'University of Cape Town',
    shortName: 'UCT',
    aliases: ['uct', 'cape town', 'afrique du sud'],
    country: 'Afrique du Sud',
    city: 'Le Cap',
    type: 'public'
  },
  {
    id: 'cairo',
    name: 'Cairo University',
    shortName: 'CU',
    aliases: ['cairo', 'caire', 'egypte'],
    country: 'Égypte',
    city: 'Le Caire',
    type: 'public'
  },
  {
    id: 'nairobi',
    name: 'University of Nairobi',
    shortName: 'UoN',
    aliases: ['nairobi', 'kenya', 'uon'],
    country: 'Kenya',
    city: 'Nairobi',
    type: 'public'
  },
  {
    id: 'legon',
    name: 'University of Ghana, Legon',
    shortName: 'UG',
    aliases: ['legon', 'ghana', 'accra'],
    country: 'Ghana',
    city: 'Accra',
    type: 'public'
  },
  {
    id: 'lagos',
    name: 'University of Lagos',
    shortName: 'UNILAG',
    aliases: ['unilag', 'lagos', 'nigeria'],
    country: 'Nigeria',
    city: 'Lagos',
    type: 'public'
  },

  // ============ OPTION AUTRE ============
  {
    id: 'other',
    name: 'Autre université',
    aliases: ['autre', 'other', 'non listée'],
    country: 'Autre',
    type: 'public'
  }
]

// Fonction de recherche qui prend en compte les alias
export function searchUniversities(query: string): University[] {
  if (!query || query.length < 2) return []

  const normalizedQuery = query.toLowerCase().trim()

  return universities
    .filter(uni => {
      // Recherche dans le nom officiel
      if (uni.name.toLowerCase().includes(normalizedQuery)) return true
      // Recherche dans l'acronyme
      if (uni.shortName?.toLowerCase().includes(normalizedQuery)) return true
      // Recherche dans les alias
      if (uni.aliases.some(alias => alias.includes(normalizedQuery))) return true
      // Recherche dans la ville
      if (uni.city?.toLowerCase().includes(normalizedQuery)) return true
      // Recherche dans le pays
      if (uni.country.toLowerCase().includes(normalizedQuery)) return true
      return false
    })
    .sort((a, b) => {
      // Prioriser les correspondances exactes d'acronyme
      const aExact = a.shortName?.toLowerCase() === normalizedQuery
      const bExact = b.shortName?.toLowerCase() === normalizedQuery
      if (aExact && !bExact) return -1
      if (!aExact && bExact) return 1
      return 0
    })
    .slice(0, 10) // Limiter à 10 résultats
}

// Obtenir une université par son ID
export function getUniversityById(id: string): University | undefined {
  return universities.find(uni => uni.id === id)
}

// Obtenir les universités par pays
export function getUniversitiesByCountry(country: string): University[] {
  return universities.filter(uni => uni.country === country)
}

// Liste des pays disponibles
export function getAvailableCountries(): string[] {
  const countries = new Set(universities.map(uni => uni.country))
  return Array.from(countries).sort()
}
