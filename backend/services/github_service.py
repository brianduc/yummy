"""
YUMMY Backend - GitHub Service
Wrapper around the GitHub REST API and raw content fetching.
"""

import httpx
from fastapi import HTTPException
from config import DB


# ============================================================
# INTERNAL HELPERS
# ============================================================

def _get_headers() -> dict:
    """Return an auth header if a GitHub token is configured."""
    token = DB.get("github_token", "")
    if token:
        return {"Authorization": f"token {token}"}
    return {}


# ============================================================
# PUBLIC API
# ============================================================

async def github_fetch(path: str) -> httpx.Response:
    """
    Call the GitHub REST API.

    Args:
        path: API path, e.g. "/repos/owner/repo"

    Returns:
        httpx.Response object (caller handles .json()).
    """
    headers = _get_headers()
    async with httpx.AsyncClient(timeout=30) as client:
        return await client.get(f"https://api.github.com{path}", headers=headers)


async def github_raw(owner: str, repo: str, branch: str, file_path: str) -> str:
    """
    Fetch a file's raw content from GitHub.

    Args:
        owner:     GitHub username or org name
        repo:      Repository name
        branch:    Branch name (main, master, develop, ...)
        file_path: File path in the repo (e.g. "src/index.ts")

    Returns:
        File content as a string.

    Raises:
        HTTPException 404 if the file doesn't exist or cannot be read.
    """
    headers = _get_headers()
    url = f"https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{file_path}"
    
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.get(url, headers=headers)
        if r.status_code != 200:
            raise HTTPException(
                status_code=404,
                detail=f"Unable to read file '{file_path}' from GitHub (status: {r.status_code})."
            )
        return r.text


async def get_repo_info(owner: str, repo: str) -> dict:
    """
    Fetch repository metadata (default_branch, description, etc.).

    Returns:
        Repo data dict from the GitHub API.

    Raises:
        Exception if the repo does not exist or is not accessible.
    """
    resp = await github_fetch(f"/repos/{owner}/{repo}")
    if resp.status_code != 200:
        error_msg = resp.json().get("message", "Unknown error")
        raise Exception(f"GitHub API: {error_msg} (status: {resp.status_code})")
    return resp.json()


async def get_repo_tree(owner: str, repo: str, branch: str) -> list:
    """
    Fetch the repository file tree (recursive).

    Returns:
        List of file objects: [{"path": "...", "type": "blob|tree", "size": int}, ...]
    """
    resp = await github_fetch(
        f"/repos/{owner}/{repo}/git/trees/{branch}?recursive=1"
    )
    if resp.status_code != 200:
        raise Exception(f"Unable to fetch file tree: {resp.status_code}")
    return resp.json().get("tree", [])
