# Docker CRUD Practice API

A small TypeScript + Express REST API for practicing:

- Docker images, containers, ports, and build context
- Dockerfile instructions and layer caching
- REST API fundamentals and CRUD operations
- API documentation with Swagger UI / OpenAPI

The project manages **Tasks**. Data is stored in memory, so it resets whenever the application/container restarts. This is intentional for the first Docker exercise; persistence can be added later with PostgreSQL or a Docker volume.

## Project structure

```text
docker-crud-api/
├── Dockerfile
├── .dockerignore
├── main.ts
├── package.json
├── tsconfig.json
└── README.md
```

## Requirements

- Docker installed and running
- Optional for running without Docker: Node.js 22+

## Run locally (without Docker)

```bash
npm install
npm run dev
```

The API starts at `http://localhost:3000`.

## Build a Docker image

Run this command from the project directory:

```bash
docker build -t crud-practice-api:1.0 .
```

Useful commands to inspect the result:

```bash
docker images
docker image inspect crud-practice-api:1.0
```

## Run a container

```bash
docker run -d --name crud-api -p 3000:3000 crud-practice-api:1.0
```

Open these URLs:

- API health: http://localhost:3000/health
- Swagger UI documentation: http://localhost:3000/docs
- Raw OpenAPI JSON: http://localhost:3000/openapi.json

Check logs and container status:

```bash
docker ps
docker logs crud-api
docker stop crud-api
docker start crud-api
docker rm -f crud-api
```

## CRUD endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/tasks` | Get all tasks |
| POST | `/api/tasks` | Create a task |
| GET | `/api/tasks/:id` | Get one task |
| PATCH | `/api/tasks/:id` | Update title and/or completed |
| DELETE | `/api/tasks/:id` | Delete a task |

### Test with curl

Create a task:

```bash
curl -X POST http://localhost:3000/api/tasks \
  -H 'Content-Type: application/json' \
  -d '{"title":"Learn Docker layers"}'
```

Copy the returned `id` and use it in the following requests.

Get all tasks:

```bash
curl http://localhost:3000/api/tasks
```

Get one task (replace `TASK_ID`):

```bash
curl http://localhost:3000/api/tasks/TASK_ID
```

Update a task:

```bash
curl -X PATCH http://localhost:3000/api/tasks/TASK_ID \
  -H 'Content-Type: application/json' \
  -d '{"completed":true,"title":"Docker CRUD API completed"}'
```

Delete a task:

```bash
curl -i -X DELETE http://localhost:3000/api/tasks/TASK_ID
```

## Docker learning exercises

Try these tasks one by one:

1. Build the image and explain what each Dockerfile instruction does.
2. Run `docker history crud-practice-api:1.0` and inspect the image layers.
3. Change the API response text in `main.ts`, rebuild the image, and observe which layers are reused.
4. Run a second container on another host port: `docker run -d --name crud-api-3001 -p 3001:3000 crud-practice-api:1.0`.
5. Stop and remove the container, then create it again. Notice that in-memory task data is lost.
6. Add a `PUT` endpoint and compare `PUT` with `PATCH`.
7. Add input validation for maximum title length.
8. Add PostgreSQL later, then use Docker Compose to run the API and database together.

## Important concepts

- **Image:** the packaged application and its runtime dependencies.
- **Container:** a running instance of an image.
- **Port mapping:** `-p 3000:3000` maps port 3000 on your machine to port 3000 inside the container.
- **Layer:** Docker caches the result of build instructions. Copying `package.json` before source files helps reuse the dependency-installation layer when only application code changes.
- **Build context:** the `.` at the end of `docker build` means the current directory is sent to Docker as the build context. `.dockerignore` excludes unnecessary files.

## Troubleshooting

**Port 3000 is already in use:** map another host port, for example `-p 3001:3000`, then open `http://localhost:3001/docs`.

**Container exits:** inspect `docker logs crud-api` for the application error.

**Changes do not appear:** rebuild the image and recreate the container:

```bash
docker rm -f crud-api
docker build -t crud-practice-api:1.0 .
docker run -d --name crud-api -p 3000:3000 crud-practice-api:1.0
```
