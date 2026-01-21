import React, {
  useEffect,
  useMemo,
  useState,
  useContext,
  createContext,
} from "react"
import { Routes, Route, useNavigate, useParams, Link } from "react-router-dom"
import { useSwipeable } from "react-swipeable"
import type { Project, Run, Task, Log } from "./lib/types"

const API_BASE_URL =
  (import.meta as any).env?.VITE_API_URL || "http://localhost:8000"

type AuthUser = {
  id?: number
  email: string
  full_name?: string | null
}

// ---------- Helpers ----------

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleString("en-IN")
  } catch {
    return value
  }
}

function decodeJwt(token: string): any | null {
  try {
    const [, payload] = token.split(".")
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/")
    const json = atob(base64)
    return JSON.parse(json)
  } catch {
    return null
  }
}

// generic authed fetch
async function authedRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = localStorage.getItem("access_token")
  if (!token) {
    throw new Error("Not authenticated")
  }

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
    Authorization: `Bearer ${token}`,
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  })

  if (!res.ok) {
    let message = `Request failed with status ${res.status}`
    try {
      const data = await res.json()
      if (data && (data.detail || data.message)) {
        message = data.detail || data.message
      }
    } catch {
      // ignore
    }
    throw new Error(message)
  }

  if (res.status === 204) {
    return undefined as T
  }

  return (await res.json()) as T
}

// ---------- Toast system ----------

type ToastKind = "success" | "error" | "info"

type Toast = {
  id: number
  kind: ToastKind
  message: string
}

const ToastContext = createContext<{
  pushToast: (kind: ToastKind, message: string) => void
} | null>(null)

function ToastProvider({ children }: { children: React.ReactNode }) {
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

function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error("useToast must be used inside ToastProvider")
  }
  return ctx
}

// ---------- Auth page (login + signup) ----------

type AuthPageProps = {
  onAuthSuccess: (token: string, user: AuthUser) => void
}

