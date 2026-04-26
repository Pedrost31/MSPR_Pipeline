import { useEffect, useState } from 'react'
import { api } from '../../../api'
import { useToast } from '../../../context/ToastContext'
import Modal from '../../../components/Modal'
import { IconEmpty } from '../../../components/Icons'

const PAGE_SIZE = 20

export default function ProfilsSection() {
  const toast = useToast()

  const [profils, setProfils] = useState([])
  const [filtered, setFiltered] = useState([])
  const [page, setPage] = useState(1)

  const [accounts, setAccounts] = useState([])
  const [linkTarget, setLinkTarget] = useState(null)
  const [unlinkTarget, setUnlink] = useState(null)
  const [selectedAccountId, setSelectedAccountId] = useState('')

  const loadProfils = () =>
    api('GET', '/utilisateurs')
      .then(d => {
        setProfils(d)
        setFiltered(d)
        setPage(1)
      })
      .catch(e => toast(e.message, 'err'))

  const loadAccounts = () =>
    api('GET', '/auth/users')
      .then(setAccounts)
      .catch(e => toast(e.message, 'err'))

  useEffect(() => {
    loadProfils()
    loadAccounts()
  }, [])

  const filter = q => {
    const res = profils.filter(p =>
      String(p.user_id).includes(q) ||
      (p.account_email ?? '').toLowerCase().includes(q.toLowerCase()) ||
      (p.gender ?? '').toLowerCase().includes(q.toLowerCase())
    )
    setFiltered(res)
    setPage(1)
  }

  const openLink = profil => {
    setSelectedAccountId('')
    setLinkTarget(profil)
  }

  const confirmLink = async () => {
    if (!selectedAccountId) return toast('Sélectionne un compte', 'err')

    try {
      await api('PUT', `/utilisateurs/${linkTarget.user_id}/link`, {
        api_user_id: Number(selectedAccountId)
      })
      toast('Profil lié avec succès', 'ok')
      setLinkTarget(null)
      loadProfils()
    } catch (e) {
      toast(e.message, 'err')
    }
  }

  const confirmUnlink = async () => {
    try {
      await api('DELETE', `/utilisateurs/${unlinkTarget.user_id}/link`)
      toast('Profil délié', 'ok')
      setUnlink(null)
      loadProfils()
    } catch (e) {
      toast(e.message, 'err')
    }
  }

  const usedAccountIds = new Set(
    profils.map(p => p.api_user_id).filter(Boolean)
  )

  const linked = filtered.filter(p => p.api_user_id)
  const unlinked = filtered.filter(p => !p.api_user_id)

  // 🔥 PAGINATION
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))

  const paginatedData = filtered.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  )

  return (
    <>
      <div className="page-title">Profils santé</div>
      <div className="page-sub">
        Attribue un compte à chaque profil importé pour lui donner accès à ses données.
      </div>

      <div className="toolbar">
        <input
          className="search"
          placeholder="Rechercher par ID, email, genre…"
          onChange={e => filter(e.target.value)}
        />

        <span className="badge badge-user">
          {unlinked.length} non lié{unlinked.length > 1 ? 's' : ''}
        </span>

        <span className="badge badge-admin">
          {linked.length} lié{linked.length > 1 ? 's' : ''}
        </span>
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
            {paginatedData.length === 0 ? (
              <tr>
                <td colSpan={8} className="empty">
                  <div className="empty-icon">
                    <IconEmpty size={40} />
                  </div>
                  Aucun profil
                </td>
              </tr>
            ) : (
              paginatedData.map(p => (
                <tr key={p.user_id}>
                  <td><code>{p.user_id}</code></td>
                  <td>{p.age ?? '—'}</td>
                  <td>{p.gender ?? '—'}</td>
                  <td>{p.experience_level ?? '—'}</td>
                  <td>{p.weight_kg ?? '—'}</td>
                  <td>{p.bmi_calculated ?? '—'}</td>

                  <td>
                    {p.account_email ? (
                      <span className="badge badge-admin">
                        {p.account_email}
                      </span>
                    ) : (
                      <span className="badge badge-user">Non lié</span>
                    )}
                  </td>

                  <td>
                    <div className="actions">
                      {p.api_user_id ? (
                        <button
                          className="btn-sm btn-role"
                          onClick={() => setUnlink(p)}
                        >
                          Délier
                        </button>
                      ) : (
                        <button
                          className="btn-sm btn-edit"
                          onClick={() => openLink(p)}
                        >
                          Attribuer
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* PAGINATION */}
      {filtered.length > PAGE_SIZE && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 20 }}>

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
            onClick={() => setPage(p => Math.min(p + 1, totalPages))}
            disabled={page === totalPages}
          >
            ➡
          </button>

        </div>
      )}

      {/* MODAL LINK */}
      {linkTarget && (
        <Modal
          title="Attribuer un compte"
          subtitle={`Profil ID ${linkTarget.user_id}`}
          onClose={() => setLinkTarget(null)}
          onConfirm={confirmLink}
          confirmLabel="Attribuer"
        >
          <div className="form-group">
            <label>Compte</label>
            <select
              value={selectedAccountId}
              onChange={e => setSelectedAccountId(e.target.value)}
            >
              <option value="">-- Sélectionner --</option>

              {accounts.map(a => (
                <option
                  key={a.id}
                  value={a.id}
                  disabled={usedAccountIds.has(a.id)}
                >
                  {a.email} ({a.role})
                </option>
              ))}
            </select>
          </div>
        </Modal>
      )}

      {/* MODAL UNLINK */}
      {unlinkTarget && (
        <Modal
          title="Délier le compte"
          subtitle={`Retirer ${unlinkTarget.account_email}`}
          onClose={() => setUnlink(null)}
          onConfirm={confirmUnlink}
          confirmLabel="Délier"
          danger
        />
      )}
    </>
  )
}