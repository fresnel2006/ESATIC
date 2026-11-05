import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import * as api from '../api/index.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sessionMessage, setSessionMessage] = useState('')

  const refresh = useCallback(async () => {
    try {
      setUser(await api.me())
    } catch (e) {
      if (e.code === 'session_replaced') setSessionMessage(e.message)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lecture initiale de la session
    refresh()
  }, [refresh])

  // Vérifie régulièrement que la session n'a pas été ouverte ailleurs : toutes les minutes, et au retour sur
  // l'onglet, seulement quand il est à l'écran (chaque vérification coûte des lectures Firebase).
  // Pendant une épreuve, chaque enregistrement de la copie fait déjà cette vérification.
  useEffect(() => {
    if (!user) return
    const check = async () => {
      if (document.hidden) return
      try {
        await api.me()
      } catch (e) {
        if (e.status === 401) {
          setSessionMessage(e.code === 'session_replaced' ? e.message : 'Votre session a expiré.')
          setUser(null)
        }
      }
    }
    const id = setInterval(check, 60000)
    document.addEventListener('visibilitychange', check)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', check) }
  }, [user])

  const value = useMemo(() => ({
    user,
    loading,
    sessionMessage,
    clearSessionMessage: () => setSessionMessage(''),
    async login(identifier, password) {
      const u = await api.login(identifier, password)
      setSessionMessage('')
      setUser(u)
      return u
    },
    async logout() {
      await api.logout()
      setUser(null)
    },
    setUser,
    refresh,
  }), [user, loading, sessionMessage, refresh])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext)
}
