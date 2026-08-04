-- CreateTable
CREATE TABLE "addresses" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "contact" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admins" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "nickname" TEXT,
    "role" TEXT NOT NULL DEFAULT 'operator',
    "permissions" TEXT[],
    "status" INTEGER NOT NULL DEFAULT 1,
    "last_login_at" TIMESTAMP(3),
    "last_login_ip" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookkeeping_packages" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "taxpayer_type" TEXT NOT NULL,
    "cycle" TEXT NOT NULL,
    "base_price" DECIMAL(10,2) NOT NULL,
    "invoice_price" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "invoice_price_normal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "social_price" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "fund_price" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "description" TEXT,
    "features" TEXT,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "status" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bookkeeping_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_receipts" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "outlet_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "remark" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" INTEGER NOT NULL DEFAULT 1,
    "title" TEXT NOT NULL,
    "tax_no" TEXT,
    "bank" TEXT,
    "bank_account" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "materials" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "status" INTEGER NOT NULL DEFAULT 0,
    "remark" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "newspaper_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "status" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "sub_types" JSONB,

    CONSTRAINT "newspaper_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "newspaper_templates" (
    "id" TEXT NOT NULL,
    "newspaper_id" TEXT,
    "category_id" TEXT,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sample_data" TEXT,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "status" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "businessType" TEXT,
    "color" TEXT,
    "desc" TEXT,
    "templateType" TEXT,

    CONSTRAINT "newspaper_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "newspapers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "alias" TEXT,
    "publisher" TEXT,
    "province" TEXT,
    "city" TEXT,
    "price_per_word" DECIMAL(10,2) NOT NULL,
    "min_words" INTEGER NOT NULL DEFAULT 50,
    "coverage" INTEGER NOT NULL DEFAULT 1,
    "level" INTEGER NOT NULL DEFAULT 1,
    "image" TEXT,
    "description" TEXT,
    "status" INTEGER NOT NULL DEFAULT 1,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "category_id" TEXT,
    "city_code" TEXT,
    "province_code" TEXT,
    "region" TEXT,
    "enable_sections" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "newspapers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "newspaper_sections" (
    "id" TEXT NOT NULL,
    "newspaper_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "list_price" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "deadline_time" TEXT,
    "publish_cycle" TEXT,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "status" INTEGER NOT NULL DEFAULT 1,
    "remark" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "newspaper_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operation_logs" (
    "id" TEXT NOT NULL,
    "admin_id" TEXT,
    "module" TEXT,
    "action" TEXT,
    "target" TEXT,
    "detail" TEXT,
    "ip" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operation_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_assignments" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "outlet_id" TEXT NOT NULL,
    "status" INTEGER NOT NULL DEFAULT 1,
    "status_text" TEXT NOT NULL DEFAULT '待接单',
    "assigned_by" TEXT,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accepted_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "remark" TEXT,

    CONSTRAINT "order_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "item_type" TEXT NOT NULL,
    "seal_id" TEXT,
    "package_id" TEXT,
    "name" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "image" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outlet_notifications" (
    "id" TEXT NOT NULL,
    "outlet_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'order',
    "order_id" TEXT,
    "order_no" TEXT,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outlet_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_types" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,

    CONSTRAINT "business_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outlet_business_types" (
    "id" TEXT NOT NULL,
    "outlet_id" TEXT NOT NULL,
    "business_type_id" TEXT NOT NULL,

    CONSTRAINT "outlet_business_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outlets" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contact" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "province" TEXT,
    "city" TEXT,
    "district" TEXT,
    "address" TEXT,
    "status" INTEGER NOT NULL DEFAULT 1,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "total_orders" INTEGER NOT NULL DEFAULT 0,
    "last_login_at" TIMESTAMP(3),
    "last_login_ip" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "service_area" TEXT NOT NULL DEFAULT '[]',
    "business_license" TEXT,
    "special_permits" TEXT NOT NULL DEFAULT '[]',
    "outlet_openid" TEXT,
    "subscribe_msg" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "outlets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "personal_doc_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "desc" TEXT,
    "color" TEXT,
    "icon" TEXT,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "status" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "personal_doc_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "personal_doc_items" (
    "id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT,
    "desc" TEXT,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "status" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "personal_doc_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_replies" (
    "id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "author_type" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "author_name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_replies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "user_name" TEXT NOT NULL DEFAULT '热心用户',
    "content" TEXT NOT NULL,
    "images" TEXT[],
    "module" TEXT NOT NULL DEFAULT 'seal_biz',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reply_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "module" TEXT NOT NULL DEFAULT 'seal',
    "rating" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "images" TEXT[],
    "reply" TEXT,
    "reply_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seal_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "status" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seal_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seal_orders" (
    "id" TEXT NOT NULL,
    "order_no" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "module" TEXT NOT NULL DEFAULT 'seal',
    "type" TEXT NOT NULL DEFAULT '在线刻章',
    "company_name" TEXT,
    "legal_person" TEXT,
    "license_region" TEXT,
    "seal_reason" TEXT,
    "contact_phone" TEXT,
    "legal_phone" TEXT,
    "total_price" DECIMAL(10,2) NOT NULL,
    "pay_price" DECIMAL(10,2),
    "address_id" TEXT,
    "address_json" TEXT,
    "license_address_json" TEXT,
    "need_invoice" BOOLEAN NOT NULL DEFAULT false,
    "invoice_id" TEXT,
    "status" INTEGER NOT NULL DEFAULT 1,
    "status_text" TEXT NOT NULL DEFAULT '待支付',
    "remark" TEXT,
    "pay_time" TIMESTAMP(3),
    "pay_method" TEXT,
    "transaction_id" TEXT,
    "express_company" TEXT,
    "express_no" TEXT,
    "admin_remark" TEXT,
    "processed_by" TEXT,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "assignment_status" INTEGER NOT NULL DEFAULT 0,
    "delivered_at" TIMESTAMP(3),
    "delivery_status" INTEGER NOT NULL DEFAULT 0,
    "signed_at" TIMESTAMP(3),
    "newspaper_content" TEXT,
    "newspaper_issue_count" INTEGER,
    "invoice_json" TEXT,
    "newspaper_copy_count" INTEGER,
    "newspaper_id" TEXT,
    "newspaper_section_id" TEXT,
    "newspaper_section_name" TEXT,
    "newspaper_images" TEXT,

    CONSTRAINT "seal_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seal_packages" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "badge" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "seal_ids" TEXT[],
    "status" INTEGER NOT NULL DEFAULT 1,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "images" TEXT[],
    "region_prices" JSONB,

    CONSTRAINT "seal_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seal_scene_packages" (
    "scene_id" TEXT NOT NULL,
    "package_id" TEXT NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seal_scene_packages_pkey" PRIMARY KEY ("scene_id","package_id")
);

-- CreateTable
CREATE TABLE "seal_scene_seals" (
    "scene_id" TEXT NOT NULL,
    "seal_id" TEXT NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seal_scene_seals_pkey" PRIMARY KEY ("scene_id","seal_id")
);

-- CreateTable
CREATE TABLE "seal_scenes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "bgColor" TEXT,
    "route" TEXT,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "status" INTEGER NOT NULL DEFAULT 1,
    "sceneType" TEXT NOT NULL DEFAULT 'scene',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seal_scenes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seals" (
    "id" TEXT NOT NULL,
    "category_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "image" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "region_prices" JSON NOT NULL DEFAULT '{}',
    "status" INTEGER NOT NULL DEFAULT 1,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_configs" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "value_type" TEXT NOT NULL DEFAULT 'string',
    "group" TEXT NOT NULL DEFAULT 'default',
    "name" TEXT,
    "description" TEXT,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "status" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_banners" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "image" TEXT NOT NULL,
    "link" TEXT,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "status" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_banners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_announcements" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" INTEGER NOT NULL DEFAULT 1,
    "published_at" TIMESTAMP(3),
    "expired_at" TIMESTAMP(3),
    "operator" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_intros" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "image" TEXT NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "status" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_intros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "openid" TEXT,
    "unionid" TEXT,
    "nickname" TEXT,
    "avatar" TEXT,
    "phone" TEXT,
    "realname" TEXT,
    "id_card" TEXT,
    "status" INTEGER NOT NULL DEFAULT 1,
    "last_login_at" TIMESTAMP(3),
    "last_login_ip" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispatch_config" (
    "id" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'auto',
    "auto_assign" BOOLEAN NOT NULL DEFAULT true,
    "business_type_filter" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT,

    CONSTRAINT "dispatch_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outlet_priority" (
    "id" TEXT NOT NULL,
    "outlet_id" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "remark" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outlet_priority_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forced_manual_regions" (
    "id" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "city" TEXT,
    "remark" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT,

    CONSTRAINT "forced_manual_regions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admins_username_key" ON "admins"("username");

-- CreateIndex
CREATE UNIQUE INDEX "bookkeeping_packages_taxpayer_type_cycle_key" ON "bookkeeping_packages"("taxpayer_type", "cycle");

-- CreateIndex
CREATE INDEX "newspaper_sections_newspaper_id_status_idx" ON "newspaper_sections"("newspaper_id", "status");

-- CreateIndex
CREATE INDEX "newspaper_sections_newspaper_id_sort_idx" ON "newspaper_sections"("newspaper_id", "sort");

-- CreateIndex
CREATE UNIQUE INDEX "order_assignments_order_id_key" ON "order_assignments"("order_id");

-- CreateIndex
CREATE INDEX "outlet_notifications_outlet_id_created_at_idx" ON "outlet_notifications"("outlet_id", "created_at");

-- CreateIndex
CREATE INDEX "outlet_notifications_outlet_id_is_read_idx" ON "outlet_notifications"("outlet_id", "is_read");

-- CreateIndex
CREATE UNIQUE INDEX "business_types_name_key" ON "business_types"("name");

-- CreateIndex
CREATE UNIQUE INDEX "business_types_code_key" ON "business_types"("code");

-- CreateIndex
CREATE INDEX "outlet_business_types_business_type_id_idx" ON "outlet_business_types"("business_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "outlet_business_types_outlet_id_business_type_id_key" ON "outlet_business_types"("outlet_id", "business_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "outlets_phone_key" ON "outlets"("phone");

-- CreateIndex
CREATE INDEX "question_replies_question_id_idx" ON "question_replies"("question_id");

-- CreateIndex
CREATE INDEX "questions_module_status_idx" ON "questions"("module", "status");

-- CreateIndex
CREATE INDEX "questions_status_created_at_idx" ON "questions"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "seal_orders_order_no_key" ON "seal_orders"("order_no");

-- CreateIndex
CREATE UNIQUE INDEX "system_configs_key_key" ON "system_configs"("key");

-- CreateIndex
CREATE UNIQUE INDEX "users_openid_key" ON "users"("openid");

-- CreateIndex
CREATE UNIQUE INDEX "users_unionid_key" ON "users"("unionid");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "outlet_priority_outlet_id_key" ON "outlet_priority"("outlet_id");

-- AddForeignKey
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_receipts" ADD CONSTRAINT "delivery_receipts_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "seal_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_receipts" ADD CONSTRAINT "delivery_receipts_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "seal_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "newspaper_templates" ADD CONSTRAINT "newspaper_templates_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "newspaper_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "newspaper_templates" ADD CONSTRAINT "newspaper_templates_newspaper_id_fkey" FOREIGN KEY ("newspaper_id") REFERENCES "newspapers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "newspapers" ADD CONSTRAINT "newspapers_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "newspaper_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "newspaper_sections" ADD CONSTRAINT "newspaper_sections_newspaper_id_fkey" FOREIGN KEY ("newspaper_id") REFERENCES "newspapers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_assignments" ADD CONSTRAINT "order_assignments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "seal_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_assignments" ADD CONSTRAINT "order_assignments_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "seal_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "seal_packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_seal_id_fkey" FOREIGN KEY ("seal_id") REFERENCES "seals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outlet_notifications" ADD CONSTRAINT "outlet_notifications_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outlet_business_types" ADD CONSTRAINT "outlet_business_types_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outlet_business_types" ADD CONSTRAINT "outlet_business_types_business_type_id_fkey" FOREIGN KEY ("business_type_id") REFERENCES "business_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_doc_items" ADD CONSTRAINT "personal_doc_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "personal_doc_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_replies" ADD CONSTRAINT "question_replies_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "seal_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seal_orders" ADD CONSTRAINT "seal_orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seal_scene_packages" ADD CONSTRAINT "seal_scene_packages_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "seal_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seal_scene_packages" ADD CONSTRAINT "seal_scene_packages_scene_id_fkey" FOREIGN KEY ("scene_id") REFERENCES "seal_scenes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seal_scene_seals" ADD CONSTRAINT "seal_scene_seals_scene_id_fkey" FOREIGN KEY ("scene_id") REFERENCES "seal_scenes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seal_scene_seals" ADD CONSTRAINT "seal_scene_seals_seal_id_fkey" FOREIGN KEY ("seal_id") REFERENCES "seals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seals" ADD CONSTRAINT "seals_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "seal_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outlet_priority" ADD CONSTRAINT "outlet_priority_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
