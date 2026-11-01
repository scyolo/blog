import {
  GitHubWriter,
  type RepositoryArticle,
  type Publication,
} from "../writer/github";
import {
  DraftLibrary,
  DRAFTS_KEY,
  newDraft,
  type WriterDraft,
} from "../writer/drafts";
import {
  fromEditorTime,
  toEditorTime,
  parseMarkdownFile,
  validateArticle,
  serializeArticle,
  WriterError,
  MAX_DOCUMENT_BYTES,
  type Article,
} from "../writer/document";
import { renderPreview } from "../writer/preview";
import { livePublication } from "../writer/live";
import { stringify } from "yaml";

const $ = <T extends HTMLElement = HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)!;
const $$ = <T extends HTMLElement = HTMLElement>(selector: string) => [
  ...document.querySelectorAll<T>(selector),
];
const config = JSON.parse($("#writer-config").textContent || "{}");
const github = new GitHubWriter(config);
let storage: Storage | undefined;
try {
  storage = localStorage;
} catch {
  /* Export remains available when storage is blocked. */
}
const library = new DraftLibrary(storage);
const editor = $<HTMLTextAreaElement>("[data-editor]");
const preview = $("[data-preview]");
const fieldNames = [
  "title",
  "slug",
  "description",
  "pubDatetime",
  "category",
  "tags",
] as const;
const fields = Object.fromEntries(
  fieldNames.map(name => [
    name,
    $<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
      `[data-field="${name}"]`
    ),
  ])
);
const connectDialog = $<HTMLDialogElement>("[data-connect-dialog]");
const publishDialog = $<HTMLDialogElement>("[data-publish-dialog]");
let saveTimer: ReturnType<typeof setTimeout>;
let previewTimer: ReturnType<typeof setTimeout>;
let pollTimer: ReturnType<typeof setTimeout>;
let previewRevision = 0;
let pollRevision = 0;
let unsaved = false;
let storageChanged = false;
let repositoryPrivate = false;
let busy = false;
let connecting = false;
let posts: RepositoryArticle[] = [];
let prepared: { article: Article; draft: WriterDraft } | undefined;

function message(error: unknown) {
  return error instanceof WriterError
    ? error.message
    : "操作未完成，请重试；当前内容仍保留在编辑器中。";
}
function feedback(text: string) {
  $("[data-feedback-text]").textContent = text;
}

function capture() {
  const draft = library.active;
  const time = String(draft.data.pubDatetime ?? "");
  draft.data = {
    ...draft.data,
    title: fields.title.value,
    slug: fields.slug.value.trim(),
    description: fields.description.value,
    category: fields.category.value,
    pubDatetime:
      toEditorTime(time) === fields.pubDatetime.value
        ? time
        : fromEditorTime(fields.pubDatetime.value),
    tags: fields.tags.value
      .split(/[,，]/)
      .map(tag => tag.trim())
      .filter(Boolean),
  };
  draft.body = editor.value;
  draft.updatedAt = new Date().toISOString();
  return draft;
}

function saveLocal(text = "草稿已保存到本机") {
  clearTimeout(saveTimer);
  capture();
  try {
    if (storageChanged)
      throw new WriterError(
        "另一标签页已更新草稿。请先导出当前内容，再刷新页面，避免互相覆盖。"
      );
    library.save();
    unsaved = false;
    feedback(text);
    $("[data-save-time]").textContent =
      "· " +
      new Date().toLocaleTimeString("zh-CN", {
        timeZone: "Asia/Shanghai",
        hour: "2-digit",
        minute: "2-digit",
      });
    renderDraftList();
    return true;
  } catch (error) {
    unsaved = true;
    feedback(message(error));
    return false;
  }
}

function scheduleSave() {
  unsaved = true;
  feedback("正在保存…");
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveLocal(), 350);
}

function renderDraftList() {
  const select = $<HTMLSelectElement>("[data-local-draft]");
  select.replaceChildren(
    ...library.items.map(draft => {
      const option = new Option(
        String(draft.data.title || "未命名草稿"),
        draft.id
      );
      option.selected = draft.id === library.activeId;
      return option;
    })
  );
  $("[data-draft-count]").textContent = String(library.items.length);
}

