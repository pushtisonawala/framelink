import { z } from "zod";

export const emailSchema = z.string().trim().toLowerCase().email().max(254);
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128);
export const nameSchema = z.string().trim().min(1).max(120);

export const registerSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: passwordSchema,
});

export const createEventSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  date: z.coerce.date().optional(),
});

export const updateEventSchema = createEventSchema.partial();

export const addMemberSchema = z.object({
  email: emailSchema,
  name: nameSchema.optional(),
});

export const registerUploadSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"]),
  fileSize: z.number().int().positive(),
});

export const selectPhotosSchema = z.object({
  photoIds: z.array(z.string().min(1)).min(1).max(2000),
  selected: z.boolean(),
});

export const createGallerySchema = z.object({
  title: z.string().trim().min(1).max(160),
  photoIds: z.array(z.string().min(1)).min(1, "Select at least one photo").max(5000),
  pin: z
    .string()
    .regex(/^\d{4,8}$/u, "PIN must be 4–8 digits")
    .optional(),
  allowDownload: z.boolean().optional().default(true),
  expiresAt: z.coerce.date().optional(),
  publish: z.boolean().optional().default(true),
});

export const updateGallerySchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  photoIds: z.array(z.string().min(1)).max(5000).optional(),
  allowDownload: z.boolean().optional(),
  expiresAt: z.coerce.date().nullable().optional(),
  published: z.boolean().optional(),
  rotatePin: z.boolean().optional(),
  pin: z
    .string()
    .regex(/^\d{4,8}$/u, "PIN must be 4–8 digits")
    .optional(),
});

export const verifyPinSchema = z.object({
  pin: z.string().trim().min(1).max(16),
});

export const paginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  q: z.string().trim().max(120).optional(),
  uploadedBy: z.string().optional(),
  selected: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  status: z.enum(["PENDING", "READY", "FAILED"]).optional(),
});
