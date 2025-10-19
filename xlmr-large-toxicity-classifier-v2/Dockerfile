FROM nvcr.io/nvidia/tritonserver:24.05-py3

RUN python3 -m pip install --no-cache-dir --upgrade pip \
 && python3 -m pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu \
    torch==2.3.1 torchvision==0.18.1 \
 && python3 -m pip install --no-cache-dir \
    transformers==4.44.2 tokenizers>=0.15.0

COPY model_repository /models

ENV TOKENIZERS_PARALLELISM=false
EXPOSE 8000 8001 8002
CMD ["tritonserver", "--model-repository=/models", "--log-verbose=1", "--strict-model-config=false"]
