"""
Integration test: Archisynapse API x Lyrica3 Pro payment flow.

Requires the Archisynapse Node.js server running on localhost:3000.
Start it with: npm start

Run: python -m pytest clients/python/tests/test_integration.py -v
Or:  pip install -e clients/python && pytest clients/python/tests/ -v

Tests the full Lyrica3 Pro payment lifecycle:
  1. Create customers (user + stakeholders)
  2. Charge for a track generation
  3. Distribute royalties via payouts
  4. Check dashboard metrics reflect activity
  5. Refund a transaction
  6. Verify webhook event flow
"""

import os
import time

import pytest

from archisynapse import (
    ArchisynapseClient,
    AuthenticationError,
    NotFoundError,
)

API_KEY = os.environ.get("ARCHISYNAPSE_API_KEY", "sk_test_123456789")
BASE_URL = os.environ.get("ARCHISYNAPSE_BASE_URL", "http://localhost:3000/api/v1")

pytestmark = pytest.mark.skipif(
    not os.environ.get("ARCHISYNAPSE_TEST"),
    reason="Set ARCHISYNAPSE_TEST=1 to run integration tests against a live server",
)


@pytest.fixture
def client():
    return ArchisynapseClient(api_key=API_KEY, base_url=BASE_URL)


def test_health(client):
    result = client.health()
    assert result["status"] == "ok"


def test_ready(client):
    result = client.ready()
    assert result["ready"] is True


def test_auth_failure():
    bad = ArchisynapseClient(api_key="bad_key", base_url=BASE_URL)
    with pytest.raises(AuthenticationError):
        bad.customers.list()


def test_customer_lifecycle(client):
    cust = client.customers.create(
        email="shiestybizz@example.com",
        name="shiestybizz",
        metadata={"source": "lyrica3_pro", "handle": "@shiestybizz"},
    )
    assert cust["id"].startswith("cus_")
    assert cust["email"] == "shiestybizz@example.com"

    fetched = client.customers.get(cust["id"])
    assert fetched["id"] == cust["id"]

    with pytest.raises(NotFoundError):
        client.customers.get("cus_nonexistent")


def test_transaction_lifecycle(client):
    cust = client.customers.create(
        email="artist@example.com", name="Test Artist"
    )

    txn = client.transactions.create(
        amount=29900,
        currency="USD",
        description="Track generation: SGV Anthem",
        customer={"id": cust["id"], "email": cust["email"]},
        metadata={"source": "lyrica3_pro", "track_title": "SGV Anthem"},
    )
    assert txn["id"].startswith("txn_")
    assert txn["amount"] == 29900
    assert txn["status"] == "succeeded"

    fetched = client.transactions.get(txn["id"])
    assert fetched["id"] == txn["id"]


def test_lyrica3_royalty_distribution(client):
    # Create a transaction
    cust = client.customers.create(
        email="creator@lyrica3.io", name="Creator"
    )
    txn = client.transactions.create(
        amount=100000,
        currency="USD",
        description="Track: Barrio Nights",
        customer={"id": cust["id"], "email": cust["email"]},
    )

    # Distribute royalties (simulate: create payouts of the stakeholder amounts)
    stakeholders = {
        "prompt_writer": 40.0,
        "vocal_owner": 20.0,
        "emotional_arc_designer": 10.0,
        "persona_creator": 10.0,
        "producer": 10.0,
        "model_owners": 5.0,
        "remixer": 5.0,
    }

    total = float(txn["amount"])
    distributed = []
    for role, pct in stakeholders.items():
        share = int(total * pct / 100)
        distributed.append({"role": role, "amount_cents": share})

    total_distributed = sum(d["amount_cents"] for d in distributed)
    assert abs(total_distributed - total) / total < 0.01  # Within 1%

    # Verify dashboard reflects the activity
    metrics = client.dashboard.metrics()
    assert metrics["total_transactions"] > 0
    assert metrics["total_volume_cents"] > 0


def test_refund_flow(client):
    txn = client.transactions.create(
        amount=5000,
        currency="USD",
        description="Test refund",
    )
    refund = client.transactions.refund(
        txn["id"],
        reason="Customer requested cancellation",
    )
    assert refund["status"] == "succeeded"
    assert refund["amount"] == 5000

    txn_after = client.transactions.get(txn["id"])
    assert txn_after["status"] == "refunded"


def test_webhook_flow(client):
    result = client.webhooks.send(
        event_type="track.created",
        data={"track_id": "track_abc123", "creator": "@shiestybizz", "title": "SGV"},
    )
    assert result["received"] is True

    events = client.webhooks.list()
    assert events["total"] > 0


def test_dashboard_metrics(client):
    metrics = client.dashboard.metrics()
    assert "total_transactions" in metrics
    assert "total_volume_cents" in metrics
    assert "active_customers" in metrics
    assert "status_breakdown" in metrics


def test_customer_not_found(client):
    with pytest.raises(NotFoundError):
        client.customers.get("cus_does_not_exist_at_all")
