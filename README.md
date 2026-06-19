# Text Editor App

A full-stack collaborative rich-text editor built as a vibe coding assessment.

## Current foundation

- React 19 and TypeScript web application
- TipTap rich-text editor
- Yjs conflict-free collaborative document model
- Hocuspocus WebSocket collaboration server
- Live connection status and collaborative cursor support
- SQLite persistence using Node's built-in SQLite module
- REST API for documents, comments, reviews, and revisions
- Local storage backup and live word/character count
- npm workspaces monorepo

## Monorepo structure

```text
text-editor-app/
├── apps/
│   ├── web/        React, TipTap, Yjs, Hocuspocus provider
│   └── server/     Express API, Hocuspocus server, SQLite
├── packages/
│   └── shared/     Shared types and constants
├── data/           Local SQLite database (generated, ignored)
└── package.json    Workspace scripts
```

## Architecture

```text
Browser
  ├── React + TipTap
  ├── localStorage backup
  ├── REST API ───────────────┐
  └── Yjs over WebSocket ──┐  │
                           │  │
Node.js server             │  │
  ├── Hocuspocus ◀─────────┘  │
  ├── Express ◀───────────────┘
  └── SQLite
```

## Run locally

Requirements:

- Node.js 22 or newer
- npm 10 or newer

```bash
git clone git@github.com:amyao/text-editor-app.git
cd text-editor-app
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

Development services:

- Web app: `http://localhost:5173`
- REST API: `http://localhost:3001`
- Collaboration WebSocket: `ws://localhost:1234`

## Useful commands

```bash
npm run dev          # Start the complete stack
npm run dev:web      # Start only the web app
npm run dev:server   # Start only the API and collaboration server
npm run build        # Build all workspaces
npm run typecheck    # Type-check all workspaces
```

## Planned assessment features

- [x] Text input and display
- [x] Bold, italic, color, font size, lists, and paragraphs
- [x] Clear document content
- [x] Save a local backup
- [x] Live word count
- [x] Real-time collaborative document foundation
- [x] Collaborative cursor foundation
- [x] Comments UI with collaborative anchored text marks
- [ ] Complete review workflow and persistent highlights
- [x] Version history UI, snapshots, and restore
- [ ] Authentication and shareable document links
- [ ] Automated tests
- [ ] README screenshots
