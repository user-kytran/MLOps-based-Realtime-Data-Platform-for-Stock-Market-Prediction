FROM apache/airflow:2.10.0

USER root

# Cài đặt dependencies cần thiết
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        gcc \
        g++ \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

USER airflow

# Copy requirements và cài đặt packages
COPY --chown=airflow:root requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt \
    && rm -f /tmp/requirements.txt

# Copy DAGs
COPY --chown=airflow:root dags /opt/airflow/dags