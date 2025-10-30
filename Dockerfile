FROM python:3.11-slim

WORKDIR /app

COPY pyproject.toml uv.lock ./

RUN pip install --no-cache-dir flask flask-cors python-dotenv psycopg2-binary gunicorn

COPY . .

ENV PORT=8080
ENV PYTHONUNBUFFERED=1

CMD python -c "from app import init_db; init_db()" && exec gunicorn --bind :$PORT --workers 1 --threads 8 --timeout 0 --log-level info app:app
