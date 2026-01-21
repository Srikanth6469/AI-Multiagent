import re

BLOCK_PATTERNS = [
    r"ignore previous",
    r"system:",
    r"developer:",
    r"you are chatgpt",
    r"jailbreak",
    r"override",
    r"sudo",
    r"password",
    r"api[_-]?key",
    r"token",
]

def sanitize(text: str) -> str:
    if not text:
        return ""

    text = text[:3000]   # prevent giant payload attacks

    for pattern in BLOCK_PATTERNS:
        text = re.sub(pattern, "[filtered]", text, flags=re.I)

    return text.strip()
