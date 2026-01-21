// src/lib/api.ts

import type { Project, Run, Task, Log } from "./types"

// Read the backend URL from env OR fallback o localhost
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000"

// Generic helper to make HTTP requests
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API ${res.status}: ${text}`)
  }

  return res.json() as Promise<T>
}

// Actual API functions that map to your FastAPI endpoints
export const api = {
  // Projects
  listProjects: () => request<Project[]>("/projects/"),
  getProject: (id: number) => request<Project>(`/projects/${id}`),
  createProject: (data: { title: string; description?: string }) =>
    request<Project>("/projects/", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  planProject: (projectId: number) =>
    request<{ run_id: number; project_id: number; run_status: string; steps: any[] }>(
      `/projects/${projectId}/plan`,
      { method: "POST" },
    ),

  // Runs
  listRuns: () => request<Run[]>("/runs/"),
  getRun: (runId: number) => request<Run>(`/runs/${runId}`),
  executeRun: (runId: number) =>
    request<{ run_id: number; project_id: number; status: string; executed_tasks: number }>(
      `/runs/${runId}/execute`,
      { method: "POST" },
    ),
  summarizeRun: (runId: number) =>
    request<{ run_id: number; project_id: number; status: string; final_summary: string }>(
      `/runs/${runId}/summarize`,
      { method: "POST" },
    ),

  // Tasks & Logs
  getRunTasks: (runId: number) => request<Task[]>(`/runs/${runId}/tasks`),
  getRunLogs: (runId: number) => request<Log[]>(`/runs/${runId}/logs`),
}