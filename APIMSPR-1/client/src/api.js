export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
    this.name = 'ApiError'
  }
}

const ERROR_LABELS = {
  400: 'Requête invalide',
  401: 'Non authentifié — veuillez vous reconnecter',
  403: 'Accès refusé',
  404: 'Ressource introuvable',
  409: 'Conflit — cette ressource existe déjà',
  500: 'Erreur serveur interne',
}

export async function api(method, path, body) {
  let res
  try {
    res = await fetch(path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError('Impossible de joindre le serveur. Vérifiez votre connexion.', 0)
  }

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    const message = data.error || ERROR_LABELS[res.status] || 'Erreur serveur'
    throw new ApiError(message, res.status)
  }

  return data
}
