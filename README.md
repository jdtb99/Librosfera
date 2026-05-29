# 📚 Librosfera

> A full-stack online bookstore with a complete e-commerce flow, multi-role administration, physical-store inventory, and an AWS cloud-native deployment.

<p align="center">
  <a href="https://d2yi4dc5p43lte.cloudfront.net"><strong>🌐 Live Demo »</strong></a>
</p>

<p align="center">
  <img alt="React" src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white">
  <img alt="Node.js" src="https://img.shields.io/badge/Node.js-22-339933?logo=node.js&logoColor=white">
  <img alt="Express" src="https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white">
  <img alt="MongoDB" src="https://img.shields.io/badge/MongoDB-Atlas-47A248?logo=mongodb&logoColor=white">
  <img alt="AWS" src="https://img.shields.io/badge/AWS-EC2%20·%20S3%20·%20CloudFront-FF9900?logo=amazonaws&logoColor=white">
</p>

---

## Overview

**Librosfera** ("Book-sphere") is a production-style e-commerce platform for a bookstore that operates both online and through physical branches. It covers the full retail lifecycle: catalog browsing, cart, checkout (home delivery **or** in-store pickup with QR codes), payment, order fulfillment, and returns — plus the back-office to run it all.

The project is deployed end-to-end on AWS behind a single HTTPS domain, using private S3 buckets served through CloudFront, an EC2-hosted API, and MongoDB Atlas.

## 🔗 Live demo

**https://d2yi4dc5p43lte.cloudfront.net**

To explore the customer experience, **register a new client account** from the sign-up page — registration is open. The catalog, cart, checkout, store locator, saved cards/addresses, and order history are all available to client accounts.

> Administrator and root dashboards (catalog management, sales, returns, user management, store management) are restricted. Admin demo access is available on request.

---

## ☁️ Cloud architecture

The whole application is served under **one CloudFront distribution** with multiple origins, so the frontend, the API, and user-uploaded images all live on the **same HTTPS domain**. This eliminates CORS entirely and avoids mixed-content issues.

```
                          https://<cloudfront-domain>
                                     │
                        ┌────────────┴────────────┐
                        │      CloudFront (CDN)    │
                        │   HTTPS · edge caching   │
                        └──┬──────────┬─────────┬──┘
              default /*   │   /api/* │         │ /uploads/*
                           ▼          ▼         ▼
                 ┌─────────────┐ ┌─────────┐ ┌──────────────┐
                 │  S3 (OAC)   │ │   EC2   │ │  S3 (OAC)    │
                 │  React SPA  │ │  Nginx  │ │ book images  │
                 │  (private)  │ │  ↓ PM2  │ │  (private)   │
                 └─────────────┘ │ Node API│ └──────────────┘
                                 └────┬────┘
                                      │
                              ┌───────┴───────┐
                              │ MongoDB Atlas │
                              └───────────────┘
```

**Why this design**

| Decision | Reason |
|----------|--------|
| Single multi-origin CloudFront distribution | One HTTPS domain → no CORS, frontend uses relative API paths |
| Private S3 buckets + **OAC** (Origin Access Control) | Buckets are never public; only CloudFront can read them |
| CloudFront in front of the EC2 API | Provides HTTPS to an HTTP-only origin without managing certificates on a raw IP |
| Path-based routing (`/api/*`, `/uploads/*`, `/*`) | API is never cached; images and the SPA are cached at the edge |
| SPA fallback via custom error responses (403/404 → `index.html`) | Client-side routes resolve correctly on direct access/refresh |
| Dedicated IAM user with least-privilege policy | The API can only `Put/Get/Delete` objects in the uploads bucket — nothing else |
| PM2 + Nginx reverse proxy on EC2 | App stays up across reboots; backend port is never exposed publicly |

---

## ✨ Features

### Storefront (clients)
- Catalog with full-text **search, autocomplete, fuzzy search**, featured titles, and discounts
- Personalized **recommendations**
- Shopping cart with real-time stock reservation
- Checkout with **home delivery** or **in-store pickup (QR code)**
- Saved **payment cards** and **shipping addresses**
- Order history, order detail, and **returns** requests
- In-app **messaging** with the store
- Password recovery via email

