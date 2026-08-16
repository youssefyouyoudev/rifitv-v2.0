# Theme Hydration

The root layout applies the saved theme before interactive UI renders through `ThemeScript`.

`ThemeToggle` no longer reads `document` during its initial render. It starts with stable markup, syncs the current class after mount, and uses a stable accessible label: `Toggle theme`.

Countdown and date labels use fixed locale/timezone formatting so server and browser output do not drift by locale.
