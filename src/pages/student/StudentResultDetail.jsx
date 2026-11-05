import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import * as api from '../../api/index.js'
import { ErrorBox, Loader, useAsync, ICON } from '../../components/ui.jsx'
import { AnswerView } from '../../components/AnswerView.jsx'
import Statement from '../../components/Statement.jsx'
import { QUESTION_TYPES, fmtNote } from '../../lib/format.js'

export default function StudentResultDetail() {
  const { attemptId } = useParams()
  const { data, loading, error } = useAsync(() => api.studentResultDetail(attemptId), [attemptId])
  return (
    <div className="stack">
      <Link to="/etudiant/resultats" className="row small"><ArrowLeft {...ICON} /> Retour aux résultats</Link>
      <ErrorBox error={error} />
      {loading && !data ? <Loader /> : data && (
        <>
          <div className="card"><div className="card-body row" style={{ flexWrap: 'wrap' }}>
            <div className="grow" style={{ flex: 1 }}>
              <h1 style={{ fontSize: '1.2rem' }}>{data.title}</h1>
              <p className="muted small">{data.matiere}</p>
            </div>
            <div className="note-big" style={{ fontSize: '1.6rem' }}>{fmtNote(data.note20)}<small>/20</small></div>
            <div className="muted small">{fmtNote(data.score)} / {data.maxScore} points</div>
          </div></div>
          {data.questions.map((q, i) => (
            <div className="q-card" key={q.id}>
              <div className="q-card-head">
                <span className="q-num">Question {i + 1}</span>
                <span className="tag">{QUESTION_TYPES[q.type]}</span>
                <div className="spacer" />
                <strong>{fmtNote(q.score)} / {q.points}</strong>
              </div>
              <div className="q-card-body">
                <Statement text={q.statement} />
                <AnswerView question={q} value={q.value} />
                {q.feedback && <div className="notice"><div><strong>Commentaire de l'enseignant</strong><br />{q.feedback}</div></div>}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
