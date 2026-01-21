from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.api import projects, runs ,auth
from backend.app.core.db import engine, Base
Base.metadata.create_all(bind=engine)

app = FastAPI()

# 👉 Allowed frontend origins
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

# 👉 CORS middleware MUST be added on the same `app` that uvicorn uses
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],     # <- IMPORTANT: allows OPTIONS, GET, POST, etc.
    allow_headers=["*"],     # <- allow all headers (including Content-Type)
)

# 👉 include routers AFTER middleware
app.include_router(projects.router)
app.include_router(runs.router)
app.include_router(auth.router)
