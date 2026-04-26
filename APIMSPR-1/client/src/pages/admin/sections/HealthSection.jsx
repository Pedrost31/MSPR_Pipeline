import { useEffect, useState } from 'react'
import { api } from '../../../api'
import { useToast } from '../../../context/ToastContext'
import Modal from '../../../components/Modal'
import { IconEmpty } from '../../../components/Icons'

const PAGE_SIZE = 20

export default function HealthSection({ config }) {
  const toast = useToast()

  const [data, setData] = useState([])
  const [filtered, setFiltered] = useState([])
  const [delTarget, setDel] = useState(null)

  const [page, setPage] = useState(1)

  const load = () =>
    api('GET', config.endpoint)
      .then(d => {
        setData(d)
        setFiltered(d)
        setPage(1)
      })
      .catch(e => toast(e.message, 'err'))

  useEffect(() => {
    load()
  }, [config.endpoint])

  const filter = q => {
    const res = data.filter(r =>
      Object.values(r).some(v =>
        String(v).toLowerCase().includes(q.toLowerCase())
      )
    )
    setFiltered(res)
    setPage(1)
  }

  const confirmDel = async () => {
    try {
      await api('DELETE', config.delUrl(config.delKey(delTarget)))
      toast('Supprimé', 'ok')
      setDel(null)
      load()
    } catch (e) {
      toast(e.message, 'err')
    }
  }

  const cols =
    config.cols || (data.length > 0 ? Object.keys(data[0]).slice(0, 7) : [])

  // pagination
  const start = (page - 1) * PAGE_SIZE
  const end = page * PAGE_SIZE
  const paginated = filtered.slice(start, end)
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)

  return (
    <>
      <div className="page-title">{config.title}</div>

      <div className="toolbar">
        <input
          className="search"
          placeholder="Rechercher…"
          onChange={e => filter(e.target.value)}
        />
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {cols.map(c => <th key={c}>{c}</th>)}
              <th></th>
            </tr>
          </thead>

          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={cols.length + 1} className="empty">
                  <div className="empty-icon">
                    <IconEmpty size={40} />
                  </div>
                  Aucune donnée
                </td>
              </tr>
            ) : (
              paginated.map((row, i) => (
                <tr key={i}>
                  {cols.map(c => (
                    <td key={c}>{row[c] ?? '—'}</td>
                  ))}
                  <td>
                    <button
                      className="btn-sm btn-del"
                      onClick={() => setDel(row)}
                    >
                      Suppr.
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* PAGINATION */}
      {filtered.length > PAGE_SIZE && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 20,
            marginTop: 20,
          }}
        >
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
            onClick={() =>
              setPage(p => (p < totalPages ? p + 1 : p))
            }
            disabled={page >= totalPages}
          >
            ➡
          </button>
        </div>
      )}

      {/* DELETE MODAL */}
      {delTarget && (
        <Modal
          title="Confirmer la suppression"
          subtitle="Cette action est irréversible."
          onClose={() => setDel(null)}
          onConfirm={confirmDel}
          confirmLabel="Supprimer"
          danger
        />
      )}
    </>
  )
}