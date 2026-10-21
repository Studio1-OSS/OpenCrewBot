# Frontend conventions

Use semantic HTML and accessible form labels. Announce pending, success and error states with a live region.
Use fetch for POST /api/subscriptions/upgrade. Disable the button while pending and retain the operation key for retry.
Never infer a successful upgrade from clicking the button. Confirm the server result.
Cite /shared/api-contract.md when implementing this flow.
