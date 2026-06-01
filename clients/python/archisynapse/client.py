from __future__ import annotations

import os
from typing import Any, Dict, Optional

import requests

from .errors import (
    ArchisynapseError,
    AuthenticationError,
    NotFoundError,
    RateLimitError,
    ServerError,
    ValidationError,
)


class ArchisynapseClient:
    BASE_URL = "http://localhost:3000/api/v1"

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        timeout: int = 30,
    ):
        self.api_key = api_key or os.environ.get("ARCHISYNAPSE_API_KEY", "")
        self.base_url = (base_url or os.environ.get("ARCHISYNAPSE_BASE_URL")) or self.BASE_URL
        self.timeout = timeout
        self.session = requests.Session()
        self.session.headers.update({
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "User-Agent": "archisynapse-python/1.0.0",
        })

    def _request(self, method: str, path: str, **kwargs) -> Any:
        url = f"{self.base_url.rstrip('/')}/{path.lstrip('/')}"
        try:
            resp = self.session.request(
                method, url, timeout=self.timeout, **kwargs
            )
        except requests.ConnectionError as e:
            raise ArchisynapseError(
                f"Could not connect to Archisynapse API at {self.base_url}: {e}"
            ) from e
        except requests.Timeout as e:
            raise ArchisynapseError(
                f"Request to {url} timed out after {self.timeout}s"
            ) from e

        if resp.status_code == 401:
            raise AuthenticationError("Invalid or missing API key", status_code=401)
        if resp.status_code == 404:
            raise NotFoundError(resp.json().get("error", {}).get("message", "Not found"), status_code=404)
        if resp.status_code == 429:
            raise RateLimitError("Rate limit exceeded", status_code=429)
        if 400 <= resp.status_code < 500:
            error_data = resp.json().get("error", {})
            raise ValidationError(
                error_data.get("message", "Validation error"),
                status_code=resp.status_code,
                code=error_data.get("code"),
            )
        if resp.status_code >= 500:
            raise ServerError("Server error", status_code=resp.status_code)

        return resp.json()

    def get(self, path: str, params: Optional[Dict] = None) -> Any:
        return self._request("GET", path, params=params or {})

    def post(self, path: str, data: Optional[Dict] = None) -> Any:
        return self._request("POST", path, json=data or {})

    def put(self, path: str, data: Optional[Dict] = None) -> Any:
        return self._request("PUT", path, json=data or {})

    def delete(self, path: str) -> Any:
        return self._request("DELETE", path)

    # -- Customers --
    @property
    def customers(self) -> "CustomersResource":
        return CustomersResource(self)

    # -- Transactions --
    @property
    def transactions(self) -> "TransactionsResource":
        return TransactionsResource(self)

    # -- Payouts --
    @property
    def payouts(self) -> "PayoutsResource":
        return PayoutsResource(self)

    # -- Webhooks --
    @property
    def webhooks(self) -> "WebhooksResource":
        return WebhooksResource(self)

    # -- Dashboard --
    @property
    def dashboard(self) -> "DashboardResource":
        return DashboardResource(self)

    # -- Blueprints --
    @property
    def blueprints(self) -> "BlueprintsResource":
        return BlueprintsResource(self)

    # -- Health --
    def health(self) -> Dict:
        return self._request("GET", self.base_url.replace("/api/v1", "/health"))

    def ready(self) -> Dict:
        return self._request("GET", self.base_url.replace("/api/v1", "/ready"))


class BaseResource:
    def __init__(self, client: ArchisynapseClient):
        self._client = client


class CustomersResource(BaseResource):
    _path = "customers"

    def create(self, email: str, name: str, phone: str = None, metadata: Dict = None) -> Dict:
        return self._client.post(self._path, data={
            "email": email, "name": name, "phone": phone, "metadata": metadata or {},
        })

    def get(self, customer_id: str) -> Dict:
        return self._client.get(f"{self._path}/{customer_id}")

    def list(self, limit: int = 20, offset: int = 0) -> Dict:
        return self._client.get(self._path, params={"limit": limit, "offset": offset})


class TransactionsResource(BaseResource):
    _path = "transactions"

    def create(self, amount: int, currency: str = "USD", description: str = None,
               customer: Dict = None, payment_method: Dict = None, metadata: Dict = None) -> Dict:
        return self._client.post(self._path, data={
            "amount": amount,
            "currency": currency,
            "description": description,
            "customer": customer,
            "payment_method": payment_method or {"type": "card"},
            "metadata": metadata or {},
        })

    def get(self, transaction_id: str) -> Dict:
        return self._client.get(f"{self._path}/{transaction_id}")

    def list(self, limit: int = 20, offset: int = 0, status: str = None) -> Dict:
        params = {"limit": limit, "offset": offset}
        if status:
            params["status"] = status
        return self._client.get(self._path, params=params)

    def refund(self, transaction_id: str, amount: int = None, reason: str = None) -> Dict:
        return self._client.post(f"{self._path}/{transaction_id}/refunds", data={
            "amount": amount, "reason": reason,
        })


class PayoutsResource(BaseResource):
    _path = "payouts"

    def list(self, limit: int = 20, offset: int = 0, status: str = None) -> Dict:
        params = {"limit": limit, "offset": offset}
        if status:
            params["status"] = status
        return self._client.get(self._path, params=params)


class WebhooksResource(BaseResource):
    _path = "webhooks"

    def send(self, event_type: str, data: Dict = None) -> Dict:
        return self._client.post(self._path, data={
            "type": event_type, "data": data or {},
        })

    def list(self, limit: int = 20, offset: int = 0, event_type: str = None) -> Dict:
        params = {"limit": limit, "offset": offset}
        if event_type:
            params["type"] = event_type
        return self._client.get(self._path, params=params)


class DashboardResource(BaseResource):
    _path = "dashboard"

    def metrics(self) -> Dict:
        return self._client.get(self._path)


class BlueprintsResource(BaseResource):
    _path = "blueprints"

    def list(self, limit: int = 20, offset: int = 0, category: str = None,
             tags: list = None, complexity: str = None) -> Dict:
        params = {"limit": limit, "offset": offset}
        if category:
            params["category"] = category
        if tags:
            params["tags"] = ",".join(tags)
        if complexity:
            params["complexity"] = complexity
        return self._client.get(self._path, params=params)

    def get(self, blueprint_id: str) -> Dict:
        return self._client.get(f"{self._path}/{blueprint_id}")

    def get_by_slug(self, slug: str) -> Dict:
        return self._client.get(f"{self._path}/slug/{slug}")

    def match(self, query: str = None, tags: list = None, category: str = None,
              complexity: str = None, limit: int = 5) -> Dict:
        params = {"limit": limit}
        if query:
            params["query"] = query
        if tags:
            params["tags"] = ",".join(tags)
        if category:
            params["category"] = category
        if complexity:
            params["complexity"] = complexity
        return self._client.get(f"{self._path}/match", params=params)

    def create(self, **data) -> Dict:
        return self._client.post(self._path, data=data)

    def update(self, blueprint_id: str, **data) -> Dict:
        return self._client.put(f"{self._path}/{blueprint_id}", data=data)

    def delete(self, blueprint_id: str) -> Dict:
        return self._client.delete(f"{self._path}/{blueprint_id}")
