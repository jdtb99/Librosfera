# 📚 Librosfera — AWS Cloud Infrastructure Case Study

> End-to-end cloud infrastructure for a full-stack e-commerce platform: designed, deployed, and operated on AWS using Terraform (IaC), with a focus on security hardening, cost optimization, and production troubleshooting — not just "it runs on AWS."

<p align="center">
  <a href="https://d2yi4dc5p43lte.cloudfront.net"><strong>🌐 Live Demo »</strong></a> ·
  <a href="./infra"><strong>📦 Terraform code »</strong></a>
</p>

<p align="center">
  <img alt="AWS SAA" src="https://img.shields.io/badge/AWS%20Certified-Solutions%20Architect%20Associate-FF9900?logo=amazonaws&logoColor=white">
  <img alt="Terraform" src="https://img.shields.io/badge/Terraform-IaC-7B42BC?logo=terraform&logoColor=white">
  <img alt="AWS" src="https://img.shields.io/badge/AWS-EC2%20·%20S3%20·%20CloudFront%20·%20IAM-FF9900?logo=amazonaws&logoColor=white">
  <img alt="Linux" src="https://img.shields.io/badge/Linux-Amazon%20Linux%202023-FCC624?logo=linux&logoColor=black">
  <img alt="Nginx" src="https://img.shields.io/badge/Nginx-reverse%20proxy-009639?logo=nginx&logoColor=white">
</p>

---

## Overview

**Librosfera** is a production-style bookstore e-commerce application (React + Node.js + MongoDB) that I use as a **realistic workload to build and operate real AWS infrastructure** — not a toy demo. The application code exists to give the infrastructure something real to serve: user uploads that need secure storage, an API that needs to be reachable but not exposed, static assets that need to be cached globally, and a system that needs to go up and down without breaking.

Everything below the application layer — the architecture, the security posture, the cost model, the automation, and the operational runbooks — is my own design and work, done as hands-on practice for cloud support / cloud infrastructure engineering roles, aligned with the AWS Certified Solutions Architect – Associate certification.

## 🔗 Live demo

**https://d2yi4dc5p43lte.cloudfront.net**

