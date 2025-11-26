'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Save, X, Tag, Sparkles } from 'lucide-react'
import api from '@/lib/api'
import { toast } from 'react-hot-toast'
import LaTeXEditor from '@/components/LaTeXEditor'

interface Subject {
  id: string
  name: string
  color: string
}

export default function NewNotePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    subject_id: '',
    tags: [] as string[],
  })
  const [tagInput, setTagInput] = useState('')

  useEffect(() => {
    fetchSubjects()
  }, [])

  const fetchSubjects = async () => {
    try {
      const response = await api.get('/subjects/')
      setSubjects(response.data)
    } catch (error) {
      console.error('Erreur lors du chargement des matières:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.title || !formData.content || !formData.subject_id) {
      toast.error('Veuillez remplir tous les champs obligatoires')
      return
    }

    setLoading(true)
    try {
      const response = await api.post('/notes/', formData)
      toast.success('Note créée avec succès!')
      router.push(`/notes/${response.data.id}`)
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la création')
    } finally {
      setLoading(false)
    }
  }

  const addTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData({
        ...formData,
        tags: [...formData.tags, tagInput.trim()],
      })
      setTagInput('')
    }
  }

  const removeTag = (tagToRemove: string) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter((tag) => tag !== tagToRemove),
    })
  }

  const generateWithAI = async () => {
    if (!formData.content) {
      toast.error('Ajoutez du contenu d\'abord')
      return
    }

    try {
      toast.loading('Génération de flashcards avec IA...', { duration: 3000 })
      const response = await api.post('/ai/generate-flashcards', {
        content: formData.content,
        count: 10,
      })
      toast.success(`${response.data.flashcards.length} flashcards générées!`)
    } catch (error) {
      toast.error('Erreur lors de la génération IA')
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Nouvelle Note</h1>
        <button
          onClick={() => router.back()}
          className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition flex items-center space-x-2"
        >
          <X className="h-5 w-5" />
          <span>Annuler</span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Main Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Titre <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Ex: Chapitre 5 - Les Algorithmes de Tri"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-lg"
              required
            />
          </div>

          {/* Subject */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Matière <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.subject_id}
              onChange={(e) => setFormData({ ...formData, subject_id: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              required
            >
              <option value="">Sélectionnez une matière</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
          </div>

          {/* Content */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Contenu <span className="text-red-500">*</span>
            </label>
            <LaTeXEditor
              value={formData.content}
              onChange={(content) => setFormData({ ...formData, content })}
              placeholder="Écris ta note ici... Utilise LaTeX pour les formules mathématiques ($x^2$, $$\int_0^1$$, etc.)"
              rows={15}
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tags
            </label>
            <div className="flex items-center space-x-2 mb-2">
              <div className="flex-1 relative">
                <Tag className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addTag()
                    }
                  }}
                  placeholder="Ajouter un tag..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <button
                type="button"
                onClick={addTag}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
              >
                Ajouter
              </button>
            </div>
            {formData.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {formData.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center px-3 py-1 rounded-full bg-primary-100 text-primary-700 text-sm"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="ml-2 hover:text-primary-900"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* AI Actions */}
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl border border-purple-200 p-6">
          <div className="flex items-start space-x-4">
            <div className="p-3 bg-white rounded-lg shadow-sm">
              <Sparkles className="h-6 w-6 text-purple-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-2">Actions IA</h3>
              <p className="text-sm text-gray-600 mb-4">
                Utilisez l'IA pour créer automatiquement des flashcards, des quiz ou résumer votre note.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={generateWithAI}
                  className="px-4 py-2 bg-white border border-purple-300 text-purple-700 rounded-lg hover:bg-purple-50 transition text-sm font-medium"
                >
                  Générer des flashcards
                </button>
                <button
                  type="button"
                  className="px-4 py-2 bg-white border border-purple-300 text-purple-700 rounded-lg hover:bg-purple-50 transition text-sm font-medium"
                >
                  Créer un quiz
                </button>
                <button
                  type="button"
                  className="px-4 py-2 bg-white border border-purple-300 text-purple-700 rounded-lg hover:bg-purple-50 transition text-sm font-medium"
                >
                  Résumer
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end space-x-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-semibold flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="h-5 w-5" />
            <span>{loading ? 'Enregistrement...' : 'Enregistrer la note'}</span>
          </button>
        </div>
      </form>
    </div>
  )
}
