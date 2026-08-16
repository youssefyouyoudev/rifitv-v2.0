# Roles And Permissions

RiFiTV uses native Laravel RBAC tables:

- `roles`
- `role_user`

Users must be admin users to enter admin routes, and roles determine what actions are allowed.

## Seed Roles

Owner:

- `*`

Editor:

- `admin.search`
- `matches.manage`
- `scores.manage`
- `teams.manage`
- `competitions.manage`

Stream Manager:

- `admin.search`
- `streams.manage`

Content Manager:

- `admin.search`
- `content.manage`
- `settings.manage`

## Enforcement

Navigation visibility is not trusted. Laravel middleware/Form Requests enforce permissions on writes and protected reads.

Audit logs record important actions without passwords, tokens, or full source URLs.
