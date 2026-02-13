# System Design and Tradeoffs

## Components
- Dashboard (React): user auth, store list, create/delete, events.
- Backend (Express): auth, store API, orchestration trigger, status tracking.
- SQLite: metadata storage for stores and events.
- SQLite: metadata storage for stores and events.
- Kubernetes + Helm: per-store namespace, Helm release per store.
- Secrets: Managed natively via K8s API (pre-provisioned before Helm install).
- Storage: Dynamic provisioning via StorageClass (standard/local-path).
- Ingress (nginx): stable per-store hostname routing.

## Provisioning flow
1) User creates a store in the dashboard.
2) Backend writes a store record (status = Provisioning).
3) Backend creates a namespace and runs `helm upgrade --install`.
4) A reconciliation loop checks pod readiness and updates status to Ready.

## Deletion flow
1) User deletes a store.
2) Backend uninstalls the Helm release.
3) Backend deletes the namespace.
4) Store record is removed from the database.

## Idempotency and failure handling
- Namespace creation tolerates AlreadyExists and reuses existing namespaces.
- Helm install is `upgrade --install` to reduce duplicates.
- Provisioning has a timeout and logs failures into the event stream.
- Reconciliation loop marks stores Ready when pods are all running/ready.

## Tradeoffs and limitations
- SQLite is a local file; the backend is not safe to scale horizontally.
- Provisioning concurrency is limited in-memory (not durable across restarts).
- MedusaJS is stubbed in this submission.
- MedusaJS is stubbed in this submission.

