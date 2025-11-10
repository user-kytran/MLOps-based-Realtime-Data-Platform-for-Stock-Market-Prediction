# Build stage
FROM python:3.11-slim as builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    librdkafka-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements và build wheels
COPY requirements.txt .
RUN pip wheel --no-cache-dir --no-deps --wheel-dir /app/wheels -r requirements.txt

# Runtime stage
FROM python:3.11-slim

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    librdkafka1 \
    && rm -rf /var/lib/apt/lists/*

# Copy wheels from builder stage
COPY --from=builder /app/wheels /wheels

# Install packages từ wheels
RUN pip install --no-cache /wheels/* \
    && rm -rf /wheels \
    && pip cache purge

# Copy source code
COPY . .

# Clean up
RUN rm -rf __pycache__ \
    && find . -type f -name "*.pyc" -delete

# Create non-root user
RUN useradd -m -s /bin/bash appuser
USER appuser

CMD ["python", "-O", "stock_producer.py"]