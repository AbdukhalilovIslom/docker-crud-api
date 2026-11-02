import express, { Request, Response, NextFunction } from 'express';
import swaggerUi from 'swagger-ui-express';
import { randomUUID } from 'node:crypto';

const app = express();
const PORT = Number(process.env.PORT ?? 3000);

app.use(express.json({ limit: '1mb' }));

// Simple request logger: useful when inspecting `docker logs`.
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.originalUrl}`);
  next();
});

// Basic in-memory rate limiter for learning API protection.
// Allows 100 requests per client IP in each 15-minute window.
const requestCounts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 100;
const RATE_WINDOW_MS = 15 * 60 * 1000;

app.use((req: Request, res: Response, next: NextFunction) => {
  const key = req.ip || 'unknown';
  const now = Date.now();
  let record = requestCounts.get(key);

  if (!record || now >= record.resetAt) {
    record = { count: 0, resetAt: now + RATE_WINDOW_MS };
    requestCounts.set(key, record);
  }

  record.count += 1;
  res.setHeader('X-RateLimit-Limit', RATE_LIMIT);
  res.setHeader('X-RateLimit-Remaining', Math.max(0, RATE_LIMIT - record.count));
  res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetAt / 1000));

  if (record.count > RATE_LIMIT) {
    return res.status(429).json({
      error: 'Too many requests',
      message: 'Please try again later.',
    });
  }

  return next();
});

type Task = {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
};

// In-memory storage: data resets when the container restarts.
const tasks: Task[] = [];

const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'Docker CRUD Practice API',
    version: '1.1.0',
    description: 'A REST API for practicing TypeScript, Docker, CRUD, filtering, pagination and API documentation.',
  },
  servers: [{ url: `http://localhost:${PORT}`, description: 'Local server' }],
  tags: [
    { name: 'General', description: 'API status and statistics' },
    { name: 'Tasks', description: 'CRUD operations for tasks' },
  ],
  paths: {
    '/': {
      get: {
        tags: ['General'],
        summary: 'API welcome endpoint',
        responses: { '200': { description: 'API information' } },
      },
    },
    '/health': {
      get: {
        tags: ['General'],
        summary: 'Check API health',
        responses: { '200': { description: 'API is running' } },
      },
    },
    '/api/stats': {
      get: {
        tags: ['General'],
        summary: 'Get task statistics',
        responses: { '200': { description: 'Task totals and completion rate' } },
      },
    },
    '/api/tasks': {
      get: {
        tags: ['Tasks'],
        summary: 'Get tasks with optional filtering and pagination',
        parameters: [
          { name: 'completed', in: 'query', schema: { type: 'boolean' }, description: 'Filter by completion status' },
          { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Search in task titles' },
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 10 } },
        ],
        responses: {
          '200': {
            description: 'Paginated task list',
            content: { 'application/json': { schema: { type: 'object' } } },
          },
        },
      },
      post: {
        tags: ['Tasks'],
        summary: 'Create a task',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateTask' } } },
        },
        responses: {
          '201': { description: 'Task created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Task' } } } },
          '400': { description: 'Invalid request body' },
        },
      },
    },
    '/api/tasks/bulk': {
      patch: {
        tags: ['Tasks'],
        summary: 'Update completion status for multiple tasks',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  ids: { type: 'array', items: { type: 'string', format: 'uuid' }, minItems: 1 },
                  completed: { type: 'boolean' },
                },
                required: ['ids', 'completed'],
              },
            },
          },
        },
        responses: {
          '200': { description: 'Bulk update result' },
          '400': { description: 'Invalid request body' },
        },
      },
    },
    '/api/tasks/completed': {
      delete: {
        tags: ['Tasks'],
        summary: 'Delete all completed tasks',
        responses: { '200': { description: 'Number of deleted tasks' } },
      },
    },
    '/api/tasks/{id}': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
      get: {
        tags: ['Tasks'],
        summary: 'Get a task by ID',
        responses: {
          '200': { description: 'Task found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Task' } } } },
          '404': { description: 'Task not found' },
        },
      },
      patch: {
        tags: ['Tasks'],
        summary: 'Update a task',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateTask' } } },
        },
        responses: {
          '200': { description: 'Task updated' },
          '400': { description: 'Invalid request body' },
          '404': { description: 'Task not found' },
        },
      },
      delete: {
        tags: ['Tasks'],
        summary: 'Delete a task',
        responses: { '204': { description: 'Task deleted' }, '404': { description: 'Task not found' } },
      },
    },
  },
  components: {
    schemas: {
      Task: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          title: { type: 'string', example: 'Learn Docker layers' },
          completed: { type: 'boolean', example: false },
          createdAt: { type: 'string', format: 'date-time' },
        },
        required: ['id', 'title', 'completed', 'createdAt'],
      },
      CreateTask: {
        type: 'object',
        properties: { title: { type: 'string', example: 'Learn Docker' } },
        required: ['title'],
      },
      UpdateTask: {
        type: 'object',
        properties: {
          title: { type: 'string', example: 'Learn Docker Compose' },
          completed: { type: 'boolean', example: true },
        },
        minProperties: 1,
      },
    },
  },
};

