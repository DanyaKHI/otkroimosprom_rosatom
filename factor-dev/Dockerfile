FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt ./requirements.txt
RUN pip install --upgrade pip \
 && pip install -r requirements.txt

COPY app.py ./app.py
COPY main.py ./main.py
RUN mkdir -p /app/models

EXPOSE 8080

CMD ["python", "main.py"]
