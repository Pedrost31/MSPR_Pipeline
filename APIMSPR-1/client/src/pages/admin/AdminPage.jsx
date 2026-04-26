import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import DashboardSection  from './sections/DashboardSection'
import UsersSection      from './sections/UsersSection'
import AlimentSection    from './sections/AlimentSection'
import HealthSection     from './sections/HealthSection'
import ProfilsSection    from './sections/ProfilsSection'
import AnalyticsSection  from './sections/AnalyticsSection'
import {
  IconDashboard, IconUsers, IconFood, IconUser,
  IconBowl, IconActivity, IconTrend,
} from '../../components/Icons'

const NAV = [
  { id: 'dashboard',  label: 'Dashboard',    icon: <IconDashboard size={16}/> },
  { id: 'users',      label: 'Comptes API',   icon: <IconUsers size={16}/>,    group: 'Comptes' },
  { id: 'aliment',    label: 'Aliments',      icon: <IconFood size={16}/>,     group: 'Référentiel' },
  { id: 'profil',     label: 'Profils',       icon: <IconUser size={16}/>,     group: 'Santé' },
  { id: 'conso',      label: 'Consommation',  icon: <IconBowl size={16}/>,     group: 'Santé' },
  { id: 'activite',   label: 'Activité',      icon: <IconActivity size={16}/>, group: 'Santé' },
  { id: 'analytics',  label: 'Analytiques',   icon: <IconTrend size={16}/>,    group: 'Analytics' },
]

const HEALTH_CONFIGS = {
  conso:    { title: 'Consommation alimentaire', endpoint: '/consommation',         cols: ['id_consumption','date_consommation','repas_type','food_item','quantite_grammes'], delKey: r => r.id_consumption, delUrl: k => `/consommation/${k}` },
  activite: { title: 'Activité quotidienne',     endpoint: '/activite_quotidienne', cols: ['id_activity','date','workout_type','steps','calories_burned','pct_actif'],        delKey: r => r.id_activity,    delUrl: k => `/activite_quotidienne/${k}` },
}

export default function AdminPage() {
  const { user, logout } = useAuth()
  const [active, setActive] = useState('dashboard')

  const groups = []
  NAV.forEach(item => {
    if (item.group && !groups.includes(item.group)) groups.push(item.group)
  })

  function renderSection() {
    if (active === 'dashboard')  return <DashboardSection />
    if (active === 'users')      return <UsersSection />
    if (active === 'aliment')    return <AlimentSection />
    if (active === 'profil')     return <ProfilsSection />
    if (active === 'analytics')  return <AnalyticsSection />
    const cfg = HEALTH_CONFIGS[active]
    return cfg ? <HealthSection config={cfg} /> : null
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-logo">Health<span>AI</span> Admin</div>

        <div className="sidebar-group">Tableau de bord</div>
        <div
          className={`sidebar-item${active === 'dashboard' ? ' active' : ''}`}
          onClick={() => setActive('dashboard')}
        >
          <span className="icon"><IconDashboard size={16}/></span> Dashboard
        </div>

        {groups.map(group => (
          <div key={group}>
            <div className="sidebar-group">{group}</div>
            {NAV.filter(n => n.group === group).map(item => (
              <div
                key={item.id}
                className={`sidebar-item${active === item.id ? ' active' : ''}`}
                onClick={() => setActive(item.id)}
              >
                <span className="icon">{item.icon}</span> {item.label}
              </div>
            ))}
          </div>
        ))}

        <div className="sidebar-footer">
          <strong>{user?.email}</strong>
          <button className="btn-logout" onClick={logout}>Déconnexion</button>
        </div>
      </aside>

      <main className="main">
        {renderSection()}
      </main>
    </div>
  )
}
