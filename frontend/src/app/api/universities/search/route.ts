import { NextRequest, NextResponse } from 'next/server'

// Proxy API pour contourner les problèmes CORS/Mixed Content
// L'API Hipo est en HTTP, donc on fait le proxy côté serveur

const HIPO_API_URL = 'http://universities.hipolabs.com'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const name = searchParams.get('name')
  const country = searchParams.get('country')

  if (!name || name.length < 2) {
    return NextResponse.json([])
  }

  try {
    // Construire l'URL
    let url = `${HIPO_API_URL}/search?name=${encodeURIComponent(name)}`
    if (country) {
      url += `&country=${encodeURIComponent(country)}`
    }

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
      // Cache pendant 5 minutes
      next: { revalidate: 300 }
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()

    // S'assurer que data est un tableau
    if (!Array.isArray(data)) {
      return NextResponse.json([])
    }

    // Limiter à 15 résultats et trier
    const results = data
      .sort((a: any, b: any) => {
        // Prioriser les correspondances au début du nom
        const aStartsWith = a.name.toLowerCase().startsWith(name.toLowerCase())
        const bStartsWith = b.name.toLowerCase().startsWith(name.toLowerCase())
        if (aStartsWith && !bStartsWith) return -1
        if (!aStartsWith && bStartsWith) return 1
        return a.name.localeCompare(b.name)
      })
      .slice(0, 15)

    return NextResponse.json(results)
  } catch (error) {
    console.error('Erreur proxy universités:', error)
    return NextResponse.json([], { status: 500 })
  }
}
