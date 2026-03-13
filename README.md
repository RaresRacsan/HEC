# blypp

**blypp** is a personal, open-source voice & chat platform built for small friend groups who want fast, low-latency voice communication without relying on third-party services.

> _"We built blypp because we were tired of voice delay. It's for us, hosted by us."_

---

## What is blypp?

blypp is a self-hosted chat + voice application inspired by the idea that a small group of friends should be able to run their own communication platform. It is **not affiliated with, derived from, or intended to imitate any commercial product**.

Key features:
- 💬 **Text channels** inside group spaces
- 🔊 **Low-latency voice & video** powered by [LiveKit](https://livekit.io)
- 📩 **Direct messages** between users
- 🔗 **Invite codes** to share spaces with friends
- ⚙️ **Device settings** — choose microphone, camera, speaker, and volume

---

## Tech Stack

| Layer    | Technology                          |
|----------|-------------------------------------|
| Frontend | React + TypeScript + Vite           |
| Voice    | LiveKit (self-hosted or cloud)      |
| Backend  | Rust (Axum) REST + WebSocket API    |
| Deploy   | Docker Compose + Nginx              |

---

## Running Locally

### Prerequisites
- Docker & Docker Compose
- Node.js 18+

### Start the backend

```bash
docker-compose up -d
```

### Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Deployment

A GitHub Actions workflow (`.github/workflows/deploy.yml`) is included for automated deployment. Edit the workflow to match your server and domain.

For manual deployment:
1. Build the frontend: `npm run build`
2. Copy `dist/` to your server
3. Configure Nginx to serve the static files and proxy `/api` to the backend

---

## Project Structure

```
blypp/
├── frontend/          # React + TypeScript UI
│   └── src/
│       ├── App.tsx
│       ├── Auth.tsx
│       ├── Chat.tsx
│       ├── Modals.tsx
│       ├── SettingsModal.tsx
│       └── CustomVideoConference.tsx
├── backend/           # Go API server
├── docker-compose.yml
└── .github/workflows/ # CI/CD
```

---

## License

MIT License — free to use, modify, and self-host.

---

## Disclaimer

blypp is an independent personal project. It is not affiliated with, endorsed by, or derived from any commercial chat or voice platform. All design, code, and branding are original work created for personal use.