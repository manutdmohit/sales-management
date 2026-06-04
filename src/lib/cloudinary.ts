import { v2 as cloudinary } from "cloudinary";
import type { PaymentReceipt } from "@/domain/types";
import { AppError } from "@/lib/errors";
import type { ReceiptCategory } from "@/lib/receipt-display";

export type { ReceiptCategory };

export const RECEIPT_MAX_BYTES = 5 * 1024 * 1024;

export const RECEIPT_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]);

function cloudinaryConfigured(): boolean {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
  );
}

function ensureCloudinaryConfigured(): void {
  if (!cloudinaryConfigured()) {
    throw new AppError(
      "Receipt uploads are not configured (Cloudinary env vars missing)",
      503,
      "UPLOAD_NOT_CONFIGURED"
    );
  }
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

function receiptFolder(businessId: string, category: ReceiptCategory): string {
  const prefix = process.env.CLOUDINARY_FOLDER?.trim() || "inventory-platform";
  return `${prefix}/${businessId}/${category}`;
}

export function receiptBelongsToBusiness(
  receipt: Pick<PaymentReceipt, "publicId">,
  businessId: string,
  category: ReceiptCategory
): boolean {
  const folder = receiptFolder(businessId, category);
  return receipt.publicId.startsWith(`${folder}/`);
}

export function assertReceiptBelongsToBusiness(
  receipt: PaymentReceipt,
  businessId: string,
  category: ReceiptCategory
): void {
  if (!receiptBelongsToBusiness(receipt, businessId, category)) {
    throw new AppError("Receipt does not belong to this business", 400);
  }
}

export async function uploadReceiptImage(
  file: Buffer,
  options: {
    businessId: string;
    category: ReceiptCategory;
    uploadedBy?: string;
    mimeType: string;
    label?: string;
  }
): Promise<PaymentReceipt> {
  ensureCloudinaryConfigured();

  if (!RECEIPT_MIME_TYPES.has(options.mimeType)) {
    throw new AppError(
      "Only JPEG, PNG, WebP, GIF, or HEIC images are allowed",
      400
    );
  }
  if (file.length > RECEIPT_MAX_BYTES) {
    throw new AppError("Image must be 5 MB or smaller", 400);
  }

  const folder = receiptFolder(options.businessId, options.category);

  const result = await new Promise<{
    secure_url: string;
    public_id: string;
  }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
        allowed_formats: ["jpg", "jpeg", "png", "webp", "gif", "heic", "heif"],
      },
      (error, uploadResult) => {
        if (error || !uploadResult) {
          reject(error ?? new Error("Cloudinary upload failed"));
          return;
        }
        resolve({
          secure_url: uploadResult.secure_url,
          public_id: uploadResult.public_id,
        });
      }
    );
    stream.end(file);
  });

  return {
    url: result.secure_url,
    publicId: result.public_id,
    uploadedAt: new Date(),
    uploadedBy: options.uploadedBy,
    label: options.label,
  };
}

export { receiptThumbnailUrl } from "@/lib/receipt-display";
