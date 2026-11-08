// Logo ESATIC en vectoriel (public/img/logo-esatic.svg), net à toutes les tailles.
// Avec `withMark`, le symbole seul est aussi rendu : la CSS choisit lequel afficher (menu replié).
export default function Logo({ height = 40, withMark = false }) {
  const full = (
    <img
      src="/img/logo-esatic.svg"
      alt="ESATIC - École Supérieure Africaine des TIC"
      className="logo-img logo-full"
      style={{ height, width: 'auto' }}
    />
  )
  if (!withMark) return full
  return (
    <>
      {full}
      <img src="/img/logo-esatic-mark.svg" alt="ESATIC" className="logo-img logo-mark" style={{ height: 38, width: 'auto' }} />
    </>
  )
}
