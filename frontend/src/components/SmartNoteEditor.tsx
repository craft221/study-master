'use client'

import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import {
  Eye,
  Image as ImageIcon,
  Loader2,
  Code,
  Pencil,
  RotateCw,
  RotateCcw,
  Trash2,
  Maximize2,
  ChevronDown,
  ChevronRight,
  Calculator,
  X,
  FlaskConical,
  Beaker
} from 'lucide-react'
import api from '@/lib/api'
import { toast } from 'react-hot-toast'
import 'katex/dist/katex.min.css'
import katex from 'katex'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface SmartNoteEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

// Bibliothèque complète de symboles LaTeX par catégorie
const mathCategories = [
  {
    id: 'basic',
    name: 'Opérations de base',
    icon: '➕',
    symbols: [
      { label: '+', latex: '$+$', desc: 'Addition' },
      { label: '−', latex: '$-$', desc: 'Soustraction' },
      { label: '×', latex: '$\\times$', desc: 'Multiplication' },
      { label: '÷', latex: '$\\div$', desc: 'Division' },
      { label: '±', latex: '$\\pm$', desc: 'Plus ou moins' },
      { label: '∓', latex: '$\\mp$', desc: 'Moins ou plus' },
      { label: '·', latex: '$\\cdot$', desc: 'Point multiplication' },
      { label: '/', latex: '$/$', desc: 'Fraction inline' },
      { label: '=', latex: '$=$', desc: 'Égal' },
      { label: '≠', latex: '$\\neq$', desc: 'Différent' },
      { label: '≈', latex: '$\\approx$', desc: 'Approximativement' },
      { label: '≡', latex: '$\\equiv$', desc: 'Identique' },
      { label: '∝', latex: '$\\propto$', desc: 'Proportionnel' },
    ]
  },
  {
    id: 'fractions',
    name: 'Fractions & Racines',
    icon: '½',
    symbols: [
      { label: 'a/b', latex: '$\\frac{a}{b}$', desc: 'Fraction' },
      { label: 'a/b/c/d', latex: '$\\frac{\\frac{a}{b}}{\\frac{c}{d}}$', desc: 'Fraction complexe' },
      { label: '√', latex: '$\\sqrt{x}$', desc: 'Racine carrée' },
      { label: '∛', latex: '$\\sqrt[3]{x}$', desc: 'Racine cubique' },
      { label: 'ⁿ√', latex: '$\\sqrt[n]{x}$', desc: 'Racine n-ième' },
      { label: 'x²', latex: '$x^{2}$', desc: 'Carré' },
      { label: 'x³', latex: '$x^{3}$', desc: 'Cube' },
      { label: 'xⁿ', latex: '$x^{n}$', desc: 'Puissance n' },
      { label: 'xₙ', latex: '$x_{n}$', desc: 'Indice n' },
      { label: 'xₙᵐ', latex: '$x_{n}^{m}$', desc: 'Indice et exposant' },
      { label: 'ₐCᵦ', latex: '$\\binom{n}{k}$', desc: 'Coefficient binomial' },
    ]
  },
  {
    id: 'calculus',
    name: 'Calcul (Intégrales, Limites, Dérivées)',
    icon: '∫',
    symbols: [
      { label: '∫', latex: '$\\int$', desc: 'Intégrale' },
      { label: '∫ᵃᵇ', latex: '$\\int_{a}^{b}$', desc: 'Intégrale de a à b' },
      { label: '∫∫', latex: '$\\iint$', desc: 'Intégrale double' },
      { label: '∫∫∫', latex: '$\\iiint$', desc: 'Intégrale triple' },
      { label: '∮', latex: '$\\oint$', desc: 'Intégrale de contour' },
      { label: '∮ᵃᵇ', latex: '$\\oint_{a}^{b}$', desc: 'Intégrale contour bornée' },
      { label: 'lim', latex: '$\\lim_{x \\to a}$', desc: 'Limite' },
      { label: 'lim∞', latex: '$\\lim_{x \\to \\infty}$', desc: 'Limite à l\'infini' },
      { label: 'lim₀', latex: '$\\lim_{x \\to 0}$', desc: 'Limite en 0' },
      { label: 'd/dx', latex: '$\\frac{d}{dx}$', desc: 'Dérivée' },
      { label: 'd²/dx²', latex: '$\\frac{d^2}{dx^2}$', desc: 'Dérivée seconde' },
      { label: '∂/∂x', latex: '$\\frac{\\partial}{\\partial x}$', desc: 'Dérivée partielle' },
      { label: '∂²/∂x²', latex: '$\\frac{\\partial^2}{\\partial x^2}$', desc: 'Dérivée partielle seconde' },
      { label: 'f\'', latex: '$f\'(x)$', desc: 'Notation prime' },
      { label: 'f\'\'', latex: '$f\'\'(x)$', desc: 'Dérivée seconde prime' },
      { label: 'ḟ', latex: '$\\dot{f}$', desc: 'Notation point (Newton)' },
      { label: 'f̈', latex: '$\\ddot{f}$', desc: 'Double point' },
      { label: '∇', latex: '$\\nabla$', desc: 'Nabla (gradient)' },
      { label: '∇²', latex: '$\\nabla^2$', desc: 'Laplacien' },
      { label: 'dx', latex: '$dx$', desc: 'Différentielle' },
    ]
  },
  {
    id: 'sums',
    name: 'Sommes & Produits',
    icon: 'Σ',
    symbols: [
      { label: '∑', latex: '$\\sum$', desc: 'Somme' },
      { label: '∑ᵢ₌₁ⁿ', latex: '$\\sum_{i=1}^{n}$', desc: 'Somme de 1 à n' },
      { label: '∑ᵢ₌₀∞', latex: '$\\sum_{i=0}^{\\infty}$', desc: 'Somme infinie' },
      { label: '∏', latex: '$\\prod$', desc: 'Produit' },
      { label: '∏ᵢ₌₁ⁿ', latex: '$\\prod_{i=1}^{n}$', desc: 'Produit de 1 à n' },
      { label: '∐', latex: '$\\coprod$', desc: 'Coproduit' },
      { label: '⋃', latex: '$\\bigcup$', desc: 'Union grande' },
      { label: '⋂', latex: '$\\bigcap$', desc: 'Intersection grande' },
      { label: '⋁', latex: '$\\bigvee$', desc: 'Ou logique grand' },
      { label: '⋀', latex: '$\\bigwedge$', desc: 'Et logique grand' },
    ]
  },
  {
    id: 'matrices',
    name: 'Matrices & Vecteurs',
    icon: '▦',
    symbols: [
      { label: '[2×2]', latex: '$$\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}$$', desc: 'Matrice 2×2 crochets' },
      { label: '[3×3]', latex: '$$\\begin{bmatrix} a & b & c \\\\ d & e & f \\\\ g & h & i \\end{bmatrix}$$', desc: 'Matrice 3×3 crochets' },
      { label: '(2×2)', latex: '$$\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}$$', desc: 'Matrice 2×2 parenthèses' },
      { label: '(3×3)', latex: '$$\\begin{pmatrix} a & b & c \\\\ d & e & f \\\\ g & h & i \\end{pmatrix}$$', desc: 'Matrice 3×3 parenthèses' },
      { label: '|2×2|', latex: '$$\\begin{vmatrix} a & b \\\\ c & d \\end{vmatrix}$$', desc: 'Déterminant 2×2' },
      { label: '|3×3|', latex: '$$\\begin{vmatrix} a & b & c \\\\ d & e & f \\\\ g & h & i \\end{vmatrix}$$', desc: 'Déterminant 3×3' },
      { label: '‖2×2‖', latex: '$$\\begin{Vmatrix} a & b \\\\ c & d \\end{Vmatrix}$$', desc: 'Norme matrice' },
      { label: '{cases}', latex: '$$\\begin{cases} x & \\text{si } a \\\\ y & \\text{sinon} \\end{cases}$$', desc: 'Système de cas' },
      { label: 'vect', latex: '$\\vec{v}$', desc: 'Vecteur' },
      { label: '→AB', latex: '$\\overrightarrow{AB}$', desc: 'Vecteur AB' },
      { label: '|v|', latex: '$\\|v\\|$', desc: 'Norme vecteur' },
      { label: 'v̂', latex: '$\\hat{v}$', desc: 'Vecteur unitaire' },
      { label: 'v·w', latex: '$\\vec{v} \\cdot \\vec{w}$', desc: 'Produit scalaire' },
      { label: 'v×w', latex: '$\\vec{v} \\times \\vec{w}$', desc: 'Produit vectoriel' },
      { label: 'Aᵀ', latex: '$A^{T}$', desc: 'Transposée' },
      { label: 'A⁻¹', latex: '$A^{-1}$', desc: 'Inverse' },
      { label: 'det', latex: '$\\det(A)$', desc: 'Déterminant' },
      { label: 'tr', latex: '$\\text{tr}(A)$', desc: 'Trace' },
      { label: 'I', latex: '$I_n$', desc: 'Matrice identité' },
      { label: '0', latex: '$\\mathbf{0}$', desc: 'Matrice nulle' },
    ]
  },
  {
    id: 'greek',
    name: 'Lettres Grecques',
    icon: 'α',
    symbols: [
      { label: 'α', latex: '$\\alpha$', desc: 'Alpha' },
      { label: 'β', latex: '$\\beta$', desc: 'Bêta' },
      { label: 'γ', latex: '$\\gamma$', desc: 'Gamma' },
      { label: 'δ', latex: '$\\delta$', desc: 'Delta' },
      { label: 'ε', latex: '$\\epsilon$', desc: 'Epsilon' },
      { label: 'ζ', latex: '$\\zeta$', desc: 'Zêta' },
      { label: 'η', latex: '$\\eta$', desc: 'Êta' },
      { label: 'θ', latex: '$\\theta$', desc: 'Thêta' },
      { label: 'ι', latex: '$\\iota$', desc: 'Iota' },
      { label: 'κ', latex: '$\\kappa$', desc: 'Kappa' },
      { label: 'λ', latex: '$\\lambda$', desc: 'Lambda' },
      { label: 'μ', latex: '$\\mu$', desc: 'Mu' },
      { label: 'ν', latex: '$\\nu$', desc: 'Nu' },
      { label: 'ξ', latex: '$\\xi$', desc: 'Xi' },
      { label: 'π', latex: '$\\pi$', desc: 'Pi' },
      { label: 'ρ', latex: '$\\rho$', desc: 'Rho' },
      { label: 'σ', latex: '$\\sigma$', desc: 'Sigma' },
      { label: 'τ', latex: '$\\tau$', desc: 'Tau' },
      { label: 'υ', latex: '$\\upsilon$', desc: 'Upsilon' },
      { label: 'φ', latex: '$\\phi$', desc: 'Phi' },
      { label: 'χ', latex: '$\\chi$', desc: 'Chi' },
      { label: 'ψ', latex: '$\\psi$', desc: 'Psi' },
      { label: 'ω', latex: '$\\omega$', desc: 'Oméga' },
      { label: 'Γ', latex: '$\\Gamma$', desc: 'Gamma majuscule' },
      { label: 'Δ', latex: '$\\Delta$', desc: 'Delta majuscule' },
      { label: 'Θ', latex: '$\\Theta$', desc: 'Thêta majuscule' },
      { label: 'Λ', latex: '$\\Lambda$', desc: 'Lambda majuscule' },
      { label: 'Ξ', latex: '$\\Xi$', desc: 'Xi majuscule' },
      { label: 'Π', latex: '$\\Pi$', desc: 'Pi majuscule' },
      { label: 'Σ', latex: '$\\Sigma$', desc: 'Sigma majuscule' },
      { label: 'Φ', latex: '$\\Phi$', desc: 'Phi majuscule' },
      { label: 'Ψ', latex: '$\\Psi$', desc: 'Psi majuscule' },
      { label: 'Ω', latex: '$\\Omega$', desc: 'Oméga majuscule' },
    ]
  },
  {
    id: 'relations',
    name: 'Relations & Comparaisons',
    icon: '≤',
    symbols: [
      { label: '<', latex: '$<$', desc: 'Inférieur' },
      { label: '>', latex: '$>$', desc: 'Supérieur' },
      { label: '≤', latex: '$\\leq$', desc: 'Inférieur ou égal' },
      { label: '≥', latex: '$\\geq$', desc: 'Supérieur ou égal' },
      { label: '≪', latex: '$\\ll$', desc: 'Très inférieur' },
      { label: '≫', latex: '$\\gg$', desc: 'Très supérieur' },
      { label: '≺', latex: '$\\prec$', desc: 'Précède' },
      { label: '≻', latex: '$\\succ$', desc: 'Succède' },
      { label: '∼', latex: '$\\sim$', desc: 'Similaire' },
      { label: '≃', latex: '$\\simeq$', desc: 'Asymptotiquement égal' },
      { label: '≅', latex: '$\\cong$', desc: 'Congruent' },
      { label: '≐', latex: '$\\doteq$', desc: 'Approche' },
      { label: '∥', latex: '$\\parallel$', desc: 'Parallèle' },
      { label: '⊥', latex: '$\\perp$', desc: 'Perpendiculaire' },
    ]
  },
  {
    id: 'sets',
    name: 'Ensembles & Logique',
    icon: '∈',
    symbols: [
      { label: '∈', latex: '$\\in$', desc: 'Appartient à' },
      { label: '∉', latex: '$\\notin$', desc: 'N\'appartient pas' },
      { label: '⊂', latex: '$\\subset$', desc: 'Sous-ensemble strict' },
      { label: '⊃', latex: '$\\supset$', desc: 'Sur-ensemble strict' },
      { label: '⊆', latex: '$\\subseteq$', desc: 'Sous-ensemble' },
      { label: '⊇', latex: '$\\supseteq$', desc: 'Sur-ensemble' },
      { label: '∪', latex: '$\\cup$', desc: 'Union' },
      { label: '∩', latex: '$\\cap$', desc: 'Intersection' },
      { label: '∅', latex: '$\\emptyset$', desc: 'Ensemble vide' },
      { label: 'ℕ', latex: '$\\mathbb{N}$', desc: 'Entiers naturels' },
      { label: 'ℤ', latex: '$\\mathbb{Z}$', desc: 'Entiers relatifs' },
      { label: 'ℚ', latex: '$\\mathbb{Q}$', desc: 'Rationnels' },
      { label: 'ℝ', latex: '$\\mathbb{R}$', desc: 'Réels' },
      { label: 'ℂ', latex: '$\\mathbb{C}$', desc: 'Complexes' },
      { label: '∀', latex: '$\\forall$', desc: 'Pour tout' },
      { label: '∃', latex: '$\\exists$', desc: 'Il existe' },
      { label: '∄', latex: '$\\nexists$', desc: 'Il n\'existe pas' },
      { label: '¬', latex: '$\\neg$', desc: 'Non logique' },
      { label: '∧', latex: '$\\land$', desc: 'Et logique' },
      { label: '∨', latex: '$\\lor$', desc: 'Ou logique' },
      { label: '⊕', latex: '$\\oplus$', desc: 'Ou exclusif' },
      { label: '⇒', latex: '$\\Rightarrow$', desc: 'Implique' },
      { label: '⇔', latex: '$\\Leftrightarrow$', desc: 'Équivalent' },
      { label: '∴', latex: '$\\therefore$', desc: 'Donc' },
      { label: '∵', latex: '$\\because$', desc: 'Parce que' },
    ]
  },
  {
    id: 'arrows',
    name: 'Flèches',
    icon: '→',
    symbols: [
      { label: '→', latex: '$\\rightarrow$', desc: 'Flèche droite' },
      { label: '←', latex: '$\\leftarrow$', desc: 'Flèche gauche' },
      { label: '↔', latex: '$\\leftrightarrow$', desc: 'Flèche double' },
      { label: '⇒', latex: '$\\Rightarrow$', desc: 'Implique' },
      { label: '⇐', latex: '$\\Leftarrow$', desc: 'Est impliqué par' },
      { label: '⇔', latex: '$\\Leftrightarrow$', desc: 'Si et seulement si' },
      { label: '↑', latex: '$\\uparrow$', desc: 'Flèche haut' },
      { label: '↓', latex: '$\\downarrow$', desc: 'Flèche bas' },
      { label: '↗', latex: '$\\nearrow$', desc: 'Flèche diagonale NE' },
      { label: '↘', latex: '$\\searrow$', desc: 'Flèche diagonale SE' },
      { label: '↖', latex: '$\\nwarrow$', desc: 'Flèche diagonale NW' },
      { label: '↙', latex: '$\\swarrow$', desc: 'Flèche diagonale SW' },
      { label: '↦', latex: '$\\mapsto$', desc: 'Mappe vers' },
      { label: '⟼', latex: '$\\longmapsto$', desc: 'Mappe vers (long)' },
      { label: '↪', latex: '$\\hookrightarrow$', desc: 'Injection' },
      { label: '↠', latex: '$\\twoheadrightarrow$', desc: 'Surjection' },
    ]
  },
  {
    id: 'trig',
    name: 'Trigonométrie',
    icon: '∠',
    symbols: [
      { label: 'sin', latex: '$\\sin(x)$', desc: 'Sinus' },
      { label: 'cos', latex: '$\\cos(x)$', desc: 'Cosinus' },
      { label: 'tan', latex: '$\\tan(x)$', desc: 'Tangente' },
      { label: 'cot', latex: '$\\cot(x)$', desc: 'Cotangente' },
      { label: 'sec', latex: '$\\sec(x)$', desc: 'Sécante' },
      { label: 'csc', latex: '$\\csc(x)$', desc: 'Cosécante' },
      { label: 'arcsin', latex: '$\\arcsin(x)$', desc: 'Arc sinus' },
      { label: 'arccos', latex: '$\\arccos(x)$', desc: 'Arc cosinus' },
      { label: 'arctan', latex: '$\\arctan(x)$', desc: 'Arc tangente' },
      { label: 'sinh', latex: '$\\sinh(x)$', desc: 'Sinus hyperbolique' },
      { label: 'cosh', latex: '$\\cosh(x)$', desc: 'Cosinus hyperbolique' },
      { label: 'tanh', latex: '$\\tanh(x)$', desc: 'Tangente hyperbolique' },
      { label: '°', latex: '$^{\\circ}$', desc: 'Degré' },
      { label: '∠', latex: '$\\angle$', desc: 'Angle' },
      { label: '△', latex: '$\\triangle$', desc: 'Triangle' },
    ]
  },
  {
    id: 'functions',
    name: 'Fonctions & Logarithmes',
    icon: 'f',
    symbols: [
      { label: 'f(x)', latex: '$f(x)$', desc: 'Fonction' },
      { label: 'g∘f', latex: '$g \\circ f$', desc: 'Composition' },
      { label: 'f⁻¹', latex: '$f^{-1}$', desc: 'Fonction inverse' },
      { label: 'ln', latex: '$\\ln(x)$', desc: 'Logarithme naturel' },
      { label: 'log', latex: '$\\log(x)$', desc: 'Logarithme' },
      { label: 'log₁₀', latex: '$\\log_{10}(x)$', desc: 'Logarithme base 10' },
      { label: 'logₐ', latex: '$\\log_{a}(x)$', desc: 'Logarithme base a' },
      { label: 'e', latex: '$e$', desc: 'Nombre d\'Euler' },
      { label: 'eˣ', latex: '$e^{x}$', desc: 'Exponentielle' },
      { label: 'exp', latex: '$\\exp(x)$', desc: 'Exponentielle' },
      { label: '|x|', latex: '$|x|$', desc: 'Valeur absolue' },
      { label: '⌊x⌋', latex: '$\\lfloor x \\rfloor$', desc: 'Partie entière inf' },
      { label: '⌈x⌉', latex: '$\\lceil x \\rceil$', desc: 'Partie entière sup' },
      { label: 'max', latex: '$\\max$', desc: 'Maximum' },
      { label: 'min', latex: '$\\min$', desc: 'Minimum' },
      { label: 'sup', latex: '$\\sup$', desc: 'Supremum' },
      { label: 'inf', latex: '$\\inf$', desc: 'Infimum' },
      { label: 'arg', latex: '$\\arg$', desc: 'Argument' },
      { label: 'sgn', latex: '$\\text{sgn}$', desc: 'Signe' },
    ]
  },
  {
    id: 'special',
    name: 'Symboles Spéciaux',
    icon: '∞',
    symbols: [
      { label: '∞', latex: '$\\infty$', desc: 'Infini' },
      { label: '∂', latex: '$\\partial$', desc: 'Dérivée partielle' },
      { label: 'ℏ', latex: '$\\hbar$', desc: 'H barre (Planck)' },
      { label: 'ℓ', latex: '$\\ell$', desc: 'L cursif' },
      { label: 'ℵ', latex: '$\\aleph$', desc: 'Aleph' },
      { label: '…', latex: '$\\ldots$', desc: 'Points horizontaux' },
      { label: '⋯', latex: '$\\cdots$', desc: 'Points centrés' },
      { label: '⋮', latex: '$\\vdots$', desc: 'Points verticaux' },
      { label: '⋱', latex: '$\\ddots$', desc: 'Points diagonaux' },
      { label: '□', latex: '$\\square$', desc: 'Carré' },
      { label: '△', latex: '$\\triangle$', desc: 'Triangle' },
      { label: '○', latex: '$\\circ$', desc: 'Cercle' },
      { label: '★', latex: '$\\star$', desc: 'Étoile' },
      { label: '†', latex: '$\\dagger$', desc: 'Croix' },
      { label: '‡', latex: '$\\ddagger$', desc: 'Double croix' },
      { label: '′', latex: '$\\prime$', desc: 'Prime' },
      { label: 'x̄', latex: '$\\bar{x}$', desc: 'Barre' },
      { label: 'x̂', latex: '$\\hat{x}$', desc: 'Chapeau' },
      { label: 'x̃', latex: '$\\tilde{x}$', desc: 'Tilde' },
      { label: 'ẋ', latex: '$\\dot{x}$', desc: 'Point' },
      { label: 'ẍ', latex: '$\\ddot{x}$', desc: 'Double point' },
    ]
  },
  {
    id: 'physics',
    name: 'Physique',
    icon: '⚛',
    symbols: [
      { label: 'F=ma', latex: '$F = ma$', desc: 'Newton 2' },
      { label: 'E=mc²', latex: '$E = mc^2$', desc: 'Einstein' },
      { label: 'v=d/t', latex: '$v = \\frac{d}{t}$', desc: 'Vitesse' },
      { label: 'a=Δv/Δt', latex: '$a = \\frac{\\Delta v}{\\Delta t}$', desc: 'Accélération' },
      { label: 'p=mv', latex: '$p = mv$', desc: 'Quantité de mouvement' },
      { label: 'W=Fd', latex: '$W = Fd$', desc: 'Travail' },
      { label: 'P=W/t', latex: '$P = \\frac{W}{t}$', desc: 'Puissance' },
      { label: 'Ec', latex: '$E_c = \\frac{1}{2}mv^2$', desc: 'Énergie cinétique' },
      { label: 'Ep', latex: '$E_p = mgh$', desc: 'Énergie potentielle' },
      { label: 'V=IR', latex: '$V = IR$', desc: 'Loi d\'Ohm' },
      { label: 'P=VI', latex: '$P = VI$', desc: 'Puissance électrique' },
      { label: 'ω', latex: '$\\omega = 2\\pi f$', desc: 'Pulsation' },
      { label: 'λ', latex: '$\\lambda = \\frac{v}{f}$', desc: 'Longueur d\'onde' },
    ]
  },
  {
    id: 'chemistry',
    name: 'Chimie',
    icon: '⚗',
    symbols: [
      { label: '→', latex: '$\\rightarrow$', desc: 'Réaction' },
      { label: '⇌', latex: '$\\rightleftharpoons$', desc: 'Équilibre' },
      { label: '↑', latex: '$\\uparrow$', desc: 'Gaz' },
      { label: '↓', latex: '$\\downarrow$', desc: 'Précipité' },
      { label: 'H₂O', latex: '$H_2O$', desc: 'Eau' },
      { label: 'CO₂', latex: '$CO_2$', desc: 'Dioxyde carbone' },
      { label: 'pH', latex: '$pH = -\\log[H^+]$', desc: 'pH' },
      { label: 'n=m/M', latex: '$n = \\frac{m}{M}$', desc: 'Quantité de matière' },
      { label: 'C=n/V', latex: '$C = \\frac{n}{V}$', desc: 'Concentration' },
      { label: 'PV=nRT', latex: '$PV = nRT$', desc: 'Gaz parfait' },
      { label: 'ΔH', latex: '$\\Delta H$', desc: 'Enthalpie' },
      { label: 'ΔG', latex: '$\\Delta G$', desc: 'Énergie libre Gibbs' },
      { label: 'ΔS', latex: '$\\Delta S$', desc: 'Entropie' },
    ]
  },
  {
    id: 'brackets',
    name: 'Parenthèses & Délimiteurs',
    icon: '( )',
    symbols: [
      { label: '( )', latex: '$\\left( x \\right)$', desc: 'Parenthèses' },
      { label: '[ ]', latex: '$\\left[ x \\right]$', desc: 'Crochets' },
      { label: '{ }', latex: '$\\left\\{ x \\right\\}$', desc: 'Accolades' },
      { label: '| |', latex: '$\\left| x \\right|$', desc: 'Valeur absolue' },
      { label: '‖ ‖', latex: '$\\left\\| x \\right\\|$', desc: 'Norme' },
      { label: '⟨ ⟩', latex: '$\\langle x \\rangle$', desc: 'Chevrons' },
      { label: '⌊ ⌋', latex: '$\\lfloor x \\rfloor$', desc: 'Plancher' },
      { label: '⌈ ⌉', latex: '$\\lceil x \\rceil$', desc: 'Plafond' },
    ]
  },
  {
    id: 'stats',
    name: 'Statistiques & Probabilités',
    icon: '📊',
    symbols: [
      { label: 'x̄', latex: '$\\bar{x}$', desc: 'Moyenne' },
      { label: 'σ', latex: '$\\sigma$', desc: 'Écart-type' },
      { label: 'σ²', latex: '$\\sigma^2$', desc: 'Variance' },
      { label: 'μ', latex: '$\\mu$', desc: 'Moyenne population' },
      { label: 'P(A)', latex: '$P(A)$', desc: 'Probabilité' },
      { label: 'P(A|B)', latex: '$P(A|B)$', desc: 'Probabilité conditionnelle' },
      { label: 'P(A∩B)', latex: '$P(A \\cap B)$', desc: 'Probabilité conjointe' },
      { label: 'P(A∪B)', latex: '$P(A \\cup B)$', desc: 'Probabilité union' },
      { label: 'E(X)', latex: '$E(X)$', desc: 'Espérance' },
      { label: 'Var(X)', latex: '$\\text{Var}(X)$', desc: 'Variance' },
      { label: 'Cov', latex: '$\\text{Cov}(X,Y)$', desc: 'Covariance' },
      { label: 'ρ', latex: '$\\rho$', desc: 'Corrélation' },
      { label: 'n!', latex: '$n!$', desc: 'Factorielle' },
      { label: 'nCk', latex: '$\\binom{n}{k}$', desc: 'Combinaison' },
      { label: 'nPk', latex: '$P_k^n$', desc: 'Permutation' },
    ]
  },
]

