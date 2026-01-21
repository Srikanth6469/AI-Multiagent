import React, { createContext, useContext, useState } from "react"

type ToastKind = "success" | "error" | "info"

type Toast = {
  id: number
  kind: ToastKind
  message: string
}

const ToastContext = createContext<{
  pushToast: (kind: ToastKind, message: string) => void
} | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const pushToast = (kind: ToastKind, message: string) => {
    const id = Date.now() + Math.random()
    setToasts((prev) => [...prev, { id, kind, message }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 3500)
  }

  return (
    <ToastContext.Provider value={{ pushToast }}>
      {children}
      <div className="toast-container">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`toast ${
              t.kind === "success"
                ? "toast-success"
                : t.kind === "error"
                ? "toast-error"
                : "toast-info"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error("useToast must be used inside ToastProvider")
  return ctx
}
