# RiFiTV Analytics

RiFiTV uses a first-party, privacy-conscious event pipeline for product reliability and growth measurement. The frontend still emits the `rifitv:analytics` browser event and an optional `dataLayer` entry so an approved external provider can be connected later, but the repository now also sends an allowlisted event to `POST /api/v1/analytics/events`.

## Events

- `page_view`: route path, traffic-source category, device category.
- `match_opened`: match slug, status, playback status.
- `watch_clicked`: match slug, status, competition, playback status.
- `playback_started`: match slug and source identifier.
- `playback_failed`: match slug and source identifier.
- `channel_switched`: match slug and source identifier.
- `search_submitted`: query length and result count when available. The query itself is not stored.
- `competition_viewed`: competition identifier when emitted by a future client surface.
- `match_shared`: native-share or clipboard method.
- `cta_clicked`: named conversion action.
- `favorite_toggled`: local team or competition preference changed.
- `reminder_toggled`: local match reminder preference changed.

The server stores a one-way HMAC of a random browser-local visitor ID, the route path, an allowlisted payload, and the server-side occurrence time. It does not store IP addresses, raw referrers, raw search queries, stream URLs, cookies, names, emails, or authentication tokens. Analytics transport failure is intentionally non-blocking for browsing and playback.

## Admin reporting

Authenticated admins with `analytics.view` can use `/admin/analytics`. The report shows collected unique visitors, returning visitors, daily activity, event counts, traffic-source categories, device categories, popular paths, and popular match slugs. Empty data is shown as empty; metrics are never estimated.

The scheduled operational cleanup job removes analytics events older than 90 days. Any external analytics, advertising, Search Console, or consent-management integration requires a separate privacy/legal review before activation.