function fillDraft() {
  const draft = library.active;
  for (const name of fieldNames) {
    const value = draft.data[name];
    fields[name].value =
      name === "pubDatetime"
        ? toEditorTime(String(value ?? ""))
        : name === "tags"
          ? Array.isArray(value)
            ? value.join(", ")
            : ""
          : String(value ?? "");
  }
  (fields.slug as HTMLInputElement).readOnly = Boolean(draft.remote);
  editor.value = draft.body;
  $("[data-remote-version]").textContent = draft.remote
    ? `已载入仓库版本 ${draft.remote.sha.slice(0, 7)}；原有封面、作者与其他文章信息会保留。`
    : "";
  $("[data-sync-draft]").textContent = draft.remote?.published
    ? "下架这篇文章"
    : "保存为仓库草稿";
  renderDraftList();
  void updatePreview();
  if (draft.publication) void watchPublication(draft.publication);
  else {
    pollRevision++;
    clearTimeout(pollTimer);
    $("[data-publication]").hidden = true;
  }
}

function addDraft(draft: WriterDraft) {
  // Keep the previous document even when importing or creating a new article.
  saveLocal();
  try {
    library.add(draft);
    fillDraft();
    saveLocal("已打开新草稿，上一份保留在「本机草稿」中");
    fields.title.focus();
  } catch (error) {
    feedback(message(error));
  }
}

async function updatePreview() {
  const revision = ++previewRevision;
  const source = editor.value;
  const count = source.replace(/\s/g, "").length;
  $("[data-word-count]").textContent = `${count} 字`;
  $("[data-reading-time]").textContent =
    `约 ${Math.max(1, Math.ceil(count / 350))} 分钟`;
  if (new TextEncoder().encode(source).length > MAX_DOCUMENT_BYTES) {
    preview.textContent = "文章较长，请拆分后预览。当前内容仍可编辑。";
    return;
  }
  try {
    const html = await renderPreview(source, {
      base: import.meta.env.BASE_URL,
      assets: config.assets,
      path: library.active.remote?.path,
    });
    if (revision !== previewRevision) return;
    preview.innerHTML =
      html ||
      '<p class="writer-empty-preview">从左边写下第一句话，文章会在这里慢慢成形。</p>';
    for (const link of preview.querySelectorAll("a")) {
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    }
    const diagrams = [
      ...preview.querySelectorAll<HTMLElement>("pre > code.language-mermaid"),
    ];
    if (!diagrams.length) return;
    const mermaid = (await import("mermaid")).default;
    if (revision !== previewRevision) return;
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme:
        document.documentElement.dataset.theme === "dark" ? "dark" : "default",
      suppressErrorRendering: true,
    });
    for (const [index, code] of diagrams.entries()) {
      const id = `writer-diagram-${revision}-${index}`;
      try {
        const result = await mermaid.render(id, code.textContent ?? "");
        if (revision !== previewRevision) return;
        const figure = document.createElement("figure");
        figure.className = "writer-diagram";
        figure.innerHTML = result.svg;
        code.parentElement?.replaceWith(figure);
      } catch {
        if (revision !== previewRevision) return;
        document.getElementById(`d${id}`)?.remove();
        const hint = document.createElement("p");
        hint.className = "writer-field-help";
        hint.textContent = "图表语法尚未完成，暂时显示源码。";
        code.parentElement?.after(hint);
      }
    }
  } catch {
    if (revision === previewRevision)
      preview.textContent =
        "暂时无法渲染这段内容，请检查 Markdown；正文已保留。";
  }
}

function setTab(mode: string) {
  $("[data-editor-body]").dataset.mode = mode;
  $("#writer-panel").setAttribute("aria-labelledby", `writer-tab-${mode}`);
  for (const tab of $$<HTMLButtonElement>("[data-tab]")) {
    const active = tab.dataset.tab === mode;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
  }
  $("[data-preview-mode]").textContent =
    mode === "preview" ? "返回写作" : "阅读预览";
}

function format(name: string) {
  const start = editor.selectionStart;
  const end = editor.selectionEnd;
  const selection = editor.value.slice(start, end) || "文字";
  const formats: Record<string, [string, string]> = {
    heading: ["## ", ""],
    bold: ["**", "**"],
    italic: ["*", "*"],
    quote: ["> ", ""],
    code: ["\n```text\n", "\n```\n"],
    list: ["- ", ""],
    task: ["- [ ] ", ""],
    link: ["[", "](https://example.com)"],
  };
  const [before, after] = formats[name];
  editor.setRangeText(before + selection + after, start, end, "select");
  setTab(
    $("[data-editor-body]").dataset.mode === "preview"
      ? "edit"
      : $("[data-editor-body]").dataset.mode!
  );
  editor.focus();
  scheduleSave();
  void updatePreview();
}

