import ArticleContent from "@/components/ArticleContent";

export default function MainsAccordion({ mains, answerFramework, question }) {
  if (!mains && !answerFramework && !question) return null;

  return (
    <details id="mains" className="mains-accordion scroll-mt-28">
      <summary>
        <span>
          <small>Mains-only layer</small>
          <strong>✍️ Open Mains Perspective & Answer Framework</strong>
        </span>
        <span className="mains-accordion-action">Click to expand ↓</span>
      </summary>
      <div className="mains-accordion-body">
        {mains && (
          <section>
            <h2>Mains Perspective</h2>
            <ArticleContent content={mains} />
          </section>
        )}
        {answerFramework && (
          <section>
            <h2>Answer Framework</h2>
            <ArticleContent content={answerFramework} />
          </section>
        )}
        {question && (
          <section className="mains-question-box">
            <h2>Possible Mains Question</h2>
            <ArticleContent content={question} />
          </section>
        )}
      </div>
    </details>
  );
}
