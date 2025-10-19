## app

### Аннтоация
Сервер реализует само web приложением чат бота со всем AI пайплайном

backend: python (FastAPI)
frontend: python (React)

### Инструкция
Запуск

!!!ВАЖНО ЗАПОЛНИТЬ ПЕРЕМЕННЫЕ ОКРУЖЕНИЯ

 * TOXICITY_CLASSIFIER_HOST - хост сервиса xlmr-large-toxicity-classifier-v2
 * SENTINEL_CLASSIFIER_HOST - хост сервиса sentinel-triton
 * RUBERT_HOST - хост сервиса rubert-tiny2-embeddings
 * FACTORS_DEV_HOST - хост сервиса factor-dev
 * QWEN_URL - хост сервиса qwen-triton
 * DATABASE_USER - пользователь в PostgreSQL
 * DATABASE_PASSWORD - пароль в PostgreSQL
 * DATABASE_HOST - хост в PostgreSQL
 * DATABASE_NAME - название базы данных в PostgreSQL

 Опцианальные переменные окружения

* TOXICITY_CLASSIFIER_TIMEOUT - timeout сервиса xlmr-large-toxicity-classifier-v2
* SENTINEL_CLASSIFIER_HOST - timeout сервиса sentinel-triton
* RUBERT_TIMEOUT - timeout сервиса rubert-tiny2-embeddings
* FACTORS_DEV_TIMEOUT - timeout сервиса factor-dev
* QWEN_TIMEOUT - timeout сервиса qwen-triton
* JWT_SECRET - jwt ключ

```
docker compose up --build
```

Приминение:

На 8080 открывает web приложение