import { redirect } from "next/navigation";
import { createCategorySlug } from "@/lib/categoryRouting";

export default async function LegacyCategoryPage({ params }) {
  const { category } = await params;
  redirect(`/category/${createCategorySlug(decodeURIComponent(category))}`);
}
