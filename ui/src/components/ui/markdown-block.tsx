import { useMemo } from "react";

const replaceLiteralAll = (value: string, search: string, next: string) => value.split(search).join(next);

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatMarkdownInline = (value: string) =>
  value
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");

const markdownToHtml = (markdown: string) => {
  const source = replaceLiteralAll(escapeHtml(markdown || ""), "\r\n", "\n");
  const lines = source.split("\n");
  const html: string[] = [];
  const paragraphBuffer: string[] = [];
  let inUl = false;
  let inOl = false;
  let inCode = false;
  const codeBuffer: string[] = [];

  const flushParagraph = () => {
    if (paragraphBuffer.length === 0) return;
    html.push(`<p>${formatMarkdownInline(paragraphBuffer.join("<br />"))}</p>`);
    paragraphBuffer.length = 0;
  };

  const closeLists = () => {
    if (inUl) {
      html.push("</ul>");
      inUl = false;
    }
    if (inOl) {
      html.push("</ol>");
      inOl = false;
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (inCode) {
      if (trimmed.startsWith("```")) {
        html.push(`<pre><code>${codeBuffer.join("\n")}</code></pre>`);
        inCode = false;
        codeBuffer.length = 0;
      } else {
        codeBuffer.push(line);
      }
      continue;
    }

    if (trimmed.startsWith("```")) {
      flushParagraph();
      closeLists();
      inCode = true;
      continue;
    }

    if (!trimmed) {
      flushParagraph();
      closeLists();
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      closeLists();
      const level = headingMatch[1].length;
      html.push(`<h${level}>${formatMarkdownInline(headingMatch[2])}</h${level}>`);
      continue;
    }

    const quoteMatch = trimmed.match(/^>\s?(.*)$/);
    if (quoteMatch) {
      flushParagraph();
      closeLists();
      html.push(`<blockquote>${formatMarkdownInline(quoteMatch[1])}</blockquote>`);
      continue;
    }

    const ulMatch = trimmed.match(/^[-*]\s+(.+)$/);
    if (ulMatch) {
      flushParagraph();
      if (inOl) {
        html.push("</ol>");
        inOl = false;
      }
      if (!inUl) {
        html.push("<ul>");
        inUl = true;
      }
      html.push(`<li>${formatMarkdownInline(ulMatch[1])}</li>`);
      continue;
    }

    const olMatch = trimmed.match(/^\d+\.\s+(.+)$/);
    if (olMatch) {
      flushParagraph();
      if (inUl) {
        html.push("</ul>");
        inUl = false;
      }
      if (!inOl) {
        html.push("<ol>");
        inOl = true;
      }
      html.push(`<li>${formatMarkdownInline(olMatch[1])}</li>`);
      continue;
    }

    closeLists();
    paragraphBuffer.push(trimmed);
  }

  flushParagraph();
  closeLists();

  if (inCode) {
    html.push(`<pre><code>${codeBuffer.join("\n")}</code></pre>`);
  }

  return html.join("");
};

export const MarkdownBlock = ({ content, className }: { content: string; className?: string }) => {
  const html = useMemo(() => markdownToHtml(content), [content]);
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
};
