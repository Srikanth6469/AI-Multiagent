from abc import ABC, abstractmethod
from typing import Any, Dict


class BaseAgent(ABC):
    """Base class for all agents."""

    name: str = "base-agent"
    description: str = "Base agent"

    @abstractmethod
    def run(self, **kwargs) -> Dict[str, Any]:
        """
        Run the agent with provided kwargs.
        Must be implemented by subclasses.
        """
        raise NotImplementedError
