import api from '@/lib/api'

// Timeout spécifique pour OCR (5 minutes pour les gros documents)
const OCR_TIMEOUT = 300000 // 5 minutes

export interface OCRResult {
  text: string
  confidence: number
  language: string
  page_count?: number
}

export interface OCRLanguage {
  code: string
  name: string
  native_name: string
}

export interface OCRStats {
  total_ocr_requests: number
  total_pages_processed: number
  total_images_processed: number
  average_confidence: number
  most_used_language: string
}

export const ocrService = {
  // Upload PDF and extract text
  uploadPDF: async (
    file: File,
    createNote: boolean = false,
    language: string = 'fra'
  ): Promise<OCRResult> => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('create_note', createNote.toString())
    formData.append('language', language)

    const response = await api.post('/ocr/upload-pdf', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: OCR_TIMEOUT, // 5 minutes pour les gros PDFs
    })
    return response.data
  },

  // Upload image and extract text
  uploadImage: async (
    file: File,
    language: string = 'fra'
  ): Promise<OCRResult> => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('language', language)

    const response = await api.post('/ocr/upload-image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: OCR_TIMEOUT, // 5 minutes pour les grosses images
    })
    return response.data
  },

  // Get supported OCR languages
  getLanguages: async (): Promise<OCRLanguage[]> => {
    const response = await api.get('/ocr/languages')
    return response.data.languages || response.data
  },

  // Get OCR usage statistics
  getStats: async (): Promise<OCRStats> => {
    const response = await api.get('/ocr/stats')
    return response.data
  },
}
