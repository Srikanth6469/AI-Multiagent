from datetime import datetime

from backend.app.celery_app import celery_app
from backend.app.core.db import SessionLocal
from backend.app.models.project import Project, Run, Task, Log
from backend.app.agents.planner import PlannerAgent


@celery_app.task
def run_planning_workflow(run_id: int) -> None:
    """
    Background task:
    - Load the run + project
    - Call PlannerAgent
    - Create Task rows
    - Update Run status
    - Write logs
    """
    db = SessionLocal()
    try:
        run = db.query(Run).filter(Run.id == run_id).first()
        if not run:
            return

        project = db.query(Project).filter(Project.id == run.project_id).first()
        if not project:
            run.status = "failed"
            db.commit()
            return

        # Mark as running
        run.status = "running"
        db.add(run)
        db.commit()

        # Log: started
        log = Log(
            run_id=run.id,
            agent_type="planner",
            level="info",
            message="Planner workflow started",
        )
        db.add(log)
        db.commit()

        agent = PlannerAgent()
        result = agent.run(goal=project.description or project.title)

        # Create tasks from planner steps
        for step in result["steps"]:
            task = Task(
                run_id=run.id,
                agent_type="planner",
                status="done",  # For now, planner tasks are immediately done
                input=result["goal"],
                output=step["details"],
                order_index=step["index"],
            )
            db.add(task)

        # Final log
        done_log = Log(
            run_id=run.id,
            agent_type="planner",
            level="info",
            message=f"Planner created {len(result['steps'])} steps",
        )
        db.add(done_log)

        # Mark run completed
        run.status = "completed"
        run.updated_at = datetime.utcnow()
        db.add(run)

        db.commit()

    except Exception as e:
        # In case of error, mark run failed
        run = db.query(Run).filter(Run.id == run_id).first()
        if run:
            run.status = "failed"
            db.add(run)
            error_log = Log(
                run_id=run.id,
                agent_type="planner",
                level="error",
                message=f"Planner failed: {e}",
            )
            db.add(error_log)
            db.commit()
    finally:
        db.close()