function exportMarkdown() {
  const draft = capture();
  try {
    // An incomplete draft must still be recoverable when browser storage is unavailable.
    let source: string;
    try {
      source = serializeArticle(
        validateArticle({ ...draft.data, draft: true }, draft.body)
      );
    } catch {
      source = `---\n${stringify({ ...draft.data, draft: true }, { lineWidth: 0 })}---\n\n${draft.body}\n`;
    }
    const blob = new Blob([source], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${String(draft.data.slug || "untitled-draft").replace(/[^a-z0-9-]/gi, "-")}.md`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    feedback("草稿已导出为 Markdown；这不会改变线上文章");
  } catch (error) {
    feedback(message(error));
  }
}

function updateConnection() {
  $("[data-connection-status]").textContent = github.connected
    ? "GitHub 已连接"
    : "本地写作模式";
  $("[data-connect]").textContent = github.connected
    ? "断开连接"
    : "连接 GitHub ↗";
  $("[data-repository-panel]").hidden = !github.connected;
}

async function loadPosts() {
  const refresh = $<HTMLButtonElement>("[data-refresh-posts]");
  refresh.disabled = true;
  try {
    posts = await github.list();
    const select = $<HTMLSelectElement>("[data-remote-post]");
    select.replaceChildren(
      new Option(
        posts.length ? "选择一篇文章" : "还没有文章，从这里开始写吧",
        ""
      ),
      ...posts.map(
        post =>
          new Option(
            `${post.data.draft ? "草稿 · " : ""}${post.data.title}`,
            post.path
          )
      )
    );
  } catch (error) {
    feedback(message(error));
    updateConnection();
  } finally {
    refresh.disabled = false;
  }
}

function openConnection() {
  $("[data-connect-error]").textContent = "";
  connectDialog.showModal();
  $<HTMLInputElement>("[data-token]").focus();
}

function preparePublication(draftMode = false) {
  if (busy) return;
  const draft = capture();
  try {
    const data: Record<string, unknown> = { ...draft.data, draft: draftMode };
    if (draft.remote?.published) data.modDatetime = new Date().toISOString();
    const article = validateArticle(data, draft.body);
    serializeArticle(article);
    if (!github.connected) {
      saveLocal();
      openConnection();
      return;
    }
    prepared = { article, draft };
    $("#publish-title").textContent = draftMode
      ? draft.remote?.published
        ? "确认下架文章"
        : "保存到仓库"
      : "准备发布";
    $("[data-publish-name]").textContent = article.data.title;
    const future = Date.parse(article.data.pubDatetime) > Date.now();
    $("[data-publish-explanation]").textContent = draftMode
      ? draft.remote?.published
        ? "文章将在部署完成后从博客中下架，GitHub 历史仍保留原文。"
        : `草稿将写入${repositoryPrivate ? "私有" : "公开"}仓库。${repositoryPrivate ? "" : "任何人都能在 GitHub 查看草稿原文；私密内容请只保存在本机。"}`
      : future
        ? "发布时间尚未到。提交后会保留在仓库中，需要在该时间到达后再次触发构建才能上线；本版本不会自动定时发布。"
        : `文章将公开在 ${import.meta.env.BASE_URL}posts/${article.data.slug}/。确认后会提交正文并开始部署。`;
    $("[data-confirm-publish]").textContent = draftMode
      ? draft.remote?.published
        ? "确认下架"
        : "确认保存草稿"
      : "确认发布";
    $("[data-publish-error]").textContent = "";
    saveLocal();
    publishDialog.showModal();
  } catch (error) {
    feedback(message(error));
  }
}

async function watchPublication(publication: Publication) {
  clearTimeout(pollTimer);
  const revision = ++pollRevision;
  const box = $("[data-publication]");
  const text = $("[data-publication-text]");
  const deployLink = $<HTMLAnchorElement>("[data-deploy-link]");
  const articleLink = $<HTMLAnchorElement>("[data-article-link]");
  box.hidden = false;
  articleLink.hidden = true;
  deployLink.href = `https://github.com/${config.repository}/actions/workflows/${config.workflow}`;
  deployLink.hidden = false;
  if (publication.future && !publication.draft) {
    text.textContent =
      "已提交到仓库。发布时间到达后，需要再次触发构建才会上线。";
    return;
  }
  text.textContent = "已提交到 GitHub，正在等待构建与部署…";
  const siteUrl = new URL(import.meta.env.BASE_URL, window.location.origin)
    .href;
  const poll = async (attempt = 0) => {
    if (revision !== pollRevision) return;
    try {
      const live = await livePublication(publication, siteUrl);
      if (revision !== pollRevision) return;
      if (live !== "waiting") {
        text.textContent =
          live === "published"
            ? "文章已上线。"
            : "仓库草稿已保存，公开站点已更新。";
        if (live === "published") {
          articleLink.href = new URL(
            `posts/${publication.slug}/`,
            siteUrl
          ).href;
          articleLink.hidden = false;
        }
        return;
      }
      if (github.connected) {
        const state = await github.deployment(publication.revision);
        if (revision !== pollRevision) return;
        if (state.url) deployLink.href = state.url;
        if (state.state === "failed" || state.state === "skipped") {
          text.textContent =
            state.state === "failed"
              ? "文章已提交，但构建或部署失败，尚未确认上线。请查看部署记录。"
              : "本次部署已跳过，可能已有更新的提交。请查看最新部署记录。";
          return;
        }
        text.textContent =
          state.state === "deployed"
            ? "部署完成，正在确认线上文章…"
            : "文章已提交，GitHub 正在构建与部署…";
      }
    } catch {
      if (revision === pollRevision)
        text.textContent =
          "文章已提交，暂时无法确认部署状态。可打开部署记录查看。";
    }
    if (revision === pollRevision && attempt < 59)
      pollTimer = setTimeout(() => void poll(attempt + 1), 10_000);
    else if (revision === pollRevision)
      text.textContent =
        "文章已提交，暂未确认上线。请查看部署记录，稍后重新打开草稿可继续检查。";
  };
  await poll();
}

$("[data-connect-form]").addEventListener("submit", async event => {
  event.preventDefault();
  if (connecting) return;
  const field = $<HTMLInputElement>("[data-token]");
  const token = field.value.trim();
  field.value = "";
  if (!token.startsWith("github_pat_")) {
    $("[data-connect-error]").textContent =
      "请使用以 github_pat_ 开头、仅授权本仓库的细粒度访问令牌。";
    return;
  }
  const button = $<HTMLButtonElement>("[data-connect-submit]");
  connecting = true;
  button.disabled = true;
  try {
    const result = await github.connect(token);
    if (!connectDialog.open) {
      github.disconnect();
      return;
    }
    repositoryPrivate = result.private;
    $("[data-repository-privacy]").textContent = result.private
      ? "仓库草稿在 GitHub 权限范围内可见。"
      : "这是公开仓库。私密草稿请保留在本机，不要同步到仓库。";
    updateConnection();
    connectDialog.close();
    feedback(`已连接 ${result.login}，可以载入文章或准备发布`);
    await loadPosts();
  } catch (error) {
    $("[data-connect-error]").textContent = message(error);
  } finally {
    button.disabled = false;
    connecting = false;
  }
});
connectDialog.addEventListener("close", () => {
  $<HTMLInputElement>("[data-token]").value = "";
});

$("[data-publish-form]").addEventListener("submit", async event => {
  event.preventDefault();
  if (!prepared || busy) return;
  busy = true;
  const pending = prepared;
  const button = $<HTMLButtonElement>("[data-confirm-publish]");
  button.disabled = true;
  button.textContent = "正在提交…";
  try {
    const publication = await github.save(
      pending.article,
      pending.draft.remote
    );
    pending.draft.remote = {
      path: publication.path,
      sha: publication.sha,
      published: !publication.draft,
    };
    pending.draft.data = { ...pending.article.data };
    pending.draft.publication = publication;
    publishDialog.close();
    fillDraft();
    saveLocal("文章版本已更新，本机草稿已保存");
    await loadPosts();
  } catch (error) {
    $("[data-publish-error]").textContent = message(error);
    button.textContent = "重试提交";
    updateConnection();
  } finally {
    busy = false;
    button.disabled = false;
  }
});
publishDialog.addEventListener("cancel", event => {
  if (busy) event.preventDefault();
});
for (const close of $$("[data-close]"))
  close.addEventListener("click", () => {
    if (!busy) close.closest("dialog")?.close();
  });

$("[data-connect]").addEventListener("click", () => {
  if (github.connected) {
    github.disconnect();
    posts = [];
    updateConnection();
    feedback("已断开 GitHub，访问令牌已从当前会话清除");
  } else openConnection();
});
$("[data-save]").addEventListener("click", () => saveLocal());
$("[data-details]").addEventListener("click", () => fields.title.focus());
$("[data-export]").addEventListener("click", exportMarkdown);
$("[data-publish]").addEventListener("click", () => preparePublication());
$("[data-sync-draft]").addEventListener("click", () =>
  preparePublication(true)
);
$("[data-new]").addEventListener("click", () => addDraft(newDraft()));
$("[data-preview-mode]").addEventListener("click", () =>
  setTab(
    $("[data-editor-body]").dataset.mode === "preview" ? "edit" : "preview"
  )
);
$("[data-refresh-posts]").addEventListener("click", () => void loadPosts());
$("[data-load-post]").addEventListener("click", () => {
  const post = posts.find(
    item => item.path === $<HTMLSelectElement>("[data-remote-post]").value
  );
  if (!post) {
    feedback("请先选择一篇仓库文章");
    return;
  }
  const draft = newDraft({ ...post.data }, post.body);
  draft.remote = {
    path: post.path,
    sha: post.sha,
    published: !post.data.draft,
  };
  addDraft(draft);
});
$("[data-local-draft]").addEventListener("change", event => {
  const nextId = (event.target as HTMLSelectElement).value;
  if (!saveLocal()) return;
  library.activeId = nextId;
  fillDraft();
  saveLocal("已切换本机草稿");
});
$("[data-delete-draft]").addEventListener("click", () => {
  if (confirm("删除这份本机草稿？仓库中的文章不会被删除。")) {
    library.removeActive();
    fillDraft();
    saveLocal("已删除本机草稿");
  }
});
$("[data-import-button]").addEventListener("click", () =>
  $<HTMLInputElement>("[data-import]").click()
);
$("[data-import]").addEventListener("change", async event => {
  const field = event.target as HTMLInputElement;
  const file = field.files?.[0];
  field.value = "";
  if (!file) return;
  try {
    if (file.size > MAX_DOCUMENT_BYTES)
      throw new WriterError("导入文件不能超过 240 KB。");
    const parsed = parseMarkdownFile(await file.text());
    addDraft(newDraft(parsed.data, parsed.body));
  } catch (error) {
    feedback(message(error));
  }
});
editor.addEventListener("input", () => {
  scheduleSave();
  clearTimeout(previewTimer);
  previewTimer = setTimeout(() => void updatePreview(), 250);
});
for (const field of Object.values(fields))
  field.addEventListener("input", scheduleSave);
for (const button of $$("[data-format]"))
  button.addEventListener("click", () => format(button.dataset.format!));
for (const tab of $$<HTMLButtonElement>("[data-tab]")) {
  tab.addEventListener("click", () => setTab(tab.dataset.tab!));
  tab.addEventListener("keydown", event => {
    const tabs = $$<HTMLButtonElement>("[data-tab]");
    let index = tabs.indexOf(tab);
    if (event.key === "ArrowRight") index = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft")
      index = (index + tabs.length - 1) % tabs.length;
    else if (event.key === "Home") index = 0;
    else if (event.key === "End") index = tabs.length - 1;
    else return;
    event.preventDefault();
    tabs[index].focus();
    setTab(tabs[index].dataset.tab!);
  });
}
document.addEventListener("keydown", event => {
  if (
    !(event.metaKey || event.ctrlKey) ||
    connectDialog.open ||
    publishDialog.open
  )
    return;
  const key = event.key.toLowerCase();
  if (key === "s") {
    event.preventDefault();
    saveLocal();
  }
  if (key === "enter") {
    event.preventDefault();
    preparePublication();
  }
  if (document.activeElement === editor && ["b", "i"].includes(key)) {
    event.preventDefault();
    format(key === "b" ? "bold" : "italic");
  }
});
window.addEventListener("storage", event => {
  if (event.key === DRAFTS_KEY) {
    storageChanged = true;
    feedback("另一标签页已更新草稿，请导出当前修改后刷新页面。");
  }
});
window.addEventListener("beforeunload", event => {
  if (unsaved && !saveLocal()) event.preventDefault();
});
window.addEventListener("pagehide", () => {
  if (unsaved) saveLocal();
  github.disconnect();
  $<HTMLInputElement>("[data-token]").value = "";
  clearTimeout(pollTimer);
});
window.addEventListener("pageshow", () => updateConnection());
fillDraft();
feedback(
  library.warning || (library.active.body ? "已恢复本机草稿" : "准备开始写作")
);
if (window.matchMedia("(max-width: 680px)").matches) setTab("edit");
$("[data-writer]").dataset.ready = "true";
