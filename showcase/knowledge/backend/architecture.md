# Backend architecture

The subscription service accepts only plan "pro" for this showcase.
Implement one pure function upgradeSubscription(request, state), returning { status, body }.
State contains an idempotency Map. The same key and same plan return the same successful result.
Reuse of a key with a different plan returns HTTP 409 with { error: "idempotency_conflict" }.
Keep implementation decisions here, and publish an approved client contract separately.
