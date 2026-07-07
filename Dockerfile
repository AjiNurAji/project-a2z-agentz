FROM python:3.12-slim

RUN apt-get update && apt-get install -y build-essential && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirement files first for caching
COPY requirements.txt .
COPY backend/requirements.txt ./backend_reqs.txt

# Install dependencies (Python 3.11 has pre-compiled wheels for most packages)
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install --no-cache-dir -r backend_reqs.txt

# Copy the rest of the app
COPY . .

# Set PYTHONPATH so absolute imports from the root work
ENV PYTHONPATH=/app

WORKDIR /app/backend
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]

