# CA PDF live quality gate

Production CA PDF imports are normalized and quality-scored in Supabase before reader materialization. The 2026-09-11 hardening pass also stores renderer-safe heading forms for legacy ArticleContent normalization until the component-level canonical Markdown bypass is applied.

Required live checks after each batch:

- one FAST READ, WHY IN NEWS, TOP DATA & FACTS, PRELIMS, QUICK REVISION and objective question block
- exactly four MCQ options with separate Answer and Explanation
- one probable Mains question and one ~300-word structured answer
- no duplicate/empty headings created by renderer normalization
- one SOURCES section and working Prelims/Mains AI links
- publication date must match the PDF metadata date
