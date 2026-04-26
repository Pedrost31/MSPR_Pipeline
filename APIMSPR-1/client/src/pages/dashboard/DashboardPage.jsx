import { useState, useEffect } from 'react'
import { api } from '../../api'
import { useAuth } from '../../context/AuthContext'
import {
  IconHome, IconActivity, IconBowl,
  IconFood, IconTrend, IconEmpty,
} from '../../components/Icons'
import { usePagination, PAGE_SIZE } from '../../hooks/usePagination'
import Pagination from '../../components/Pagination'

const SECTIONS = [
  { id: 'home',      label: 'Accueil',      icon: <IconHome size={16}/>,     group: 'Mon espace' },
  { id: 'analytics', label: 'Mon bilan',    icon: <IconTrend size={16}/>,    group: 'Mon espace', endpoint: '/analytics/kpi',          cols: ['bmi_calculated','categorie_imc','nb_seances','moy_calories_brulees','total_steps'] },
  { id: 'activite',  label: 'Activité',     icon: <IconActivity size={16}/>, group: 'Mes données', endpoint: '/activite_quotidienne',  cols: ['id_activity','date','workout_type','steps','calories_burned','pct_actif'] },
  { id: 'conso',     label: 'Consommation', icon: <IconBowl size={16}/>,     group: 'Mes données', endpoint: '/consommation',          cols: ['id_consumption','date_consommation','repas_type','food_item','quantite_grammes'] },
  { id: 'aliment',   label: 'Aliments',     icon: <IconFood size={16}/>,     group: 'Référentiel', endpoint: '/aliment',               cols: ['food_item','category','calories_kcal','protein_g','carbohydrates_g','fat_g'] },
]

const COUNTS = ['activite', 'conso', 'aliment']

function DataTable({ section }) {
  const [data, setData]         = useState([])
  const [filtered, setFiltered] = useState([])
  const { paginated, page, setPage, pageCount, total } = usePagination(filtered)

  useEffect(() => {
    api('GET', section.endpoint).then(d => { setData(d); setFiltered(d) }).catch(() => {})
  }, [section.endpoint])

  const cols   = section.cols || (data.length > 0 ? Object.keys(data[0]).slice(0, 6) : [])
  const filter = q => setFiltered(
    data.filter(r => Object.values(r).some(v => String(v).toLowerCase().includes(q.toLowerCase())))
  )

  return (
    <>
      <div className="page-title">{section.label}</div>
      <div className="page-sub">Vos données — lecture seule</div>
      <div className="toolbar">
        <input className="search" placeholder="Rechercher…" onChange={e => filter(e.target.value)} />
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr>{cols.map(c => <th key={c}>{c}</th>)}</tr></thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={cols.length} className="empty">
                  <div className="empty-icon"><IconEmpty size={40}/></div>
                  Aucune donnée
                </td>
              </tr>
            ) : (
              paginated.map((r, i) => (
                <tr key={i}>{cols.map(c => <td key={c}>{r[c] ?? '—'}</td>)}</tr>
              ))
            )}
          </tbody>
        </table>
        <Pagination page={page} pageCount={pageCount} total={total} pageSize={PAGE_SIZE} setPage={setPage} />
      </div>
    </>
  )
}

export default function DashboardPage() {
  const { user, logout } = useAuth()
  const [active, setActive] = useState('home')
  const [counts, setCounts] = useState({})

  useEffect(() => {
    COUNTS.forEach(id => {
      const sec = SECTIONS.find(s => s.id === id)
      if (!sec) return
      api('GET', sec.endpoint).then(d => setCounts(c => ({ ...c, [id]: d.length }))).catch(() => {})
    })
  }, [])

  const groups        = [...new Set(SECTIONS.map(s => s.group))]
  const activeSection = SECTIONS.find(s => s.id === active)

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-logo">Health<span>AI</span></div>

        {groups.map(g => (
          <div key={g}>
            <div className="sidebar-group">{g}</div>
            {SECTIONS.filter(s => s.group === g).map(s => (
              <div
                key={s.id}
                className={`sidebar-item${active === s.id ? ' active' : ''}`}
                onClick={() => setActive(s.id)}
              >
                <span className="icon">{s.icon}</span> {s.label}
              </div>
            ))}
          </div>
        ))}

        <div className="sidebar-footer">
          <strong>{user?.email}</strong>
          <span className="sidebar-user-badge">user</span>
          <button className="btn-logout-muted" onClick={logout}>Déconnexion</button>
        </div>
      </aside>

      <main className="main">
        {active === 'home' ? (
          <>
            <div className="welcome-card">
              <h2>Bonjour, {user?.email?.split('@')[0]}</h2>
              <p>Bienvenue sur votre espace HealthAI. Consultez vos données depuis le menu.</p>
            </div>
            <div className="info-grid">
              {COUNTS.map(id => {
                const s = SECTIONS.find(x => x.id === id)
                return (
                  <div key={id} className="stat-card clickable" onClick={() => setActive(id)}>
                    <div className="lbl">{s?.label}</div>
                    <div className="val">{counts[id] ?? '—'}</div>
                  </div>
                )
              })}
            </div>
          </>
        ) : activeSection?.endpoint ? (
          <DataTable section={activeSection} />
        ) : null}
      </main>
    </div>
  )
}