// Symboles rapides (favoris) pour la barre d'outils principale
const quickSymbols = [
  { label: '×', latex: '$\\times$' },
  { label: '÷', latex: '$\\div$' },
  { label: '√', latex: '$\\sqrt{}$' },
  { label: 'a/b', latex: '$\\frac{a}{b}$' },
  { label: '∑', latex: '$\\sum_{i=1}^{n}$' },
  { label: '∫ᵃᵇ', latex: '$\\int_{a}^{b}$' },
  { label: 'lim', latex: '$\\lim_{x \\to a}$' },
  { label: '[M]', latex: '$$\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}$$' },
  { label: 'α', latex: '$\\alpha$' },
  { label: 'π', latex: '$\\pi$' },
  { label: '≤', latex: '$\\leq$' },
  { label: '→', latex: '$\\rightarrow$' },
]

function resolveImageUrl(src: string): string {
  if (src.startsWith('/api/')) return `${API_URL}${src}`
  return src
}

function renderLatex(text: string): string {
  if (!text) return ''
  let result = text

  // Code blocks
  result = result.replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre class="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto my-3 text-sm font-mono"><code>${code.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`
  })

  // Inline code
  result = result.replace(/`([^`]+)`/g, '<code class="bg-purple-100 dark:bg-purple-900 px-1.5 py-0.5 rounded text-sm font-mono text-purple-700 dark:text-purple-300">$1</code>')

  // Display math $$...$$
  result = result.replace(/\$\$([^$]+)\$\$/g, (match, latex) => {
    try {
      return `<div class="my-4 py-3 text-center overflow-x-auto bg-blue-50 dark:bg-blue-900/20 rounded-lg">${katex.renderToString(latex.trim(), { displayMode: true, throwOnError: false })}</div>`
    } catch { return match }
  })

  // Inline math $...$
  result = result.replace(/\$([^$\n]+)\$/g, (match, latex) => {
    try {
      return katex.renderToString(latex.trim(), { displayMode: false, throwOnError: false })
    } catch { return match }
  })

  // Images
  result = result.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, url) => {
    return `<img src="${resolveImageUrl(url)}" alt="${alt}" class="max-w-full rounded-lg shadow-md my-3 mx-auto" style="max-height: 400px;" />`
  })

  // Headers
  result = result.replace(/^### (.+)$/gm, '<h3 class="text-lg font-bold mt-4 mb-2 text-gray-800 dark:text-gray-200">$1</h3>')
  result = result.replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold mt-5 mb-3 text-purple-700 dark:text-purple-300">$1</h2>')
  result = result.replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold mt-6 mb-4 text-gray-900 dark:text-white">$1</h1>')

  // Bold and italic
  result = result.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-bold">$1</strong>')
  result = result.replace(/\*([^*]+)\*/g, '<em>$1</em>')

  // Lists
  result = result.replace(/^- (.+)$/gm, '<li class="ml-4 my-1">• $1</li>')
  result = result.replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4 my-1">$1. $2</li>')

  // Line breaks
  result = result.replace(/\n/g, '<br>')

  return result
}

function htmlToMarkdown(html: string): string {
  let text = html
  // Handle images with style (size/rotation)
  text = text.replace(/<img[^>]+src=["']([^"']+)["'][^>]*style=["']([^"']*)["'][^>]*>/gi, (match, src, style) => {
    let cleanSrc = src.startsWith(API_URL) ? src.replace(API_URL, '') : src
    const widthMatch = style.match(/width:\s*(\d+)px/)
    const heightMatch = style.match(/height:\s*(\d+)px/)
    const rotateMatch = style.match(/rotate\((\d+)deg\)/)
    let sizeInfo = ''
    if (widthMatch || heightMatch || rotateMatch) {
      const w = widthMatch ? widthMatch[1] : ''
      const h = heightMatch ? heightMatch[1] : ''
      const r = rotateMatch ? rotateMatch[1] : '0'
      sizeInfo = `{${w}x${h}r${r}}`
    }
    return `![image${sizeInfo}](${cleanSrc})`
  })
  text = text.replace(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi, (_, src) => {
    let cleanSrc = src.startsWith(API_URL) ? src.replace(API_URL, '') : src
    return `![image](${cleanSrc})`
  })
  text = text.replace(/<br\s*\/?>/gi, '\n')
  text = text.replace(/<\/div><div>/gi, '\n')
  text = text.replace(/<div>/gi, '\n')
  text = text.replace(/<\/div>/gi, '')
  text = text.replace(/<[^>]+>/g, '')
  text = text.replace(/&nbsp;/g, ' ')
  text = text.replace(/&lt;/g, '<')
  text = text.replace(/&gt;/g, '>')
  text = text.replace(/&amp;/g, '&')
  return text.trim()
}

function markdownToHtml(markdown: string): string {
  let html = markdown
  // Parse image with size info: ![image{200x150r90}](url)
  html = html.replace(/!\[([^\]]*?)(\{(\d*)x(\d*)r(\d+)\})?\]\(([^)]+)\)/g, (_, alt, sizeGroup, w, h, r, url) => {
    let style = 'max-height: 400px;'
    if (w) style = `width: ${w}px; ${style}`
    if (h) style = `height: ${h}px; ${style}`
    if (r && r !== '0') style = `transform: rotate(${r}deg); ${style}`
    return `<img src="${resolveImageUrl(url)}" alt="${alt || 'image'}" class="inline-block max-w-full rounded-lg shadow-md my-2 cursor-pointer" style="${style}" data-url="${url}" />`
  })
  html = html.replace(/\n/g, '<br>')
  return html
}

