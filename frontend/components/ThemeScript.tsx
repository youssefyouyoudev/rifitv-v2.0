export function ThemeScript() {
  const script = `
try {
  var stored = window.localStorage.getItem("rifitv-theme");
  var preferred = window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  var theme = stored || preferred;
  document.documentElement.classList.remove("light", "dark");
  document.documentElement.classList.add(theme);
} catch (_) {
  document.documentElement.classList.add("dark");
}`;

  return <script id="rifitv-theme-script" dangerouslySetInnerHTML={{ __html: script }} />;
}
