# Security Policy

## Reporting a vulnerability

Report vulnerabilities privately to `info@savne.net`. Include the affected
plugin and Saltcorn versions, reproduction steps, impact, and any proposed
mitigation. Do not publish credentials, API tokens, or exploit details in a
public issue before Savne has had a reasonable opportunity to investigate.

## Authentication model

Administrative endpoints require a native Saltcorn API token belonging to an
enabled administrator. Swagger UI and the OpenAPI JSON are public discovery
resources and contain no credentials. Operators should rotate exposed tokens,
use HTTPS outside trusted networks, and grant administrator access sparingly.

Write operations default to dry-run where supported. Destructive operations
must identify explicit Saltcorn objects and do not provide a global workspace
reset endpoint.