export default function SmartNoteEditor({ value, onChange, placeholder = 'Écris ta note ici...', className = '' }: SmartNoteEditorProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [showDrawing, setShowDrawing] = useState(false)
  const [drawingColor, setDrawingColor] = useState('#000000')
  const [brushSize, setBrushSize] = useState(3)

  // Math library panel
  const [showMathLibrary, setShowMathLibrary] = useState(false)
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['calculus', 'matrices'])
  const [mathSearch, setMathSearch] = useState('')

  // Chemistry formula helper
  const [showChemistry, setShowChemistry] = useState(false)
  const [chemFormula, setChemFormula] = useState('')

  // Preview visibility (always show by default, can collapse)
  const [showPreview, setShowPreview] = useState(true)

  // Convertir formule chimique en LaTeX (H2O → $H_2O$)
  const convertChemFormula = useCallback((formula: string): string => {
    // Convertir les chiffres en indices pour la chimie
    let result = formula
      .replace(/(\d+)/g, '_{$1}') // Chiffres → indices
      .replace(/\^(\d+)/g, '^{$1}') // ^2 → exposant
      .replace(/\+/g, '^{+}')  // + → exposant
      .replace(/-(?!\d)/g, '^{-}')  // - isolé → exposant
    return `$\\ce{${formula}}$` // Utiliser mhchem si dispo, sinon format basique
  }, [])

  // Image selection (Word-like) - Simplified
  const [selectedImage, setSelectedImage] = useState<HTMLImageElement | null>(null)
  const [imageRect, setImageRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const [imageRotation, setImageRotation] = useState(0)
  const [isResizing, setIsResizing] = useState(false)
  const resizeRef = useRef<{ handle: string; startX: number; startY: number; startW: number; startH: number; aspectRatio: number } | null>(null)

  const editorRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  const previewHtml = useMemo(() => renderLatex(value), [value])

  // Define handleInput early (needed by resize effect)
  const handleInput = useCallback(() => {
    if (editorRef.current) {
      onChange(htmlToMarkdown(editorRef.current.innerHTML))
    }
  }, [onChange])

  // Define insertText early (needed by insertChemFormula)
  const insertText = useCallback((text: string) => {
    if (!editorRef.current) return
    editorRef.current.focus()
    const selection = window.getSelection()
    if (selection) {
      let range = selection.rangeCount > 0 ? selection.getRangeAt(0) : document.createRange()
      if (!editorRef.current.contains(range.commonAncestorContainer)) {
        range = document.createRange()
        range.selectNodeContents(editorRef.current)
        range.collapse(false)
      }
      range.insertNode(document.createTextNode(text))
      range.collapse(false)
      selection.removeAllRanges()
      selection.addRange(range)
      handleInput()
    }
  }, [handleInput])

  // Insert chemistry formula
  const insertChemFormula = useCallback(() => {
    if (!chemFormula.trim()) return
    // Format simple: H2O devient $H_{2}O$
    const formatted = chemFormula
      .replace(/([A-Za-z])(\d+)/g, '$1_{$2}')  // H2 → H_{2}
      .replace(/\^(\d+[+-]?)/g, '^{$1}')  // ^2+ → ^{2+}
      .replace(/(\d+)\+/g, '$1^{+}')  // 2+ → 2^{+}
      .replace(/(\d+)-/g, '$1^{-}')  // 2- → 2^{-}
    insertText(`$${formatted}$`)
    setChemFormula('')
    setShowChemistry(false)
  }, [chemFormula, insertText])

  // Initialize editor
  useEffect(() => {
    if (editorRef.current && !editorRef.current.innerHTML && value) {
      editorRef.current.innerHTML = markdownToHtml(value)
    }
  }, [])

  // Sync value
  useEffect(() => {
    if (editorRef.current) {
      const currentMarkdown = htmlToMarkdown(editorRef.current.innerHTML)
      if (currentMarkdown !== value && value !== undefined) {
        editorRef.current.innerHTML = markdownToHtml(value)
      }
    }
  }, [value])

  // Update image rect when selected - optimized
  const updateImageRect = useCallback(() => {
    if (!selectedImage || !editorRef.current) {
      setImageRect(null)
      return
    }
    const editorRect = editorRef.current.getBoundingClientRect()
    const imgRect = selectedImage.getBoundingClientRect()
    const transform = selectedImage.style.transform || ''
    const rotateMatch = transform.match(/rotate\((-?\d+)deg\)/)
    setImageRotation(rotateMatch ? parseInt(rotateMatch[1]) : 0)
    setImageRect({
      x: imgRect.left - editorRect.left + editorRef.current.scrollLeft,
      y: imgRect.top - editorRect.top + editorRef.current.scrollTop,
      w: imgRect.width,
      h: imgRect.height
    })
  }, [selectedImage])

  useEffect(() => {
    updateImageRect()
    if (!selectedImage) return

    // Use MutationObserver for better performance
    const observer = new MutationObserver(updateImageRect)
    observer.observe(selectedImage, { attributes: true, attributeFilter: ['style'] })

    // Also update on window resize
    window.addEventListener('resize', updateImageRect)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', updateImageRect)
    }
  }, [selectedImage, updateImageRect])

  // Handle resize - optimized with requestAnimationFrame
  useEffect(() => {
    if (!isResizing || !selectedImage) return

    let animationFrame: number | null = null

    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeRef.current) return

      if (animationFrame) cancelAnimationFrame(animationFrame)

      animationFrame = requestAnimationFrame(() => {
        if (!resizeRef.current || !selectedImage) return

        const { handle, startX, startY, startW, startH, aspectRatio } = resizeRef.current
        const dx = e.clientX - startX
        const dy = e.clientY - startY

        let newW = startW
        let newH = startH

        // Corner resize (maintain aspect ratio)
        const isCorner = handle.length === 2

        if (handle.includes('e')) newW = Math.max(30, startW + dx)
        if (handle.includes('w')) newW = Math.max(30, startW - dx)
        if (handle.includes('s')) newH = Math.max(30, startH + dy)
        if (handle.includes('n')) newH = Math.max(30, startH - dy)

        // Maintain aspect ratio for corners
        if (isCorner) {
          const delta = Math.abs(dx) > Math.abs(dy) ? dx : dy
          if (handle === 'se' || handle === 'nw') {
            newW = Math.max(30, startW + (handle === 'se' ? delta : -delta))
          } else {
            newW = Math.max(30, startW + (handle === 'ne' ? delta : -delta))
          }
          newH = newW / aspectRatio
        }

        selectedImage.style.width = `${Math.round(newW)}px`
        selectedImage.style.height = `${Math.round(newH)}px`

        updateImageRect()
      })
    }

    const handleMouseUp = () => {
      if (animationFrame) cancelAnimationFrame(animationFrame)
      resizeRef.current = null
      setIsResizing(false)
      handleInput()
      setTimeout(updateImageRect, 10)
    }

    document.addEventListener('mousemove', handleMouseMove, { passive: true })
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      if (animationFrame) cancelAnimationFrame(animationFrame)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing, selectedImage, handleInput, updateImageRect])

  // Click outside to deselect image
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (overlayRef.current && !overlayRef.current.contains(e.target as Node)) {
        if (editorRef.current?.contains(e.target as Node)) {
          const target = e.target as HTMLElement
          if (target.tagName !== 'IMG') {
            setSelectedImage(null)
          }
        } else {
          setSelectedImage(null)
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const uploadImage = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) { toast.error('Max 10 MB'); return }
    setIsUploading(true)
    const formData = new FormData()
    formData.append('file', file)
    try {
      const response = await api.post('/notes/upload-image', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      if (response.data.success && response.data.url) {
        editorRef.current?.focus()
        const selection = window.getSelection()
        if (selection) {
          let range = selection.rangeCount > 0 ? selection.getRangeAt(0) : document.createRange()
          if (!editorRef.current?.contains(range.commonAncestorContainer)) {
            range = document.createRange()
            range.selectNodeContents(editorRef.current!)
            range.collapse(false)
          }
          const img = document.createElement('img')
          img.src = resolveImageUrl(response.data.url)
          img.alt = 'image'
          img.className = 'inline-block max-w-full rounded-lg shadow-md my-2 cursor-pointer'
          img.style.maxHeight = '400px'
          img.dataset.url = response.data.url
          range.insertNode(img)
          range.setStartAfter(img)
          selection.removeAllRanges()
          selection.addRange(range)
        }
        handleInput()
        toast.success('Image ajoutée!')
      }
    } catch (e: any) { toast.error(e.response?.data?.detail || 'Erreur upload') }
    finally { setIsUploading(false) }
  }

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

  const handleEditorClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.tagName === 'IMG') {
      e.preventDefault()
      e.stopPropagation()
      setSelectedImage(target as HTMLImageElement)
    } else {
      setSelectedImage(null)
    }
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (selectedImage && (e.key === 'Delete' || e.key === 'Backspace')) {
      e.preventDefault()
      selectedImage.remove()
      setSelectedImage(null)
      handleInput()
    }
  }, [selectedImage, handleInput])

  const startResize = useCallback((handle: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!selectedImage) return

    const w = selectedImage.offsetWidth
    const h = selectedImage.offsetHeight

    resizeRef.current = {
      handle,
      startX: e.clientX,
      startY: e.clientY,
      startW: w,
      startH: h,
      aspectRatio: w / h
    }

    setIsResizing(true)
  }, [selectedImage])

  const rotateImage = useCallback((degrees: number) => {
    if (!selectedImage) return
    const newRotation = (imageRotation + degrees + 360) % 360
    setImageRotation(newRotation)
    selectedImage.style.transform = newRotation ? `rotate(${newRotation}deg)` : ''
    handleInput()
    setTimeout(updateImageRect, 10)
  }, [selectedImage, imageRotation, handleInput, updateImageRect])

  const resetImageSize = useCallback(() => {
    if (!selectedImage) return
    selectedImage.style.width = 'auto'
    selectedImage.style.height = 'auto'
    selectedImage.style.maxHeight = '400px'
    selectedImage.style.transform = ''
    setImageRotation(0)
    handleInput()
    setTimeout(updateImageRect, 50)
  }, [selectedImage, handleInput, updateImageRect])

  const deleteImage = () => {
    if (!selectedImage) return
    selectedImage.remove()
    setSelectedImage(null)
    handleInput()
  }

  // Drawing canvas
  const [isDrawingActive, setIsDrawingActive] = useState(false)
  const lastPos = useRef({ x: 0, y: 0 })

  useEffect(() => {
    if (showDrawing && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d')
      if (ctx) { ctx.fillStyle = 'white'; ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height) }
    }
  }, [showDrawing])

  const startDrawingCanvas = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (rect) { lastPos.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }; setIsDrawingActive(true) }
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingActive || !canvasRef.current) return
    const ctx = canvasRef.current.getContext('2d')
    const rect = canvasRef.current.getBoundingClientRect()
    if (ctx) {
      ctx.beginPath()
      ctx.moveTo(lastPos.current.x, lastPos.current.y)
      ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top)
      ctx.strokeStyle = drawingColor
      ctx.lineWidth = brushSize
      ctx.lineCap = 'round'
      ctx.stroke()
      lastPos.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }
  }

  const saveDrawing = () => {
    canvasRef.current?.toBlob(async (blob) => {
      if (blob) { await uploadImage(new File([blob], 'dessin.png', { type: 'image/png' })); setShowDrawing(false) }
    })
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Toolbar - Simple et efficace */}
      <div className="flex flex-wrap items-center gap-1 p-2 bg-white dark:bg-gray-800 rounded-lg border shadow-sm">
        {/* Symboles rapides */}
        <div className="flex flex-wrap gap-0.5">
          {quickSymbols.map((sym, i) => (
            <button
              key={i}
              onClick={() => insertText(sym.latex)}
              className="px-1.5 py-1 text-sm hover:bg-purple-100 dark:hover:bg-purple-900 rounded transition font-medium"
              title={sym.latex}
            >
              {sym.label}
            </button>
          ))}
        </div>

        <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />

        {/* Bouton Bibliothèque Math */}
        <button
          onClick={() => setShowMathLibrary(!showMathLibrary)}
          className={`flex items-center gap-1 px-2 py-1.5 rounded transition text-sm font-medium ${
            showMathLibrary
              ? 'bg-purple-500 text-white'
              : 'bg-purple-100 hover:bg-purple-200 dark:bg-purple-900/50 dark:hover:bg-purple-800 text-purple-700 dark:text-purple-300'
          }`}
          title="Bibliothèque de symboles mathématiques"
        >
          <Calculator className="h-4 w-4" />
          <span className="hidden sm:inline">Maths</span>
          {showMathLibrary ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </button>

        <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />

        {/* Actions */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="p-2 hover:bg-green-100 dark:hover:bg-green-900 rounded transition"
          title="Ajouter une image"
        >
          {isUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImageIcon className="h-5 w-5 text-green-600" />}
        </button>

        <button
          onClick={() => insertText('\n```\ncode\n```\n')}
          className="p-2 hover:bg-blue-100 dark:hover:bg-blue-900 rounded transition"
          title="Bloc de code"
        >
          <Code className="h-5 w-5 text-blue-600" />
        </button>

        <button
          onClick={() => setShowDrawing(!showDrawing)}
          className={`p-2 rounded transition ${showDrawing ? 'bg-purple-500 text-white' : 'hover:bg-purple-100 dark:hover:bg-purple-900'}`}
          title="Dessiner"
        >
          <Pencil className="h-5 w-5" />
        </button>

        <div className="flex-1" />

        {/* Toggle aperçu (réduire/afficher) */}
        <button
          onClick={() => setShowPreview(!showPreview)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition ${
            showPreview
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
              : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600'
          }`}
          title={showPreview ? 'Masquer l\'aperçu' : 'Afficher l\'aperçu'}
        >
          <Eye className="h-4 w-4" />
          <span className="text-sm hidden sm:inline">{showPreview ? 'Aperçu' : 'Aperçu'}</span>
          {showPreview ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </button>
      </div>

      {/* Panneau Bibliothèque Mathématique */}
      {showMathLibrary && (
        <div className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-gray-800 dark:to-gray-900 rounded-xl border border-purple-200 dark:border-purple-800 p-4 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-purple-800 dark:text-purple-300 flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Bibliothèque Mathématique
            </h3>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Rechercher un symbole..."
                value={mathSearch}
                onChange={(e) => setMathSearch(e.target.value)}
                className="px-3 py-1.5 text-sm border border-purple-200 dark:border-purple-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-400 w-48"
              />
              <button
                onClick={() => setShowMathLibrary(false)}
                className="p-1.5 hover:bg-purple-200 dark:hover:bg-purple-800 rounded-lg transition"
                title="Fermer"
              >
                <X className="h-4 w-4 text-gray-500" />
              </button>
            </div>
          </div>

          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {mathCategories
              .filter(cat => {
                if (!mathSearch) return true
                const searchLower = mathSearch.toLowerCase()
                return cat.name.toLowerCase().includes(searchLower) ||
                  cat.symbols.some(s =>
                    s.label.toLowerCase().includes(searchLower) ||
                    s.desc.toLowerCase().includes(searchLower)
                  )
              })
              .map((category) => {
                const isExpanded = expandedCategories.includes(category.id)
                const filteredSymbols = mathSearch
                  ? category.symbols.filter(s =>
                      s.label.toLowerCase().includes(mathSearch.toLowerCase()) ||
                      s.desc.toLowerCase().includes(mathSearch.toLowerCase())
                    )
                  : category.symbols

                if (mathSearch && filteredSymbols.length === 0) return null

                return (
                  <div key={category.id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <button
                      onClick={() => {
                        setExpandedCategories(prev =>
                          prev.includes(category.id)
                            ? prev.filter(id => id !== category.id)
                            : [...prev, category.id]
                        )
                      }}
                      className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{category.icon}</span>
                        <span className="font-medium text-gray-800 dark:text-gray-200">{category.name}</span>
                        <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                          {filteredSymbols.length}
                        </span>
                      </div>
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-gray-500" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-gray-500" />
                      )}
                    </button>

                    {(isExpanded || mathSearch) && filteredSymbols.length > 0 && (
                      <div className="px-4 pb-3 pt-1 border-t border-gray-100 dark:border-gray-700">
                        <div className="flex flex-wrap gap-1.5">
                          {filteredSymbols.map((sym, i) => (
                            <button
                              key={i}
                              onClick={() => {
                                insertText(sym.latex)
                                if (!mathSearch) setShowMathLibrary(false)
                              }}
                              className="group relative px-2.5 py-1.5 bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-900/50 dark:to-blue-900/50 hover:from-purple-200 hover:to-blue-200 dark:hover:from-purple-800 dark:hover:to-blue-800 rounded-lg transition text-sm font-medium text-gray-800 dark:text-gray-200 border border-purple-200 dark:border-purple-700"
                              title={`${sym.desc}\n${sym.latex}`}
                            >
                              {sym.label}
                              <span className="absolute hidden group-hover:block z-50 bg-gray-900 text-white text-xs px-2 py-1 rounded -top-8 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
                                {sym.desc}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
          </div>

          <div className="mt-3 pt-3 border-t border-purple-200 dark:border-purple-700 text-xs text-gray-500 dark:text-gray-400">
            <strong>Astuce:</strong> Cliquez sur un symbole pour l'insérer. Les matrices utilisent <code className="bg-white dark:bg-gray-800 px-1 rounded">$$...$$</code> pour s'afficher en bloc.
          </div>
        </div>
      )}

      <input type="file" ref={fileInputRef} onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])} accept="image/*" className="hidden" />

      {/* Drawing Canvas */}
      {showDrawing && (
        <div className="bg-white dark:bg-gray-800 border rounded-lg p-3 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-sm font-medium">🎨 Dessin</span>
            <input type="color" value={drawingColor} onChange={(e) => setDrawingColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0" />
            <select value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} className="px-2 py-1 border rounded text-sm">
              <option value={2}>Fin</option>
              <option value={4}>Normal</option>
              <option value={8}>Épais</option>
            </select>
            <div className="flex-1" />
            <button onClick={() => { const ctx = canvasRef.current?.getContext('2d'); if (ctx && canvasRef.current) { ctx.fillStyle = 'white'; ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height) }}}
              className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm">Effacer</button>
            <button onClick={saveDrawing} className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white rounded text-sm">Insérer</button>
          </div>
          <canvas
            ref={canvasRef}
            width={700}
            height={200}
            onMouseDown={startDrawingCanvas}
            onMouseMove={draw}
            onMouseUp={() => setIsDrawingActive(false)}
            onMouseLeave={() => setIsDrawingActive(false)}
            className="border rounded cursor-crosshair w-full bg-white"
          />
        </div>
      )}

      {/* Éditeur (toujours visible) */}
      <div className="relative">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-1">
            <Pencil className="h-3 w-3" />
            Éditeur
          </span>
          <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
        </div>
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          className="border-2 border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 min-h-[200px] max-h-[350px] overflow-y-auto p-4 focus:outline-none focus:border-purple-400 text-gray-900 dark:text-gray-100 leading-relaxed"
          onInput={handleInput}
          onPaste={handlePaste}
          onClick={handleEditorClick}
          onKeyDown={handleKeyDown}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer?.files?.[0]; if (f?.type.startsWith('image/')) uploadImage(f) }}
          onDragOver={(e) => e.preventDefault()}
          data-placeholder={placeholder}
          style={{ whiteSpace: 'pre-wrap' }}
        />

        {/* Word-like Image Selection Overlay - Optimized */}
        {selectedImage && imageRect && (
          <div
            ref={overlayRef}
            className="absolute pointer-events-none z-10"
            style={{
              left: imageRect.x - 4,
              top: imageRect.y - 4,
              width: imageRect.w + 8,
              height: imageRect.h + 8,
              willChange: 'transform'
            }}
          >
            {/* Selection border */}
            <div className="absolute inset-0 border-2 border-blue-500 rounded-lg shadow-sm" />

            {/* Floating Toolbar */}
            <div className="pointer-events-auto absolute -top-12 left-1/2 transform -translate-x-1/2 flex items-center gap-1 bg-white dark:bg-gray-800 shadow-lg rounded-lg px-2 py-1.5 border z-20">
              <button onClick={() => rotateImage(-90)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition" title="Rotation -90°">
                <RotateCcw className="h-4 w-4 text-gray-600 dark:text-gray-300" />
              </button>
              <button onClick={() => rotateImage(90)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition" title="Rotation +90°">
                <RotateCw className="h-4 w-4 text-gray-600 dark:text-gray-300" />
              </button>
              <div className="w-px h-5 bg-gray-300 dark:bg-gray-600 mx-1" />
              <button onClick={resetImageSize} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition" title="Réinitialiser taille">
                <Maximize2 className="h-4 w-4 text-gray-600 dark:text-gray-300" />
              </button>
              <div className="w-px h-5 bg-gray-300 dark:bg-gray-600 mx-1" />
              <button onClick={deleteImage} className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/50 rounded transition" title="Supprimer image">
                <Trash2 className="h-4 w-4 text-red-500" />
              </button>
            </div>

            {/* Corner Resize Handles (maintain aspect ratio) */}
            <div onMouseDown={(e) => startResize('nw', e)} className="pointer-events-auto absolute -top-2 -left-2 w-4 h-4 bg-blue-500 border-2 border-white rounded-full cursor-nw-resize shadow-md hover:bg-blue-600 transition-colors" />
            <div onMouseDown={(e) => startResize('ne', e)} className="pointer-events-auto absolute -top-2 -right-2 w-4 h-4 bg-blue-500 border-2 border-white rounded-full cursor-ne-resize shadow-md hover:bg-blue-600 transition-colors" />
            <div onMouseDown={(e) => startResize('sw', e)} className="pointer-events-auto absolute -bottom-2 -left-2 w-4 h-4 bg-blue-500 border-2 border-white rounded-full cursor-sw-resize shadow-md hover:bg-blue-600 transition-colors" />
            <div onMouseDown={(e) => startResize('se', e)} className="pointer-events-auto absolute -bottom-2 -right-2 w-4 h-4 bg-blue-500 border-2 border-white rounded-full cursor-se-resize shadow-md hover:bg-blue-600 transition-colors" />

            {/* Edge Resize Handles (free resize) */}
            <div onMouseDown={(e) => startResize('n', e)} className="pointer-events-auto absolute -top-1.5 left-1/2 transform -translate-x-1/2 w-8 h-2.5 bg-white border-2 border-blue-500 rounded-full cursor-n-resize shadow-md hover:bg-blue-50 transition-colors" />
            <div onMouseDown={(e) => startResize('s', e)} className="pointer-events-auto absolute -bottom-1.5 left-1/2 transform -translate-x-1/2 w-8 h-2.5 bg-white border-2 border-blue-500 rounded-full cursor-s-resize shadow-md hover:bg-blue-50 transition-colors" />
            <div onMouseDown={(e) => startResize('w', e)} className="pointer-events-auto absolute top-1/2 -left-1.5 transform -translate-y-1/2 w-2.5 h-8 bg-white border-2 border-blue-500 rounded-full cursor-w-resize shadow-md hover:bg-blue-50 transition-colors" />
            <div onMouseDown={(e) => startResize('e', e)} className="pointer-events-auto absolute top-1/2 -right-1.5 transform -translate-y-1/2 w-2.5 h-8 bg-white border-2 border-blue-500 rounded-full cursor-e-resize shadow-md hover:bg-blue-50 transition-colors" />

            {/* Size indicator */}
            <div className="pointer-events-none absolute -bottom-9 left-1/2 transform -translate-x-1/2 text-xs bg-gray-900/90 text-white px-2 py-1 rounded-lg whitespace-nowrap shadow-lg">
              {Math.round(imageRect.w)} × {Math.round(imageRect.h)} px
              {imageRotation !== 0 && <span className="ml-1 text-blue-300">• {imageRotation}°</span>}
            </div>
          </div>
        )}
      </div>

      {/* Aperçu (toujours visible, peut être réduit) */}
      {showPreview && (
        <div className="mt-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wide flex items-center gap-1">
              <Eye className="h-3 w-3" />
              Aperçu en temps réel
            </span>
            <div className="flex-1 h-px bg-blue-200 dark:bg-blue-800" />
          </div>
          <div className="border-2 border-blue-200 dark:border-blue-800 rounded-xl bg-gradient-to-br from-blue-50/50 to-purple-50/50 dark:from-gray-900 dark:to-gray-800 min-h-[150px] max-h-[300px] overflow-y-auto p-4">
            {value ? (
              <div className="prose prose-sm max-w-none dark:prose-invert latex-preview" dangerouslySetInnerHTML={{ __html: previewHtml }} />
            ) : (
              <p className="text-gray-400 italic text-center py-6">L'aperçu apparaîtra ici...</p>
            )}
          </div>
        </div>
      )}

      {/* Hint */}
      <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
        Colle une image avec <strong>Ctrl+V</strong> • Formule LaTeX: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">$x^2$</code> • Bloc: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">$$formule$$</code>
      </p>

      <style jsx>{`
        [contenteditable]:empty:before { content: attr(data-placeholder); color: #9ca3af; pointer-events: none; }
      `}</style>
    </div>
  )
}
