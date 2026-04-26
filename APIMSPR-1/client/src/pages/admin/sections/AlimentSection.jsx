import { useEffect, useState } from 'react'
import { api } from '../../../api'
import { useToast } from '../../../context/ToastContext'
import Modal from '../../../components/Modal'
import { IconEmpty } from '../../../components/Icons'
import { usePagination, PAGE_SIZE } from '../../../hooks/usePagination'
import Pagination from '../../../components/Pagination'

const empty = {
  food_item: '', category: '', calories_kcal: '', protein_g: '',
  carbohydrates_g: '', fat_g: '', fiber_g: '',
}

export default function AlimentSection() {
  const toast = useToast()
  const [data, setData]         = useState([])
  const [filtered, setFiltered] = useState([])
  const { paginated, page, setPage, pageCount, total } = usePagination(filtered)
  const [editName, setEditName] = useState(null)
  const [form, setForm]         = useState(empty)
  const [showForm, setShow]     = useState(false)
  const [delTarget, setDel]     = useState(null)

  const load = () =>
    api('GET', '/aliment')
      .then(d => { setData(d); setFiltered(d) })
      .catch(e => toast(e.message, 'err'))

  useEffect(() => { load() }, [])

  const filter = q => setFiltered(
    data.filter(r => Object.values(r).some(v => String(v).toLowerCase().includes(q.toLowerCase())))
  )
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const openCreate = () => {
    setEditName(null)
    setForm(empty)
    setShow(true)
  }
  const openEdit = r => {
    setEditName(r.food_item)
    setForm({
      food_item: r.food_item, category: r.category || '',
      calories_kcal: r.calories_kcal || '', protein_g: r.protein_g || '',
      carbohydrates_g: r.carbohydrates_g || '', fat_g: r.fat_g || '',
      fiber_g: r.fiber_g || '',
    })
    setShow(true)
  }

  const submit = async () => {
    if (!form.food_item) return toast('Nom requis', 'err')
    try {
      if (editName) await api('PUT', `/aliment/${encodeURIComponent(editName)}`, form)
      else          await api('POST', '/aliment', form)
      toast('Enregistré', 'ok')
      setShow(false)
      load()
    } catch (e) { toast(e.message, 'err') }
  }

  const confirmDel = async () => {
    try {
      await api('DELETE', `/aliment/${encodeURIComponent(delTarget)}`)
      toast('Supprimé', 'ok')
      setDel(null)
      load()
    } catch (e) { toast(e.message, 'err') }
  }

  return (
    <>
      <div className="page-title">Aliments</div>
      <div className="toolbar">
        <input className="search" placeholder="Rechercher…" onChange={e => filter(e.target.value)} />
        <button className="btn-primary" onClick={openCreate}>+ Ajouter</button>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Aliment</th><th>Catégorie</th><th>Kcal</th>
              <th>Protéines (g)</th><th>Glucides (g)</th><th>Lipides (g)</th><th>Fibres (g)</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="empty">
                  <div className="empty-icon"><IconEmpty size={40}/></div>
                  Aucun aliment
                </td>
              </tr>
            ) : (
              paginated.map(r => (
                <tr key={r.food_item}>
                  <td>{r.food_item}</td>
                  <td>{r.category || '—'}</td>
                  <td>{r.calories_kcal ?? '—'}</td>
                  <td>{r.protein_g ?? '—'}</td>
                  <td>{r.carbohydrates_g ?? '—'}</td>
                  <td>{r.fat_g ?? '—'}</td>
                  <td>{r.fiber_g ?? '—'}</td>
                  <td>
                    <div className="actions">
                      <button className="btn-sm btn-edit" onClick={() => openEdit(r)}>Modifier</button>
                      <button className="btn-sm btn-del"  onClick={() => setDel(r.food_item)}>Suppr.</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <Pagination page={page} pageCount={pageCount} total={total} pageSize={PAGE_SIZE} setPage={setPage} />
      </div>

      {showForm && (
        <Modal
          title={editName ? "Modifier l'aliment" : 'Nouvel aliment'}
          subtitle="Valeurs nutritionnelles"
          onClose={() => setShow(false)}
          onConfirm={submit}
          confirmLabel="Enregistrer"
        >
          <div className="form-group">
            <label>Nom</label>
            <input value={form.food_item} onChange={set('food_item')} placeholder="ex: Poulet grillé" />
          </div>
          <div className="form-group">
            <label>Catégorie</label>
            <input value={form.category} onChange={set('category')} placeholder="ex: Viande" />
          </div>
          <div className="form-grid">
            <div className="form-group"><label>Calories (kcal)</label><input type="number" value={form.calories_kcal}    onChange={set('calories_kcal')} /></div>
            <div className="form-group"><label>Protéines (g)</label>  <input type="number" value={form.protein_g}        onChange={set('protein_g')} /></div>
            <div className="form-group"><label>Glucides (g)</label>   <input type="number" value={form.carbohydrates_g}  onChange={set('carbohydrates_g')} /></div>
            <div className="form-group"><label>Lipides (g)</label>    <input type="number" value={form.fat_g}            onChange={set('fat_g')} /></div>
            <div className="form-group"><label>Fibres (g)</label>     <input type="number" value={form.fiber_g}          onChange={set('fiber_g')} /></div>
          </div>
        </Modal>
      )}

      {delTarget && (
        <Modal
          title="Supprimer l'aliment"
          subtitle={`Supprimer "${delTarget}" ? Action irréversible.`}
          onClose={() => setDel(null)}
          onConfirm={confirmDel}
          confirmLabel="Supprimer"
          danger
        />
      )}
    </>
  )
}
