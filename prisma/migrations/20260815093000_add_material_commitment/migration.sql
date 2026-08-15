-- Add material_commitment field to content_about
ALTER TABLE "content_about" ADD COLUMN "material_commitment" TEXT NOT NULL DEFAULT '';

COMMENT ON COLUMN "content_about"."material_commitment" IS '材料真实性承诺书内容（富文本 HTML）';
