// src/lib/types.ts

export interface Project {
  id: number
  title: string
  description?: string | null
  status: string
  created_at: string
  updated_at: string
}

export interface Run {
  is_archived: any
  id: number
  project_id: number
  status: string
  final_summary?: string | null
  created_at: string
  updated_at: string
}

export interface Task {
  id: number
  run_id: number
  agent_type: string
  status: string
  input?: string | null
  output?: string | null
  order_index?: number | null
  created_at: string
  updated_at: string
}

export interface Log {
  id: number
  run_id: number
  agent_type?: string | null
  level: string
  message: string
  created_at: string
}