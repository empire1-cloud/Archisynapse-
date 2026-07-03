# Archisynapse API Specification

## Overview

The Archisynapse API provides real-time payment processing, transaction management, and financial reporting capabilities. Built for high performance with <100ms response times and 99.99% uptime.

## Base URL

```
https://api.archisynapse.io/v1
```

## Authentication

### API Key Authentication

All requests require an API key in the `Authorization` header:

```bash
Authorization: Bearer YOUR_API_KEY
```

Ledger-backed payment requests are organization-scoped by the authenticated API key or JWT. A caller may send `X-Organization-ID`, but it must match the authenticated organization context or the request is rejected.

## Core Endpoints

### Transactions

#### Create Transaction

```http
POST /transactions
```

Notes:
- `idempotencyKey` is required for payment creation.
- Payment-method inputs must be tokenized only.
- Ledger posting uses non-reusable idempotency keys: same key + same payload returns the original result, while same key + different payload is rejected.

**Response (201 Created):**
```json
{
  "id": "txn_7c4a1e9b",
  "status": "SUCCEEDED",
  "amount": 1000,
  "currency": "USD",
  "created_at": "2026-05-29T12:34:56Z"
}
```

#### Get Transaction

```http
GET /transactions/{transaction_id}
```

#### List Transactions

```http
GET /transactions?limit=50&offset=0&status=succeeded
```

#### Refund Transaction

```http
POST /transactions/{transaction_id}/refunds
```

Refunds reverse the original ledger transaction through the ledger service boundary. If payment capture succeeds but ledger posting fails, the payment remains discoverable for reconciliation retry instead of being silently dropped.

### Customers

#### Create Customer

```http
POST /customers
```

#### Get Customer

```http
GET /customers/{customer_id}
```

#### List Customers

```http
GET /customers?limit=50&offset=0
```

### Payouts

#### List Payouts

```http
GET /payouts?status=completed&limit=50
```

---

## Rate Limiting

- **Free Tier**: 100 requests/minute
- **Professional Tier**: 1,000 requests/minute
- **Enterprise**: Custom limits

---

## Webhooks

Subscribe to real-time events via webhooks.

### Event Types

- `transaction.succeeded` - Transaction completed successfully
- `transaction.failed` - Transaction failed
- `payout.completed` - Payout processed
- `customer.created` - New customer created

---

*Last Updated: May 2026*
*API Version: 1.0*
