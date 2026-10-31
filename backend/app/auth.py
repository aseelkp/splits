"""Single-password login. Login stores a flag in a signed, httpOnly cookie (Starlette's session)."""

import hmac

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel

from app.config import get_settings


def require_auth(request: Request) -> None:
    """Dependency: reject the request unless the signed session cookie says we're logged in."""
    if not request.session.get("auth"):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not logged in.")


router = APIRouter(prefix="/api/auth", tags=["auth"])


class Login(BaseModel):
    password: str


@router.post("/login")
def login(data: Login, request: Request):
    settings = get_settings()
    if not settings.app_password or not settings.session_secret:
        # Fail closed: with no password configured, nobody can log in.
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Login is not configured on the server.")
    # compare_digest takes the same time however many characters match (no timing leak).
    if not hmac.compare_digest(data.password.encode(), settings.app_password.encode()):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Wrong password.")
    request.session["auth"] = True
    return {"authenticated": True}


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request):
    request.session.clear()


@router.get("/me")
def me(request: Request):
    return {"authenticated": bool(request.session.get("auth"))}


protected = [Depends(require_auth)]
