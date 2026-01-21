from typing import List

from fastapi import APIRouter, Depends, HTTPException, Response ,status
from sqlalchemy.orm import Session

from backend.app.core.db import get_db
from backend.app.models.project import Project, Run, Task, Log ,User
from backend.app.api.auth import get_current_user
from backend.app.schemas.project import ProjectCreate, ProjectRead ,ProjectUpdate
from backend.app.agents.planner import PlannerAgent

router = APIRouter(prefix="/projects", tags=["projects"])


# ---------- Create a project ----------

@router.post("/", response_model=ProjectRead)
def create_project(project_in: ProjectCreate, db: Session = Depends(get_db) ,current_user: User = Depends(get_current_user)):
    project = Project(
        title=project_in.title,
        description=project_in.description,
        status="created",
        owner_id=current_user.id,
    )
    db.add(project)
    db.commit()
    db.refresh(project)

    return project


# ---------- Get a single project ----------

@router.get("/{project_id}", response_model=ProjectRead)
def get_project(
    project_id: int, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)):
    
    print(">>> get_project from backend.app.api.projects is running")
    
    project = db.query(Project).filter(Project.id == project_id,Project.owner_id == current_user.id,).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.put("/{project_id}", response_model=ProjectRead)
def update_project(
    project_id: int,
    project_in: ProjectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = (
        db.query(Project)
        .filter(
            Project.id == project_id,
            Project.owner_id == current_user.id,
        )
        .first()
    )

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Only update fields that were sent
    if project_in.title is not None:
        project.title = project_in.title
    if project_in.description is not None:
        project.description = project_in.description
    if project_in.status is not None:
        project.status = project_in.status

    db.commit()
    db.refresh(project)
    return project


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = (
        db.query(Project)
        .filter(
            Project.id == project_id,
            Project.owner_id == current_user.id,
        )
        .first()
    )

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    db.delete(project)
    db.commit()
    # 204 – no body
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------- List all projects ----------

@router.get("/", response_model=List[ProjectRead])
def list_projects(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    
    ):
    projects = (
        db.query(Project)
        .filter(Project.owner_id == current_user.id)
        .order_by(Project.created_at.desc())
        .all()
    )
    return projects
    

