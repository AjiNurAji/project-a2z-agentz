FROM python:3.12-slim

RUN apt-get update && apt-get install -y build-essential && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirement files first for caching
COPY backend/requirements.txt ./backend/requirements.txt

# Install dependencies
RUN pip install --no-cache-dir -r backend/requirements.txt
# Copy the backend app
COPY backend/ ./backend/

# Set PYTHONPATH so absolute imports (database, web3_async, agent_a_chroma) resolve
ENV PYTHONPATH=/app/backend
ENV PROTOCOL_BUFFERS_PYTHON_IMPLEMENTATION=python

WORKDIR /app/backend
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "${PORT:-8080}"]
