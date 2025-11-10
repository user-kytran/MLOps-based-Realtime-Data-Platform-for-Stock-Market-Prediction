FROM python:3.11-slim

WORKDIR /app

# Cài đặt dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy code
COPY . .

# Expose port FastAPI
EXPOSE 8005

# Run uvicorn
CMD ["uvicorn", "src:app", "--host", "0.0.0.0", "--port", "8005", "--reload"]
