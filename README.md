# Z-Raiders

A top-down multiplayer zombie survival game. Players connect over WebSocket, fight off zombies and each other on a shared map, and keep a persistent kill score tied to their account.

## Features

- Account creation, login, and email-based password reset
- Real-time multiplayer over WebSocket
- Zombies with pathfinding AI that navigate around buildings
- Ranged weapons (gun, rifle, shotgun, sniper) with magazines and reload, plus a permanent melee knife
- HP bars for players and zombies
- Persistent per-account score and a top-3 leaderboard, shown on the login screen and in-game
- In-game chat
- Volume control, visible on every screen

## Tech stack

- Backend: Node.js, Express, `ws` (WebSocket), PostgreSQL
- Frontend: Phaser 3
- Nginx as a reverse proxy in front of the app
- Docker Compose to run the app, database, and proxy together

## Project structure

```
src/       Backend: server, game loop, message handling, persistence
public/    Frontend: Phaser scene, UI, client-side scripts
```

## Running the project

### With Docker (recommended)

```
cp .env.example .env
docker compose up --build
```

The game is served at `http://localhost:8080`. Without SMTP credentials in `.env`, the app still runs, but password-reset emails won't be sent.

### Without Docker

Requires Node.js and a running PostgreSQL instance.

```
npm install
cp .env.example .env   # point POSTGRES_* at your local database
node src/server.js
```

## Known issues

- Melee hit detection is still client-authoritative and should be moved to the server.

## Roadmap

Longer-term direction for the game, not yet implemented:

- Battle royale mode with a shrinking map
- Player groups/alliances
- Base building with gathered materials (wood, bricks, metal)
- Weapon rarity tiers and attachments (scope, suppressor, grip, extended magazine)
- Additional zombie types with distinct abilities
