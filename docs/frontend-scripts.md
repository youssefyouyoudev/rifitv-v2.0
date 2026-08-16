# Frontend Scripts

The match page JSON-LD block is rendered through Next.js `Script` instead of a raw React `<script>` element in the page component.

The only inline theme script is the root before-paint theme initializer. It is intentionally placed in the document shell to prevent a light/dark flash and does not create component-level script render warnings.

E2E now fails on unexpected React hydration, script-render, uncaught React, or page errors.
