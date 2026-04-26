import { useState, useMemo, useEffect } from 'react'

export const PAGE_SIZE = 10

export function usePagination(data) {
  const [page, setPage] = useState(1)

  // Retour à la page 1 à chaque changement de données (filtre, rechargement)
  useEffect(() => { setPage(1) }, [data])

  const pageCount = Math.ceil(data.length / PAGE_SIZE) || 1

  const paginated = useMemo(
    () => data.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [data, page]
  )

  return { paginated, page, setPage, pageCount, total: data.length }
}
