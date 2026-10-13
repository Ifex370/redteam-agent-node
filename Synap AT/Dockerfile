FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && useradd --uid 10001 --create-home appuser
COPY server.py export_enquiries.py ./
COPY public ./public
RUN mkdir /app/data && chown appuser:appuser /app/data
USER appuser
ENV DATA_DIR=/app/data
EXPOSE 8080
CMD ["gunicorn", "--bind", "0.0.0.0:8080", "--workers", "2", "--access-logfile", "-", "server:app"]
