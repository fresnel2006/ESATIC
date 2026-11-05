// Bulletin de notes (aperçu administrateur et page étudiant). Même contenu que le PDF.
import Logo from './Logo.jsx'
import { fmtDate, fmtNote } from '../lib/format.js'

export default function BulletinView({ data, code, version }) {
  const d = data
  return (
    <article className="bulletin">
      <header className="bulletin-head">
        <Logo height={44} />
        <div className="bulletin-school">
          <strong>{d.school.name}</strong>
          <span>{d.school.city} - Année académique {d.school.year}</span>
        </div>
      </header>

      <h2 className="bulletin-title">{d.template.title}</h2>
      <p className="bulletin-period">{d.periode.name} - du {fmtDate(d.periode.start)} au {fmtDate(d.periode.end)}</p>

      <dl className="bulletin-id">
        <div><dt>Étudiant</dt><dd>{d.student.name}</dd></div>
        <div><dt>Matricule</dt><dd className="mono">{d.student.matricule}</dd></div>
        <div><dt>Classe</dt><dd>{d.classe}</dd></div>
        <div><dt>Effectif</dt><dd>{d.effectif}</dd></div>
      </dl>

      <div className="table-wrap">
        <table className="table bulletin-table">
          <thead>
            <tr><th>Matière</th><th className="num">Coef.</th><th>Notes /20</th><th className="num">Moyenne</th><th>Appréciation</th></tr>
          </thead>
          <tbody>
            {d.lines.map((l) => (
              <tr key={l.matiereId}>
                <td><strong style={{ fontWeight: 600 }}>{l.matiere}</strong></td>
                <td className="num">{l.coefficient}</td>
                <td>
                  {l.notes.length === 0 ? <span className="muted">-</span> : (
                    <span className="bulletin-notes">
                      {l.notes.map((n, i) => <span key={i} title={`${n.label} (${n.source})`}>{fmtNote(n.note20)}</span>)}
                    </span>
                  )}
                </td>
                <td className="num"><strong>{fmtNote(l.avg)}</strong></td>
                <td className="small">{l.appreciation}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bulletin-summary">
        <div><span>Moyenne générale</span><strong>{fmtNote(d.general)}<small>/20</small></strong></div>
        <div><span>Mention</span><strong>{d.mention}</strong></div>
        {d.rank && <div><span>Rang</span><strong>{d.rank}<small>e / {d.effectif}</small></strong></div>}
        {d.classStats && <div><span>Moyenne de la classe</span><strong>{fmtNote(d.classStats.average)}<small>/20</small></strong></div>}
      </div>

      <div className="bulletin-appreciation">
        <span>Appréciation générale</span>
        <p>{d.appreciationGenerale}</p>
      </div>

      <footer className="bulletin-foot">
        <div>
          <div className="small muted">Code de vérification</div>
          <div className="mono bulletin-code">{code}</div>
          <div className="small muted">À contrôler sur la page « Vérifier un bulletin » de la plateforme{version > 1 ? ` - version ${version}` : ''}</div>
        </div>
        <div className="bulletin-sign">
          <div className="small muted">{d.template.signatory}</div>
        </div>
      </footer>
      {d.template.footer && <p className="small muted bulletin-note">{d.template.footer}</p>}
    </article>
  )
}
