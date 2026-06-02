"use client"

import * as React from "react"

type ToastVariant = "default" | "destructive"

interface Toast {
  id: string
  title: string
  description?: string
  variant?: ToastVariant
}

interface ToastState {
  toasts: Toast[]
}

type ToastAction =
  | { type: "ADD_TOAST"; toast: Toast }
  | { type: "DISMISS_TOAST"; toastId: string }

function toastReducer(state: ToastState, action: ToastAction): ToastState {
  switch (action.type) {
    case "ADD_TOAST":
      return { ...state, toasts: [...state.toasts, action.toast] }
    case "DISMISS_TOAST":
      return { ...state, toasts: state.toasts.filter(t => t.id !== action.toastId) }
    default:
      return state
  }
}

let count = 0
function genId() { return `toast-${++count}` }

export function useToast() {
  const [state, dispatch] = React.useReducer(toastReducer, { toasts: [] })

  const toast = React.useCallback((opts: { title: string; description?: string; variant?: ToastVariant }) => {
    const id = genId()
    dispatch({ type: "ADD_TOAST", toast: { ...opts, id } })
    setTimeout(() => dispatch({ type: "DISMISS_TOAST", toastId: id }), 4000)
  }, [])

  return { toast, toasts: state.toasts }
}
