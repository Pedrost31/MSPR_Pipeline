import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Login     from './pages/Login'
import AdminPage from './pages/admin/AdminPage'
import Dashboard from './pages/dashboard/DashboardPage'

function Guard({ role, children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="loading-screen"><div className="spinner"/></div>
  if (!user)   return <Navigate to="/" replace />
  if (user.role !== role) return <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace />
  return children
}

export default function App() {
  const { user, loading } = useAuth()
  if (loading) return <div className="loading-screen"><div className="spinner"/></div>

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={
          user
            ? <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace />
            : <Login />
        } />
        <Route path="/admin" element={<Guard role="admin"><AdminPage /></Guard>} />
        <Route path="/dashboard" element={<Guard role="user"><Dashboard /></Guard>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
