# Security Policy

## Platform Security Architecture

Archisynapse operates an enterprise-grade secure payment framework. Our system design minimizes attack surfaces and ensures strict multi-tenancy logical isolation across all services.

---

## 🔐 1. Authentication & API Credentials
- **API Keys**: Issued with `sk_test_` or `sk_live_` prefixes. Keys must be sent in the standard HTTP `Authorization` header as Bearer tokens.
- **Cache Isolation**: Caching of API keys is handled by a dedicated Redis cache cluster. Cache nodes enforce a maximum 10-minute time-to-live (TTL) to guarantee key revocation events take effect quickly.

---

## ✉️ 2. SLA113 OS Envelope Cryptography
To support secure integration with Agentic OS universes like SLA113, the platform implements **OS Envelopes** for transaction requests.

- **Envelope Scheme**: Every message routed via the `os-gateway` must carry:
  1.  `envelope_id`: Unique tracking token.
  2.  `sender_identity`: Registered agent identity.
  3.  `source_universe`: Source universe context (e.g. `L3`).
  4.  `payload`: The complete target action and transaction details.
  5.  `signature`: An HMAC SHA-256 hash generated over the payload string using the tenant’s private shared secret.
- **Enforcement**: The OS Gateway performs cryptographic signature verification on every incoming envelope. If the signatures do not match the expected payload hash, the transaction is rejected with an `HTTP 403 Forbidden` response.

---

## 🛡️ 3. Multi-Tenancy Data Protection
- **Tenant Headers**: Downstream services NEVER read API keys directly. The API Gateway strips credentials and injects cryptographically validated tenant headers:
  *   `X-Tenant-ID`
  *   `X-Tenant-Tier`
- **Data Query Isolation**: All SQL queries across the Transaction, Payout, and Customer services strictly bind `tenant_id` clauses to prevent cross-tenant data leakage.

---

## 📈 4. Rate Limiting Protection
- **Sliding/Fixed Windows**: Gateway enforces sliding window limit assertions in Redis by tenant ID and tier:
  *   **Free Tier**: 100 requests / minute
  *   **Pro Tier**: 1,000 requests / minute
  *   **Enterprise Tier**: 10,000 requests / minute
- **Fail-Open Policy**: If the Redis cache is unreachable, rate-limiting shifts to in-memory tracking maps to ensure billing runs without interruption.

---

## 📝 5. Double-Entry Immutable Auditing
- **Immutable Ledger**: The Ledger service registers all cash movements inside a transactional ACID scope using debit and credit entries.
- **Auditing Balance**: Sum of all assets and expenses must always equal liabilities, equity, and revenues. Any non-zero discrepancy trips security alerts.
