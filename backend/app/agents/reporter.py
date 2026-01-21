# backend/app/agents/reporter.py

from typing import List, Dict


class ReporterAgent:
    """
    Reporter that takes all tasks and produces a final summary.
    Later you can swap this with a proper LLM summarizer.
    """

    def run(self, project_title: str, tasks: List[Dict]) -> str:
        """
        Args:
            project_title: title/goal of the project
            tasks: list of dicts with order_index, agent_type, input, output

        Returns:
            A final narrative summary string.
        """
        lines: List[str] = []

        lines.append(f"Summary for project: {project_title}")
        lines.append("")
        lines.append("This run executed the following steps:")

        for t in tasks:
            idx = t.get("order_index", "?")
            agent_type = t.get("agent_type") or "executor"
            input_text = (t.get("input") or "").strip()
            output_text = (t.get("output") or "").strip()

            lines.append("")
            lines.append(f"Step {idx} ({agent_type}):")
            if input_text:
                lines.append(f"- Instruction: {input_text}")
            if output_text:
                lines.append(f"- Result: {output_text}")
            else:
                lines.append("- Result: (no output recorded)")

        lines.append("")
        lines.append(
            "Overall, the project has been broken down into clear steps and "
            "each step has been processed. This summary can be used as a high-level "
            "report of what the orchestrator completed."
        )

        return "\n".join(lines)