### Back-office (administrator / root)
- **Book management**: CRUD, multi-image upload, copies/inventory, discounts
- **Sales** dashboard with shipping-status updates and internal notes
- **Returns** management with automated expiry jobs
- **User management** (root can create administrators)
- **Physical-store management** with an interactive **map (Leaflet)**, per-store inventory, and **stock transfers** between branches
- **Messaging** center and statistics dashboards
- **Activity logging** across the system

### Platform
- **Role-based access control**: `cliente`, `administrador`, `root`
- **JWT authentication** with bcrypt password hashing
- **Scheduled jobs** (node-cron) for expired returns and file cleanup
- **Interactive API docs** via Swagger UI (`/api-docs`)
- Security middleware: Helmet, CORS, rate limiting, input validation

---

## 🛠️ Tech stack

**Frontend**
- React 19, React Router 7
- Axios, Tailwind CSS, lucide-react, react-toastify
- Leaflet (store maps), client-side image caching (IndexedDB)

**Backend**
- Node.js, Express 4
- MongoDB + Mongoose 8
- JSON Web Tokens + bcryptjs
- Multer + AWS SDK v3 (S3 uploads)
- Nodemailer (transactional email), node-cron (jobs)
- Helmet, CORS, express-rate-limit, express-validator
- QRCode (pickup codes), Swagger (API docs)
- Jest + Supertest (tests)

**Infrastructure**
- AWS EC2 (Amazon Linux 2023), Nginx, PM2
- AWS S3 (frontend + uploads, private with OAC)
- AWS CloudFront (single multi-origin distribution, HTTPS)
- AWS IAM (least-privilege policies)
- MongoDB Atlas

---

## 🚀 Local development

### Prerequisites
- Node.js 18+
- A MongoDB connection string (Atlas or local)
- (Optional) An AWS S3 bucket + IAM credentials for image uploads

### 1. Clone
```bash
git clone https://github.com/jdtb99/Librosfera.git
cd Librosfera
```

### 2. Backend
```bash
cd Backend
npm install
cp .env.example .env   # then fill in the values
npm run dev            # http://localhost:5000
```

Required environment variables (see `Backend/.env.example`):

| Variable | Description |
|----------|-------------|
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` / `JWT_EXPIRE` | Auth token signing secret / lifetime |
| `EMAIL_USER` / `EMAIL_PASSWORD` | SMTP credentials for transactional email |
| `AWS_REGION` / `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | AWS credentials for S3 |
| `AWS_S3_UPLOADS_BUCKET` | Bucket name for book images |
| `CLOUDFRONT_URL` | CDN base URL used to build public image URLs |
| `FRONT_URL` / `BASE_URL` | Frontend and backend base URLs |

On first run, a default **root** user is seeded automatically (see `Backend/Database/scripts/initRootUser.js`).

### 3. Frontend
```bash
cd Frontend/login-app
npm install
# create .env with: REACT_APP_API_URL=http://localhost:5000
npm start              # http://localhost:3000
```

### API documentation
With the backend running, open **http://localhost:5000/api-docs** for the interactive Swagger UI.

---

## 📁 Project structure

```
Librosfera/
├── Backend/
│   ├── src/
│   │   ├── controllers/      # request handlers
│   │   ├── routes/           # API routes (/api/v1/...)
│   │   ├── middleware/       # auth, uploads (S3), validation
│   │   ├── utils/            # s3Client, email, helpers
│   │   └── server.js         # entry point
│   └── Database/
│       ├── models/           # Mongoose schemas
│       ├── services/         # business logic
│       └── scripts/          # seeders & maintenance jobs
└── Frontend/
    └── login-app/
        └── src/components/   # React views & UI components
```

---

## 🧠 Engineering highlights

- **Stateless, cloud-native file handling** — book images stream from the HTTP request straight to S3 (no local disk), so the API stays horizontally scalable.
- **Atomic checkout** — sales are created inside a MongoDB transaction (cart conversion, inventory decrement, cart cleanup), with side-effects (pickup record, confirmation email) deferred until after commit.
- **Same-origin architecture** — relative API paths + a single CloudFront domain remove the need for any CORS configuration in production.
- **Least-privilege security** — the runtime IAM user is scoped to a single bucket; buckets remain private and are reachable only through CloudFront OAC.

---

## 📄 License

This project is part of a personal portfolio. All rights reserved.
