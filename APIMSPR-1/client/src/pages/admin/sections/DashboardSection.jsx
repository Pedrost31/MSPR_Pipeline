import { useEffect, useState } from 'react'
import { api } from '../../../api'
import { useToast } from '../../../context/ToastContext'

import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis
} from 'recharts'

const CARDS = [
  { key: 'api_users', label: 'Comptes API', cls: 'blue' },
  { key: 'utilisateur', label: 'Profils santé', cls: 'green' },
  { key: 'nutrition', label: 'Aliments', cls: '' },
  { key: 'consommation_alimentaire', label: 'Consommation', cls: 'amber' },
  { key: 'activite_journaliere', label: 'Activité', cls: 'rose' },
]

const IMC_COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6']
const GENDER_COLORS = ['#3b82f6', '#ec4899', '#8b5cf6']

export default function DashboardSection() {
  const [stats, setStats] = useState({})
  const [kpi, setKpi] = useState([])
  const toast = useToast()

  useEffect(() => {
    api('GET', '/auth/stats')
      .then(setStats)
      .catch(e => toast(e.message, 'err'))

    api('GET', '/analytics/kpi')
      .then(setKpi)
      .catch(e => toast(e.message, 'err'))
  }, [])

  if (!kpi || kpi.length === 0) return <div>Chargement...</div>

  // ---------- IMC ----------
  const imcMap = {}
  const genderMap = {}

  kpi.forEach(d => {
    imcMap[d.categorie_imc] = (imcMap[d.categorie_imc] || 0) + 1
    genderMap[d.gender] = (genderMap[d.gender] || 0) + 1
  })

  const imcData = Object.entries(imcMap).map(([k, v]) => ({
    name: k,
    value: v
  }))

  const genderData = Object.entries(genderMap).map(([k, v]) => ({
    name: k,
    value: v
  }))

  // ---------- GRAPHS DATA ----------
  const dureeData = kpi.map(d => ({
    user: `User ${d.user_id}`,
    duree: d.moy_duree_seance_h
  }))

  const seanceData = kpi.map(d => ({
    user: `User ${d.user_id}`,
    seances: d.nb_seances
  }))

  const stepsData = kpi.map(d => ({
    user: `User ${d.user_id}`,
    steps: d.total_steps
  }))

  return (
    <>
      <div className="page-title">Dashboard</div>

      {/* ================= KPI CARDS ================= */}
      <div className="stats">
        {CARDS.map(c => (
          <div key={c.key} className={`stat-card ${c.cls}`}>
            <div className="lbl">{c.label}</div>
            <div className="val">{stats[c.key] ?? '—'}</div>
          </div>
        ))}
      </div>

      {/* ================= GRAPHS ================= */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 30,
          marginTop: 40,
          alignItems: 'stretch'
        }}
      >

        {/* IMC */}
        <div className="chart-card">
          <h3>Catégories IMC</h3>
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={imcData}
                dataKey="value"
                nameKey="name"
                outerRadius={100}
                label
              >
                {imcData.map((_, i) => (
                  <Cell key={i} fill={IMC_COLORS[i % IMC_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* GENRE */}
        <div className="chart-card">
          <h3>Genre</h3>
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={genderData}
                dataKey="value"
                nameKey="name"
                outerRadius={100}
                label
              >
                {genderData.map((_, i) => (
                  <Cell key={i} fill={GENDER_COLORS[i % GENDER_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* SÉANCES */}
        <div className="chart-card">
          <h3>Nombre de séances</h3>
          <ResponsiveContainer>
            <BarChart data={seanceData}>
              <XAxis dataKey="user" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="seances" fill="#6366f1" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* DURÉE */}
        <div className="chart-card">
          <h3>Durée moyenne des séances (h)</h3>
          <ResponsiveContainer>
            <BarChart data={dureeData}>
              <XAxis dataKey="user" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="duree" fill="#f59e0b" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* STEPS */}
        <div className="chart-card">
          <h3>Distribution des pas</h3>
          <ResponsiveContainer>
            <BarChart data={stepsData}>
              <XAxis dataKey="user" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="steps" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </div>

      </div>
    </>
  )
}