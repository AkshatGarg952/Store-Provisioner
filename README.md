# Store Provisioner Platform

A local Kubernetes platform for provisioning isolated e-commerce stores on demand.

Scope (this submission)
- Local Kubernetes only (Kind/k3d/Minikube).
- WooCommerce is implemented end-to-end.
- MedusaJS is stubbed (allowed by the assignment scope note).

Features (local)
- Namespace per store with ResourceQuota, LimitRange, and NetworkPolicy.
- Store status and activity events in the dashboard.
- Concurrency limit: 2 active provisioning jobs.
- Per-user store limit: 3.
- Provisioning timeout: 15 minutes.
- Ingress per store with stable hostnames.

Tech stack
- Backend: Node.js, Express, SQLite, Sequelize
- Frontend: React, TailwindCSS
- Infrastructure: Kubernetes (local), Helm
- Orchestration: Kubernetes client (Node.js)

Local setup and run
Prerequisites:
- Docker Desktop (or any local K8s cluster)
- kubectl
- Helm
- Kind (optional but recommended if you want the auto-recovery flow)
- Set `JWT_SECRET` to keep logins valid across restarts.

1) Create a local cluster (optional if you already have one)
```bash
kind create cluster --config store_provisioner/kind-config.yaml
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml
kubectl wait --namespace ingress-nginx --for=condition=ready pod --selector=app.kubernetes.io/component=controller --timeout=90s
```

2) Start backend
```bash
cd store_provisioner/backend
npm install
npm start
```
Runs on `http://localhost:3000`

3) Start dashboard
```bash
cd store_provisioner/dashboard
npm install
npm run dev
```
Runs on `http://localhost:5173`

Local domain routing
- Default store URL format is `http://store-<id>.127.0.0.1.nip.io`
- You can override the suffix with `INGRESS_DOMAIN_SUFFIX`
Example:
```bash
INGRESS_DOMAIN_SUFFIX=127.0.0.1.nip.io npm start
INGRESS_DOMAIN_SUFFIX=127.0.0.1.nip.io npm start
```

Production Deployment (VPS/k3s)
This platform is designed to be production-ready.
1) Install k3s on your VPS.
2) Configure `helm/values-prod.yaml` with your domain and storage class (default: `local-path` for k3s).
3) Deploy the store provisioner (dashboard/backend) normally (e.g., via Docker Compose or k8s).
4) The backend will provision stores using the production values:
   - Dynamic PVC provisioning via `local-path` StorageClass.
   - Secure Secret management via K8s API (no CLI args).


Create a store
1) Open the dashboard at `http://localhost:5173`
2) Register and log in
3) Click `Create Store` and select `WooCommerce`
4) Wait until status becomes `Ready`
5) Open the store URL from the card
Note: On first boot, the storefront can appear empty for ~2–3 minutes while WordPress initializes and the WooCommerce setup script installs plugins, configures pages, and creates sample products. This is expected for new stores.

Get the WooCommerce admin password
Admin username is `admin`. Password is stored in the namespace secret:
```bash
kubectl get secret store-secret -n store-<id> -o jsonpath="{.data.admin-password}" | base64 -d
```

Place an order (Definition of Done)
1) Open the storefront URL
2) Add a product to cart
3) Checkout using Cash on Delivery (enabled automatically)
4) Verify order in WooCommerce admin:
   `http://store-<id>.<suffix>/wp-admin` -> WooCommerce -> Orders

Delete a store
- Use the `Delete` button in the dashboard
- Backend runs `helm uninstall` and deletes the namespace

System design and tradeoffs
See `store_provisioner/SYSTEM_DESIGN_AND_TRADEOFFS.md`.

Known gaps
- MedusaJS is stubbed (not implemented).
- MedusaJS is stubbed (not implemented).
- SQLite is a local file, so the backend is not safe to scale horizontally.
- JWT secret uses a local fallback and should be set explicitly for real deployments.

Operations
See `store_provisioner/docs/operations.md`.