function AuthPage({ onAuthSuccess }: AuthPageProps) {
  const [mode, setMode] = useState<"login" | "signup">("login")
  const [email, setEmail] = useState("")
  const [fullName, setFullName] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { pushToast } = useToast()

  const handleLogin = async () => {
    setError(null)
    if (!email || !password) {
      const msg = "Email and password are required"
      setError(msg)
      pushToast("error", msg)
      return
    }
    try {
      setLoading(true)
      const body = new URLSearchParams({
        username: email,
        password,
      })
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.detail || "Failed to login")
      }
      const data = await res.json()
      const token = data.access_token as string
      const payload = decodeJwt(token)

      const user: AuthUser = {
        id: payload?.sub ? Number(payload.sub) : undefined,
        email: payload?.email ?? email,
        full_name: payload?.full_name ?? null,
      }

      pushToast("success", "Logged in successfully.")
      onAuthSuccess(token, user)
    } catch (err: any) {
      const msg = err.message || "Login failed"
      setError(msg)
      pushToast("error", msg)
    } finally {
      setLoading(false)
    }
  }

  const handleSignup = async () => {
    setError(null)
    if (!email || !password) {
      const msg = "Email and password are required"
      setError(msg)
      pushToast("error", msg)
      return
    }
    try {
      setLoading(true)
      const res = await fetch(`${API_BASE_URL}/auth/signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
          full_name: fullName || undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.detail || "Failed to sign up")
      }
      pushToast("success", "Account created. Logging you in…")
      await handleLogin()
    } catch (err: any) {
      const msg = err.message || "Signup failed"
      setError(msg)
      pushToast("error", msg)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (mode === "login") {
      void handleLogin()
    } else {
      void handleSignup()
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-header">
          <h2>{mode === "login" ? "Welcome back" : "Create your workspace"}</h2>
          <p>
            Sign {mode === "login" ? "in" : "up"} to orchestrate your AI-powered
            projects.
          </p>
        </div>

        {error && <div className="auth-error">{error}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="auth-label">
            <span>Email</span>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </label>

          {mode === "signup" && (
            <label className="auth-label">
              <span>Full name</span>
              <input
                className="input"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter your full name"
              />
            </label>
          )}

          <label className="auth-label">
            <span>Password</span>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </label>

          <button
            className="btn btn-primary auth-submit"
            type="submit"
            disabled={loading}
          >
            {loading
              ? mode === "login"
                ? "Signing in…"
                : "Creating account…"
              : mode === "login"
                ? "Sign in"
                : "Sign up"}
          </button>
        </form>

        <div className="auth-footer">
          {mode === "login" ? (
            <>
              <span>Don&apos;t have an account?</span>
              <button
                type="button"
                className="link-button"
                onClick={() => setMode("signup")}
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              <span>Already have an account?</span>
              <button
                type="button"
                className="link-button"
                onClick={() => setMode("login")}
              >
                Sign in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------- Project list item with swipe-to-delete ----------

type ProjectListItemProps = {
  project: Project
  latestRun?: Run
  onNavigate: () => void
  onPlan: (e: React.MouseEvent) => void
  onDelete: () => void
}

function ProjectListItem({
  project,
  latestRun,
  onNavigate,
  onPlan,
  onDelete,
}: ProjectListItemProps) {
  const [offset, setOffset] = useState(0)
  const [isSwiping, setIsSwiping] = useState(false)

  const handlers = useSwipeable({
    onSwiping: ({ deltaX }) => {
      if (deltaX < 0) {
        setIsSwiping(true)
        setOffset(Math.max(deltaX, -120))
      }
    },
    onSwipedLeft: ({ absX }) => {
      setIsSwiping(false)
      if (absX > 80) {
        setOffset(-140)
        setTimeout(() => {
          onDelete()
          setOffset(0)
        }, 120)
      } else {
        setOffset(0)
      }
    },
    onSwiped: () => {
      setIsSwiping(false)
      if (offset > -80) {
        setOffset(0)
      }
    },
    preventScrollOnSwipe: true,
    trackTouch: true,
    trackMouse: true,
  })

  const handleClick = () => {
    if (isSwiping || offset !== 0) return
    onNavigate()
  }

  return (
    <div className="project-swipe-container" {...handlers}>
      <div className="project-swipe-background">
        <span className="project-swipe-delete-label">Delete</span>
      </div>

      <div
        className="project-card project-swipe-card"
        style={{ transform: `translateX(${offset}px)` }}
        onClick={handleClick}
      >
        <div className="project-card-header">
          <div>
            <div className="project-title">{project.title}</div>
            {project.description && (
              <div className="project-description">
                {project.description}
              </div>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span className="badge-pill">Status: {project.status}</span>
            <button
              className="btn btn-ghost"
              onClick={(e) => {
                e.stopPropagation()
                onPlan(e)
              }}
            >
              Plan run
            </button>
          </div>
        </div>

        <div className="project-meta">
          <span>Created: {formatDate(project.created_at)}</span>
          {" • "}
          <span>Updated: {formatDate(project.updated_at)}</span>
          {latestRun && (
            <>
              {" • "}
              <span>
                Latest run #{latestRun.id} – {latestRun.status}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------- Projects dashboard ----------

function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [runs, setRuns] = useState<Run[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const navigate = useNavigate()
  const { pushToast } = useToast()

  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [deletingTitle, setDeletingTitle] = useState<string>("")
  const [deleting, setDeleting] = useState(false)

  const load = async () => {
    try {
      setLoading(true)
      setError(null)
      const [projectsRes, runsRes] = await Promise.all([
        authedRequest<Project[]>("/projects/"),
        authedRequest<Run[]>("/runs/"),
      ])
      setProjects(projectsRes)
      setRuns(runsRes)
    } catch (err: any) {
      const msg = err.message || "Failed to load data"
      setError(msg)
      pushToast("error", msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const latestRunByProject = useMemo(() => {
    const m = new Map<number, Run>()
    for (const r of runs) {
      const prev = m.get(r.project_id)
      if (!prev) {
        m.set(r.project_id, r)
      } else {
        if (
          new Date(r.created_at).getTime() >
          new Date(prev.created_at).getTime()
        ) {
          m.set(r.project_id, r)
        }
      }
    }
    return m
  }, [runs])

  const handleCreate = async () => {
    if (!title.trim()) return
    try {
      setCreating(true)
      setError(null)
      const project = await authedRequest<Project>("/projects/", {
        method: "POST",
        body: JSON.stringify({ title, description }),
      })
      setTitle("")
      setDescription("")
      pushToast("success", `Created project "${project.title}"`)
      await load()
      navigate(`/projects/${project.id}`)
    } catch (err: any) {
      const msg = err.message || "Failed to create project"
      setError(msg)
      pushToast("error", msg)
    } finally {
      setCreating(false)
    }
  }

  const handlePlan = async (
    projectId: number,
    projectTitle: string,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation()
    setError(null)

    try {
      // Create + plan run via /runs/projects/{project_id}
      const run = await authedRequest<Run>(`/runs/projects/${projectId}/runs`, {
        method: "POST",
        body: JSON.stringify({}), // RunCreate body (currently unused in backend)
      })

      // Optionally check how many tasks were created
      let taskCount = 0
      try {
        const tasks = await authedRequest<Task[]>(`/runs/${run.id}/tasks`)
        taskCount = tasks.length
      } catch {
        // don't block planning if tasks fetch fails
      }

      pushToast(
        "success",
        `Planned run #${run.id} for "${projectTitle}" with ${taskCount} step(s).`,
      )

      // Soft reload; if it fails, don't override the success
      try {
        await load()
      } catch (err: any) {
        const msg =
          err.message || "Project planned, but failed to refresh workspace."
        pushToast("error", msg)
      }
    } catch (err: any) {
      const msg = err.message || "Failed to plan project"
      setError(msg)
      pushToast("error", msg)
    }
  }

  const handleConfirmDelete = async () => {
    if (deletingId == null) return
    try {
      setDeleting(true)
      setError(null)
      await authedRequest<void>(`/projects/${deletingId}`, {
        method: "DELETE",
      })
      pushToast("success", `Deleted project "${deletingTitle}"`)
      setDeletingId(null)
      setDeletingTitle("")
      await load()
    } catch (err: any) {
      const msg = err.message || "Failed to delete project"
      setError(msg)
      pushToast("error", msg)
    } finally {
      setDeleting(false)
    }
  }

  const handleCancelDelete = () => {
    if (deleting) return
    setDeletingId(null)
    setDeletingTitle("")
  }

  return (
    <>
      <div className="app-main-grid">
        {/* Left: create project */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              New project
              <span className="badge-pill">
                Describe what you want to achieve
              </span>
            </div>
          </div>
          <p className="card-subtitle">
            Tell the orchestrator what outcome you care about. It will handle
            the agents, tasks and workflow behind the scenes.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <input
              className="input"
              placeholder="e.g. Instagram marketing for my bakery"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <textarea
              className="textarea"
              placeholder="Describe the goal in plain language. The planner will break it into steps."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button
                className="btn btn-primary"
                onClick={handleCreate}
                disabled={creating}
              >
                {creating ? "Creating…" : "Create project"}
              </button>
              <span
                style={{ fontSize: 11, color: "#6b7280", alignSelf: "center" }}
              >
                You can refine or re-plan anytime later.
              </span>
            </div>
          </div>
        </div>

        {/* Right: quick stats */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Workspace activity</div>
          </div>
          <p className="card-subtitle">
            A snapshot of what your orchestrator is managing for you.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 10,
              marginTop: 10,
            }}
          >
            <div
              className="card"
              style={{
                padding: 10,
                borderRadius: 12,
                border: "1px solid rgba(37,99,235,0.7)",
                background:
                  "radial-gradient(circle at top left,#1d4ed8,#020617)",
              }}
            >
              <div style={{ fontSize: 11, color: "#bfdbfe" }}>Projects</div>
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  marginTop: 4,
                  color: "#eff6ff",
                }}
              >
                {projects.length}
              </div>
            </div>

            <div
              className="card"
              style={{
                padding: 10,
                borderRadius: 12,
                border: "1px solid rgba(52,211,153,0.7)",
              }}
            >
              <div style={{ fontSize: 11, color: "#6ee7b7" }}>Runs</div>
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  marginTop: 4,
                  color: "#a7f3d0",
                }}
              >
                {runs.length}
              </div>
            </div>

            <div
              className="card"
              style={{
                padding: 10,
                borderRadius: 12,
                border: "1px solid rgba(251,191,36,0.7)",
              }}
            >
              <div style={{ fontSize: 11, color: "#facc15" }}>Active</div>
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  marginTop: 4,
                  color: "#fef3c7",
                }}
              >
                {runs.filter((r) => r.status === "running").length}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            marginTop: 12,
            borderRadius: 10,
            border: "1px solid rgba(248,113,113,0.6)",
            background: "rgba(185,28,28,0.12)",
            padding: "8px 10px",
            fontSize: 12,
            color: "#fecaca",
          }}
        >
          {error}
        </div>
      )}

      {/* Projects list */}
      <div style={{ marginTop: 20 }}>
        <div className="section-title-row">
          <div className="section-title">Projects</div>
          <span style={{ fontSize: 11, color: "#6b7280" }}>
            Click a project to drill into its runs and plan. Swipe left on a card
            to delete.
          </span>
        </div>

        {loading ? (
          <p style={{ fontSize: 13, color: "#9ca3af" }}>Loading projects…</p>
        ) : projects.length === 0 ? (
          <p style={{ fontSize: 13, color: "#9ca3af" }}>
            No projects yet. Start by creating one above.
          </p>
        ) : (
          <div className="projects-list">
            {projects.map((p) => {
              const latestRun = latestRunByProject.get(p.id)
              return (
                <ProjectListItem
                  key={p.id}
                  project={p}
                  latestRun={latestRun}
                  onNavigate={() => navigate(`/projects/${p.id}`)}
                  onDelete={() => {
                    setDeletingId(p.id)
                    setDeletingTitle(p.title)
                  }}
                  onPlan={(e) => handlePlan(p.id, p.title, e)}
                />
              )
            })}
          </div>
        )}
      </div>

      {/* Delete confirm modal */}
      {deletingId !== null && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-title">Delete project?</div>
            <p className="modal-body">
              Are you sure you want to delete{" "}
                <strong>{deletingTitle || "this project"}</strong>? This action
                cannot be undone.
            </p>
            <div className="modal-actions">
              <button
                className="btn btn-ghost"
                onClick={handleCancelDelete}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary modal-danger"
                onClick={handleConfirmDelete}
                disabled={deleting}
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ---------- Project detail page ----------

function ProjectDetailPage() {
  const { id } = useParams()
  const projectId = Number(id)
  const [project, setProject] = useState<Project | null>(null)
  const [runs, setRuns] = useState<Run[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [logs, setLogs] = useState<Log[]>([])
  const [activeRun, setActiveRun] = useState<Run | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const { pushToast } = useToast()

  // edit state
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState("")
  const [editDescription, setEditDescription] = useState("")

  const load = async () => {
    try {
      setLoading(true)
      setError(null)

      const [projectRes, runsRes] = await Promise.all([
        authedRequest<Project>(`/projects/${projectId}`),
        authedRequest<Run[]>("/runs/"),
      ])

      setProject(projectRes)
      setEditTitle(projectRes.title)
      setEditDescription(projectRes.description || "")

      const projectRuns = runsRes
        .filter((r) => r.project_id === projectId && !r.is_archived)
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime(),
        )

      setRuns(projectRuns)

      const latest = projectRuns[0] ?? null
      setActiveRun(latest)

      if (latest) {
        const [tasksRes, logsRes] = await Promise.all([
          authedRequest<Task[]>(`/runs/${latest.id}/tasks`),
          authedRequest<Log[]>(`/runs/${latest.id}/logs`),
        ])
        setTasks(tasksRes)
        setLogs(logsRes)
      } else {
        setTasks([])
        setLogs([])
      }
    } catch (err: any) {
      const msg = err.message || "Failed to load project details"
      setError(msg)
      pushToast("error", msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!Number.isNaN(projectId)) {
      void load()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  const handleSelectRun = async (run: Run) => {
  try {
    setError(null)
    setActiveRun(run)

  } catch (err: any) {
    const msg = err.message || "Failed to load run details"
    setError(msg)
    pushToast("error", msg)
  }
}
  const handleExecute = async () => {
    if (!activeRun) return
    try {
      setBusy(true)
      setError(null)
      await authedRequest<{ status: string }>(
        `/runs/${activeRun.id}/execute`,
        {
          method: "POST",
        },
      )
      pushToast("success", "Run executed. Reloading tasks and logs…")
      await handleSelectRun(activeRun)
    } catch (err: any) {
      const msg = err.message || "Failed to execute run"
      setError(msg)
      pushToast("error", msg)
    } finally {
      setBusy(false)
    }
  }

  const handleSummarize = async () => {
    if (!activeRun) return
    try {
      setBusy(true)
      setError(null)
      const res = await authedRequest<{
        status: string
        final_summary: string
      }>(`/runs/${activeRun.id}/summarize`, {
        method: "POST",
      })
      setActiveRun((prev) =>
        prev
          ? { ...prev, final_summary: res.final_summary, status: res.status }
          : prev,
      )
      const logsRes = await authedRequest<Log[]>(
        `/runs/${activeRun.id}/logs`,
      )
      setLogs(logsRes)
      pushToast("success", "Generated final summary for this run.")
    } catch (err: any) {
      const msg = err.message || "Failed to summarize run"
      setError(msg)
      pushToast("error", msg)
    } finally {
      setBusy(false)
    }
  }

  const handleSaveProject = async () => {
    if (!project) return
    try {
      setBusy(true)
      setError(null)
      const updated = await authedRequest<Project>(`/projects/${projectId}`, {
        method: "PUT",
        body: JSON.stringify({
          title: editTitle.trim() || project.title,
          description: editDescription,
        }),
      })
      setProject(updated)
      setEditing(false)
      pushToast("success", "Project updated.")
    } catch (err: any) {
      const msg = err.message || "Failed to update project"
      setError(msg)
      pushToast("error", msg)
    } finally {
      setBusy(false)
    }
  }

  const handleCancelEdit = () => {
    if (!project) return
    setEditTitle(project.title)
    setEditDescription(project.description || "")
    setEditing(false)
  }

  const hasAnyOutput = tasks.some(
    (t) => t.output && t.output.trim().length > 0,
  )

  return (
    <>
      <div
        style={{
          marginBottom: 14,
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <Link
          to="/"
          style={{ fontSize: 12, color: "#93c5fd", textDecoration: "none" }}
        >
          ← Back to projects
        </Link>
        <span style={{ fontSize: 11, color: "#6b7280" }}>
          Project #{projectId}
        </span>
      </div>

      {error && (
        <div
          style={{
            marginBottom: 12,
            borderRadius: 10,
            border: "1px solid rgba(248,113,113,0.6)",
            background: "rgba(185,28,28,0.12)",
            padding: "8px 10px",
            fontSize: 12,
            color: "#fecaca",
          }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <p style={{ fontSize: 13, color: "#9ca3af" }}>Loading…</p>
      ) : !project ? (
        <p style={{ fontSize: 13, color: "#9ca3af" }}>Project not found.</p>
      ) : (
        <div className="app-main-grid">
          {/* Left: project + runs */}
          <div>
            <div className="card" style={{ marginBottom: 14 }}>
              <div
                className="card-header"
                style={{ justifyContent: "space-between" }}
              >
                <div className="card-title">
                  {!editing ? (
                    <>
                      {project.title}
                      <span className="badge-pill">
                        Status: {project.status}
                      </span>
                    </>
                  ) : (
                    <>
                      <input
                        className="input"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        placeholder="Project title"
                        style={{ maxWidth: 320 }}
                      />
                      <span className="badge-pill">
                        Status: {project.status}
                      </span>
                    </>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {!editing ? (
                    <button
                      className="btn btn-ghost"
                      onClick={() => setEditing(true)}
                    >
                      Edit
                    </button>
                  ) : (
                    <>
                      <button
                        className="btn btn-ghost"
                        onClick={handleCancelEdit}
                        disabled={busy}
                      >
                        Cancel
                      </button>
                      <button
                        className="btn btn-primary"
                        onClick={handleSaveProject}
                        disabled={busy}
                      >
                        {busy ? "Saving…" : "Save"}
                      </button>
                    </>
                  )}
                </div>
              </div>
              {editing ? (
                <textarea
                  className="textarea"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Describe the goal in plain language."
                  style={{ marginTop: 8 }}
                />
              ) : (
                project.description && (
                  <p
                    style={{
                      fontSize: 13,
                      color: "#d1d5db",
                      marginBottom: 6,
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {project.description}
                  </p>
                )
              )}
              <p style={{ fontSize: 11, color: "#6b7280" }}>
                Created: {formatDate(project.created_at)} • Updated:{" "}
                {formatDate(project.updated_at)}
              </p>
            </div>

            <div className="card">
              <div className="section-title-row">
                <div className="section-title">Runs</div>
                <span style={{ fontSize: 11, color: "#6b7280" }}>
                  Select a run to inspect its tasks.
                </span>
              </div>
              {runs.length === 0 ? (
                <p style={{ fontSize: 13, color: "#9ca3af" }}>
                  No runs yet. Go back and click <strong>Plan run</strong> from
                  the projects page.
                </p>
              ) : (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 6 }}
                >
                  {runs.map((r) => (
                    <button
                      key={r.id}
                      className="btn btn-ghost"
                      style={{
                        justifyContent: "space-between",
                        borderRadius: 999,
                        paddingInline: 12,
                        borderColor:
                          activeRun && activeRun.id === r.id
                            ? "rgba(96,165,250,0.9)"
                            : "rgba(55,65,81,0.9)",
                        background:
                          activeRun && activeRun.id === r.id
                            ? "rgba(15,23,42,0.9)"
                            : "rgba(15,23,42,0.6)",
                      }}
                      onClick={() => handleSelectRun(r)}
                    >
                      <span>
                        Run #{r.id} • {r.status}
                      </span>
                      <span style={{ fontSize: 11, color: "#9ca3af" }}>
                        {formatDate(r.created_at)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div>
            <div className="card" style={{ marginBottom: 14 }}>
              <div className="section-title-row">
                <div className="section-title">Plan & tasks</div>
                {activeRun && (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      className="btn btn-ghost"
                      onClick={handleExecute}
                      disabled={busy || tasks.length === 0}
                    >
                      {busy ? "Running…" : "Execute run"}
                    </button>
                    <button
                      className="btn btn-primary"
                      onClick={handleSummarize}
                      disabled={busy || !hasAnyOutput}
                    >
                      {busy ? "Summarizing…" : "Summarize"}
                    </button>
                  </div>
                )}
              </div>

              {!activeRun ? (
                <p style={{ fontSize: 13, color: "#9ca3af" }}>
                  No run selected yet.
                </p>
              ) : tasks.length === 0 ? (
                <p style={{ fontSize: 13, color: "#9ca3af" }}>
                  No tasks found for this run. Try re-planning the project from
                  the Projects page.
                </p>
              ) : (
                <ol className="steps-list">
                  {tasks.map((t) => (
                    <li key={t.id}>
                      <div className="step-title">
                        Step {t.order_index ?? "-"} • {t.agent_type} •{" "}
                        <span style={{ textTransform: "capitalize" }}>
                          {t.status}
                        </span>
                      </div>
                      {t.input && <div className="step-body">{t.input}</div>}
                      {t.output && (
                        <div
                          className="step-body"
                          style={{
                            marginTop: 4,
                            borderRadius: 10,
                            border: "1px solid rgba(55,65,81,0.95)",
                            padding: "6px 8px",
                          }}
                        >
                          <strong>Result:</strong> {t.output}
                        </div>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </div>

            <div className="card">
              <div className="section-title-row">
                <div className="section-title">Logs & summary</div>
              </div>
              {!activeRun ? (
                <p style={{ fontSize: 13, color: "#9ca3af" }}>
                  No run selected.
                </p>
              ) : (
                <>
                  <div style={{ marginBottom: 10 }}>
                    <div
                      style={{
                        fontSize: 11,
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        color: "#6b7280",
                        marginBottom: 4,
                      }}
                    >
                      Final summary
                    </div>
                    {activeRun.final_summary ? (
                      <div className="summary-box">
                        {activeRun.final_summary}
                      </div>
                    ) : (
                      <p style={{ fontSize: 12, color: "#9ca3af" }}>
                        No summary yet. Run <strong>Summarize</strong> after
                        executing tasks.
                      </p>
                    )}
                  </div>

                  <div>
                    <div
                      style={{
                        fontSize: 11,
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        color: "#6b7280",
                        marginBottom: 4,
                      }}
                    >
                      Logs
                    </div>
                    {logs.length === 0 ? (
                      <p style={{ fontSize: 12, color: "#9ca3af" }}>
                        No logs yet. Execute the run to see agent activity here.
                      </p>
                    ) : (
                      <div className="logs-list">
                        {logs.map((log) => (
                          <div key={log.id} className="log-line">
                            <span
                              className={`log-level ${
                                log.level === "error"
                                  ? "log-level-error"
                                  : "log-level-info"
                              }`}
                            >
                              {log.level}
                            </span>{" "}
                            <span style={{ color: "#9ca3af" }}>
                              [{formatDate(log.created_at)}]
                            </span>{" "}
                            <span>{log.message}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ---------- App shell with header + auth gate ----------

function App() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const storedToken = localStorage.getItem("access_token")
    if (storedToken) {
      const payload = decodeJwt(storedToken)
      if (payload?.email) {
        setAuthUser({
          id: payload.sub ? Number(payload.sub) : undefined,
          email: payload.email,
          full_name: payload.full_name ?? null,
        })
      } else {
        localStorage.removeItem("access_token")
      }
    }
    setAuthReady(true)
  }, [])

  const handleAuthSuccess = (t: string, user: AuthUser) => {
    localStorage.setItem("access_token", t)
    setAuthUser(user)
  }

  const handleLogout = () => {
    localStorage.removeItem("access_token")
    setAuthUser(null)
    setMenuOpen(false)
  }

  if (!authReady) {
    return (
      <div className="app-shell">
        <div className="app-container">
          <p style={{ fontSize: 13, color: "#9ca3af" }}>Loading…</p>
        </div>
      </div>
    )
  }

  const displayName =
    authUser?.full_name && authUser.full_name.trim().length > 0
      ? authUser.full_name
      : authUser?.email

  return (
    <ToastProvider>
      <div className="app-shell">
        <div className="app-container">
          {!authUser ? (
            <AuthPage onAuthSuccess={handleAuthSuccess} />
          ) : (
            <>
              <header className="app-header">
                <div className="app-title-block">
                  <h1>
                    AI Orchestrator
                    <span className="app-title-badge">
                      Multi-agent control room
                    </span>
                  </h1>
                  <p>
                    Turn a vague goal into a concrete multi-step plan, run it
                    through agents, and collect a clean summary — all in one
                    place.
                  </p>
                </div>
                <div className="app-header-right">
                  <div className="app-tagline-pill">
                    <span className="app-tagline-dot" />
                    orchestrating LLM agents
                  </div>
                  <div className="user-menu">
                    <button
                      type="button"
                      className="user-menu-button"
                      onClick={() => setMenuOpen((v) => !v)}
                    >
                      <div className="user-avatar">
                        {displayName?.[0]?.toUpperCase() || "U"}
                      </div>
                      <span className="user-name">{displayName}</span>
                      <span className="user-caret">▾</span>
                    </button>
                    {menuOpen && (
                      <div className="user-menu-dropdown">
                        <button
                          type="button"
                          className="user-menu-item disabled"
                        >
                          My account (coming soon)
                        </button>
                        <button
                          type="button"
                          className="user-menu-item"
                          onClick={handleLogout}
                        >
                          Logout
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </header>

              <Routes>
                <Route path="/" element={<ProjectsPage />} />
                <Route path="/projects/:id" element={<ProjectDetailPage />} />
              </Routes>
            </>
          )}
        </div>
      </div>
    </ToastProvider>
  )
}

export default App


