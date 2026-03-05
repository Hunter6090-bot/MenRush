# Near&Now - Location-Based Social Discovery Platform

A modern, full-stack MVP for discovering and messaging people nearby in real-time.

## 🚀 Features

- **User Authentication**: Secure registration and login with JWT tokens
- **Location-Based Discovery**: Find users within 5km using PostGIS geolocation
- **Real-time Messaging**: Socket.io powered instant messaging
- **Online Status**: See who's online and when they were last active
- **User Profiles**: Complete profiles with photos, bio, age, and distance
- **Mobile-First Design**: Responsive TailwindCSS UI

## 🏗️ Tech Stack

### Backend
- **Node.js + Express** - REST API
- **TypeScript** - Type safety
- **PostgreSQL + PostGIS** - Geospatial database
- **Socket.io** - Real-time communication
- **JWT** - Authentication
- **Bcryptjs** - Password hashing
- **Zod** - Input validation

### Frontend
- **React 18** - UI framework
- **Vite** - Build tool
- **TypeScript** - Type safety
- **TailwindCSS** - Styling
- **TanStack Query** - API state management
- **Zustand** - Client state
- **Socket.io Client** - Real-time messaging

### Infrastructure
- **Docker & Docker Compose** - Containerization
- **PostgreSQL 16 + PostGIS** - Spatial database
- **Ready for deployment** (Vercel, Railway, Fly.io)

## 📦 Quick Start

### Prerequisites
- Node.js 18+
- Docker & Docker Compose
- Git

### Installing Docker (macOS)

If you don’t have Docker yet:

- **Option A – Docker Desktop (recommended)**  
  Download and install from [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/), then open Docker Desktop once so the engine is running.

- **Option B – Homebrew**  
  ```bash
  brew install --cask docker
  ```  
  Then open **Docker** from Applications so the engine starts.

After installation, run `docker compose version` (or `docker-compose version`) to confirm it works.

### 1. Clone & Setup

```bash
cd NearNow
cp .env.example .env
```

### 2. Start with Docker

Make sure Docker Desktop (or the Docker engine) is running, then from the project root:

```bash
docker compose up --build
```

(You can use `docker-compose` instead of `docker compose` if you have the older standalone binary.)

No `.env` file is required for this—Compose injects `DATABASE_URL`, `JWT_SECRET`, etc. into the backend container.

This starts:
- PostgreSQL with PostGIS on port 5432
- Backend API on port 3000
- Database automatically initialized with schema

### 3. Start Frontend (in another terminal)

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on http://localhost:5173

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Sign in

### Users
- `GET /api/users/nearby?lat=X&lng=Y&radius=5` - Nearby users
- `GET /api/users/profile/:id` - User profile
- `POST /api/users/location` - Update location
- `POST /api/users/profile` - Update profile

### Messages
- `POST /api/messages` - Send message
- `GET /api/messages/conversation/:otherId` - Get chat
- `GET /api/messages/conversations` - List chats

## 🔐 Security Features

- ✅ Bcrypt password hashing
- ✅ JWT authentication
- ✅ Input validation with Zod
- ✅ Message sanitization
- ✅ CORS protection
- ✅ SQL injection prevention (parameterized queries)

## 📊 Database Schema

### Users Table
```sql
id (UUID)
email (UNIQUE)
password_hash
name
age
bio
photo_url
created_at
```

### Profiles Table (with geolocation)
```sql
id (UUID)
user_id (FK to users)
location (GEOGRAPHY - PostGIS)
lat, lng (DECIMAL)
online (BOOLEAN)
last_seen (TIMESTAMP)
```

### Messages Table
```sql
id (UUID)
sender_id, receiver_id (FK to users)
message (TEXT)
read (BOOLEAN)
created_at (TIMESTAMP)
```

## 🎯 Geospatial Query Example

```sql
SELECT * FROM profiles
WHERE ST_DWithin(
  location,
  ST_MakePoint(:lng,:lat)::geography,
  5000  -- 5km in meters
)
AND online = true
ORDER BY last_seen DESC
```

## 🚀 Deployment

### Backend (Railway/Fly.io)
```bash
# Build image
docker build -t nearnow-backend ./backend

# Push to registry and deploy
```

### Frontend (Vercel)
```bash
vercel --prod
```

## 📝 Environment Variables

```
DATABASE_URL=postgresql://user:pass@host:5432/nearnow
JWT_SECRET=your-secret-key
PORT=3000
NODE_ENV=production
FRONTEND_URL=https://yourdomain.com
```

## 🧪 Testing

### Create Test Users
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user1@example.com",
    "password": "password123",
    "name": "Alice",
    "age": 25
  }'
```

### Get Nearby Users
```bash
curl http://localhost:3000/api/users/nearby?lat=40.7128&lng=-74.0060&radius=5 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 🛠️ Development

### Backend Development
```bash
cd backend
npm install
npm run dev  # Runs with ts-node
```

### Frontend Development
```bash
cd frontend
npm install
npm run dev
```

### Database Migrations
```bash
docker-compose exec postgres psql -U nearnow -d nearnow < database/schema.sql
```

## 📚 Project Structure

```
NearNow/
├── backend/
│   ├── src/
│   │   ├── server.ts (Main app)
│   │   ├── db.ts (Database connection)
│   │   ├── routes/ (API routes)
│   │   ├── services/ (Business logic)
│   │   ├── middleware/ (Auth, error handling)
│   │   └── types/ (TypeScript types & validation)
│   ├── package.json
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── App.tsx (Main component)
│   │   ├── pages/ (Page components)
│   │   ├── components/ (Reusable components)
│   │   ├── api/ (API client)
│   │   ├── hooks/ (Custom hooks & stores)
│   │   └── styles/ (Global CSS)
│   ├── package.json
│   └── index.html
├── database/
│   └── schema.sql (Database initialization)
├── docker-compose.yml (Container orchestration)
└── README.md
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

MIT - See LICENSE file

## ✨ Next Steps for Production

- [ ] Add email verification
- [ ] Implement user blocking/reporting
- [ ] Add photo upload to S3/Cloudinary
- [ ] Implement pagination for nearby users
- [ ] Add typing indicators
- [ ] Message read receipts
- [ ] User ratings/reviews
- [ ] Push notifications
- [ ] Add payment processing (Stripe)
- [ ] Implement user matching preferences
- [ ] Analytics dashboard
- [ ] Admin panel

## 🐛 Issues & Support

Found a bug? Have a suggestion? Open an issue!

---

**Built with ❤️ for connecting people nearby**
