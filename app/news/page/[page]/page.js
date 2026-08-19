import { notFound } from "next/navigation";
import NewsPage, {
  generateMetadata as generateBaseMetadata,
} from "@/app/news/page.js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function parsePage(value) {
  const page = Number(value);
  return Number.isInteger(page) && page >= 2 ? page : null;
}

export async function generateMetadata({ params }) {
  const resolved = await params;
  const page = parsePage(resolved?.page);
  if (!page) return {};

  return generateBaseMetadata({
    searchParams: Promise.resolve({ page }),
  });
}

export default async function NewsArchivePage({ params }) {
  const resolved = await params;
  const page = parsePage(resolved?.page);
  if (!page) notFound();

  return NewsPage({
    searchParams: Promise.resolve({ page }),
  });
}
