/**
 * Chuyển markdown thô thành Notion blocks (paragraph + heading + bulleted_list).
 */
export function markdownToBlocks(md: string): Record<string, unknown>[] {
  const blocks: Record<string, unknown>[] = [];
  const lines = md.split("\n");

  for (const line of lines) {
    if (!line.trim()) continue;

    if (line.startsWith("# ")) {
      blocks.push({
        object: "block",
        type: "heading_1",
        heading_1: { rich_text: [{ text: { content: line.slice(2) } }] },
      });
    } else if (line.startsWith("## ")) {
      blocks.push({
        object: "block",
        type: "heading_2",
        heading_2: { rich_text: [{ text: { content: line.slice(3) } }] },
      });
    } else if (line.startsWith("### ")) {
      blocks.push({
        object: "block",
        type: "heading_3",
        heading_3: { rich_text: [{ text: { content: line.slice(4) } }] },
      });
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      blocks.push({
        object: "block",
        type: "bulleted_list_item",
        bulleted_list_item: { rich_text: [{ text: { content: line.slice(2) } }] },
      });
    } else {
      blocks.push({
        object: "block",
        type: "paragraph",
        paragraph: { rich_text: [{ text: { content: line } }] },
      });
    }
  }
  return blocks;
}
