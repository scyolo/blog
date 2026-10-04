for (const pre of document.querySelectorAll<HTMLPreElement>(
  "#article pre:not([data-mermaid-source])"
)) {
  const code = pre.querySelector("code");
  if (!code) continue;
  pre.tabIndex = 0;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "copy-code";
  button.textContent = "复制代码";
  button.setAttribute("aria-label", "复制代码");
  button.setAttribute("aria-live", "polite");
  button.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(code.textContent ?? "");
      button.textContent = "已复制";
    } catch {
      button.textContent = "请手动选择代码";
    }
    setTimeout(() => {
      button.textContent = "复制代码";
    }, 1500);
  });
  pre.append(button);
}

type DiagramState = {
  figure: HTMLElement;
  source: string;
  version: number;
  visible: boolean;
};
const diagrams: DiagramState[] = Array.from(
  document.querySelectorAll<HTMLElement>("[data-mermaid]")
).map(figure => ({
  figure,
  source: figure.querySelector("[data-mermaid-source] code")?.textContent ?? "",
  version: 0,
  visible: false,
}));
let library: Promise<(typeof import("mermaid"))["default"]> | undefined;
let queue = Promise.resolve();
let sequence = 0;
function requestRender(state: DiagramState) {
  const version = ++state.version;
  queue = queue.then(async () => {
    if (version !== state.version || !state.figure.isConnected) return;
    const status = state.figure.querySelector<HTMLElement>(
      "[data-mermaid-status]"
    );
    const output = state.figure.querySelector<HTMLElement>(
      "[data-mermaid-output]"
    );
    if (!output) return;
    try {
      library ??= import("mermaid").then(module => module.default);
      const mermaid = await library;
      if (version !== state.version) return;
      const theme =
        document.documentElement.dataset.theme === "dark" ? "dark" : "light";
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        theme: theme === "dark" ? "dark" : "default",
        suppressErrorRendering: true,
        fontFamily: "system-ui, Microsoft YaHei, sans-serif",
      });
      const result = await mermaid.render(
        "diagram-" + ++sequence,
        state.source
      );
      if (version !== state.version) return;
      output.innerHTML = result.svg;
      const svg = output.querySelector("svg");
      if (svg) {
        svg.style.width = Math.max(320, svg.viewBox.baseVal.width) + "px";
        svg.style.maxWidth = "none";
        svg.style.height = "auto";
      }
      result.bindFunctions?.(output);
      state.figure.dataset.renderedTheme = theme;
      if (status) status.hidden = true;
    } catch {
      if (status) {
        status.hidden = false;
        status.textContent = "图表暂时无法渲染，可以展开查看源码。";
      }
      state.figure.querySelector("details")?.setAttribute("open", "");
    }
  });
}
if (diagrams.length) {
  const observer = new IntersectionObserver(
    entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const state = diagrams.find(item => item.figure === entry.target);
        if (state) {
          state.visible = true;
          requestRender(state);
        }
        observer.unobserve(entry.target);
      }
    },
    { rootMargin: "250px" }
  );
  diagrams.forEach(state => observer.observe(state.figure));
  document.addEventListener("theme-change", () =>
    diagrams.filter(state => state.visible).forEach(requestRender)
  );
}
