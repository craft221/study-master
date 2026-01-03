/**
 * Service Worker pour Study Master - Mode hors ligne
 * Gère le cache, les requêtes réseau et la synchronisation
 */

const CACHE_VERSION = 'v1.2.0';
const STATIC_CACHE = `study-master-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `study-master-dynamic-${CACHE_VERSION}`;
const API_CACHE = `study-master-api-${CACHE_VERSION}`;

// Ressources statiques à mettre en cache immédiatement
// Note: On utilise uniquement les ressources qui existent
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
];

// Routes API à mettre en cache pour le mode hors ligne
const CACHEABLE_API_ROUTES = [
  '/api/v1/users/me',
  '/api/v1/notes/',
  '/api/v1/flashcards/decks/',
  '/api/v1/schedules/',
  '/api/v1/study-groups/',
  '/api/v1/subjects/',
  '/api/v1/gamification/profile',
  '/api/v1/gamification/achievements',
  '/api/v1/mascot/state',
];

// Routes pour la synchronisation en arrière-plan
const SYNC_ROUTES = [
  { tag: 'sync-notes', endpoint: '/api/v1/notes/' },
  { tag: 'sync-flashcards', endpoint: '/api/v1/flashcards/' },
  { tag: 'sync-schedules', endpoint: '/api/v1/schedules/' },
  { tag: 'sync-study-sessions', endpoint: '/api/v1/study-sessions/' },
];

// Installation du Service Worker
self.addEventListener('install', (event) => {
  console.log('[SW] Installation en cours...');

  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(async (cache) => {
        console.log('[SW] Mise en cache des ressources statiques');
        // Utiliser addAll avec gestion d'erreur individuelle
        const cachePromises = STATIC_ASSETS.map(async (url) => {
          try {
            const response = await fetch(url);
            if (response.ok) {
              await cache.put(url, response);
              console.log('[SW] Cached:', url);
            }
          } catch (error) {
            console.warn('[SW] Impossible de cacher:', url, error.message);
          }
        });
        return Promise.all(cachePromises);
      })
      .then(() => {
        console.log('[SW] Installation terminée');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Erreur lors de l\'installation:', error);
        // Ne pas bloquer l'installation même en cas d'erreur
        return self.skipWaiting();
      })
  );
});

// Activation du Service Worker
self.addEventListener('activate', (event) => {
  console.log('[SW] Activation en cours...');

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => {
              return name.startsWith('study-master-') &&
                     name !== STATIC_CACHE &&
                     name !== DYNAMIC_CACHE &&
                     name !== API_CACHE;
            })
            .map((name) => {
              console.log('[SW] Suppression du cache obsolète:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[SW] Activation terminée');
        return self.clients.claim();
      })
  );
});

// Interception des requêtes
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorer les requêtes non-GET pour le cache
  if (request.method !== 'GET') {
    // Stocker les requêtes POST/PUT/DELETE échouées pour synchronisation
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) {
      event.respondWith(handleMutationRequest(request));
    }
    return;
  }

  // Stratégie pour les requêtes API
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request));
    return;
  }

  // Stratégie pour les ressources statiques (Cache First)
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Stratégie pour les pages (Network First)
  event.respondWith(networkFirst(request, DYNAMIC_CACHE));
});

// Stratégie Cache First
async function cacheFirst(request, cacheName) {
  const cachedResponse = await caches.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.error('[SW] Erreur Cache First:', error);
    return new Response('Contenu non disponible hors ligne', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

// Stratégie Network First
async function networkFirst(request, cacheName) {
  try {
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.log('[SW] Réseau indisponible, utilisation du cache');

    const cachedResponse = await caches.match(request);

    if (cachedResponse) {
      return cachedResponse;
    }

    // Retourner la page hors ligne pour les requêtes de navigation
    if (request.mode === 'navigate') {
      return caches.match('/offline');
    }

    return new Response('Contenu non disponible hors ligne', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

// Gestion des requêtes API
async function handleApiRequest(request) {
  const url = new URL(request.url);
  const isCacheable = CACHEABLE_API_ROUTES.some(route =>
    url.pathname.includes(route.replace('/api/v1', ''))
  );

  try {
    const networkResponse = await fetch(request);

    // Mettre en cache les réponses API réussies
    if (networkResponse.ok && isCacheable) {
      const cache = await caches.open(API_CACHE);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.log('[SW] API hors ligne, utilisation du cache');

    const cachedResponse = await caches.match(request);

    if (cachedResponse) {
      // Ajouter un header pour indiquer que c'est une réponse en cache
      const headers = new Headers(cachedResponse.headers);
      headers.set('X-From-Cache', 'true');
      headers.set('X-Cache-Date', cachedResponse.headers.get('date') || new Date().toISOString());

      return new Response(cachedResponse.body, {
        status: cachedResponse.status,
        statusText: cachedResponse.statusText,
        headers
      });
    }

    // Retourner une réponse d'erreur avec des données vides
    return new Response(JSON.stringify({
      error: 'offline',
      message: 'Vous êtes hors ligne. Les données ne sont pas disponibles.',
      cached: false
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Gestion des requêtes de mutation (POST, PUT, DELETE)
async function handleMutationRequest(request) {
  try {
    const response = await fetch(request.clone());
    return response;
  } catch (error) {
    console.log('[SW] Mutation échouée, stockage pour synchronisation');

    // Cloner la requête et la stocker dans IndexedDB
    const requestData = await serializeRequest(request);
    await storeOfflineRequest(requestData);

    // Enregistrer pour la synchronisation en arrière-plan
    if ('sync' in self.registration) {
      await self.registration.sync.register('sync-offline-data');
    }

    return new Response(JSON.stringify({
      success: true,
      offline: true,
      message: 'Action enregistrée. Elle sera synchronisée lorsque vous serez en ligne.'
    }), {
      status: 202,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Sérialiser une requête pour le stockage
async function serializeRequest(request) {
  const body = await request.clone().text();

  return {
    url: request.url,
    method: request.method,
    headers: Object.fromEntries(request.headers.entries()),
    body: body || null,
    timestamp: Date.now()
  };
}

// Stocker une requête hors ligne dans IndexedDB
async function storeOfflineRequest(requestData) {
  return new Promise((resolve, reject) => {
    const dbRequest = indexedDB.open('StudyMasterOffline', 1);

    dbRequest.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('pendingRequests')) {
        db.createObjectStore('pendingRequests', { keyPath: 'id', autoIncrement: true });
      }
    };

    dbRequest.onsuccess = (event) => {
      const db = event.target.result;
      const transaction = db.transaction('pendingRequests', 'readwrite');
      const store = transaction.objectStore('pendingRequests');

      store.add(requestData);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    };

    dbRequest.onerror = () => reject(dbRequest.error);
  });
}

// Synchronisation en arrière-plan
self.addEventListener('sync', (event) => {
  console.log('[SW] Événement de synchronisation:', event.tag);

  if (event.tag === 'sync-offline-data') {
    event.waitUntil(syncOfflineData());
  }
});

// Synchroniser les données hors ligne
async function syncOfflineData() {
  return new Promise((resolve, reject) => {
    const dbRequest = indexedDB.open('StudyMasterOffline', 1);

    dbRequest.onsuccess = async (event) => {
      const db = event.target.result;
      const transaction = db.transaction('pendingRequests', 'readwrite');
      const store = transaction.objectStore('pendingRequests');

      const getAllRequest = store.getAll();

      getAllRequest.onsuccess = async () => {
        const pendingRequests = getAllRequest.result;

        for (const requestData of pendingRequests) {
          try {
            const response = await fetch(requestData.url, {
              method: requestData.method,
              headers: requestData.headers,
              body: requestData.body
            });

            if (response.ok) {
              // Supprimer la requête synchronisée
              store.delete(requestData.id);

              // Notifier le client
              const clients = await self.clients.matchAll();
              clients.forEach(client => {
                client.postMessage({
                  type: 'SYNC_SUCCESS',
                  url: requestData.url,
                  method: requestData.method
                });
              });
            }
          } catch (error) {
            console.error('[SW] Erreur de synchronisation:', error);
          }
        }

        resolve();
      };

      getAllRequest.onerror = () => reject(getAllRequest.error);
    };

    dbRequest.onerror = () => reject(dbRequest.error);
  });
}

// Vérifier si c'est une ressource statique
function isStaticAsset(pathname) {
  const staticExtensions = ['.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf'];
  return staticExtensions.some(ext => pathname.endsWith(ext));
}

// Gestion des notifications push
self.addEventListener('push', (event) => {
  console.log('[SW] Notification push reçue');

  if (!event.data) return;

  const data = event.data.json();

  const options = {
    body: data.body || 'Nouvelle notification de Study Master',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/',
      ...data
    },
    actions: data.actions || []
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Study Master', options)
  );
});

// Clic sur une notification
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Clic sur notification');

  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Chercher une fenêtre existante
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(urlToOpen);
            return client.focus();
          }
        }

        // Ouvrir une nouvelle fenêtre
        if (self.clients.openWindow) {
          return self.clients.openWindow(urlToOpen);
        }
      })
  );
});

// Message depuis le client
self.addEventListener('message', (event) => {
  console.log('[SW] Message reçu:', event.data);

  switch (event.data.type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;

    case 'CACHE_URLS':
      event.waitUntil(cacheUrls(event.data.urls));
      break;

    case 'CLEAR_CACHE':
      event.waitUntil(clearAllCaches());
      break;

    case 'GET_CACHE_STATUS':
      event.waitUntil(getCacheStatus().then(status => {
        event.source.postMessage({ type: 'CACHE_STATUS', status });
      }));
      break;
  }
});

// Mettre en cache des URLs spécifiques
async function cacheUrls(urls) {
  const cache = await caches.open(DYNAMIC_CACHE);

  for (const url of urls) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        await cache.put(url, response);
      }
    } catch (error) {
      console.error('[SW] Erreur lors du cache de:', url, error);
    }
  }
}

// Vider tous les caches
async function clearAllCaches() {
  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.map(name => caches.delete(name)));
  console.log('[SW] Tous les caches ont été vidés');
}

// Obtenir le statut du cache
async function getCacheStatus() {
  const cacheNames = await caches.keys();
  const status = {};

  for (const name of cacheNames) {
    const cache = await caches.open(name);
    const keys = await cache.keys();
    status[name] = keys.length;
  }

  return status;
}

console.log('[SW] Service Worker chargé - Version:', CACHE_VERSION);
