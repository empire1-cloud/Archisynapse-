"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { type User } from "firebase/auth"
import { auth, signInAnonymously, onAuthStateChanged } from "@/lib/firebase"

interface FirebaseContextType {
  user: User | null
  loading: boolean
}

const FirebaseContext = createContext<FirebaseContextType>({ user: null, loading: true })

export function useFirebase() {
  return useContext(FirebaseContext)
}

export function FirebaseClientProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) {
        setUser(u)
      } else {
        signInAnonymously(auth).catch(() => {})
      }
      setLoading(false)
    })
    return () => unsub()
  }, [])

  return (
    <FirebaseContext.Provider value={{ user, loading }}>
      {children}
    </FirebaseContext.Provider>
  )
}
