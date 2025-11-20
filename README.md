# n8n Dashboard Backend

Backend API server for the n8n Agent Dashboard, providing secure REST API endpoints, real-time log streaming via Server-Sent Events, and webhook integration with n8n workflows.

## Features

- 🔐 **JWT Authentication** - Secure token-based authentication
- 🚀 **Agent Management** - CRUD operations for n8n workflow agents
- 📊 **Real-time Logging** - SSE-based log streaming from n8n workflows
- 📝 **Forms Integration** - Support, contact, and change request forms with n8n webhook forwarding
- 📈 **Dashboard Statistics** - Aggregated metrics and analytics
- 🔒 **Security** - Helmet, CORS, rate limiting, XSS protection
- 💾 **Neon DB (PostgreSQL)** - Serverless PostgreSQL database
- ⚡ **Redis Caching** - Fast caching layer for improved performance

## Tech Stack

- **Runtime**: Node.js 18+ with TypeScript
- **Framework**: Express.js
- **Database**: Neon DB (Serverless PostgreSQL)
- **Cache**: Redis
- **Validation**: Zod
- **Authentication**: JWT (jsonwebtoken)
- **Security**: Helmet, bcrypt, sanitize-html
- **Logging**: Winston
- **n8n Integration**: Axios for webhooks, EventSource for SSE

## Prerequisites

- Node.js 18 or higher
- Neon DB account and database ([neon.tech](https://neon.tech))
- Redis instance (local or cloud)
- n8n instance with webhooks configured

## Getting Started

### 1. Environment Setup

Copy the example environment file and fill in your configuration:

```bash
cp .env.example .env
```

Edit `.env` and configure:
- `DATABASE_URL` - Your Neon DB connection string
- `REDIS_URL` - Your Redis connection URL
- `JWT_SECRET` - Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- `N8N_BASE_URL` - Your n8n instance URL
- `N8N_WEBHOOK_DOMAIN_WHITELIST` - Allowed webhook domains
- Other settings as needed

### 2. Install Dependencies

```bash
npm install
```

### 3. Start Development Server

```bash
npm run dev
```

The server will start on `http://localhost:3001`.

### 4. Production Build

```bash
npm run build
npm start
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login and get JWT token
- `GET /api/auth/validate` - Validate token and get user data
- `POST /api/auth/logout` - Logout (client-side token removal)

### Agents
- `GET /api/agents` - Get all agents
- `POST /api/agents` - Create new agent
- `GET /api/agents/:id` - Get agent by ID
- `PUT /api/agents/:id` - Update agent
- `DELETE /api/agents/:id` - Delete agent
- `POST /api/agents/:id/trigger` - Trigger agent manually
- `POST /api/agents/:id/stop` - Stop running agent

### Logs
- `GET /api/logs/sessions` - Get all log sessions
- `GET /api/logs/sessions/:id` - Get session with logs
- `DELETE /api/logs/sessions/:id` - Delete log session

### SSE (Real-time)
- `GET /api/sse/stream/:sessionId` - Stream logs via Server-Sent Events

### Forms
- `POST /api/forms/support` - Submit support request
- `POST /api/forms/contact` - Submit contact form  
- `POST /api/forms/request-change` - Submit change request

### Statistics
- `GET /api/stats/dashboard` - Get dashboard statistics
- `GET /api/stats/support-usage` - Get support usage stats

### Health Check
- `GET /api/health` - Server health and connectivity status

## Architecture

```
backend/
├── src/
│   ├── config/         # Database, Redis, environment configuration
│   ├── controllers/    # Request handlers
│   ├── middleware/     # Auth, validation, security, rate limiting
│   ├── routes/         # API route definitions
│   ├── services/       # Business logic (agents, n8n, SSE, cache)
│   ├── types/          # TypeScript interfaces and Zod schemas
│   ├── utils/          # Helpers (logger, encryption, validators)
│   ├── app.ts          # Express app configuration
│   └── server.ts       # Server entry point
```

## Security

- **JWT Tokens**: 12-hour expiration, HS256 algorithm
- **Password Hashing**: bcrypt with 12 rounds
- **Rate Limiting**: 
  - General API: 100 req/15min
  - Authentication: 5 req/15min
  - Forms: Plan-based (10/week for free, unlimited for pro/enterprise)
- **CORS**: Whitelist-based origin checking
- **XSS Protection**: HTML sanitization on all inputs
- **Helmet**: Security headers (CSP, HSTS, etc.)
- **Webhook Validation**: Domain whitelist enforcement

## Database Schema

The backend automatically creates the following tables:
- `users` - User accounts and plan information
- `agents` - n8n workflow agents
- `log_sessions` - Terminal/log sessions
- `log_entries` - Individual log messages
- `support_requests` - Support form submissions
- `contact_submissions` - Contact form submissions

## Development

### Scripts

```bash
npm run dev          # Start development server with hot reload
npm run build        # Build TypeScript to JavaScript
npm start            # Start production server
npm test             # Run tests
npm run lint         # Run ESLint
npm run format       # Format code with Prettier
```

### Testing

```bash
# Run all tests
npm test

# Run integration tests
npm run test:integration

# Watch mode
npm run test:watch
```

## Deployment

### PM2 (Production)

```bash
npm install -g pm2
npm run build
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### Docker (Optional)

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
CMD ["node", "dist/server.js"]
```

## Environment Variables

See `.env.example` for full list of configuration options.

Key variables:
- `DATABASE_URL` - Neon DB connection string (required)
- `REDIS_URL` - Redis connection URL (required)
- `JWT_SECRET` - Secret for signing JWTs (required)
- `N8N_BASE_URL` - n8n instance URL (required)
- `CORS_ORIGIN` - Allowed frontend origins (required)

## Troubleshooting

### Database Connection Issues
- Verify your Neon DB connection string includes `?sslmode=require`
- Check firewall/network settings
- Ensure database user has proper permissions

### Redis Connection Issues
- Verify Redis is running: `redis-cli ping`
- Check REDIS_URL format: `redis://username:password@host:port`

### n8n Integration Issues
- Ensure webhook URLs are whitelisted in `N8N_WEBHOOK_DOMAIN_WHITELIST`
- Verify n8n workflows return `{ "sseUrl": "..." }` in webhook response
- Check n8n instance is reachable from backend

## License

MIT

## Support

For issues or questions:
- Create an issue on GitHub
- Submit a support request via the dashboard
- Contact: admin@nexdevs.com
