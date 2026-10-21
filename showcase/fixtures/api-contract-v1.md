# Subscription upgrade API — approved contract v1

POST /api/subscriptions/upgrade
Request JSON: { "plan": "pro", "idempotencyKey": "<unique operation key>" }
Success: HTTP 200, { "plan": "pro", "status": "active", "contractVersion": "v1" }
Invalid plan or missing key: HTTP 400, { "error": "invalid_request" }
The client must reuse the same idempotency key when retrying the same action.
Product copy: "Upgrade to Pro". The server is the authority for the resulting plan.

This shared contract is reviewed by a human maintainer. Implementation notes belong in the owning team's collection.
