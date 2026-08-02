import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function containsHtml(value = "") {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

export default function ArticleContent({ content, fallback }) {
  const value = String(content || fallback || "").trim();

  if (containsHtml(value)) {
    return (
      <div
        className="article-rich-content"
        dangerouslySetInnerHTML={{ __html: value }}
      />
    );
  }

  return (
    <div className="article-rich-content">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
    </div>
  );
}