> The backend runs on an on-demand EC2 instance that is normally **stopped to avoid idle cost** (see [Cost optimization](#-cost-optimization) below) and started for demos/testing. If the live link doesn't load the catalog, the instance is simply off — ask and I'll bring it up.

---

## ☁️ Cloud architecture

Everything is served under **one CloudFront distribution** with multiple origins, so the frontend, the API, and user-uploaded images all live on the **same HTTPS domain** — no CORS, no mixed content, no public backend.

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
                                      │ IAM instance role (no static keys)
                              ┌───────┴───────┐
                              │ MongoDB Atlas │
                              └───────────────┘
```

| Decision | Reason |
|----------|--------|
| Single multi-origin CloudFront distribution | One HTTPS domain → no CORS, no backend TLS cert to manage on a raw IP |
| Private S3 buckets + **Origin Access Control (OAC)** | Buckets are never public; only CloudFront can read them |
| Path-based routing (`/api/*`, `/uploads/*`, `/*`) | API traffic is never cached; images and the SPA are cached at the edge |
| EC2 instance role instead of static IAM keys | The backend authenticates to S3 with no long-lived credentials anywhere |
| Security Group restricted to a single source IP for SSH | No inbound management port open to the internet |
| PM2 + Nginx reverse proxy on Amazon Linux 2023 | App survives reboots; the Node process port is never exposed directly |

---

## Infrastructure as Code (Terraform)

All of the above is codified in [`infra/`](./infra) — not written from scratch against an empty account, but built to **model infrastructure that already existed** (it was first provisioned by hand to learn the console), then reconciled into Terraform state with `terraform import`, validating every plan to make sure nothing would be destroyed or recreated unintentionally before applying anything.

- **State ownership without starting over** — every resource (both S3 buckets with their policies/encryption/public-access-block config, the CloudFront distribution, the EC2 instance, its Security Group, and the IAM role) was imported into Terraform, not rebuilt.
- **Decoupled lifecycle** — the ephemeral compute layer (`module.compute`: EC2 + Security Group) is intentionally isolated from the persistent layer (S3, CloudFront, IAM) in the dependency graph. `terraform destroy -target=module.compute` tears down *only* the instance and its SG — CloudFront keeps serving the frontend and images — and `terraform apply -target=module.compute` brings it back. Getting this right required removing a stale dependency Terraform had recorded in state from an earlier design (a good example of why `terraform plan` output can't always be trusted at face value — the state's internal dependency graph had to be inspected directly and corrected with `state rm` / re-`import`).
- **Cost-aware by default** — `create_eip` is a toggle: `false` (the default) means the instance gets a free ephemeral public IP that costs nothing while stopped, instead of an Elastic IP that bills even when idle.
- **No console drift** — `terraform plan` against the live account reports zero differences; the account state and the code are kept in sync as the single source of truth.

---

##  Security hardening

A few concrete fixes made during this project, not just a checklist:

- **Found and fixed a public-access leak**: the frontend S3 bucket had a legacy bucket-policy statement granting public read access directly, bypassing CloudFront/OAC entirely. Removed it and re-verified that only the CloudFront service principal (scoped to the distribution's ARN) can read the bucket.
- **Eliminated static AWS credentials from the backend**: migrated the API from a long-lived IAM user access key stored in `.env` to an **EC2 instance profile / IAM role**, scoped to `Put/Get/Delete` on exactly one S3 bucket. Verified the cutover with `aws sts get-caller-identity` on the instance before disabling the old user's key.
- **SSH locked to a single IP**, enforced through the Security Group and kept in sync via a Terraform variable rather than opening port 22 to `0.0.0.0/0`.
- **No secrets in git** — `.env` files, Terraform state, and real `.tfvars` are all explicitly excluded; only `.env.example` / `terraform.tfvars.example` are tracked.

---

##  Cost optimization

- Analyzed AWS's 2024 pricing change that made **all public IPv4 addresses billable** (Elastic or ephemeral, attached or not) and concluded that an Elastic IP added no benefit for this workload — switched to the default ephemeral public IP, which costs nothing while the instance is stopped.
- Built a repeatable **start/stop runbook**: bring the instance up only to demo or test, repoint CloudFront's `/api/*` origin to the new address with a single `terraform apply`, then stop it again — bringing a running cost of a few cents/hour down to effectively $0 at rest.
- Audited the account and found **two orphaned CloudFront distributions** accumulating needlessly; deleting one was blocked by an active flat-rate **pricing plan subscription** (a newer CloudFront billing feature) — diagnosed the correct way to cancel it via the console before the distribution could be removed.
- Evaluated **CloudFront VPC Origins** (private-subnet EC2, no public IP at all) against the cost of the NAT Gateway it would require (~$32/month) and made the explicit call that it wasn't justified at this scale — a cost/security trade-off decision, documented rather than defaulted into.

---

##  Operations & troubleshooting

- Maintained runbooks (`MANTENIMIENTO.md`, `INFRA_ON_OFF.md`) covering instance start/stop, SSH access, PM2/Nginx management, and a symptom → cause → fix table for recurring issues.
- Diagnosed a backend outage down to its real root cause: logs showed a generic MongoDB connection failure, but isolating the problem with `nslookup` against both the instance's default resolver and `8.8.8.8` proved it was a **DNS SRV record resolution failure**, not a network/security-group issue — correctly pointing at the MongoDB Atlas cluster being auto-paused rather than a misconfiguration on the AWS side.
- Manage the EC2 lifecycle (Amazon Linux 2023) directly: `systemctl` for Nginx, `pm2` for the Node process, log inspection via PM2's log files, and `nginx -t` to validate reverse-proxy config before reloading.
- Comfortable reasoning about architectures beyond what's deployed here — e.g., how SSH/management access changes once instances sit behind an ALB + Auto Scaling Group (moving from IP-restricted SSH to instance-ID-based access via **AWS Systems Manager Session Manager**, since individual instance IPs are no longer stable or meaningful).

---

## Tech stack

**Cloud & infrastructure**
- AWS: EC2 (Amazon Linux 2023), S3, CloudFront (OAC, multi-origin, custom error responses), IAM (instance roles, least-privilege policies), Security Groups, VPC (default)
- **Terraform** — IaC for the entire stack above, including `import`-based adoption of pre-existing resources
- Nginx (reverse proxy), PM2 (process management), systemd
- MongoDB Atlas (managed database)

**Application layer (the workload running on top of the above)**
- Backend: Node.js, Express 4, Mongoose 8, JWT auth, AWS SDK v3 (S3), Jest/Supertest
- Frontend: React 19, React Router 7, Tailwind CSS

---

##  Running it locally

```bash
git clone https://github.com/jdtb99/Librosfera.git
cd Librosfera

# Backend
cd Backend
npm install
cp .env.example .env   # fill in MONGO_URI, JWT_SECRET, etc.
npm run dev             # http://localhost:5000

# Frontend (separate terminal)
cd Frontend/login-app
npm install
# create .env with: REACT_APP_API_URL=http://localhost:5000
npm start                # http://localhost:3000
```

Required backend environment variables are documented in `Backend/.env.example`. AWS credentials are **only needed for local dev** (`AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`) — in production the backend uses the EC2 instance role instead (see [Security hardening](#-security-hardening)). Interactive API docs are available at `/api-docs` once the backend is running.

---

## Project structure

```
Librosfera/
├── infra/                     # Terraform: all AWS infrastructure as code
│   ├── main.tf, cdn.tf, storage.tf, iam.tf, variables.tf, outputs.tf
│   └── modules/compute/        # EC2 + Security Group (decoupled, independently destroyable)
├── Backend/
│   ├── src/                   # controllers, routes, middleware, utils (incl. s3Client)
│   └── Database/              # Mongoose models, services, seed/maintenance scripts
└── Frontend/login-app/
    └── src/components/        # React views & UI
```

---

## License

This project is part of a personal portfolio. All rights reserved.
