import { useEffect, useState } from 'react'
import { api } from '../../../api'
import { useToast } from '../../../context/ToastContext'
import { IconEmpty } from '../../../components/Icons'

const PAGE_SIZE = 20

const VIEWS = [
  { id: 'kpi',       label: 'KPI',       endpoint: '/analytics/kpi',       desc: 'Indicateurs clés par utilisateur' },
  { id: 'profil',    label: 'Profil',     endpoint: '/analytics/profil',    desc: 'Profil complet avec statistiques agrégées' },
  { id: 'resume',    label: 'Résumé',     endpoint: '/analytics/resume',    desc: 'Activité + macros nutritionnels par jour' },
  { id: 'bilan',     label: 'Bilan cal.', endpoint: '/analytics/bilan',     desc: 'Dépense vs apport calorique' },
  { id: 'apport',    label: 'Apport',     endpoint: '/analytics/apport',    desc: 'Apport nutritionnel détaillé par repas' },
  { id: 'intensite', label: 'Intensité',  endpoint: '/analytics/intensite', desc: "Répartition de l'intensité par séance" },
]

export default function AnalyticsSection() {
  const toast = useToast()

  const [active, setActive] = useState('kpi')
  const [data, setData] = useState([])
  const [filtered, setFiltered] = useState([])
  const [loading, setLoading] = useState(false)

  const [page, setPage] = useState(1)

  const view = VIEWS.find(v => v.id === active)

  useEffect(() => {
    setLoading(true)
    setData([])
    setFiltered([])
    setPage(1)

    api('GET', view.endpoint)
      .then(d => {
        setData(d)
        setFiltered(d)
      })
      .catch(e => toast(e.message, 'err'))
      .finally(() => setLoading(false))
  }, [active])

  const cols = filtered.length > 0 ? Object.keys(filtered[0]) : []

  const filter = q => {
    const res = data.filter(r =>
      Object.values(r).some(v =>
        String(v).toLowerCase().includes(q.toLowerCase())
      )
    )
    setFiltered(res)
    setPage(1)
  }

  // pagination
  const start = (page - 1) * PAGE_SIZE
  const end = page * PAGE_SIZE
  const paginated = filtered.slice(start, end)
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)

  return (
    <>
      <div className="page-title">Analytiques</div>

      <div className="analytics-tabs">
        {VIEWS.map(v => (
          <button
            key={v.id}
            className={`analytics-tab${active === v.id ? ' active' : ''}`}
            onClick={() => setActive(v.id)}
          >
            {v.label}
          </button>
        ))}
      </div>

      <div className="page-sub">{view.desc}</div>

      <div className="toolbar">
        <input
          className="search"
          placeholder="Rechercher…"
          onChange={e => filter(e.target.value)}
        />
        <span className="badge badge-user">
          {filtered.length} ligne{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="table-wrap">
        {loading ? (
          <div className="empty">Chargement…</div>
        ) : (
          <table>
            <thead>
              <tr>{cols.map(c => <th key={c}>{c}</th>)}</tr>
            </thead>

            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={cols.length || 1} className="empty">
                    <div className="empty-icon">
                      <IconEmpty size={40} />
                    </div>
                    Aucune donnée
                  </td>
                </tr>
              ) : (
                paginated.map((r, i) => (
                  <tr key={i}>
                    {cols.map(c => (
                      <td key={c}>
                        {r[c] !== null && r[c] !== undefined ? String(r[c]) : '—'}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* pagination */}
      {filtered.length > PAGE_SIZE && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 20 }}>
          
          <button
            className="btn-primary"
            onClick={() => setPage(p => Math.max(p - 1, 1))}
            disabled={page === 1}
          >
            ⬅
          </button>

          <div style={{ padding: '8px 12px' }}>
            Page {page} / {totalPages}
          </div>

          <button
            className="btn-primary"
            onClick={() => setPage(p => (p < totalPages ? p + 1 : p))}
            disabled={page >= totalPages}
          >
            ➡
          </button>

        </div>
      )}
    </>
  )
}