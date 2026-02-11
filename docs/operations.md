# Operations Guide

## Upgrading a Store

To upgrade a store (e.g., update WordPress version or change configuration):

```bash
# Example: Upgrade WordPress version
helm upgrade store-<id> ./helm/woocommerce \
  --namespace store-<id> \
  --set wordpress.image.tag=6.4.2 \
  --reuse-values
```

## Rolling Back a Store

If an upgrade fails, you can rollback to the previous revision:

```bash
# Rollback to the previous version
helm rollback store-<id> 0 --namespace store-<id>
```

## Horizontal Scaling

To scale the Store Provisioner backend (stateless):

```bash
kubectl scale deployment store-backend --replicas=3
```

Note: The backend is now stateless (uses external SQLite/DB), so it can be scaled.

## Resource Isolation

Each store runs in its own namespace (`store-<id>`) with strict resource limits:

- **CPU Limit**: 1 Core
- **Memory Limit**: 2Gi
- **Max Pods**: 10

To view quota usage:
```bash
kubectl get resourcequota -n store-<id>
```
