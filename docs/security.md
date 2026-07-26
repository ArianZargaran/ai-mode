---
title: Security & data handling for Nova
url: northline.com/trust/ai-data
---

Nova AI processes workspace data (tickets, routing history, reply drafts) to generate its suggestions. Key points on how that data is handled:

- Ticket data used by Nova stays within your workspace's data boundary. It is not used to train models shared across other Northline customers.
- Draft replies and routing suggestions are generated per-request and are not persisted by Nova beyond the session needed to serve the response.
- Enterprise workspaces can request a dedicated data residency region (US, EU, or APAC) at no extra cost.
- SSO/SAML and SCIM provisioning are available on the Enterprise plan; a full audit log covering login, export, and admin actions ships with every Enterprise workspace.
- Northline holds SOC 2 Type II certification, renewed annually, and completes a third-party penetration test each year with a summary available to customers under NDA.

Admins can disable Nova entirely at the workspace level in Settings → AI, without affecting any non-AI functionality.
