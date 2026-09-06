from fastapi import FastAPI

APP_VERSION = "0.1.0-alpha"

app = FastAPI(title="GEO API", version=APP_VERSION)


@app.get("/health")
def health() -> dict[str, str]:
    return {"estado": "ok", "version": APP_VERSION}
