# Study Master - Strategie de Tarification v3.0

## Vue d'Ensemble

Ce document detaille la strategie de tarification de Study Master, optimisee pour une **marge de 55%** tout en offrant une valeur significative aux utilisateurs.

---

## Plans d'Abonnement

### Comparatif des Plans

| Caracteristique | FREE | PREMIUM | PREMIUM+ | INSTITUTIONAL |
|-----------------|------|---------|----------|---------------|
| **Prix USD** | $0 | $5.99/mois | $11.99/mois | $39.99/mois |
| **Prix EUR** | 0 EUR | 5.49 EUR/mois | 10.99 EUR/mois | 36.99 EUR/mois |
| **Prix XOF** | 0 FCFA | 3,500 FCFA/mois | 7,000 FCFA/mois | 24,000 FCFA/mois |
| **Requetes IA/jour** | 5 | 30 | 60 | 200 |
| **Stockage** | 100 MB | 1 GB | 5 GB | 50 GB |
| **Notes max** | 50 | 500 | Illimite | Illimite |
| **Flashcards max** | 500 | 5,000 | Illimite | Illimite |
| **Focus Rooms** | Publiques | + Privees | + Illimite | + Admin groupe |
| **Export PDF** | Basic | Avance | Premium | Enterprise |
| **Support** | Communaute | Email | Prioritaire | Dedie |

---

## Analyse des Couts

### Cout par Requete IA (Claude Sonnet 4.5)

```
Tarification Anthropic:
- Input:  $3.00 / 1M tokens
- Output: $15.00 / 1M tokens

Estimation par requete Study Master:
- Input moyen:  ~800 tokens
- Output moyen: ~500 tokens

Cout par requete:
- Input:  800 × $0.000003  = $0.0024
- Output: 500 × $0.000015  = $0.0075
- Total:                   = $0.00995 (~$0.01)
```

### Impact du Cache Redis

```
Taux de cache estime: 70%

Cout effectif par "requete utilisateur":
- 30% requetes reelles: 0.3 × $0.01 = $0.003
- 70% depuis cache:     0.7 × $0.00 = $0.000
- Cout moyen/requete:                = $0.003
```

---

## Calcul de Rentabilite (Option 3)

### Plan FREE (5 req/jour)

```
Revenus:          $0/mois
Cout IA max:      5 × 30 × $0.003 = $0.45/mois
Marge:            -$0.45 (acquisition)
```
*Objectif: Conversion vers plans payants*

### Plan PREMIUM (30 req/jour - $5.99/mois)

```
Revenus:          $5.99/mois
Cout IA max:      30 × 30 × $0.003 = $2.70/mois
Autres couts:     ~$0.30 (infra)
Total couts:      $3.00/mois
Marge brute:      $5.99 - $3.00 = $2.99/mois (50%)
```

### Plan PREMIUM+ (60 req/jour - $11.99/mois)

```
Revenus:          $11.99/mois
Cout IA max:      60 × 30 × $0.003 = $5.40/mois
Autres couts:     ~$0.50 (infra + stockage)
Total couts:      $5.90/mois
Marge brute:      $11.99 - $5.90 = $6.09/mois (51%)
```

### Plan INSTITUTIONAL (200 req/jour - $39.99/mois)

```
Revenus:          $39.99/mois
Cout IA max:      200 × 30 × $0.003 = $18.00/mois
Autres couts:     ~$2.00 (infra + support)
Total couts:      $20.00/mois
Marge brute:      $39.99 - $20.00 = $19.99/mois (50%)
```

### Marge Moyenne Ponderee

```
Distribution estimee des utilisateurs payants:
- PREMIUM:       60% des revenus
- PREMIUM+:      30% des revenus
- INSTITUTIONAL: 10% des revenus

Marge moyenne: (50% × 0.6) + (51% × 0.3) + (50% × 0.1) = ~50-55%
```

---

## Devises Supportees

### Devises Internationales
| Devise | Code | Symbole | Taux (vs USD) |
|--------|------|---------|---------------|
| Dollar US | USD | $ | 1.00 |
| Euro | EUR | EUR | 0.92 |
| Livre Sterling | GBP | £ | 0.79 |

### Devises Africaines
| Devise | Code | Pays | Taux (vs USD) |
|--------|------|------|---------------|
| Franc CFA BCEAO | XOF | Senegal, Cote d'Ivoire, Mali... | 600 |
| Franc CFA BEAC | XAF | Cameroun, Gabon, Congo... | 600 |
| Naira | NGN | Nigeria | 1,550 |
| Cedi | GHS | Ghana | 15.5 |
| Shilling Kenyan | KES | Kenya | 153 |
| Rand | ZAR | Afrique du Sud | 18.5 |
| Dirham | MAD | Maroc | 10 |
| Dinar | TND | Tunisie | 3.1 |
| Livre Egyptienne | EGP | Egypte | 50 |

---

## Providers de Paiement

### Stripe (International)
- **Regions**: Monde entier
- **Methodes**: Cartes (Visa, MC, Amex), Apple Pay, Google Pay
- **Frais**: 2.9% + $0.30/transaction
- **Integration**: API + Webhooks

### PayPal (International)
- **Regions**: 200+ pays
- **Methodes**: Solde PayPal, Cartes
- **Frais**: 2.9% + $0.30/transaction
- **Integration**: SDK + Webhooks

### Flutterwave (Afrique)
- **Regions**: 50+ pays africains
- **Methodes**:
  - Mobile Money (Orange Money, MTN, M-Pesa, Wave)
  - Cartes locales
  - Transferts bancaires
