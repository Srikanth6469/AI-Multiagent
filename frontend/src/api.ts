// src/lib/api.ts
import type { Project, Run, Task, Log } from "./types"

const API_BASE_URL =
  (import.meta as any).env?.VITE_API_URL || "http://localhost:8000"

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem("access_token")
  if (!token) return {}
  return {
    Authorization: `Bearer ${token}`,
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
    ...getAuthHeaders(),
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  })

  if (!res.ok) {
    // Try to get error message from backend
    let message = `Request failed with status ${res.status}`
    try {
      const data = await res.json()
      if (data && (data.detail || data.message)) {
        message = data.detail || data.message
      }
    } catch {
      // ignore json parse error
    }
    throw new Error(message)
  }

  if (res.status === 204) {
    // No content
    return undefined as T
  }

  return (await res.json()) as T
}

// ---------- Projects ----------

export async function listProjects(): Promise<Project[]> {
  return request<Project[]>("/projects/")
}

export async function getProject(id: number): Promise<Project> {
  return request<Project>(`/projects/${id}`)
}

export async function createProject(input: {
  title: string
  description?: string
}): Promise<Project> {
  return request<Project>("/projects/", {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export async function deleteProject(id: number): Promise<void> {
  await request<void>(`/projects/${id}`, {
    method: "DELETE",
  })
}

export async function planProject(
  projectId: number,
): Promise<{ run_id: number; project_id: number; run_status: string; steps: any[] }> {
  return request(`/projects/${projectId}/plan`, {
    method: "POST",
  })
}

// ---------- Runs / Tasks / Logs ----------

export async function listRuns(): Promise<Run[]> {
  return request<Run[]>("/runs/")
}

export async function getRunTasks(runId: number): Promise<Task[]> {
  return request<Task[]>(`/runs/${runId}/tasks`)
}

export async function getRunLogs(runId: number): Promise<Log[]> {
  return request<Log[]>(`/runs/${runId}/logs`)
}

export async function executeRun(runId: number): Promise<{ status: string }> {
  return request<{ status: string }>(`/runs/${runId}/execute`, {
    method: "POST",
  })
}

export async function summarizeRun(runId: number): Promise<{
  status: string
  final_summary: string
}> {
  return request<{ status: string; final_summary: string }>(
    `/runs/${runId}/summarize`,
    {
      method: "POST",
    },
  )
}

// ---------- Export as api object (what your components already use) ----------
export const api = {
  listProjects,
  getProject,
  createProject,
  deleteProject,
  planProject,
  listRuns,
  getRunTasks,
  getRunLogs,
  executeRun,
  summarizeRun,
}
