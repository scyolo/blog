interface HtmlNode {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: HtmlNode[];
}

/** GFM's disabled task checkboxes still need names in both preview and published HTML. */
export function rehypeTaskLabels() {
  return (tree: HtmlNode) => {
    const text = (node: HtmlNode): string =>
      node.value ?? node.children?.map(text).join("") ?? "";
    const visit = (node: HtmlNode, label = "任务状态") => {
      const name = node.tagName === "li" ? text(node).trim() || label : label;
      if (node.tagName === "input" && node.properties?.type === "checkbox")
        node.properties.ariaLabel = name;
      node.children?.forEach(child => visit(child, name));
    };
    visit(tree);
  };
}
