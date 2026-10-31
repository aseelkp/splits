from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.middleware.sessions import SessionMiddleware

from app import auth
from app.config import get_settings
from app.routers import exercises, sessions
from app.services.errors import ConflictError, InvalidInputError, NotFoundError, ServiceError

settings = get_settings()

app = FastAPI(title="Splits", docs_url="/api/docs", redoc_url=None, openapi_url="/api/openapi.json")

# The cookie holds {"auth": true}, signed with SESSION_SECRET so it can't be forged.
# httpOnly: JavaScript can't read it. SameSite=lax: other sites can't make the browser send it on POSTs.
app.add_middleware(
    SessionMiddleware,
    secret_key=settings.session_secret or "login-disabled",
    session_cookie="splits_session",
    max_age=60 * 60 * 24 * 30,
    same_site="lax",
    https_only=settings.cookie_secure,
)

app.include_router(auth.router)
app.include_router(sessions.router)
app.include_router(exercises.router)


@app.get("/api/health", tags=["meta"])
def health():
    return {"status": "ok"}


_STATUS = {NotFoundError: 404, ConflictError: 409, InvalidInputError: 422}


@app.exception_handler(ServiceError)
async def service_error_handler(request: Request, exc: ServiceError):
    """Translate service-layer errors into HTTP status codes in one place."""
    return JSONResponse({"detail": str(exc)}, status_code=_STATUS.get(type(exc), 400))
