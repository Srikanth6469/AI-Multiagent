from backend.app.core.llm_client import generate_completion
from backend.app.models.project import Task, Log
from backend.app.core.prompt_guard import sanitize

class ExecutorAgent:
    """
    Executes planned tasks in proper reasoning chain order.
    - Crash safe
    - Resumable
    - Rolling context memory
    - Cost aware
    """

    def __init__(self, db):
        self.db = db

    def run(self, project_title: str, tasks: list[Task], run_id: int):
        previous_context = ""

        for task in tasks:
            try:
                # Mark running
                task.status = "running"
                self.db.commit()

                prompt = f"""
You are an expert AI agent working on a project.

PROJECT:
{project_title}

PREVIOUS WORK:
{previous_context}

CURRENT TASK:
{sanitize(task.input)}


Continue the work carefully and clearly.
"""

                # LLM call
                result, usage = generate_completion(prompt)   # now returns (text, usage)

                # Save output
                task.output = result
                task.status = "done"
                self.db.commit()

                # Log cost
                self.db.add(Log(
                    run_id=run_id,
                    agent_type="llm",
                    level="cost",
                    message=f"Tokens used: {usage.get('total_tokens', 0)}"
                ))
                self.db.commit()

                # Rolling memory
                previous_context += f"\n---\nTask {task.order_index} Output:\n{result}"

            except Exception as e:
                self.db.rollback()
                task.status = "pending"
                self.db.commit()

                self.db.add(Log(
                    run_id=run_id,
                    agent_type=task.agent_type,
                    level="error",
                    message=str(e),
                ))
                self.db.commit()
