'use client'

import { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, BookOpen, FileText, CreditCard, Brain, FolderOpen } from 'lucide-react'
import Link from 'next/link'
import api from '@/lib/api'
import { toast } from 'react-hot-toast'

interface Subject {
  id: string
  name: string
  description: string
  color: string
  notes_count: number
  flashcards_count: number
  quizzes_count: number
  total_documents_count: number
}

const PRESET_COLORS = [
  '#ef4444', // red
  '#f59e0b', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#ec4899', // pink
]

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: PRESET_COLORS[0],
  })

  useEffect(() => {
    fetchSubjects()
  }, [])

  const fetchSubjects = async () => {
    try {
      const response = await api.get('/subjects/')
      setSubjects(response.data.subjects || [])
    } catch (error) {
      toast.error('Erreur lors du chargement des matières')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name.trim()) {
      toast.error('Le nom est obligatoire')
      return
    }

    try {
      if (editingSubject) {
        await api.put(`/subjects/${editingSubject.id}`, formData)
        toast.success('Matière mise à jour')
      } else {
        await api.post('/subjects/', formData)
        toast.success('Matière créée')
      }
      
      setFormData({ name: '', description: '', color: PRESET_COLORS[0] })
      setShowAddForm(false)
      setEditingSubject(null)
      fetchSubjects()
    } catch (error) {
      toast.error('Erreur lors de l\'enregistrement')
    }
  }

  const handleEdit = (subject: Subject) => {
    setEditingSubject(subject)
    setFormData({
      name: subject.name,
      description: subject.description,
      color: subject.color,
    })
    setShowAddForm(true)
  }

  const handleDelete = async (subjectId: string) => {
    if (!confirm('Supprimer cette matière et tout son contenu associé?')) return

    try {
      await api.delete(`/subjects/${subjectId}`)
      toast.success('Matière supprimée')
      fetchSubjects()
    } catch (error) {
      toast.error('Erreur lors de la suppression')
    }
  }

  const cancelForm = () => {
    setShowAddForm(false)
    setEditingSubject(null)
    setFormData({ name: '', description: '', color: PRESET_COLORS[0] })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Mes Matières</h1>
          <p className="text-gray-600 mt-1">{subjects.length} matières</p>
        </div>
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center justify-center px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-semibold"
          >
            <Plus className="h-5 w-5 mr-2" />
            Nouvelle matière
          </button>
        )}
      </div>

      {/* Add/Edit Form */}
      {showAddForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            {editingSubject ? 'Modifier la matière' : 'Nouvelle matière'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nom <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Mathématiques, Physique..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Description de la matière..."
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Couleur
              </label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFormData({ ...formData, color })}
                    className={`w-10 h-10 rounded-lg transition ${
                      formData.color === color ? 'ring-2 ring-offset-2 ring-gray-900' : ''
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                type="submit"
                className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-semibold"
              >
                {editingSubject ? 'Mettre à jour' : 'Créer'}
              </button>
              <button
                type="button"
                onClick={cancelForm}
                className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-semibold"
              >
                Annuler
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Subjects Grid */}
      {subjects.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <BookOpen className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Aucune matière pour le moment
          </h3>
          <p className="text-gray-600 mb-6">
            Créez votre première matière pour organiser vos notes et révisions
          </p>
          <button
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center justify-center px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-semibold"
          >
            <Plus className="h-5 w-5 mr-2" />
            Créer ma première matière
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {subjects.map((subject) => (
            <div
              key={subject.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition overflow-hidden"
            >
              <div
                className="h-3"
                style={{ backgroundColor: subject.color }}
              ></div>
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-900 mb-2">
                      {subject.name}
                    </h3>
                    {subject.description && (
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {subject.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-4 gap-3 py-4 border-t border-b border-gray-200 mb-4">
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-1">
                      <FileText className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="text-base font-bold text-gray-900">
                      {subject.notes_count}
                    </div>
                    <div className="text-xs text-gray-600">Notes</div>
                  </div>
                  <div className="text-center border-l border-gray-200">
                    <div className="flex items-center justify-center mb-1">
                      <FolderOpen className="h-4 w-4 text-amber-600" />
                    </div>
                    <div className="text-base font-bold text-gray-900">
                      {subject.total_documents_count || 0}
                    </div>
                    <div className="text-xs text-gray-600">Docs</div>
                  </div>
                  <div className="text-center border-l border-gray-200">
                    <div className="flex items-center justify-center mb-1">
                      <CreditCard className="h-4 w-4 text-purple-600" />
                    </div>
                    <div className="text-base font-bold text-gray-900">
                      {subject.flashcards_count}
                    </div>
                    <div className="text-xs text-gray-600">Cards</div>
                  </div>
                  <div className="text-center border-l border-gray-200">
                    <div className="flex items-center justify-center mb-1">
                      <Brain className="h-4 w-4 text-green-600" />
                    </div>
                    <div className="text-base font-bold text-gray-900">
                      {subject.quizzes_count}
                    </div>
                    <div className="text-xs text-gray-600">Quiz</div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center space-x-2">
                  <Link
                    href={`/documents?subject=${subject.id}`}
                    className="flex-1 px-3 py-2 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 transition text-sm font-medium flex items-center justify-center"
                  >
                    <FolderOpen className="h-4 w-4 mr-1" />
                    Documents
                  </Link>
                  <button
                    onClick={() => handleEdit(subject)}
                    className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(subject.id)}
                    className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
