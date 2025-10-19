## sentinel-triton

### Аннтоация
Сервис предназначен для классификации запросов на наличие jailbreak'ов

Используемая модель: https://huggingface.co/qualifire/prompt-injection-jailbreak-sentinel-v2

Сервис разворачивает модель на NVIDIA с помощью утилиты Triton 

### Инструкция
Запуск
```
docker compose --profile gpu up --build
```

Приминение:

Принимает текстовые запросы вовзращает уверенность в наличии jailbreak'a [0, 1]