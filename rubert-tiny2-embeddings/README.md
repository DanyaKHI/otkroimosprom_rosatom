## rubert-tiny2-embeddings

### Аннтоация
Сервис предназначен для энкодинга текста, качестве модели из семейства Bert

Используемая модель: https://huggingface.co/cointegrated/rubert-tiny2

Сервис разворачивает модель на NVIDIA с помощью утилиты Triton 

### Инструкция
Запуск
```
docker compose --profile gpu up --build
```

Приминение:

Принимает текстовые запросы вовзращает эмбеддинг размеров (312) чисел (float)