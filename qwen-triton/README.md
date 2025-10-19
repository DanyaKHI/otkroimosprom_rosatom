## qwen-triton

### Аннтоация
Сервис предназначен для генеративного ответа LLM

Используемая модель: https://huggingface.co/Qwen/Qwen3-1.7B

Сервис разворачивает модель на NVIDIA с помощью утилиты Triton 

### Инструкция
Запуск
```
docker compose --profile gpu up --build
```

Приминение:

Принимает текстовые запросы генрацию до max_tokens