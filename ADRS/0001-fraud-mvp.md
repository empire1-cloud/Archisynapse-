# ADR 0001: Fraud Detection MVP

- Status: Accepted
- Date: 2026-07-09
- Owners: Archisynapse Core
- Related: `fraud-mvp/`, `spine_receiver.py`, Lyrica 3 event contract

## Context

Archisynapse processes payments, payouts, and royalty splits for the Empire ecosystem. Without a fraud/risk layer, the platform is vulnerable to:

- Card testing and checkout fraud (merchant payment flows)
- Fake creator royalty claims and payout abuse (Lyrica 3 music ecosystem)
- Sybil attacks on creator accounts

The existing README claimed ML fraud detection but had no implementation. We need a working risk scoring service that can be deployed alongside the main API.

## Decision

Add a standalone FastAPI fraud detection service as `fraud-mvp/` in the repo root.

### Architecture

1. **Two scoring domains** in a single service:
   - `POST /risk/checkout` — merchant payment fraud (velocity checks, country mismatch, BIN pattern, card testing)
   - `POST /risk/royalty` — creator payout fraud (DNA/soulprint verification, ledger checks, payout velocity, device/email history)

2. **Empire Spine Receiver** mounted at `/api/v1`:
   - `POST /api/v1/events` — accepts HMAC-SHA256 signed events from Lyrica 3
   - `GET /api/v1/certificates` — lists minted birth certificates
   - `GET /api/v1/certificates/{dna_tag}` — retrieves certificate
   - `GET /api/v1/certificates/{dna_tag}/verify` — verifies certificate seal integrity

3. **Tech stack**: Python 3.14, FastAPI, SQLAlchemy, SQLite (dev) / PostgreSQL (prod)

4. **Security**: Pepper-hashed PII (SHA-256), HMAC API key auth, idempotency keys on all risk endpoints

### Why a separate service instead of integrating into the Express API?

- Different runtime characteristics (async Python vs Node.js Express)
- Risk scoring is I/O-bound (DB lookups, hashing) — Python/FastAPI is a natural fit
- Can be deployed and scaled independently
- No risk of fraud scoring latency affecting payment processing

## Consequences

### Positive

- Production-grade risk scoring with 4 decision tiers per domain (approve/step-up/review/block)
- Immutable audit trail via digital birth certificates for Lyrica 3 tracks
- Idempotent scoring prevents signal inflation on retries
- Merchant management with API key registration

### Trade-offs

- Separate service means another process to deploy and monitor
- SQLite in dev requires migration to PostgreSQL for production
- Empty tables on first deploy — no historical data for ML model training yet

## Follow-up

1. Wire Lyrica 3 to emit signed events to `/api/v1/events`
2. Add ML model integration for anomaly scoring (currently rule-based)
3. Deploy with PostgreSQL and configure `ARCHISYNAPSE_DATABASE_URL`
4. Add fraud dashboard to Archisynapse Studio frontend
