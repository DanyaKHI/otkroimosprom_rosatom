## xlmr-large-toxicity-classifier-v2

### Аннтоация
Сервис предназначен для классификации запросов на токсичность

Используемая модель: https://huggingface.co/textdetox/xlmr-large-toxicity-classifier-v2

Сервис разворачивает модель на NVIDIA с помощью утилиты Triton 

### Инструкция
Запуск
```
docker compose --profile gpu up --build
```

Приминение:

Принимает текстовые запросы вовзращает уверенность в токсичности [0, 1]