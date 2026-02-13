# Operations Guide (Local)

## Upgrade a store
```bash
helm upgrade store-<id> ./helm/woocommerce \
  --namespace store-<id> \
  --set wordpress.image.tag=6.4.2 \
  --reuse-values
```

## Roll back a store
```bash
helm rollback store-<id> 0 --namespace store-<id>
```

## Resource isolation
Each store runs in its own namespace (`store-<id>`) with resource limits:
- CPU limit: 1 core
- Memory limit: 2Gi
- Max pods: 10

View quota usage:
```bash
kubectl get resourcequota -n store-<id>
```

## Scaling the backend
Not supported in this submission.
The backend uses a local SQLite file, so multiple replicas are not safe.