- **Frais**: 1.4% (Mobile Money), 2.5% (Cartes)
- **Integration**: API + Webhooks

---

## Grille Tarifaire Complete

### Prix en USD
| Plan | Mensuel | Annuel | Economie |
|------|---------|--------|----------|
| FREE | $0 | $0 | - |
| PREMIUM | $5.99 | $59.99 | 17% |
| PREMIUM+ | $11.99 | $119.99 | 17% |
| INSTITUTIONAL | $39.99 | $399.99 | 17% |

### Prix en EUR
| Plan | Mensuel | Annuel |
|------|---------|--------|
| FREE | 0 EUR | 0 EUR |
| PREMIUM | 5.49 EUR | 54.99 EUR |
| PREMIUM+ | 10.99 EUR | 109.99 EUR |
| INSTITUTIONAL | 36.99 EUR | 369.99 EUR |

### Prix en XOF (Afrique de l'Ouest)
| Plan | Mensuel | Annuel |
|------|---------|--------|
| FREE | 0 FCFA | 0 FCFA |
| PREMIUM | 3,500 FCFA | 35,000 FCFA |
| PREMIUM+ | 7,000 FCFA | 70,000 FCFA |
| INSTITUTIONAL | 24,000 FCFA | 240,000 FCFA |

### Prix en NGN (Nigeria)
| Plan | Mensuel | Annuel |
|------|---------|--------|
| FREE | 0 NGN | 0 NGN |
| PREMIUM | 6,000 NGN | 60,000 NGN |
| PREMIUM+ | 12,000 NGN | 120,000 NGN |
| INSTITUTIONAL | 40,000 NGN | 400,000 NGN |

---

## Strategie de Conversion

### Funnel FREE -> PREMIUM

1. **Decouverte** (5 req/jour)
   - Experience complete de l'IA
   - Limitations visibles mais non frustrantes

2. **Engagement** (Semaine 1-2)
   - Notifications de quota restant
   - Suggestions de fonctionnalites premium

3. **Conversion** (Modal Upgrade)
   - Affiche quand quota epuise
   - Comparatif benefices
   - CTA vers page pricing

### Retention Premium

- **Emails** de recap hebdomadaire
- **Badges** exclusifs premium
- **Acces anticipe** nouvelles fonctionnalites
- **Support** prioritaire

---

## Codes Promo

### Types de Codes
| Type | Reduction | Validite | Usage |
|------|-----------|----------|-------|
| WELCOME20 | 20% | 30 jours | 1x/user |
| STUDENT50 | 50% | Annuel | Verification |
| FRIEND10 | 10% | Permanent | Parrainage |
| LAUNCH30 | 30% | Limite | Premier mois |

### Implementation
```python
class PromoCode:
    code: str           # Ex: "WELCOME20"
    discount_percent: int  # 20
    valid_from: datetime
    valid_until: datetime
    max_uses: int
    current_uses: int
    first_month_only: bool
    new_users_only: bool
```

---

## Facturation

### Cycle de Facturation
- **Mensuel**: Prelevement le jour de souscription
- **Annuel**: Prelevement unique, economie 17%

### Factures
- Generation automatique PDF
- Envoi par email
- Telechargement depuis compte
- Conformite fiscale (TVA si applicable)

### Annulation
- Effet en fin de periode payee
- Pas de remboursement prorata
- Downgrade automatique vers FREE
- Conservation des donnees 30 jours

---

## Metriques Cles

### KPIs a Suivre
| Metrique | Objectif | Calcul |
|----------|----------|--------|
| MRR | Croissance | Revenus mensuels recurrents |
| ARPU | $8+ | Revenu moyen par utilisateur |
| CAC | <$10 | Cout acquisition client |
| LTV | >$100 | Valeur vie client |
| Churn | <5% | Taux d'attrition mensuel |
| Conversion | >5% | FREE -> Payant |

### Tableau de Bord Recommande
```
+------------------+----------+----------+
| Metrique         | Ce mois  | Objectif |
+------------------+----------+----------+
| Utilisateurs     | 10,000   | 15,000   |
| Payants          | 500      | 750      |
| MRR              | $3,500   | $5,000   |
| Churn            | 4.2%     | <5%      |
| ARPU             | $7.00    | $8.00    |
+------------------+----------+----------+
```

---

## Comparaison Concurrence

| Plateforme | Prix Entry | IA Incluse | Focus Rooms |
|------------|------------|------------|-------------|
| **Study Master** | $5.99 | Oui (30/jour) | Oui |
| Anki | $25 (mobile) | Non | Non |
| Quizlet+ | $7.99 | Limitee | Non |
| Notion | $10 | Non | Non |
| Cram | $4.99 | Non | Non |

**Avantage Study Master**: IA generative + Body Doubling + Prix competitif

---

## Resume

### Points Cles
- **Marge cible**: 50-55%
- **Prix competitifs**: Inferieurs a Quizlet/Notion
- **IA generative**: Valeur ajoutee unique
- **Multi-devise**: 12 devises, 3 providers
- **Freemium**: 5 req/jour pour conversion

### Tarification Finale (Option 3)
| Plan | Prix USD | Quota IA | Marge |
|------|----------|----------|-------|
| FREE | $0 | 5/jour | Acquisition |
| PREMIUM | $5.99 | 30/jour | ~50% |
| PREMIUM+ | $11.99 | 60/jour | ~51% |
| INSTITUTIONAL | $39.99 | 200/jour | ~50% |

Cette strategie equilibre **accessibilite** pour les etudiants et **rentabilite** pour la croissance de la plateforme.
