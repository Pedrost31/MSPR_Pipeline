export default function Pagination({ page, pageCount, total, pageSize, setPage }) {
  if (pageCount <= 1) return null

  const from = (page - 1) * pageSize + 1
  const to   = Math.min(page * pageSize, total)

  const pages = buildPages(page, pageCount)

  return (
    <div className="pagination">
      <span className="pagination-info">{from}–{to} sur {total}</span>
      <div className="pagination-controls">
        <button
          className="pagination-btn"
          onClick={() => setPage(p => p - 1)}
          disabled={page === 1}
          aria-label="Page précédente"
        >‹</button>

        {pages.map((p, i) =>
          p === '…' ? (
            <span key={`ellipsis-${i}`} className="pagination-ellipsis">…</span>
          ) : (
            <button
              key={p}
              className={`pagination-btn${p === page ? ' active' : ''}`}
              onClick={() => setPage(p)}
            >{p}</button>
          )
        )}

        <button
          className="pagination-btn"
          onClick={() => setPage(p => p + 1)}
          disabled={page === pageCount}
          aria-label="Page suivante"
        >›</button>
      </div>
    </div>
  )
}

function buildPages(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)

  const pages = []
  pages.push(1)

  if (current > 4) pages.push('…')

  const start = Math.max(2, current - 1)
  const end   = Math.min(total - 1, current + 1)

  for (let i = start; i <= end; i++) pages.push(i)

  if (current < total - 3) pages.push('…')

  pages.push(total)
  return pages
}
