from typing import Optional
import os
import httpx


OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
DEFAULT_MODEL = os.getenv("DEFAULT_LLM_MODEL", "deepseek/deepseek-chat")

OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions"


def generate_completion(
    prompt: str,
    model: Optional[str] = None,
    temperature: float = 0.4,
) -> str:
    """
    Unified OpenRouter LLM function (Gemini-compatible interface)

    IMPORTANT:
    - Always returns plain text
    - Caller is responsible for JSON parsing
    - Prompt should strictly instruct JSON-only output if required
    """

    if not OPENROUTER_API_KEY:
        raise RuntimeError("OPENROUTER_API_KEY is not set")

    payload = {
        "model": model or DEFAULT_MODEL,
        "messages": [
            {"role": "system", "content": "You are a helpful AI agent."},
            {"role": "user", "content": prompt},
        ],
        "temperature": temperature,
        "max_tokens": 2048,
    }

    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost",
        "X-Title": "Multi-Agent OS",
    }

    response = httpx.post(OPENROUTER_ENDPOINT, json=payload, headers=headers, timeout=60)

    if response.status_code != 200:
        raise RuntimeError(f"OpenRouter Error: {response.text}")

    data = response.json()

    if not data.get("choices"):
        raise RuntimeError("Empty response from OpenRouter")

    usage = data.get("usage", {})

    input_tokens = usage.get("prompt_tokens", 0)
    output_tokens = usage.get("completion_tokens", 0)
    total_tokens = usage.get("total_tokens", 0)

    if total_tokens > 8000:
        raise RuntimeError("Token limit exceeded for safety")

    content = data["choices"][0]["message"]["content"].strip()

    return content, usage
