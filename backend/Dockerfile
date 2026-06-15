FROM python:3.12-slim

# Prevent writing pyc files to disc
ENV PYTHONDONTWRITEBYTECODE=1
# Prevent buffering stdout/stderr
ENV PYTHONUNBUFFERED=1

WORKDIR /workspace

# Install system dependencies (libmagic for file type validation)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libmagic1 \
    file \
    && rm -rf /var/lib/apt/lists/*

# Copy and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend application
COPY . .

# Create directory for uploads
RUN mkdir -p storage/uploads

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
