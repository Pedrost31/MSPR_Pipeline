import { useEffect, useState } from 'react'
import { api } from '../../../api'
import { useToast } from '../../../context/ToastContext'
import Modal from '../../../components/Modal'
import { IconEmpty } from '../../../components/Icons'
import { usePagination, PAGE_SIZE } from '../../../hooks/usePagination'
import Pagination from '../../../components/Pagination'

export default function ProfilsSection() {
  const toast = useToast()

  const [profils, setProfils]     = useState([])
  const [filtered, setFiltered]   = useState([])
  const [accounts, setAccounts]   = useState([])
  const [linkTarget, setLinkTarget] = useState(null)   // profil à lier
  const [unlinkTarget, setUnlink]   = useState(null)   // profil à délier
  const [selectedAccountId, setSelectedAccountId] = useState('')

  const loadProfils  = () => api('GET', '/utilisateurs').then(d => { setProfils(d); setFiltered(d) }).catch(e => toast(e.message, 'err'))
  const loadAccounts = () => api('GET', '/auth/users').then(setAccounts).catch(e => toast(e.message, 'err'))

  useEffect(() => { loadProfils(); loadAccounts() }, [])

  const filter = q => setFiltered(
    profils.filter(p =>
      String(p.user_id).includes(q) ||
      (p.account_email ?? '').toLowerCase().includes(q.toLowerCase()) ||
      (p.gender ?? '').toLowerCase().includes(q.toLowerCase())
    )
  )

  const openLink = (profil) => {
    setSelectedAccountId('')
    setLinkTarget(profil)
  }

  const confirmLink = async () => {
    if (!selectedAccountId) return toast('Sélectionne un compte', 'err')
    try {
      await api('PUT', `/utilisateurs/${linkTarget.user_id}/link`, { api_user_id: Number(selectedAccountId) })
      toast('Profil lié avec succès', 'ok')
      setLinkTarget(null)
      loadProfils()
    } catch (e) { toast(e.message, 'err') }
  }

  const confirmUnlink = async () => {
    try {
      await api('DELETE', `/utilisateurs/${unlinkTarget.user_id}/link`)
      toast('Profil délié', 'ok')
      setUnlink(null)
      loadProfils()
    } catch (e) { toast(e.message, 'err') }
  }

  // Comptes déjà utilisés (pour les griser dans le select)
  const usedAccountIds = new Set(profils.map(p => p.api_user_id).filter(Boolean))

  const { paginated, page, setPage, pageCount, total } = usePagination(filtered)

  const linked   = filtered.filter(p => p.api_user_id)
  const unlinked = filtered.filter(p => !p.api_user_id)

  return (
    <>
      <div className="page-title">Profils santé</div>
      <div className="page-sub">Attribue un compte à chaque profil importé pour lui donner accès à ses données.</div>

      <div className="toolbar">
        <input className="search" placeholder="Rechercher par ID, email, genre…" onChange={e => filter(e.target.value)} />
        <span className="badge badge-user">{unlinked.length} non lié{unlinked.length > 1 ? 's' : ''}</span>
        <span className="badge badge-admin">{linked.length} lié{linked.length > 1 ? 's' : ''}</span>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID profil</th>
              <th>Âge</th>
              <th>Genre</th>
              <th>Niveau</th>
              <th>Poids (kg)</th>
              <th>IMC</th>
              <th>Compte associé</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={8} className="empty"><div className="empty-icon"><IconEmpty size={40}/></div>Aucun profil</td></tr>
            ) : paginated.map(p => (
              <tr key={p.user_id}>
                <td><code>{p.user_id}</code></td>
                <td>{p.age ?? '—'}</td>
                <td>{p.gender ?? '—'}</td>
                <td>{p.experience_level ?? '—'}</td>
                <td>{p.weight_kg ?? '—'}</td>
                <td>{p.bmi_calculated ?? '—'}</td>
                <td>
                  {p.account_email
                    ? <span className="badge badge-admin">{p.account_email}</span>
                    : <span className="badge badge-user">Non lié</span>
                  }
                </td>
                <td>
                  <div className="actions">
                    {p.api_user_id ? (
                      <button className="btn-sm btn-role" onClick={() => setUnlink(p)}>Délier</button>
                    ) : (
                      <button className="btn-sm btn-edit" onClick={() => openLink(p)}>Attribuer</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination page={page} pageCount={pageCount} total={total} pageSize={PAGE_SIZE} setPage={setPage} />
      </div>

      {/* Modal — attribuer un compte */}
      {linkTarget && (
        <Modal
          title="Attribuer un compte"
          subtitle={`Profil ID ${linkTarget.user_id} · ${linkTarget.gender ?? ''} · ${linkTarget.age ?? ''}`}
          onClose={() => setLinkTarget(null)}
          onConfirm={confirmLink}
          confirmLabel="Attribuer"
        >
          <div className="form-group">
            <label>Compte à associer</label>
            <select value={selectedAccountId} onChange={e => setSelectedAccountId(e.target.value)}>
              <option value="">-- Sélectionner un compte --</option>
              {accounts.map(a => (
                <option key={a.id} value={a.id} disabled={usedAccountIds.has(a.id)}>
                  {a.email} ({a.role}){usedAccountIds.has(a.id) ? ' — déjà utilisé' : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Récapitulatif du profil</label>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
              <div><strong>Niveau :</strong> {linkTarget.experience_level ?? '—'}</div>
              <div><strong>Poids :</strong> {linkTarget.weight_kg ?? '—'} kg</div>
              <div><strong>Taille :</strong> {linkTarget.height_m ?? '—'} m</div>
              <div><strong>IMC :</strong> {linkTarget.bmi_calculated ?? '—'}</div>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal — délier */}
      {unlinkTarget && (
        <Modal
          title="Délier le compte"
          subtitle={`Retirer l'accès de "${unlinkTarget.account_email}" au profil ${unlinkTarget.id} ?`}
          onClose={() => setUnlink(null)}
          onConfirm={confirmUnlink}
          confirmLabel="Délier"
          danger
        />
      )}
    </>
  )
}
