"""yummy-guard — Security Agent"""
from typing import AsyncIterator
import re
from app.services.ai.base import ai_service

GUARD_SYSTEM = """You are yummy-guard, an expert application security AI agent.
Analyze code for OWASP Top 10 vulnerabilities, secrets, and security anti-patterns.
Always output structured findings with:
- Severity: CRITICAL/HIGH/MEDIUM/LOW/INFO
- CWE ID if applicable
- File and line reference
- Remediation guidance
Never miss CRITICAL findings. False negatives are worse than false positives."""

SECRET_PATTERNS = [
    (r'(?i)(password|passwd|pwd)\s*[=:]\s*["\']([^"\']{8,})["\']', "Hardcoded password"),
    (r'(?i)(api[_-]?key|apikey)\s*[=:]\s*["\']([^"\']{10,})["\']', "Hardcoded API key"),
    (r'(?i)(secret|token)\s*[=:]\s*["\']([^"\']{10,})["\']', "Hardcoded secret/token"),
    (r'AKIA[0-9A-Z]{16}', "AWS Access Key ID"),
    (r'(?i)sk-[a-zA-Z0-9]{32,}', "OpenAI API Key"),
    (r'(?i)sk-ant-[a-zA-Z0-9-]{32,}', "Anthropic API Key"),
]

class SecurityAgent:
    async def scan_code(self, code: str, language: str = "unknown") -> AsyncIterator[str]:
        # Deterministic secret scan first
        secrets = self._detect_secrets(code)
        if secrets:
            yield f"## ⚠️ SECRETS DETECTED (Deterministic Scan)\n\n"
            for s in secrets:
                yield f"- **{s['type']}** at line {s['line']}: `{s['match'][:20]}...`\n"
            yield "\n---\n\n"

        messages = [{"role": "user", "content": f"""
Security scan this {language} code for vulnerabilities:

```{language}
{code[:10000]}
```

Check for: SQL injection, XSS, command injection, path traversal, insecure deserialization,
broken auth, SSRF, XXE, IDOR, sensitive data exposure, OWASP Top 10.
"""}]
        async for chunk in ai_service.chat_stream(messages, system=GUARD_SYSTEM):
            yield chunk

    def _detect_secrets(self, code: str) -> list[dict]:
        findings = []
        for i, line in enumerate(code.split('\n'), 1):
            for pattern, name in SECRET_PATTERNS:
                if re.search(pattern, line):
                    findings.append({"type": name, "line": i, "match": line.strip()})
        return findings

    async def audit_dependencies(self, deps: list[str], ecosystem: str = "npm") -> AsyncIterator[str]:
        messages = [{"role": "user", "content": f"""
Security audit these {ecosystem} dependencies for known CVEs and vulnerabilities:

{chr(10).join(deps[:100])}

Identify outdated, vulnerable, or suspicious packages.
"""}]
        async for chunk in ai_service.chat_stream(messages, system=GUARD_SYSTEM):
            yield chunk

security_agent = SecurityAgent()
