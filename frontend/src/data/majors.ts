// Base de données des filières/domaines d'études avec catégories
// Les utilisateurs sélectionnent depuis cette liste pour garantir la cohérence des filtres

export interface Major {
  id: string
  name: string
  category: MajorCategory
  aliases: string[]
}

export type MajorCategory =
  | 'sciences_tech'
  | 'business'
  | 'health'
  | 'law_politics'
  | 'arts_humanities'
  | 'social_sciences'
  | 'education'
  | 'other'

export const categoryLabels: Record<MajorCategory, string> = {
  sciences_tech: 'Sciences & Technologies',
  business: 'Commerce & Gestion',
  health: 'Santé & Médecine',
  law_politics: 'Droit & Sciences Politiques',
  arts_humanities: 'Arts & Lettres',
  social_sciences: 'Sciences Sociales',
  education: 'Éducation & Formation',
  other: 'Autre'
}

export const majors: Major[] = [
  // ============ SCIENCES & TECHNOLOGIES ============
  {
    id: 'computer_science',
    name: 'Informatique',
    category: 'sciences_tech',
    aliases: ['info', 'cs', 'computer science', 'développement', 'programmation']
  },
  {
    id: 'software_engineering',
    name: 'Génie Logiciel',
    category: 'sciences_tech',
    aliases: ['software', 'génie log', 'dev logiciel']
  },
  {
    id: 'data_science',
    name: 'Science des Données / Data Science',
    category: 'sciences_tech',
    aliases: ['data', 'big data', 'machine learning', 'ml', 'ia', 'ai']
  },
  {
    id: 'cybersecurity',
    name: 'Cybersécurité',
    category: 'sciences_tech',
    aliases: ['sécurité informatique', 'security', 'hacking']
  },
  {
    id: 'networks',
    name: 'Réseaux & Télécommunications',
    category: 'sciences_tech',
    aliases: ['telecom', 'network', 'réseau']
  },
  {
    id: 'electronics',
    name: 'Électronique',
    category: 'sciences_tech',
    aliases: ['électro', 'circuits', 'embedded']
  },
  {
    id: 'electrical_eng',
    name: 'Génie Électrique',
    category: 'sciences_tech',
    aliases: ['electrical', 'électricité', 'eea']
  },
  {
    id: 'mechanical_eng',
    name: 'Génie Mécanique',
    category: 'sciences_tech',
    aliases: ['mécanique', 'mechanical', 'méca']
  },
  {
    id: 'civil_eng',
    name: 'Génie Civil',
    category: 'sciences_tech',
    aliases: ['civil', 'btp', 'construction', 'bâtiment']
  },
  {
    id: 'industrial_eng',
    name: 'Génie Industriel',
    category: 'sciences_tech',
    aliases: ['industriel', 'production', 'qualité']
  },
  {
    id: 'chemical_eng',
    name: 'Génie Chimique',
    category: 'sciences_tech',
    aliases: ['chimique', 'chemical', 'procédés']
  },
  {
    id: 'mathematics',
    name: 'Mathématiques',
    category: 'sciences_tech',
    aliases: ['maths', 'math', 'mathématiques appliquées']
  },
  {
    id: 'physics',
    name: 'Physique',
    category: 'sciences_tech',
    aliases: ['physics', 'physique fondamentale']
  },
  {
    id: 'chemistry',
    name: 'Chimie',
    category: 'sciences_tech',
    aliases: ['chemistry', 'chimie organique']
  },
  {
    id: 'biology',
    name: 'Biologie',
    category: 'sciences_tech',
    aliases: ['bio', 'sciences de la vie', 'svt']
  },
  {
    id: 'biochemistry',
    name: 'Biochimie',
    category: 'sciences_tech',
    aliases: ['biochem', 'biochim']
  },
  {
    id: 'biotechnology',
    name: 'Biotechnologie',
    category: 'sciences_tech',
    aliases: ['biotech', 'génie biologique']
  },
  {
    id: 'environmental_sci',
    name: 'Sciences de l\'Environnement',
    category: 'sciences_tech',
    aliases: ['environnement', 'écologie', 'développement durable']
  },
  {
    id: 'geology',
    name: 'Géologie / Sciences de la Terre',
    category: 'sciences_tech',
    aliases: ['géologie', 'geosciences', 'mines']
  },
  {
    id: 'agronomy',
    name: 'Agronomie',
    category: 'sciences_tech',
    aliases: ['agriculture', 'agro', 'sciences agronomiques']
  },
  {
    id: 'architecture',
    name: 'Architecture',
    category: 'sciences_tech',
    aliases: ['archi', 'urbanisme']
  },

  // ============ COMMERCE & GESTION ============
  {
    id: 'business_admin',
    name: 'Administration des Affaires / Business Administration',
    category: 'business',
    aliases: ['business', 'administration', 'bba', 'mba']
  },
  {
    id: 'management',
    name: 'Management / Gestion',
    category: 'business',
    aliases: ['gestion', 'management général']
  },
  {
    id: 'finance',
    name: 'Finance',
    category: 'business',
    aliases: ['finances', 'banque', 'investissement']
  },
  {
    id: 'accounting',
    name: 'Comptabilité',
    category: 'business',
    aliases: ['compta', 'audit', 'expertise comptable']
  },
  {
    id: 'marketing',
    name: 'Marketing',
    category: 'business',
    aliases: ['communication', 'publicité', 'digital marketing']
  },
  {
    id: 'international_business',
    name: 'Commerce International',
    category: 'business',
    aliases: ['import export', 'international trade', 'business international']
  },
  {
    id: 'entrepreneurship',
    name: 'Entrepreneuriat',
    category: 'business',
    aliases: ['startup', 'création entreprise']
  },
  {
    id: 'hr',
    name: 'Ressources Humaines',
    category: 'business',
    aliases: ['rh', 'grh', 'human resources']
  },
  {
    id: 'logistics',
    name: 'Logistique & Supply Chain',
    category: 'business',
    aliases: ['supply chain', 'transport', 'achats']
  },
  {
    id: 'economics',
    name: 'Économie',
    category: 'business',
    aliases: ['sciences économiques', 'éco', 'economics']
  },

  // ============ SANTÉ & MÉDECINE ============
  {
    id: 'medicine',
    name: 'Médecine',
    category: 'health',
    aliases: ['médecin', 'docteur', 'médecine générale']
  },
  {
    id: 'pharmacy',
    name: 'Pharmacie',
    category: 'health',
    aliases: ['pharmacien', 'pharma']
  },
  {
    id: 'dentistry',
    name: 'Dentaire / Odontologie',
    category: 'health',
    aliases: ['dentiste', 'chirurgie dentaire']
  },
  {
    id: 'nursing',
    name: 'Sciences Infirmières',
    category: 'health',
    aliases: ['infirmier', 'soins infirmiers', 'nursing']
  },
  {
    id: 'physiotherapy',
    name: 'Kinésithérapie',
    category: 'health',
    aliases: ['kiné', 'physio', 'rééducation']
  },
  {
    id: 'veterinary',
    name: 'Médecine Vétérinaire',
    category: 'health',
    aliases: ['véto', 'vétérinaire']
  },
  {
    id: 'public_health',
    name: 'Santé Publique',
    category: 'health',
    aliases: ['épidémiologie', 'health management']
  },
  {
    id: 'nutrition',
    name: 'Nutrition / Diététique',
    category: 'health',
    aliases: ['diététicien', 'alimentation']
  },
  {
    id: 'psychology_clinical',
    name: 'Psychologie Clinique',
    category: 'health',
    aliases: ['psychologue', 'psychiatrie']
  },

  // ============ DROIT & SCIENCES POLITIQUES ============
  {
    id: 'law',
    name: 'Droit',
    category: 'law_politics',
    aliases: ['juridique', 'avocat', 'law']
  },
  {
    id: 'private_law',
    name: 'Droit Privé',
    category: 'law_politics',
    aliases: ['droit civil', 'droit des affaires']
  },
  {
    id: 'public_law',
    name: 'Droit Public',
    category: 'law_politics',
    aliases: ['droit administratif', 'droit constitutionnel']
  },
  {
    id: 'international_law',
    name: 'Droit International',
    category: 'law_politics',
    aliases: ['relations internationales juridiques']
  },
  {
    id: 'political_science',
    name: 'Sciences Politiques',
    category: 'law_politics',
    aliases: ['science po', 'politique', 'political science']
  },
  {
    id: 'international_relations',
    name: 'Relations Internationales',
    category: 'law_politics',
    aliases: ['ri', 'diplomatie', 'affaires internationales']
  },
  {
    id: 'public_admin',
    name: 'Administration Publique',
    category: 'law_politics',
    aliases: ['fonction publique', 'ena']
  },

  // ============ ARTS & LETTRES ============
  {
    id: 'literature',
    name: 'Lettres / Littérature',
    category: 'arts_humanities',
    aliases: ['lettres modernes', 'littérature française']
  },
  {
    id: 'languages',
    name: 'Langues Étrangères',
    category: 'arts_humanities',
    aliases: ['lea', 'llce', 'anglais', 'espagnol', 'langues']
  },
  {
    id: 'history',
    name: 'Histoire',
    category: 'arts_humanities',
    aliases: ['historien', 'sciences historiques']
  },
  {
    id: 'philosophy',
    name: 'Philosophie',
    category: 'arts_humanities',
    aliases: ['philo', 'philosophie générale']
  },
  {
    id: 'fine_arts',
    name: 'Beaux-Arts',
    category: 'arts_humanities',
    aliases: ['art', 'peinture', 'sculpture', 'arts plastiques']
  },
  {
    id: 'design',
    name: 'Design',
    category: 'arts_humanities',
    aliases: ['design graphique', 'ux', 'ui', 'product design']
  },
  {
    id: 'cinema',
    name: 'Cinéma / Audiovisuel',
    category: 'arts_humanities',
    aliases: ['film', 'réalisation', 'production audiovisuelle']
  },
  {
    id: 'music',
    name: 'Musique / Musicologie',
    category: 'arts_humanities',
    aliases: ['conservatoire', 'composition']
  },
  {
    id: 'journalism',
    name: 'Journalisme',
    category: 'arts_humanities',
    aliases: ['presse', 'média', 'communication']
  },

  // ============ SCIENCES SOCIALES ============
  {
    id: 'sociology',
    name: 'Sociologie',
    category: 'social_sciences',
    aliases: ['sciences sociales', 'socio']
  },
  {
    id: 'psychology',
    name: 'Psychologie',
    category: 'social_sciences',
    aliases: ['psycho', 'sciences psychologiques']
  },
  {
    id: 'anthropology',
    name: 'Anthropologie',
    category: 'social_sciences',
    aliases: ['ethnologie', 'sciences humaines']
  },
  {
    id: 'geography',
    name: 'Géographie',
    category: 'social_sciences',
    aliases: ['géo', 'aménagement territoire']
  },
  {
    id: 'social_work',
    name: 'Travail Social',
    category: 'social_sciences',
    aliases: ['assistant social', 'éducateur spécialisé']
  },

  // ============ ÉDUCATION ============
  {
    id: 'education_sciences',
    name: 'Sciences de l\'Éducation',
    category: 'education',
    aliases: ['pédagogie', 'éducation', 'enseignement']
  },
  {
    id: 'teaching_primary',
    name: 'Enseignement Primaire',
    category: 'education',
    aliases: ['professeur des écoles', 'instituteur']
  },
  {
    id: 'teaching_secondary',
    name: 'Enseignement Secondaire',
    category: 'education',
    aliases: ['capes', 'agrégation', 'prof lycée']
  },
  {
    id: 'sports_sciences',
    name: 'Sciences du Sport / STAPS',
    category: 'education',
    aliases: ['staps', 'sport', 'eps', 'éducation physique']
  },

  // ============ AUTRE ============
  {
    id: 'other',
    name: 'Autre filière',
    category: 'other',
    aliases: ['autre', 'other', 'non listée']
  }
]

// Fonction de recherche
export function searchMajors(query: string): Major[] {
  if (!query || query.length < 2) return []

  const normalizedQuery = query.toLowerCase().trim()

  return majors
    .filter(major => {
      if (major.name.toLowerCase().includes(normalizedQuery)) return true
      if (major.aliases.some(alias => alias.includes(normalizedQuery))) return true
      return false
    })
    .slice(0, 10)
}

// Obtenir une filière par son ID
export function getMajorById(id: string): Major | undefined {
  return majors.find(major => major.id === id)
}

// Obtenir les filières par catégorie
export function getMajorsByCategory(category: MajorCategory): Major[] {
  return majors.filter(major => major.category === category)
}

// Obtenir les filières groupées par catégorie
export function getMajorsGroupedByCategory(): Record<MajorCategory, Major[]> {
  const grouped: Record<MajorCategory, Major[]> = {
    sciences_tech: [],
    business: [],
    health: [],
    law_politics: [],
    arts_humanities: [],
    social_sciences: [],
    education: [],
    other: []
  }

  majors.forEach(major => {
    grouped[major.category].push(major)
  })

  return grouped
}
