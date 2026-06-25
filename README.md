# Coda

A real-time collaborative code editor with a VS Code-inspired interface. Multiple users can edit the same file simultaneously with live cursor presence, integrated code execution, an in-browser terminal, and a room lobby system.

## Features

- **Real-time collaboration** — Conflict-free sync via Yjs CRDTs over WebSocket; every keystroke propagates instantly to all connected peers
- **VS Code-style UI** — Activity bar, collapsible sidebar, multi-tab editor, bottom panel, and status bar
- **Code execution** — Runs JavaScript, Python, and Bash locally on the server; falls back to Judge0 (via RapidAPI) for TypeScript, Go, Rust, Java, C++, C#, and SQL
- **Integrated terminal** — Full PTY terminal (via `node-pty`) served over WebSocket, rendered with xterm.js
- **Lobby & access control** — Room creators approve or reject join requests before guests gain editor access
- **Live presence** — Colored cursors and user list show who is in the room and where they are editing
- **In-room chat** — Sidebar chat panel with toast notifications for messages received while chat is closed
- **Code comments** — Inline comment popover attached to specific editor lines
- **Local folder access** — Open a local directory via the File System Access API and browse/edit files from the sidebar
- **Persistent or in-memory storage** — Uses MongoDB when available; falls back to in-memory storage automatically so the server starts without a database

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, React Router v6 |
| Editor | Monaco Editor (`@monaco-editor/react`) |
| Collaboration | Yjs, y-websocket, y-monaco |
| Terminal | xterm.js, node-pty |
| Backend | Node.js, Express |
| WebSocket | `ws` library |
| Database | MongoDB via Mongoose (optional) |
| Auth | JWT (`jsonwebtoken`), bcryptjs |
| Code execution | Local `spawn` + Judge0 CE (RapidAPI) |
| Build | Vite, concurrently |

## Project Structure

```
coda/
├── server/
│   ├── index.js          # Express app, HTTP server, WebSocket routing
│   ├── store.js          # Dual-mode data layer (MongoDB / in-memory)
│   ├── lobby.js          # Room join-request approval system
│   ├── terminal.js       # PTY WebSocket handler
│   ├── middleware/
│   │   └── auth.js       # JWT middleware
│   ├── models/
│   │   ├── User.js
│   │   └── Room.js
│   └── routes/
│       ├── auth.js       # POST /api/auth/register, /login, GET /me
│       ├── rooms.js      # CRUD /api/rooms
│       └── execute.js    # POST /api/execute
└── src/
    ├── main.jsx
    ├── App.jsx
    ├── Editor.jsx         # Monaco + Yjs binding
    ├── api/               # Axios instance
    ├── context/
    │   └── AuthContext.jsx
    ├── pages/
    │   ├── Dashboard.jsx  # Room list, create, join
    │   ├── Room.jsx       # Main editor view
    │   ├── Login.jsx
    │   └── Register.jsx
    ├── components/
    │   ├── ActivityBar.jsx
    │   ├── Sidebar.jsx
    │   ├── TabBar.jsx
    │   ├── StatusBar.jsx
    │   ├── Panel.jsx
    │   ├── ChatPanel.jsx
    │   ├── UsersPanel.jsx
    │   ├── LobbyOverlay.jsx
    │   ├── JoinRequestToast.jsx
    │   ├── CommentPopover.jsx
    │   └── panel/
    │       ├── OutputTab.jsx
    │       ├── TerminalTab.jsx
    │       ├── LogsTab.jsx
    │       ├── DebugConsoleTab.jsx
    │       ├── ProblemsTab.jsx
    │       └── PortsTab.jsx
    └── utils/
        └── fileTypes.js
```

## Getting Started

### Prerequisites

