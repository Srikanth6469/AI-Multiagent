import json
from sqlalchemy.orm import Session
from fastapi import HTTPException

from backend.app.core.llm_client import generate_completion
from backend.app.models.project import Task, Run
from backend.app.core.prompt_guard import sanitize


class PlannerAgent:
    MAX_REFINES = 3

    def __init__(self, db: Session):
        self.db = db

    def plan(self, run: Run, project_title: str, project_description: str | None = None):
        base_prompt = f"""
You are a planning agent.

Break the project into clear, ordered execution tasks.

Return ONLY valid JSON. No markdown. No explanations.

JSON Schema:
{{
  "tasks": [
    {{
      "order_index": number,
      "input": string
    }}
  ]
}}

Project Title:
{sanitize(project_title)}

Project Description:
{sanitize(project_description or "N/A")}
"""

        current, _ = generate_completion(base_prompt)

        for _ in range(self.MAX_REFINES):
            try:
                json.loads(current)
                break
            except Exception:
                current, _ = generate_completion(
                    f"Fix this and return ONLY valid JSON with same schema:\n{current}"
                )

        try:
            data = json.loads(current)
        except Exception:
            raise HTTPException(400, "Planner failed to produce valid JSON")

        tasks = data.get("tasks")
        if not isinstance(tasks, list) or not tasks:
            raise HTTPException(400, "Planner returned invalid tasks")

        created_tasks = []
        for t in tasks:
            if "order_index" not in t or "input" not in t:
                continue

            task = Task(
                run_id=run.id,
                agent_type="executor",
                status="pending",
                input=str(t["input"])[:4000],
                order_index=int(t["order_index"]),
            )
            self.db.add(task)
            created_tasks.append(task)

        run.status = "planned"
        self.db.commit()

        return created_tasks
