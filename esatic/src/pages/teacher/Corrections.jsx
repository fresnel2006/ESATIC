import { useState } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { ClipboardCheck, Zap, CheckCheck, ListOrdered, Loader2, Send } from 'lucide-react'
import * as api from '../../api/index.js'
import { useToast } from '../../context/ToastContext.jsx'
import { Empty, ErrorBox, Loader, Notice, PageHead, Pills, ResponsiveTable, RiskBadge, StatusBadge, useAsync, ICON } from '../../components/ui.jsx'
import { fmtDateTime, fmtNote } from '../../lib/format.js'

export default function Corrections() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()
  const epreuve = params.get('epreuve') || ''
  const tab = params.get('statut') || 'rendu'
  const { data, loading, error, reload } = useAsync(() => Promise.all([api.listCopies(), api.listAssessments()]), [])
  const [progress, setProgress] = useState(null)
  const [report, setReport] = useState(null)
  const [copies, assessments] = data || [[], []]
  const rows = copies.filter((c) => (!epreuve || c.assessmentId === Number(epreuve)) && (tab === 'tous' || c.status === tab))
  const current = assessments.find((a) => a.id === Number(epreuve))
  const setParam = (k, v) => { const p = new URLSearchParams(params); if (v) p.set(k, v); else p.delete(k); setParams(p) }
  const toGrade = current ? copies.filter((c) => c.assessmentId === current.id && c.status === 'rendu').length : 0

  async function autoGradeAll() {
    setReport(null)
    setProgress({ n: 0, total: 0 })
    try {
      const r = await api.autoGradeAll(current.id, (n, total) => setProgress({ n, total }))
      const v = await api.validateGradedCopies(current.id)
      setReport({ ...r, ...v })
      reload()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setProgress(null)
    }
  }

  return (
    <div>
      <PageHead
        title="Corrections"
        subtitle="Copies rendues par vos étudiants"
        actions={current && current.submitted > 0 && (
          <button className="btn btn-primary" onClick={async () => {
            try { await api.publishResults(current.id, !current.resultsPublished); toast.success(current.resultsPublished ? 'Notes retirées.' : 'Notes publiées. Les étudiants sont prévenus.'); reload() } catch (e) { toast.error(e.message) }
          }}><Send {...ICON} /> {current.resultsPublished ? 'Retirer la publication' : 'Publier les notes'}</button>
        )}
      />
      <div className="filters">
        <select className="select" value={epreuve} onChange={(e) => setParam('epreuve', e.target.value)} aria-label="Épreuve">
          <option value="">Toutes les épreuves</option>
          {assessments.filter((a) => a.submitted > 0).map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
        </select>
        <Pills value={tab} onChange={(v) => setParam('statut', v === 'rendu' ? '' : v)} items={[
          { value: 'rendu', label: 'À corriger', count: copies.filter((c) => c.status === 'rendu' && (!epreuve || c.assessmentId === Number(epreuve))).length },
          { value: 'corrige', label: 'Corrigées' },
          { value: 'tous', label: 'Toutes' },
        ]} />
      </div>

      {current && current.submitted > 0 && (
        <div className="card grading-tools">
          <div className="card-body row-wrap">
            <div style={{ flex: 1, minWidth: 240 }}>
              <strong>Outils de correction</strong>
              <div className="small muted">{toGrade} copie(s) à corriger - {current.resultsPublished ? 'notes publiées' : 'notes non publiées'}</div>
            </div>
            <button className="btn btn-primary" disabled={!!progress} onClick={autoGradeAll} title="Les QCM sont notés automatiquement ; le code, le SQL, les questions ouvertes et les diagrammes se corrigent à la main">
              {progress ? <Loader2 {...ICON} className="spin" /> : <Zap {...ICON} />}
              {progress ? `Correction ${progress.n}/${progress.total || '...'}` : 'Corriger les QCM'}
            </button>
            <Link className="btn btn-secondary" to={`/enseignant/corrections/epreuve/${current.id}`}><ListOrdered {...ICON} /> Corriger par question</Link>
            <button className="btn btn-secondary" disabled={!!progress} onClick={async () => {
              const v = await api.validateGradedCopies(current.id)
              toast.success(`${v.validated} copie(s) validée(s)${v.remaining ? `, ${v.remaining} à terminer à la main` : ''}.`)
              reload()
            }}><CheckCheck {...ICON} /> Valider les copies complètes</button>
          </div>
          {report && (
            <div className="card-body" style={{ paddingTop: 0 }}>
              <Notice kind="success">
                {report.count} copie(s) corrigée(s) automatiquement (QCM, tests de code cachés compris, SQL).{' '}
                {report.validated} copie(s) complète(s) validée(s).
                {report.remaining > 0 && ` ${report.remaining} copie(s) contiennent des questions à corriger à la main (question ouverte, HTML) : utilisez « Corriger par question ».`}
                {report.skipped.length > 0 && ` Non exécuté : ${report.skipped.join(', ')}, en attente du serveur de correction.`}
              </Notice>
            </div>
          )}
        </div>
      )}

      <ErrorBox error={error} />
      {loading && !data ? <Loader /> : (
        <div className="card">
          <ResponsiveTable
            rows={rows}
            onRowClick={(c) => navigate(`/enseignant/corrections/${c.id}`)}
            empty={<Empty icon={ClipboardCheck} title={tab === 'rendu' ? 'Aucune copie à corriger' : 'Aucune copie'} />}
            columns={[
              { key: 'student', label: 'Étudiant', primary: true, render: (c) => <span><strong style={{ fontWeight: 500 }}>{c.student}</strong> <span className="muted small">{c.matricule}</span></span> },
              { key: 'assessment', label: 'Épreuve' },
              { key: 'submittedAt', label: 'Rendue le', render: (c) => fmtDateTime(c.submittedAt) },
              { key: 'risk', label: 'Risque', render: (c) => <RiskBadge value={c.risk} /> },
              { key: 'status', label: 'Statut', render: (c) => <StatusBadge status={c.status} /> },
              { key: 'score', label: 'Note', render: (c) => (c.score === null ? '-' : `${fmtNote(c.score)} / ${c.maxScore}`) },
            ]}
          />
        </div>
      )}
    </div>
  )
}
