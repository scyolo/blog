import { readdir, readFile, lstat } from "node:fs/promises";
import { resolve, relative, isAbsolute } from "node:path";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { parse } from "parse5";
import { XMLParser } from "fast-xml-parser";
import { SyntaxValidator } from "fast-xml-validator";
import { isVisible } from "../../src/lib/publication.ts";

const hash = value => createHash("sha256").update(value).digest("hex");
const array = value =>
  value == null ? [] : Array.isArray(value) ? value : [value];
const equalSet = (actual, expected, label) => {
  const left = [...actual].sort();
  const right = [...expected].sort();
  if (
    new Set(left).size !== left.length ||
    JSON.stringify(left) !== JSON.stringify(right)
  )
    throw new Error(
      label + " 不一致: " + JSON.stringify({ actual: left, expected: right })
    );
};

export async function artifactFiles(directory) {
  const root = resolve(directory);
  const paths = [];
  async function visit(path) {
    const stat = await lstat(path);
    if (stat.isSymbolicLink())
      throw new Error("产物不允许文件系统链接: " + path);
    if (stat.isDirectory()) {
      for (const name of (await readdir(path)).sort())
        await visit(resolve(path, name));
    } else if (stat.isFile()) {
      paths.push(relative(root, path).replaceAll("\\", "/"));
    } else throw new Error("产物不允许特殊文件: " + path);
  }
  await visit(root);
  return paths.sort();
}

export async function createManifest(directory) {
  const files = {};
  for (const name of await artifactFiles(directory)) {
    const bytes = await readFile(resolve(directory, name));
    files[name] = { bytes: bytes.length, sha256: hash(bytes) };
  }
  return { version: 1, files };
}

export async function assertManifest(directory, expected) {
  if (
    expected.version !== 1 ||
    !expected.files ||
    typeof expected.files !== "object"
  )
    throw new Error("无效的产物 manifest 清单");
  const actual = await createManifest(directory);
  const canonical = manifest =>
    JSON.stringify(
      Object.entries(manifest.files).sort(([a], [b]) => a.localeCompare(b))
    );
  if (canonical(actual) !== canonical(expected))
    throw new Error(
      "产物 manifest 不匹配：文件已增加、删除或改变，必须重新验证，禁止部署"
    );
}

function readHtml(source) {
  const nodes = [];
  const walk = node => {
    nodes.push(node);
    node.childNodes?.forEach(walk);
  };
  walk(parse(source));
  const attr = (node, key) =>
    node.attrs?.find(item => item.name === key)?.value;
  const text = node =>
    node?.value ?? (node?.childNodes ?? []).map(text).join("");
  const tag = name => nodes.filter(node => node.tagName === name);
  const meta = name =>
    attr(
      tag("meta").find(
        node => attr(node, "name") === name || attr(node, "property") === name
      ) ?? {},
      "content"
    );
  const canonical = attr(
    tag("link").find(node => attr(node, "rel") === "canonical") ?? {},
    "href"
  );
  return {
    nodes,
    attr,
    text,
    tag,
    meta,
    canonical,
    ids: new Set(nodes.map(node => attr(node, "id")).filter(Boolean)),
  };
}
const route = file =>
  file === "index.html" ? "/" : "/" + file.replace(/index\.html$/, "");