// Root endpoint
app.get('/', (_req: Request, res: Response) => {
  res.json({
    name: 'Docker CRUD Practice API',
    version: '1.1.0',
    documentation: '/docs',
    health: '/health',
    endpoints: ['/api/tasks', '/api/stats'],
  });
});

// Liveness check
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// Task statistics
app.get('/api/stats', (_req: Request, res: Response) => {
  const total = tasks.length;
  const completed = tasks.filter((task) => task.completed).length;
  const pending = total - completed;

  res.json({
    total,
    completed,
    pending,
    completionRate: total === 0 ? 0 : Math.round((completed / total) * 100),
  });
});

// List, search, filter and paginate tasks
app.get('/api/tasks', (req: Request, res: Response) => {
  const search = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';
  const completedQuery = req.query.completed;
  const page = Math.max(1, Number.parseInt(String(req.query.page ?? '1'), 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(String(req.query.limit ?? '10'), 10) || 10));

  let result = [...tasks];

  if (completedQuery === 'true' || completedQuery === 'false') {
    result = result.filter((task) => task.completed === (completedQuery === 'true'));
  }

  if (search) {
    result = result.filter((task) => task.title.toLowerCase().includes(search));
  }

  const total = result.length;
  const start = (page - 1) * limit;
  const data = result.slice(start, start + limit);

  res.json({
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// Create a task
app.post('/api/tasks', (req: Request, res: Response) => {
  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';

  if (!title) {
    return res.status(400).json({ error: 'title is required and must be a non-empty string' });
  }

  if (title.length > 120) {
    return res.status(400).json({ error: 'title must be 120 characters or fewer' });
  }

  const task: Task = {
    id: randomUUID(),
    title,
    completed: false,
    createdAt: new Date().toISOString(),
  };

  tasks.push(task);
  return res.status(201).json(task);
});

// Update completion status for multiple tasks at once.
app.patch('/api/tasks/bulk', (req: Request, res: Response) => {
  const { ids, completed } = req.body ?? {};

  if (!Array.isArray(ids) || ids.length === 0 || !ids.every((id) => typeof id === 'string')) {
    return res.status(400).json({ error: 'ids must be a non-empty array of strings' });
  }
  if (typeof completed !== 'boolean') {
    return res.status(400).json({ error: 'completed must be a boolean' });
  }

  const requestedIds = new Set(ids);
  let updated = 0;

  for (const task of tasks) {
    if (requestedIds.has(task.id)) {
      task.completed = completed;
      updated += 1;
    }
  }

  return res.json({
    requested: requestedIds.size,
    updated,
    notFound: requestedIds.size - updated,
  });
});

// Delete all completed tasks.
app.delete('/api/tasks/completed', (_req: Request, res: Response) => {
  const before = tasks.length;
  const remainingTasks = tasks.filter((task) => !task.completed);
  const deleted = before - remainingTasks.length;

  tasks.splice(0, tasks.length, ...remainingTasks);
  return res.json({ deleted });
});

// Get one task
app.get('/api/tasks/:id', (req: Request, res: Response) => {
  const task = tasks.find((item) => item.id === req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  return res.json(task);
});

// Update a task
app.patch('/api/tasks/:id', (req: Request, res: Response) => {
  const task = tasks.find((item) => item.id === req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const { title, completed } = req.body ?? {};

  if (title === undefined && completed === undefined) {
    return res.status(400).json({ error: 'Provide title and/or completed to update' });
  }
  if (title !== undefined && (typeof title !== 'string' || !title.trim())) {
    return res.status(400).json({ error: 'title must be a non-empty string' });
  }
  if (title !== undefined && title.trim().length > 120) {
    return res.status(400).json({ error: 'title must be 120 characters or fewer' });
  }
  if (completed !== undefined && typeof completed !== 'boolean') {
    return res.status(400).json({ error: 'completed must be a boolean' });
  }

  if (title !== undefined) task.title = title.trim();
  if (completed !== undefined) task.completed = completed;

  return res.json(task);
});

// Delete a task
app.delete('/api/tasks/:id', (req: Request, res: Response) => {
  const index = tasks.findIndex((item) => item.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Task not found' });

  tasks.splice(index, 1);
  return res.status(204).send();
});

// Swagger and OpenAPI
app.get('/openapi.json', (_req: Request, res: Response) => res.json(openApiDocument));
app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));

// JSON 404 response for unknown routes
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: `Route ${req.method} ${req.originalUrl} not found` });
});

// Central error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`API is running on http://localhost:${PORT}`);
  console.log(`Swagger docs: http://localhost:${PORT}/docs`);
});

// Graceful shutdown: useful when Docker stops the container.
const shutdown = (signal: string) => {
  console.log(`${signal} received. Shutting down gracefully...`);
  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
