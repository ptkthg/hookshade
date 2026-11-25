FROM python:3.12-slim AS dependencies
WORKDIR /build
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

FROM python:3.12-slim AS runtime
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
RUN groupadd --gid 10001 hookshade && useradd --uid 10001 --gid hookshade --create-home hookshade
WORKDIR /app
COPY --from=dependencies /install /usr/local
COPY --chown=hookshade:hookshade . .
USER hookshade
EXPOSE 8000
CMD ["sh", "-c", "alembic upgrade head && python -m app.seed && exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --no-server-header --workers 1"]
