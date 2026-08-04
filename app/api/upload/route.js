import { NextResponse } from "next/server";
import { requireAuthenticatedAdmin } from "@/lib/adminAuth";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

export async function POST(request) {
  try {
    const auth = await requireAuthenticatedAdmin(request);
    if (!auth.ok) return auth.response;

    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      return NextResponse.json(
        {
          success: false,
          message: "Please select an image.",
        },
        { status: 400 }
      );
    }

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          success: false,
          message: "Only JPG, PNG and WEBP images are allowed.",
        },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          message: "Image size must be less than 5 MB.",
        },
        { status: 400 }
      );
    }

    const originalExtension =
      file.name.split(".").pop()?.toLowerCase() || "jpg";

    const safeExtension = ["jpg", "jpeg", "png", "webp"].includes(
      originalExtension
    )
      ? originalExtension
      : "jpg";

    const filePath = `articles/${Date.now()}-${crypto.randomUUID()}.${safeExtension}`;

    const fileBuffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await auth.supabase.storage
      .from("article-images")
      .upload(filePath, fileBuffer, {
        contentType: file.type,
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      console.error("Supabase upload error:", uploadError);

      return NextResponse.json(
        {
          success: false,
          message: uploadError.message,
        },
        { status: 500 }
      );
    }

    const { data: publicUrlData } = auth.supabase.storage
      .from("article-images")
      .getPublicUrl(filePath);

    return NextResponse.json({
      success: true,
      imageUrl: publicUrlData.publicUrl,
      filePath,
    });
  } catch (error) {
    console.error("Image upload API error:", error);

    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Image upload failed.",
      },
      { status: 500 }
    );
  }
}
