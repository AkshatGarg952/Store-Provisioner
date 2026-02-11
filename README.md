# Store Provisioner Platform

A Kubernetes-native platform for provisioning isolated e-commerce stores (WooCommerce, MedusaJS) on demand.

## 🚀 Features

- **Multi-Tenant Isolation**: Each store runs in its own Namespace with strict ResourceQuotas and NetworkPolicies.
- **Production Hardened**: Built with resilience, security, and scalability in mind.
- **Observability**: Real-time activity logs and status updates for each store.
- **Persistence**: SQLite-backed store registry for metadata persistence.
- **Abuse Prevention**: Global store limits and concurrency controls.

## 🛠️ Tech Stack

- **Backend**: Node.js, Express, SQLite, Sequelize
- **Frontend**: React, TailwindCSS, Lucide Icons
- **Infrastructure**: Kubernetes (k3s/k3d), Helm
- **Orchestration**: Kubernetes Client (Node.js)

## 📦 Setup & Installation

### Prerequisites
- Docker Desktop (or any K8s cluster)
- Helm
- Node.js (v18+)

### 1. Start Backend
```bash
cd store_provisioner/backend
npm install
npm start
```
Runs on `http://localhost:3000`

### 2. Start Dashboard
```bash
cd store_provisioner/dashboard
npm install
npm run dev
```
Runs on `http://localhost:5173`

## 🛡️ Production Hardening (Day 6)

We have implemented several production-grade features:

### 1. Resource Isolation
Every store gets a dedicated Namespace with:
- **ResourceQuotas**: Hard limits on CPU (1 core), Memory (2Gi), and Pods (10).
- **LimitRanges**: Default container requests/limits to prevent noisy neighbors.
- **NetworkPolicies**: Deny-all by default. Only allows Ingress (HTTP), MySQL, and DNS.

### 2. Abuse Prevention
- **Global Limit**: Maximum of **3 stores** can exist at any time.
- **Concurrency Control**: Only **2 provisioning jobs** can run in parallel.
- **Timeouts**: Provisioning fails safely if it takes longer than 5 minutes.

### 3. Observability
- **Activity Log**: View real-time provisioning events (Namespace creation, Helm install, etc.) in the dashboard.
- **Failure Reasoning**: If a store fails, the exact error is captured and displayed.

### 4. Security
- **Non-Root Containers**: Backend runs as a non-root user (`appuser`).
- **Least Privilege**: Helm charts use specific ServiceAccounts (if configured).

## 📖 Operations

See [docs/operations.md](docs/operations.md) for guides on:
- Upgrading Store Versions
- Rolling Back Releases
- Scaling the Platform
