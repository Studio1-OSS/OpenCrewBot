# Minimal OpenLore example

This directory contains the reproducible local service configuration, scoped synthetic knowledge and bot-seeding helpers for the OpenLore integration.

See [setup, workflow and migration](../docs/openlore.md) and [observed evaluation](../docs/openlore-evaluation.md).

- `manage.py`: checksum-verified OpenLore v0.7.5 setup, owned service start/stop, explicit operator review/promotion and contract reset.
- `seed.py`: creates or refreshes the three scoped bots and isolated rooms through the OpenCrewBot API.
- `lore.example.json` / `openlore.yml`: access policy and local service configuration.
- `knowledge/` / `fixtures/`: synthetic documents; the private marker is deliberately fake data for access checks.

Generated credentials, databases, service logs and evaluation artifacts are ignored. No running campaign, provider credential, private key, raw conversation export or machine-specific client configuration is shipped here. The maintainer token is reserved for explicit operator actions, never assigned to a model.
