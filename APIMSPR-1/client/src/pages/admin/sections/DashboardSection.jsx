import { useEffect, useState } from 'react'
import { api } from '../../../api'
import { useToast } from '../../../context/ToastContext'

const CARDS = [
  { key: 'api_users',                label: 'Comptes API',   cls: 'blue'  },
  { key: 'utilisateur',              label: 'Profils santé', cls: 'green' },
  { key: 'nutrition',                label: 'Aliments',      cls: ''      },
  { key: 'consommation_alimentaire', label: 'Consommation',  cls: 'amber' },
  { key: 'activite_journaliere',     label: 'Activité',      cls: 'rose'  },
]

export default function DashboardSection() {
  const [stats, setStats] = useState({})
  const toast = useToast()

  useEffect(() => {
    api('GET', '/auth/stats')
      .then(setStats)
      .catch(e => toast(e.message, 'err'))
  }, [])

  return (
    <>
      <div className="page-title">Dashboard</div>
      <div className="stats">
        {CARDS.map(c => (
          <div key={c.key} className={`stat-card ${c.cls}`}>
            <div className="lbl">{c.label}</div>
            <div className="val">{stats[c.key] ?? '—'}</div>
          </div>
        ))}
      </div>
    </>
  )
}
