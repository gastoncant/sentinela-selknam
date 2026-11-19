FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && useradd --system --uid 10001 app && mkdir /state && chown app /state
COPY manage.py .
COPY sentinela ./sentinela
COPY pilot ./pilot
USER app
ENV APP_DB=/state/pilot.sqlite3 PYTHONDONTWRITEBYTECODE=1
CMD ["sh","-c","python manage.py migrate --noinput && exec gunicorn --bind 0.0.0.0:8000 --workers 1 --threads 4 --timeout 30 sentinela.wsgi"]

