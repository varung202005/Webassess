from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import asyncio
import contextlib
import logging

from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.core.config import settings
from app.core.limiter import limiter
from app.api.v1.router import api_router

logger = logging.getLogger(__name__)

_IS_PRODUCTION = settings.ENVIRONMENT.lower() == "production"


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 Online Exam Portal API starting up...")
    async def deadline_sweeper():
        from app.api.v1.endpoints.exam_attempts import auto_submit_expired_attempts
        while True:
            await asyncio.sleep(30)
            try:
                await auto_submit_expired_attempts()
            except Exception as exc:
                logger.error(f"Attempt deadline sweep failed: {exc}")

    sweep_task = asyncio.create_task(deadline_sweeper())
    yield
    sweep_task.cancel()
    with contextlib.suppress(asyncio.CancelledError):
        await sweep_task
    logger.info("🛑 Online Exam Portal API shutting down...")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Online Examination Portal — Backend API",
    # Interactive docs/schema are only exposed outside production, to avoid
    # handing attackers a full map of the API surface.
    openapi_url=None if _IS_PRODUCTION else f"{settings.API_V1_STR}/openapi.json",
    docs_url=None if _IS_PRODUCTION else f"{settings.API_V1_STR}/docs",
    redoc_url=None if _IS_PRODUCTION else f"{settings.API_V1_STR}/redoc",
    lifespan=lifespan,
    # Never let debug tracebacks leak to clients.
    debug=False,
)

# Rate limiting (SlowAPI)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS — explicit allow-list, no wildcard origins/methods/headers.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
    max_age=600,
)


@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    """
    Adds standard hardening headers to every response. Applied at the
    middleware layer so it can never be forgotten on a new route.
    """
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = (
        "camera=(self), microphone=(self), geolocation=(), payment=(), usb=()"
    )
    # This is an API — responses should never be framed, sniffed, or cached
    # as if they were static/public content.
    response.headers["Content-Security-Policy"] = (
        "default-src 'none'; frame-ancestors 'none'"
    )
    response.headers["Cache-Control"] = "no-store"
    if _IS_PRODUCTION:
        response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload"
    return response


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """
    Catch-all so unexpected errors never leak stack traces, file paths,
    or internal details to the client — log full detail server-side,
    return a generic message to the caller.
    """
    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error"},
    )


# Mount all API routes
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/health")
async def health_check():
    return {"status": "ok", "version": settings.VERSION}