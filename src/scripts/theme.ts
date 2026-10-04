type Theme = "light" | "dark";
const root = document.documentElement;
const media = window.matchMedia("(prefers-color-scheme: dark)");
function savedTheme(): Theme | null {
  try {
    const value = localStorage.getItem("theme");
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}
function preferred(): Theme {
  return savedTheme() ?? (media.matches ? "dark" : "light");
}
function apply(theme: Theme, save = false) {
  root.dataset.theme = theme;
  root.classList.toggle("dark", theme === "dark");
  document
    .querySelector("[data-theme-toggle]")
    ?.setAttribute("aria-pressed", String(theme === "dark"));
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute(
      "content",
      getComputedStyle(root).getPropertyValue("--background").trim()
    );
  if (save) {
    try {
      localStorage.setItem("theme", theme);
    } catch {
      /* Storage may be disabled. */
    }
  }
  document.dispatchEvent(new CustomEvent("theme-change", { detail: theme }));
}
apply(preferred());
document
  .querySelector("[data-theme-toggle]")
  ?.addEventListener("click", () =>
    apply(root.dataset.theme === "dark" ? "light" : "dark", true)
  );
media.addEventListener("change", () => {
  if (!savedTheme()) apply(preferred());
});
window.addEventListener("storage", event => {
  if (event.key === "theme") apply(preferred());
});
window.addEventListener("pageshow", () => apply(preferred()));
