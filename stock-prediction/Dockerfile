# ============================================
# Stage 1: Builder - Install dependencies
# ============================================
FROM nvidia/cuda:12.1.0-runtime-ubuntu22.04 AS builder

# Install Python and pip
RUN apt-get update && apt-get install -y \
    python3.11 \
    python3-pip \
    python3.11-venv \
    && rm -rf /var/lib/apt/lists/*

# Create virtual environment
RUN python3.11 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copy and install requirements
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# ============================================
# Stage 2: Runtime - Minimal production image
# ============================================
FROM nvidia/cuda:12.1.0-runtime-ubuntu22.04 AS runtime

# Install only runtime dependencies
RUN apt-get update && apt-get install -y \
    python3.11 \
    rclone \
    && rm -rf /var/lib/apt/lists/*

# Copy virtual environment from builder
COPY --from=builder /opt/venv /opt/venv

# Set working directory
WORKDIR /app

# Copy application code
COPY api.py .
COPY model/ ./model/
COPY alphas/ ./alphas/

# Create results directory
RUN mkdir -p results

# Set environment variables
ENV PATH="/opt/venv/bin:$PATH" \
    CUDA_VISIBLE_DEVICES=0 \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# Expose port
EXPOSE 8006

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python3.11 -c "import requests; requests.get('http://localhost:8006/docs')" || exit 1

# Run application
CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8006", "--workers", "1"]
