import { useState } from 'react'
import { api } from '../api'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const [tab, setTab]     = useState('login')
  const [alert, setAlert] = useState(null)
  const [loading, setLoading] = useState(false)
  const { setUser }       = useAuth()

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true); setAlert(null)
    const { email, password } = Object.fromEntries(new FormData(e.target))
    try {
      const data = await api('POST', '/auth/login', { email, password })
      setUser({ email: data.email, role: data.role, id: data.id })
    } catch (err) {
      setAlert({ type: 'error', msg: err.message })
    } finally { setLoading(false) }
  }

  async function handleRegister(e) {
    e.preventDefault()
    setLoading(true); setAlert(null)
    const { email, password } = Object.fromEntries(new FormData(e.target))
    try {
      const data = await api('POST', '/auth/register', { email, password })
      setAlert({ type: 'success', msg: `Compte créé pour ${data.user.email} !` })
      e.target.reset()
    } catch (err) {
      setAlert({ type: 'error', msg: err.message })
    } finally { setLoading(false) }
  }

  const switchTab = (t) => { setTab(t); setAlert(null) }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">Health<span>AI</span></div>
          <div className="login-tagline">Plateforme de suivi santé & bien-être</div>
        </div>

        <div className="login-tabs">
          <button className={`login-tab${tab === 'login'    ? ' active' : ''}`} onClick={() => switchTab('login')}>Connexion</button>
          <button className={`login-tab${tab === 'register' ? ' active' : ''}`} onClick={() => switchTab('register')}>Créer un compte</button>
        </div>

        {tab === 'login' ? (
          <div className="login-form">
            <h2>Bon retour</h2>
            <p>Connectez-vous à votre espace HealthAI</p>
            <form onSubmit={handleLogin}>
              <div className="form-group">
                <label>Adresse email</label>
                <input name="email" type="email" placeholder="votre@email.com" required autoFocus />
              </div>
              <div className="form-group">
                <label>Mot de passe</label>
                <input name="password" type="password" placeholder="••••••••" required />
              </div>
              <button className="btn-submit" type="submit" disabled={loading}>
                {loading ? 'Connexion…' : 'Se connecter →'}
              </button>
            </form>
            {alert && <div className={`alert alert-${alert.type}`}>{alert.msg}</div>}
          </div>
        ) : (
          <div className="login-form">
            <h2>Créer un compte</h2>
            <p>Rôle <strong>user</strong> par défaut — un admin peut vous promouvoir</p>
            <form onSubmit={handleRegister}>
              <div className="form-group">
                <label>Adresse email</label>
                <input name="email" type="email" placeholder="votre@email.com" required autoFocus />
              </div>
              <div className="form-group">
                <label>Mot de passe</label>
                <input name="password" type="password" placeholder="••••••••" required />
              </div>
              <button className="btn-submit" type="submit" disabled={loading}>
                {loading ? 'Création…' : 'Créer mon compte →'}
              </button>
            </form>
            {alert && <div className={`alert alert-${alert.type}`}>{alert.msg}</div>}
          </div>
        )}
      </div>
    </div>
  )
}
