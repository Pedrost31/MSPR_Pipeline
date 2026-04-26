import { useEffect, useState } from 'react'
import { api } from '../../../api'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import Modal from '../../../components/Modal'
import { usePagination, PAGE_SIZE } from '../../../hooks/usePagination'
import Pagination from '../../../components/Pagination'

export default function UsersSection() {
  const { user: me }         = useAuth()
  const toast                = useToast()
  const [users, setUsers]    = useState([])
  const [filtered, setFiltered] = useState([])
  const { paginated, page, setPage, pageCount, total } = usePagination(filtered)
  const [editId, setEditId]  = useState(null)
  const [delTarget, setDel]  = useState(null)
  const [form, setForm]      = useState({ email: '', password: '', role: 'user' })
  const [showForm, setShowForm] = useState(false)

  const load = () => api('GET', '/auth/users').then(d => { setUsers(d); setFiltered(d) }).catch(e => toast(e.message, 'err'))
  useEffect(() => { load() }, [])

  const filter = q => setFiltered(users.filter(u => u.email.toLowerCase().includes(q.toLowerCase())))

  const openCreate = () => { setEditId(null); setForm({ email: '', password: '', role: 'user' }); setShowForm(true) }
  const openEdit   = u  => { setEditId(u.id); setForm({ email: u.email, password: '', role: u.role }); setShowForm(true) }

  const submit = async () => {
    try {
      if (editId) {
        await api('PUT', `/auth/users/${editId}`, { email: form.email })
        const orig = users.find(u => u.id === editId)
        if (orig.role !== form.role) await api('PATCH', `/auth/users/${editId}/role`, { role: form.role })
      } else {
        if (!form.password) return toast('Mot de passe requis', 'err')
        await api('POST', '/auth/users', form)
      }
      toast('Enregistré', 'ok'); setShowForm(false); load()
    } catch (e) { toast(e.message, 'err') }
  }

  const toggleRole = async (u) => {
    try {
      await api('PATCH', `/auth/users/${u.id}/role`, { role: u.role === 'admin' ? 'user' : 'admin' })
      toast('Rôle mis à jour', 'ok'); load()
    } catch (e) { toast(e.message, 'err') }
  }

  const confirmDel = async () => {
    try {
      await api('DELETE', `/auth/users/${delTarget.id}`)
      toast('Supprimé', 'ok'); setDel(null); load()
    } catch (e) { toast(e.message, 'err') }
  }

  return (
    <>
      <div className="page-title">Comptes API</div>
      <div className="toolbar">
        <input className="search" placeholder="Rechercher par email…" onChange={e => filter(e.target.value)} />
        <button className="btn-primary" onClick={openCreate}>+ Nouveau compte</button>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>ID</th><th>Email</th><th>Rôle</th><th>Créé le</th><th>Actions</th></tr></thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={5} className="empty">Aucun compte</td></tr>
            ) : paginated.map(u => (
              <tr key={u.id}>
                <td>{u.id}</td>
                <td>{u.email}{u.id === me.id && <span className="me-tag">moi</span>}</td>
                <td><span className={`badge badge-${u.role}`}>{u.role}</span></td>
                <td>{new Date(u.created_at).toLocaleDateString('fr-FR')}</td>
                <td><div className="actions">
                  <button className="btn-sm btn-edit" onClick={() => openEdit(u)}>Modifier</button>
                  {u.id !== me.id && <>
                    <button className="btn-sm btn-role" onClick={() => toggleRole(u)}>
                      {u.role === 'admin' ? 'Rétrograder' : 'Promouvoir'}
                    </button>
                    <button className="btn-sm btn-del" onClick={() => setDel(u)}>Suppr.</button>
                  </>}
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination page={page} pageCount={pageCount} total={total} pageSize={PAGE_SIZE} setPage={setPage} />
      </div>

      {showForm && (
        <Modal title={editId ? 'Modifier le compte' : 'Nouveau compte'} subtitle={editId ? `Modifier ${form.email}` : 'Créer un compte utilisateur'} onClose={() => setShowForm(false)} onConfirm={submit} confirmLabel="Enregistrer">
          <div className="form-group"><label>Email</label>
            <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          {!editId && <div className="form-group"><label>Mot de passe</label>
            <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
          </div>}
          <div className="form-group"><label>Rôle</label>
            <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
              <option value="user">user</option>
              <option value="admin">admin</option>
            </select>
          </div>
        </Modal>
      )}

      {delTarget && (
        <Modal title="Supprimer le compte" subtitle={`Supprimer "${delTarget.email}" ? Action irréversible.`} onClose={() => setDel(null)} onConfirm={confirmDel} confirmLabel="Supprimer" danger />
      )}
    </>
  )
}
