celery -A backend.app.celery_app.celery_app worker --loglevel=info
redis-server
npm run dev
source venv/bin/activate     
uvicorn backend.app.main:app --reload



#  Multi-Agent Application 

A full-stack **multi-agent application** built with a modern frontend and a scalable backend.  


- **Frontend:** https://<your-project>.vercel.app
- **Backend API:** https://<your-backend>.onrender.com

---

## ✨ Features
- 🤖 Multi-agent workflo
- ⚡ Fast, modern frontend using Vite
- 🧠 Scalable backend API
- 🔐 Environment-based configuration
- 🚫 Clean repository (no secrets or binaries)

---

## 🧱 Tech Stack

### Frontend
- React + TypeScript
- ESLint

### Backend
- Python (FastAPI / Flask)
- REST APIs
- CORS-enabled services

## 📁 Project Structure
multi-agent-app/
├── frontend/
│ ├── src/
│ ├── index.html
│ ├── package.json
│ ├── vite.config.ts
│ └── README.md
│
├── backend/
│ ├── app/
│ │ ├── routes/
│ │ ├── services/
│ │ └── main.py
│ ├── requirements.txt
│ ├── .env.example
│ └── README.md
│
├── .gitignore
└── README.md

---

## 🚫 Excluded From Repository
The following are **intentionally not pushed**:

- `node_modules/`
- `dist/`
- `.env`
- Virtual environments (`venv/`)
- **Phase 3 implementation**

> Phase 3 contains experimental / restricted logic and is excluded intentionally.

---

## ⚙️ Local Setup

### 🔹 Clone Repository
```bash
git clone https://github.com/<your-username>/<repo-name>.git
cd multi-agent-app
python -m venv venv
### Frontend Setup
cd frontend
npm install
npm run dev
Frontend runs at:
http://localhost:5173
###Backend Setup
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
Backend runs at:
http://localhost:8000
🔐 Environment Variables
Create a .env file (do not commit):
Backend
DATABASE_URL=your_database_url
API_KEY=your_secret_key
Frontend
VITE_API_URL=http://localhost:8000
🏗️ Build for Production
Frontend
npm run build
Output:
frontend/dist/

Start Command:
uvicorn app.main:app --host 0.0.0.0 --port 8000