export async function verifyArtifact({ directory, posts, siteUrl }) {
  const root = resolve(directory);
  const names = await artifactFiles(root);
  const files = new Map();
  for (const name of names) {
    if (/(?:^|\/)\.|\.(?:mdx?|tsx?|pem|key|map|pfx|zip|bundle)$/i.test(name))
      throw new Error("产物中存在源文件或私有文件: " + name);
    const bytes = await readFile(resolve(root, name));
    if (bytes.length > 25 * 1024 * 1024)
      throw new Error("单文件超过 Pages 25 MiB 限制: " + name);
    if (/UNPUBLISHED_CANARY_[A-Z0-9_]+/.test(bytes.toString("utf8")))
      throw new Error("产物泄漏未发布内容: " + name);
    files.set(name, bytes);
  }
  if (names.length > 20000)
    throw new Error("产物超过 Pages 免费计划文件数限制");
  const read = name => {
    if (!files.has(name)) throw new Error("产物缺少文件: " + name);
    return files.get(name).toString("utf8");
  };
  const info = JSON.parse(read("build-info.json"));
  const site = new URL(siteUrl ?? info.siteUrl);
  if (
    info.version !== 1 ||
    !Number.isFinite(Date.parse(info.builtAt)) ||
    new URL(info.siteUrl).href !== site.href
  )
    throw new Error("构建元数据无效或站点地址不匹配");
  const publicUrl = path => new URL(path.replace(/^\/+/, ""), site);
  const visible = posts.filter(post =>
    isVisible(post.data, Date.parse(info.builtAt))
  );
  const postRoutes = visible.map(post => "/posts/" + post.data.slug + "/");
  const htmls = new Map(
    names
      .filter(name => name.endsWith(".html"))
      .map(name => [name, readHtml(read(name))])
  );
  for (const name of ["index.html", "404.html", "search/index.html"])
    read(name);
  equalSet(
    [...htmls.keys()]
      .filter(
        name =>
          /^posts\/[^/]+\/index\.html$/.test(name) &&
          !/^posts\/\d+\//.test(name)
      )
      .map(route),
    postRoutes,
    "已发布文章页面"
  );

  function localFile(value, from, { resource = false, anchor = false } = {}) {
    let url;
    try {
      url = new URL(value, publicUrl(from));
    } catch {
      throw new Error(from + ": 无效链接 " + value);
    }
    if (url.username || url.password)
      throw new Error(from + ": 链接不得包含用户名或密码");
    if (!["http:", "https:", "mailto:", "tel:"].includes(url.protocol))
      throw new Error(from + ": 不允许的链接协议 " + value);
    if (url.origin !== site.origin) {
      if (resource) throw new Error(from + ": 不允许第三方资源 " + value);
      return null;
    }
    if (!url.pathname.startsWith(site.pathname))
      throw new Error(from + ": 链接超出站点基础路径 " + value);
    let path;
    try {
      path = decodeURIComponent(url.pathname.slice(site.pathname.length));
    } catch {
      throw new Error(from + ": 无效编码链接 " + value);
    }
    const absolute = resolve(root, path);
    const rel = relative(root, absolute);
    if (rel.startsWith("..") || isAbsolute(rel) || /[\\\x00]/.test(path))
      throw new Error("链接超出产物目录: " + value);
    const file = [
      path,
      path.replace(/\/?$/, "/") + "index.html",
      path === "" ? "index.html" : null,
    ].find(candidate => candidate !== null && files.has(candidate));
    if (!file) throw new Error(from + ": 断链 " + value);
    if (
      anchor &&
      url.hash &&
      htmls.has(file) &&
      !htmls.get(file).ids.has(decodeURIComponent(url.hash.slice(1)))
    )
      throw new Error(from + ": 不存在的锚点 " + value);
    return file;
  }

  const indexable = [];
  for (const [name, document] of htmls) {
    const path = route(name);
    const { tag, attr, text, meta } = document;
    if (attr(tag("html")[0] ?? {}, "lang")?.toLowerCase() !== "zh-cn")
      throw new Error(path + ": 中文语言元信息缺失");
    if (tag("h1").length !== 1 || !text(tag("h1")[0]).trim())
      throw new Error(path + ": 必须有一个非空主标题");
    if (!text(tag("title")[0]).trim() || !meta("description")?.trim())
      throw new Error(path + ": 标题或描述元信息缺失");
    if (
      !document.canonical ||
      (name !== "404.html" && document.canonical !== publicUrl(path).href)
    )
      throw new Error(path + ": canonical 不匹配");
    if (!meta("og:image")) throw new Error(path + ": 缺少分享图");
    localFile(meta("og:image"), path, { resource: true });
    if (!meta("robots")?.includes("noindex"))
      indexable.push(publicUrl(path).href);
    for (const node of document.nodes) {
      if (node.tagName === "a" && attr(node, "href"))
        localFile(attr(node, "href"), path, { anchor: true });
      if (
        ["img", "script", "source"].includes(node.tagName) &&
        attr(node, "src")
      )
        localFile(attr(node, "src"), path, { resource: true });
      if (
        node.tagName === "link" &&
        ["stylesheet", "icon", "modulepreload", "preload"].includes(
          attr(node, "rel")
        )
      )
        localFile(attr(node, "href"), path, { resource: true });
      if (node.tagName === "img") {
        if (attr(node, "alt") === undefined)
          throw new Error(path + ": 图片缺少 alt");
        if (!(
          Number(attr(node, "width")) > 0 && Number(attr(node, "height")) > 0
        ))
          throw new Error(path + ": 图片必须包含尺寸");
      }
      if (attr(node, "srcset"))
        for (const item of attr(node, "srcset").split(","))
          localFile(item.trim().split(/\s+/)[0], path, { resource: true });
      if (
        node.tagName === "script" &&
        attr(node, "type") === "application/ld+json"
      ) {
        try {
          JSON.parse(text(node));
        } catch {
          throw new Error(path + ": 无效 JSON-LD");
        }
      }
    }
  }
  for (const name of names.filter(name => name.endsWith(".css"))) {
    for (const match of read(name).matchAll(
      /url\(\s*["']?([^\s"')]+)["']?\s*\)/g
    )) {
      if (match[1].startsWith("data:") || match[1].startsWith("#")) continue;
      localFile(match[1], "/" + name, { resource: true });
    }
  }

  const xml = name => {
    const source = read(name);
    try {
      if (
        /<!DOCTYPE/i.test(source) ||
        SyntaxValidator.validate(source) !== true
      )
        throw new Error("XML syntax rejected");
    } catch (error) {
      throw new Error("无效 XML: " + name + ": " + error.message);
    }
    return new XMLParser({
      ignoreAttributes: false,
      parseTagValue: false,
    }).parse(source);
  };
  const items = array(xml("rss.xml").rss?.channel?.item);
  equalSet(
    items.map(item => item.link),
    postRoutes.map(path => publicUrl(path).href),
    "RSS 文章"
  );
  for (const post of visible) {
    const item = items.find(
      item => item.link === publicUrl("/posts/" + post.data.slug + "/").href
    );
    if (
      item.title !== post.data.title ||
      item.description !== post.data.description ||
      Date.parse(item.pubDate) !==
        Math.floor(post.data.pubDatetime.getTime() / 1000) * 1000
    )
      throw new Error("RSS 标题、摘要或发布时间错误: " + post.data.slug);
  }
  const sitemapUrls = [];
  for (const entry of array(xml("sitemap-index.xml").sitemapindex?.sitemap)) {
    const file = localFile(entry.loc, "/sitemap-index.xml", { resource: true });
    for (const item of array(xml(file).urlset?.url)) sitemapUrls.push(item.loc);
  }
  equalSet(sitemapUrls, indexable, "sitemap 站点地图");

  const pagefind = JSON.parse(read("pagefind/pagefind-entry.json"));
  const indexed = [];
  for (const name of names.filter(name => name.endsWith(".pf_fragment"))) {
    try {
      const plain = gunzipSync(files.get(name)).toString("utf8");
      if (!plain.startsWith("pagefind_dcd"))
        throw new Error("unexpected format");
      const data = JSON.parse(plain.slice("pagefind_dcd".length));
      if (/UNPUBLISHED_CANARY_/.test(plain)) throw new Error("未发布内容");
      indexed.push(new URL(data.url, site).pathname);
    } catch (error) {
      throw new Error("Pagefind 片段无效: " + name, { cause: error });
    }
  }
  equalSet(indexed, postRoutes, "Pagefind 已发布索引");
  const pageCount = Object.values(pagefind.languages ?? {}).reduce(
    (total, language) => total + language.page_count,
    0
  );
  if (pageCount !== visible.length) throw new Error("Pagefind 页面计数不一致");
  return {
    pages: htmls.size,
    posts: visible.length,
    indexed: indexed.length,
    files: files.size,
    revision: info.revision,
    builtAt: info.builtAt,
  };
}
