# Upgrade Decision v1

- Maintain an idempotency Map keyed by idempotencyKey.
- Retries with the same key and same plan return the same successful response.
- A previously used key with a different plan returns HTTP 409 Conflict with { error: "idempotency_conflict" } before normal plan validation.
- Invalid new requests (e.g. missing key, invalid plan) return HTTP 400 Bad Request with { error: "invalid_request" }.
- State changes occur only after full validation passes.
