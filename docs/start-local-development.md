# Local Development Setup

This guide covers running the app natively on macOS with infrastructure services (PostgreSQL, Redis, Mailhog) in Docker.

## Prerequisites

Install the following tools if not already present:

```bash
# Homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# rbenv (Ruby version manager)
brew install rbenv ruby-build
echo 'eval "$(rbenv init -)"' >> ~/.zshrc
source ~/.zshrc

# Ruby 3.4.4
rbenv install 3.4.4
rbenv global 3.4.4

# Node.js v23
brew install node@23

# pnpm
npm install -g pnpm

# overmind (process manager)
brew install overmind
```

Also install **Docker Desktop**: https://www.docker.com/products/docker-desktop/

---

## Step 1 — Create the Docker services file

Create `docker-compose.dev.yml` in the project root:

```yaml
version: '3'

services:
  postgres:
    image: pgvector/pgvector:pg16
    restart: always
    ports:
      - '5432:5432'
    volumes:
      - postgres_dev:/data/postgres
    environment:
      - POSTGRES_DB=chatwoot_development
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=

  redis:
    image: redis:alpine
    restart: always
    ports:
      - '6379:6379'
    volumes:
      - redis_dev:/data/redis

  mailhog:
    image: mailhog/mailhog
    ports:
      - 1025:1025
      - 8025:8025

volumes:
  postgres_dev:
  redis_dev:
```

---

## Step 2 — Start infrastructure services

```bash
docker compose -f docker-compose.dev.yml up -d
```

---

## Step 3 — Configure environment

```bash
cp .env.example .env
```

Edit `.env` with these values:

```bash
SECRET_KEY_BASE=    # generate with: bundle exec rake secret

FRONTEND_URL=http://localhost:3000

POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USERNAME=postgres
POSTGRES_PASSWORD=
RAILS_ENV=development

REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=

SMTP_ADDRESS=localhost
SMTP_PORT=1025
MAILER_SENDER_EMAIL=dev@localhost.com

ENABLE_ACCOUNT_SIGNUP=true
```

---

## Step 4 — Install dependencies

```bash
eval "$(rbenv init -)"

bundle install
pnpm install
```

---

## Step 5 — Set up the database

```bash
bundle exec rails db:create db:schema:load db:seed
```

---

## Step 6 — Start the application

```bash
overmind start -f Procfile.dev
```

This starts all three processes:

| Process | Description |
|---|---|
| `backend` | Rails server on port 3000 |
| `worker` | Sidekiq background job processor |
| `vite` | Vite dev server (hot reload) |

---

## Access points

| Service | URL |
|---|---|
| App | http://localhost:3000 |
| Mailhog UI | http://localhost:8025 |

---

## First login

The seed creates a default Super Admin account:

| Field | Value |
|---|---|
| **Email** | `john@acme.inc` |
| **Password** | `Password1!` |

This user is also an Administrator on the seeded **Acme Inc** account. Login at http://localhost:3000.

---

## Daily workflow

```bash
# Start infrastructure (if not running)
docker compose -f docker-compose.dev.yml up -d

# Start the app
overmind start -f Procfile.dev
```

---

## Useful commands

```bash
bundle exec rails console           # Rails REPL
bundle exec rspec spec/path/file    # Run a spec
pnpm eslint:fix                     # Fix JS lint
bundle exec rubocop -a              # Fix Ruby lint
bundle exec rails db:seed           # Re-seed test data
```
