import { useSearchParams, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { ChartColumn, FileBadge, Eye, Download, Loader2 } from 'lucide-react'
import * as api from '../../api/index.js'
import { Empty, ErrorBox, Loader, ResponsiveTable, Tabs, useAsync } from '../../components/ui.jsx'
import { fmtShort, fmtNote } from '../../lib/format.js'
import { downloadBulletin, fmtSize, openBulletin } from '../../lib/bulletinFiles.js'
import { useToast } from '../../context/ToastContext.jsx'

export default function StudentResultats() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('onglet') === 'bulletins' ? 'bulletins' : 'notes'
  const navigate = useNavigate()
  const { data, loading, error } = useAsync(() => api.studentResults(), [])

  const byMatiere = {}
  for (const r of data || []) (byMatiere[r.matiere] ||= []).push(r.note20)

  return (
    <div className="stack">
      <h1 style={{ fontSize: '1.15rem' }}>Mes résultats</h1>
      <Tabs
        value={tab}
        onChange={(v) => setParams(v === 'notes' ? {} : { onglet: v })}
        items={[{ value: 'notes', label: 'Notes' }, { value: 'bulletins', label: 'Bulletins' }]}
      />
      <ErrorBox error={error} />
      {tab === 'notes' && (loading && !data ? <Loader variant="list" /> : (
        <>
          {Object.keys(byMatiere).length > 0 && (
            <div className="grid-cards">
              {Object.entries(byMatiere).map(([m, notes]) => (
                <div className="card stat" key={m}>
                  <div className="k">{m}</div>
                  <div className="v">{fmtNote(Math.round((notes.reduce((s, n) => s + n, 0) / notes.length) * 10) / 10)}<span className="muted small">/20</span></div>
                  <div className="k">{notes.length} note{notes.length > 1 ? 's' : ''}</div>
                </div>
              ))}
            </div>
          )}
          <div className="card">
            <ResponsiveTable
              rowKey="attemptId"
              rows={data || []}
              onRowClick={(r) => navigate(`/etudiant/resultats/${r.attemptId}`)}
              empty={<Empty icon={ChartColumn} title="Aucune note publiée">Les notes apparaissent ici dès que l'enseignant les publie.</Empty>}
              columns={[
                { key: 'title', label: 'Épreuve', primary: true },
                { key: 'matiere', label: 'Matière' },
                { key: 'kind', label: 'Type', render: (r) => (r.kind === 'examen' ? 'Examen' : 'Devoir') },
                { key: 'gradedAt', label: 'Publiée le', render: (r) => fmtShort(r.gradedAt) },
                { key: 'score', label: 'Points', render: (r) => `${fmtNote(r.score)} / ${r.maxScore}` },
                { key: 'note20', label: 'Note', render: (r) => <strong>{fmtNote(r.note20)}/20</strong> },
              ]}
            />
          </div>
        </>
      ))}
      {tab === 'bulletins' && <BulletinsTab />}
    </div>
  )
}

// Bulletins déposés par l'établissement : l'étudiant les ouvre ou les télécharge
function BulletinsTab() {
  const toast = useToast()
  const [busy, setBusy] = useState(null)
  const { data, loading, error } = useAsync(() => api.studentBulletins(), [])
  if (error) return <ErrorBox error={error} />
  if (loading && !data) return <Loader variant="list" />
  const run = async (key, fn) => {
    setBusy(key)
    try { await fn() } catch (e) { toast.error(e.message) } finally { setBusy(null) }
  }
  return (
    <div className="card">
      <ResponsiveTable
        rows={data}
        empty={<Empty icon={FileBadge} title="Aucun bulletin pour le moment">Vos bulletins apparaîtront ici dès que l'établissement les aura déposés. Vous serez prévenu par une notification.</Empty>}
        columns={[
          { key: 'periode', label: 'Période', primary: true, render: (b) => <strong style={{ fontWeight: 600 }}>{b.periode}</strong> },
          { key: 'classe', label: 'Classe' },
          { key: 'uploadedAt', label: 'Déposé le', render: (b) => `${fmtShort(b.uploadedAt)}${b.version > 1 ? ' (nouvelle version)' : ''}` },
          { key: 'size', label: 'Fichier', hideMobile: true, render: (b) => <span className="small muted">{b.mime === 'application/pdf' ? 'PDF' : 'Image'}, {fmtSize(b.size)}</span> },
          { key: 'actions', label: '', className: 'actions', render: (b) => (
            <div className="row" style={{ gap: 6, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary btn-sm" disabled={!!busy} onClick={() => run(`o${b.id}`, () => openBulletin(b.id))}>
                {busy === `o${b.id}` ? <Loader2 size={14} className="spin" /> : <Eye size={14} />} Ouvrir
              </button>
              <button className="btn btn-primary btn-sm" disabled={!!busy} onClick={() => run(`d${b.id}`, () => downloadBulletin(b.id))}>
                {busy === `d${b.id}` ? <Loader2 size={14} className="spin" /> : <Download size={14} />} Télécharger
              </button>
            </div>
          ) },
        ]}
      />
    </div>
  )
}
