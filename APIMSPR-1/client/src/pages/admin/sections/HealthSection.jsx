import { useEffect, useState } from 'react'
import { api } from '../../../api'
import { useToast } from '../../../context/ToastContext'
import Modal from '../../../components/Modal'
import { IconEmpty } from '../../../components/Icons'

export default function HealthSection({ config }) {
  const toast = useToast()
  const [data, setData]         = useState([])
  const [filtered, setFiltered] = useState([])
  const [delTarget, setDel]     = useState(null)

  const load = () => api('GET', config.endpoint).then(d => { setData(d); setFiltered(d) }).catch(e => toast(e.message, 'err'))
  useEffect(() => { load() }, [config.endpoint])

  const filter = q => setFiltered(data.filter(r => Object.values(r).some(v => String(v).toLowerCase().includes(q.toLowerCase()))))

  const confirmDel = async () => {
    try {
      await api('DELETE', config.delUrl(config.delKey(delTarget)))
      toast('Supprimé', 'ok'); setDel(null); load()
    } catch (e) { toast(e.message, 'err') }
  }

  const cols = config.cols || (data.length > 0 ? Object.keys(data[0]).slice(0, 7) : [])

  return (
    <>
      <div className="page-title">{config.title}</div>
      <div className="toolbar">
        <input className="search" placeholder="Rechercher…" onChange={e => filter(e.target.value)} />
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>{cols.map(c => <th key={c}>{c}</th>)}<th></th></tr>
          </thead>
          <tbody>
            {filtered.length === 0
              ? <tr><td colSpan={cols.length + 1} className="empty"><div className="empty-icon"><IconEmpty size={40}/></div>Aucune donnée</td></tr>
              : filtered.map((row, i) => (
                <tr key={i}>
                  {cols.map(c => <td key={c}>{row[c] ?? '—'}</td>)}
                  <td><button className="btn-sm btn-del" onClick={() => setDel(row)}>Suppr.</button></td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>

      {delTarget && (
        <Modal title="Confirmer la suppression" subtitle="Cette action est irréversible." onClose={() => setDel(null)} onConfirm={confirmDel} confirmLabel="Supprimer" danger />
      )}
    </>
  )
}