- Node.js 18+
- MongoDB (optional — the server runs without it using in-memory storage)
- A Judge0 RapidAPI key (optional — only needed for TypeScript, Go, Rust, Java, C++, C#, SQL execution)

### Installation

```bash
git clone <repo-url>
cd coda
npm install
```

### Configuration

Copy the example environment file and fill in your values:

```bash
cp .env.example .env
```

```env
PORT=3001
MONGODB_URI=mongodb://localhost:27017/coda
JWT_SECRET=change_this_to_a_long_random_secret_string

# Optional — enables execution for TS, Go, Rust, Java, C++, C#, SQL
# Free tier: https://rapidapi.com/judge0-official/api/judge0-ce
JUDGE0_API_KEY=your_rapidapi_key_here
```

`JWT_SECRET` should be a long random string in production. MongoDB and Judge0 are both optional.

### Running in Development

```bash
npm run dev
```

This starts two processes concurrently:

| Process | URL |
|---|---|
| Vite dev server (React) | http://localhost:5173 |
| Express + WebSocket server | http://localhost:3001 |

The Vite server proxies `/api`, `/ws`, `/terminal`, and `/lobby` to port 3001, so you only need to open `localhost:5173`.

### Production Build

```bash
npm run build      # compiles React into dist/
npm run preview    # serves the built output locally
```

For production, serve the `dist/` directory from Express (or a static host) and set the environment variables on the server process.

## API Reference

All routes except auth require a `Authorization: Bearer <token>` header.

### Auth

| Method | Path | Body | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | `{ username, email, password }` | Create account, returns `{ token, user }` |
| `POST` | `/api/auth/login` | `{ email, password }` | Sign in, returns `{ token, user }` |
| `GET` | `/api/auth/me` | — | Returns current user |

### Rooms

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/rooms` | List rooms created by the authenticated user |
| `POST` | `/api/rooms` | Create a room `{ name, language, isPublic }` |
| `GET` | `/api/rooms/:id` | Get room by ID |
| `PATCH` | `/api/rooms/:id` | Update `name` or `language` (owner only) |
| `DELETE` | `/api/rooms/:id` | Delete room (owner only) |

### Code Execution

| Method | Path | Body | Description |
|---|---|---|---|
| `POST` | `/api/execute` | `{ code, language, stdin }` | Run code; returns `{ stdout, stderr, status, time }` |

**Locally executed** (no API key needed): `javascript`, `python`, `bash`

**Via Judge0** (requires `JUDGE0_API_KEY`): `typescript`, `go`, `rust`, `java`, `cpp`, `c`, `csharp`, `sql`

### WebSocket Endpoints

| Path | Auth | Description |
|---|---|---|
| `/ws/:roomId?token=JWT` | Required | Yjs CRDT sync for the editor document |
| `/lobby/:roomId?token=JWT` | Required | Room access approval channel |
| `/terminal?token=JWT` | Required | PTY terminal session |

## Editor UI

The editor layout mirrors VS Code:

```
┌─────────────────────────────────────────────────────┐
│  Title Bar                          [Run]  [Share]  │
├────┬────────────────────────────────────────────────┤
│    │  Tab Bar  [file.js ×]                          │
│ A  ├────────────────────────────────────────────────┤
│ c  │                                                │
│ t  │  S  Monaco Editor                              │
│ i  │  i                                             │
│ v  │  d                                             │
│ i  │  e                                             │
│ t  │  b                                             │
│ y  │  a                                             │
│    │  r                                             │
│ B  ├────────────────────────────────────────────────┤
│ a  │  Panel (Output / Terminal / Logs / Problems)   │
│ r  ├────────────────────────────────────────────────┤
│    │  Status Bar  ● Connected  2 users  JS  Ln1 Col1│
└────┴────────────────────────────────────────────────┘
```

**Activity bar panels:** Explorer (room info + file tree + language switcher), Users (live presence), Chat, Run

## Lobby System

When a user navigates to a room they did not create, they connect to the `/lobby/:roomId` WebSocket and wait for approval. The room creator sees a toast notification and can approve or reject the request. If the creator is offline, guests are auto-approved. Once approved, the guest's user ID is added to an in-memory allowlist and they are granted access to the Yjs WebSocket.

## Storage Modes

The server detects MongoDB availability at startup:

- **MongoDB connected** — all users and rooms persist across restarts
- **MongoDB unavailable** — data is stored in-memory Maps for the lifetime of the server process; no data survives a restart

No code changes are needed to switch between modes.

## Supported Languages

| Language | Execution | Monaco syntax |
|---|---|---|
| JavaScript | Local | ✓ |
| Python | Local | ✓ |
| Bash | Local (Linux/macOS) | ✓ |
| TypeScript | Judge0 | ✓ |
| Go | Judge0 | ✓ |
| Rust | Judge0 | ✓ |
| Java | Judge0 | ✓ |
| C++ | Judge0 | ✓ |
| C | Judge0 | ✓ |
| C# | Judge0 | ✓ |
| SQL | Judge0 | ✓ |
| HTML, CSS, JSON, YAML, Markdown | Syntax only | ✓ |
