# ---- Backend Dockerfile (FastAPI) ----
# Place this file at: backend/Dockerfile

FROM python:3.11-slim

# Prevents Python from writing .pyc files & buffers logs immediately (good for docker logs)
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# System deps needed by some Python packages (pdfplumber -> Pillow, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libjpeg62-turbo-dev \
    zlib1g-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps first (better layer caching -> faster rebuilds)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the actual app code
COPY app ./app

EXPOSE 8000

# NOTE: no .env is copied into the image on purpose.
# Secrets are injected at runtime via docker-compose "env_file" / environment.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
