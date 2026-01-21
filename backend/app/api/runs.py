import json
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.app.core.db import get_db
from backend.app.models.project import Project, Run, Task, Log, User
from backend.app.api.auth import get_current_user

from backend.app.agents.planner import PlannerAgent
from backend.app.agents.executor import ExecutorAgent
from backend.app.agents.reporter import ReporterAgent

router = APIRouter(prefix="/runs", tags=["runs"])



def run_to_dict(run: Run) -> dict:
    return {
        "id": run.id,
        "project_id": run.project_id,
        "status": run.status,
        "final_summary": run.final_summary,
        "created_at": run.created_at,
        "updated_at": run.updated_at,
    }


def task_to_dict(task: Task) -> dict:
    return {
        "id": task.id,
        "run_id": task.run_id,
        "agent_type": task.agent_type,
        "status": task.status,
        "input": task.input,
        "output": task.output,
        "order_index": task.order_index,
        "created_at": task.created_at,
        "updated_at": task.updated_at,
    }


def log_to_dict(log: Log) -> dict:
    return {
        "id": log.id,
        "run_id": log.run_id,
        "agent_type": log.agent_type,
        "level": log.level,
        "message": log.message,
        "created_at": log.created_at,
    }



@router.post("/projects/{project_id}/runs")
def create_and_plan_run(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.owner_id == current_user.id
    ).with_for_update().first()   

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    
    # Prevent duplicate runs
    if project.is_locked:
        raise HTTPException(status_code=409, detail="Project already has a running job")

    project.is_locked = True
    db.commit()
    db.query(Run).filter(
    Run.project_id == project.id,
    Run.is_archived == False
    ).update({"is_archived": True})
    db.commit()


    try:
        run = Run(project_id=project.id, status="created")
        db.add(run)
        db.commit()
        db.refresh(run)

        PlannerAgent(db).plan(run, project.title, project.description)

        return run_to_dict(run)

    finally:
        project.is_locked = False
        db.commit()




@router.get("/{run_id}")
def get_run(
    run_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    run = (
        db.query(Run)
        .join(Project, Run.project_id == Project.id)
        .filter(Run.id == run_id, Project.owner_id == current_user.id)
        .first()
    )
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    return run_to_dict(run)


# ---------- List runs ----------

@router.get("/")
def list_runs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    runs = (
        db.query(Run)
        .join(Project, Run.project_id == Project.id)
        .filter(
            Project.owner_id == current_user.id,
            Run.is_archived == True 
        )
        .order_by(Run.created_at.desc())
        .all()
    )
    return [run_to_dict(r) for r in runs]



# ----------delte a run ----------


def delete_run(
    run_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    run = (
        db.query(Run)
        .join(Project, Run.project_id == Project.id)
        .filter(Run.id == run_id, Project.owner_id == current_user.id)
        .first()
    )
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    db.delete(run)
    db.commit(
)

# ---------- List tasks ----------

@router.get("/{run_id}/tasks")
def list_run_tasks(
    run_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    run = (
        db.query(Run)
        .join(Project, Run.project_id == Project.id)
        .filter(Run.id == run_id, Project.owner_id == current_user.id)
        .first()
    )
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    tasks = (
        db.query(Task)
        .join(Run, Task.run_id == Run.id)
        .join(Project, Run.project_id == Project.id)
        .filter(
            Task.run_id == run_id,
            Project.owner_id == current_user.id
        )
        .order_by(Task.order_index)
        .all()
    )


    return [task_to_dict(t) for t in tasks]


# ---------- List logs ----------

@router.get("/{run_id}/logs")
def list_run_logs(
    run_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    run = (
        db.query(Run)
        .join(Project, Run.project_id == Project.id)
        .filter(Run.id == run_id, Project.owner_id == current_user.id)
        .first()
    )
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    logs = (
        db.query(Log)
        .join(Run, Log.run_id == Run.id)
        .join(Project, Run.project_id == Project.id)
        .filter(
            Log.run_id == run_id,
            Project.owner_id == current_user.id
        )
        .order_by(Log.created_at)
        .all()
     )

    return [log_to_dict(l) for l in logs]


# ---------- EXECUTE ----------

@router.post("/{run_id}/execute")
def execute_run(
    run_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Lock run row (prevents parallel workers)
    run = db.query(Run).join(Project).filter(
        Run.id == run_id,
        Project.owner_id == current_user.id
    ).with_for_update().first()

    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    if run.is_locked:
        raise HTTPException(status_code=409, detail="Run already executing")

    run.is_locked = True
    db.commit()

    try:
        # Fetch pending tasks
        tasks = db.query(Task).filter(
            Task.run_id == run_id,
            Task.status == "pending"
        ).order_by(Task.order_index).all()

        if not tasks:
            raise HTTPException(status_code=400, detail="No pending tasks")

        run.status = "running"
        db.commit()

        agent = ExecutorAgent(db)
        agent.run(run.project.title, tasks, run.id)

        run.status = "completed"
        db.commit()

        return {"run_id": run.id, "status": run.status}

    finally:
        # Always unlock run
        run.is_locked = False
        db.commit()


# ---------- SUMMARIZE ----------

@router.post("/{run_id}/summarize")
def summarize_run(
    run_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    run = (
        db.query(Run)
        .join(Project, Run.project_id == Project.id)
        .filter(Run.id == run_id, Project.owner_id == current_user.id)
        .first()
    )
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    project = run.project

    tasks = (
        db.query(Task)
        .filter(Task.run_id == run_id)
        .order_by(Task.order_index.asc())
        .all()
    )

    if not tasks:
        raise HTTPException(status_code=400, detail="No tasks to summarize")

    task_dicts = [
        {
            "order_index": t.order_index,
            "agent_type": t.agent_type,
            "input": t.input,
            "output": t.output,
        }
        for t in tasks
    ]

    agent = ReporterAgent()
    summary = agent.run(project_title=project.title, tasks=task_dicts)

    run.final_summary = summary
    run.status = "summarized"
    db.commit()

    return {
        "run_id": run.id,
        "status": run.status,
        "final_summary": run.final_summary,
    }


