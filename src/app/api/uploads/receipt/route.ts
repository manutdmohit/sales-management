import { NextResponse } from "next/server";
import { ensureProtectedApi } from "@/lib/api";
import {
  RECEIPT_MAX_BYTES,
  RECEIPT_MIME_TYPES,
  uploadReceiptImage,
  type ReceiptCategory,
} from "@/lib/cloudinary";
import { toErrorResponse, AppError } from "@/lib/errors";
import { businessService } from "@/services/business.service";

export async function POST(request: Request) {
  try {
    const session = await ensureProtectedApi();
    const form = await request.formData();
    const file = form.get("file");
    const businessId = form.get("businessId");
    const category = form.get("category");
    const label = form.get("label");

    if (!(file instanceof File)) {
      throw new AppError("file is required", 400);
    }
    if (typeof businessId !== "string" || !businessId.trim()) {
      throw new AppError("businessId is required", 400);
    }
    if (category !== "sales" && category !== "purchases" && category !== "appointments") {
      throw new AppError("category must be sales, purchases, or appointments", 400);
    }

    await businessService.getById(businessId);

    const mimeType = file.type || "application/octet-stream";
    if (!RECEIPT_MIME_TYPES.has(mimeType)) {
      throw new AppError(
        "Only JPEG, PNG, WebP, GIF, or HEIC images are allowed",
        400
      );
    }
    if (file.size > RECEIPT_MAX_BYTES) {
      throw new AppError("Image must be 5 MB or smaller", 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const receipt = await uploadReceiptImage(buffer, {
      businessId,
      category: category as ReceiptCategory,
      uploadedBy: session.sub,
      mimeType,
      label: typeof label === "string" && label.trim() ? label.trim() : undefined,
    });

    return NextResponse.json({ data: receipt }, { status: 201 });
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
