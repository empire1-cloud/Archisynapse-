# Archisynapse Python SDK

Official Python client for the [Archisynapse](https://github.com/empire1-cloud/Archisynapse-) payment API.

## Installation

```bash
pip install archisynapse
```

Or install from source:

```bash
cd clients/python
pip install -e .
```

## Quick Start

```python
from archisynapse import ArchisynapseClient

client = ArchisynapseClient(
    api_key="sk_test_123456789",
    base_url="http://localhost:3000/api/v1"
)

# Health check
print(client.health())

# Customers
customer = client.customers.create(
    email="user@example.com",
    name="John Doe"
)
print(customer)

# Transactions
txn = client.transactions.create(
    amount=29900,
    currency="USD",
    description="Pro Plan - Monthly",
)
print(txn)

# Refund
refund = client.transactions.refund(
    txn["id"],
    reason="Customer requested"
)

# Dashboard metrics
metrics = client.dashboard.metrics()
print(metrics["total_volume_formatted"])
```

## API Reference

### Customers
- `client.customers.create(email, name, phone=None, metadata=None)` → customer
- `client.customers.get(customer_id)` → customer
- `client.customers.list(limit=20, offset=0)` → paginated list

### Transactions
- `client.transactions.create(amount, currency="USD", description=None, customer=None, payment_method=None, metadata=None)` → transaction
- `client.transactions.get(transaction_id)` → transaction
- `client.transactions.list(limit=20, offset=0, status=None)` → paginated list
- `client.transactions.refund(transaction_id, amount=None, reason=None)` → refund

### Payouts
- `client.payouts.list(limit=20, offset=0, status=None)` → paginated list

### Webhooks
- `client.webhooks.send(event_type, data=None)` → webhook event
- `client.webhooks.list(limit=20, offset=0, event_type=None)` → paginated list

### Dashboard
- `client.dashboard.metrics()` → business metrics

### Health
- `client.health()` → health status
- `client.ready()` → readiness status
