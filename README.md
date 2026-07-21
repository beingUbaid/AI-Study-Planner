# 🎓 AI Study Planner — Smart AI Learning & Schedule Assistant

[![React 19](https://img.shields.io/badge/Frontend-React%2019%20%7C%20Vite%20%7C%20Tailwind-61DAFB?logo=react)](https://react.dev)
[![Node.js](https://img.shields.io/badge/Backend-Node.js%20%7C%20Express%20%7C%20MongoDB-339933?logo=nodedotjs)](https://nodejs.org)
[![Groq AI](https://img.shields.io/badge/AI%20Engine-Groq%20Llama%203.1--8B-purple)](https://groq.com)
[![Deployment](https://img.shields.io/badge/Deployment-Vercel%20%2B%20Render-black)](https://vercel.com)

**AI Study Planner** is a full-stack, AI-powered productivity platform designed to help students transform unstructured course syllabi into adaptive daily study schedules, interactive practice flashcards, and self-testing quizzes.

---

## 🔗 Live Demo & Links

- 🌐 **Live Application**: [https://ai-study-planner.vercel.app](https://ai-study-planner.vercel.app) *(Deploying via Vercel & Render)*
- 📦 **GitHub Repository**: [https://github.com/beingUbaid/AI-Study-Planner](https://github.com/beingUbaid/AI-Study-Planner)

---

## 🌟 Key Features

### 1. 🤖 Adaptive AI Schedule Generation & Plan Rebalancing
- **Syllabus PDF Parser**: Drag & drop course syllabus PDFs. Groq AI extracts chapter titles, estimated study hours, and topics automatically.
- **Adaptive Rebalancing Engine**: Missed yesterday's 2-hour study session? The AI dynamically shifts uncompleted tasks into remaining study days without overloading your schedule.

### 2. ⚡ AI Active-Recall Flashcards & Self-Testing Quizzes
- **3D Flip Flashcards**: Generate high-yield active-recall cards per subject and topic with 3D flip card animations.
- **Auto-Graded Quizzes**: Take interactive multiple-choice practice quizzes with step-by-step AI answer explanations.

### 3. 🎙️ Voice Input (Speech-to-Text) Hands-Free AI Tutor
- Speak questions directly into the AI Chatbot using Web Speech API voice recognition.
- Get instant academic explanations with embedded YouTube lecture recommendations.

### 4. 📅 Calendar Integration & iCal Export
- Sync study tasks directly into **Google Calendar**, **Apple Calendar**, or **Outlook** using 1-click `.ics` export or direct Google Calendar URLs.

### 5. 🏆 Gamification & Progress Analytics
- **Gamification Badges**: Earn unlockable badges (*Pomodoro Scholar*, *Streak Warrior*, *PDF Mastermind*, *Quiz Champion*).
- **Printable PDF Reports**: Download formatted academic progress reports to print or save.

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: React 19 (Vite)
- **Styling**: Vanilla Tailwind CSS + Glassmorphism Dark Theme
- **Icons**: Lucide React
- **Routing**: React Router 7

### Backend
- **Server**: Node.js & Express 5
- **Database**: MongoDB Atlas & Mongoose
- **Authentication**: Passport.js (Google OAuth 2.0) & JWT
- **AI SDK**: Groq SDK (`llama-3.1-8b-instant`)
- **File Processing**: Multer & pdf-parse

---

## 🏛️ System Architecture

```
┌────────────────────────────────────────────────────────┐
│                      Client (React 19)                 │
│   Dashboard │ AI Tutor │ Study Tracker │ Calendar      │
└───────────────────────────┬────────────────────────────┘
                            │ REST API / JWT
┌───────────────────────────▼────────────────────────────┐
│                  Node.js / Express 5 API               │
│   Auth Controller  │  Planner Engine  │  AI Controller │
└─────────┬─────────────────┬───────────────────┬────────┘
          │                 │                   │
   MongoDB Atlas        Groq LLM SDK       Google OAuth
   (User & Schedule)  (PDF & Quizzes)    (Authentication)
```

---

## 📁 Repository Structure

```
AI-Study-Planner/
├── backend/
│   ├── src/
│   │   ├── controllers/      # Auth, AI, Subject, Planner, Progress controllers
│   │   ├── middleware/       # JWT Auth Middleware
│   │   ├── models/           # Mongoose Schemas (User, Subject, Chapter, StudyPlan)
│   │   ├── routes/           # REST API Route Definitions
│   │   └── utils/            # Schedule generation & Email sending utilities
│   ├── .env.example          # Backend environment variable template
│   └── index.js              # Server entry point
│
├── frontend/
│   ├── src/
│   │   ├── components/       # Reusable UI components (Logo, FlashcardsQuizModal, VoiceInputButton)
│   │   ├── pages/            # Application views (Dashboard, CalendarPlanner, StudyTracker, AIAssistant)
│   │   └── services/         # Centralized API service methods
│   ├── .env.example          # Frontend environment variable template
│   └── index.html            # Vite HTML entry point
│
├── .gitignore                # Environment & build exclusions
└── README.md                 # Project documentation
```

---

## ⚙️ How to Run Locally

### Prerequisites
- Node.js (v18+)
- MongoDB Atlas account or local MongoDB instance
- Groq API Key

### 1. Clone Repository
```bash
git clone https://github.com/beingUbaid/AI-Study-Planner.git
cd AI-Study-Planner
```

### 2. Configure Backend
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your MONGO_URI, JWT_SECRET, and GROQ_API_KEY
npm run dev
```

### 3. Configure Frontend
```bash
cd ../frontend
npm install
cp .env.example .env
npm run dev
```
Open **http://localhost:5173** in your browser!

---

## 👨‍💻 Team & Contributions

- **Ubaid (Frontend Lead & AI Integrations)**:
  - Designed & developed the React 19 UI, component hierarchy, and glassmorphism styling.
  - Implemented Web Speech API voice input, Flashcards & Quiz modal, and calendar export features.
  - Handled client-side state management, responsive navigation, and error handling.
- **Backend Collaborator**:
  - Implemented Express REST API routes, Mongoose database schemas, and Nodemailer email verification.

---

## 📄 License
This project is licensed under the **MIT License**.
