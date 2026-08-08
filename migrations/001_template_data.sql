-- ============================================================
-- 登报模块模板数据迁移
-- 运行时间: 2026-08-08
-- 说明: 完善报纸分类、模板数据，修复 announcement/praise 等接口返回空的问题
-- ============================================================

-- ---------------------------------------------------
-- 1. 报纸省份数据修正
-- ---------------------------------------------------
UPDATE newspapers
SET province = '四川省', province_code = '51'
WHERE province_code IS NULL OR province = 'Sichuan';

-- ---------------------------------------------------
-- 2. newspaper_categories 分类中文名更正
-- ---------------------------------------------------
UPDATE newspaper_categories
SET name = '个人证件' WHERE name = 'Personal Docs';
UPDATE newspaper_categories
SET name = '企业公告' WHERE name = 'Company News';
UPDATE newspaper_categories
SET name = '法院公告' WHERE name = 'Court Notice';
UPDATE newspaper_categories
SET name = '政府公告' WHERE name = 'Gov Procurement';
UPDATE newspaper_categories
SET name = '注销声明' WHERE name = 'Cancellation';

-- ---------------------------------------------------
-- 3. 新增独立分类（INVOICE/ANNOUNCEMENT/PRAISE 及业务分类）
-- ---------------------------------------------------
INSERT INTO newspaper_categories (id, name, icon, sort, status, created_at, updated_at) VALUES
  ('C0000001-0001-0001-0001-000000000001', '发票收据', 1, 10, 1, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO newspaper_categories (id, name, icon, sort, status, created_at, updated_at) VALUES
  ('C0000001-0002-0001-0001-000000000001', '公告声明', 1, 11, 1, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO newspaper_categories (id, name, icon, sort, status, created_at, updated_at) VALUES
  ('C0000001-0003-0001-0001-000000000001', '表扬信', 1, 12, 1, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO newspaper_categories (id, name, icon, sort, status, created_at, updated_at) VALUES
  ('B0000001-0001-0001-0001-000000000001', '企业证件', 1, 6, 1, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO newspaper_categories (id, name, icon, sort, status, created_at, updated_at) VALUES
  ('B0000001-0002-0001-0001-000000000001', '招标公告', 1, 13, 1, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO newspaper_categories (id, name, icon, sort, status, created_at, updated_at) VALUES
  ('B0000001-0003-0001-0001-000000000001', '拍卖公告', 1, 14, 1, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO newspaper_categories (id, name, icon, sort, status, created_at, updated_at) VALUES
  ('B0000001-0004-0001-0001-000000000001', '债权债务', 1, 15, 1, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO newspaper_categories (id, name, icon, sort, status, created_at, updated_at) VALUES
  ('B0000001-0005-0001-0001-000000000001', '登报道歉', 1, 16, 1, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO newspaper_categories (id, name, icon, sort, status, created_at, updated_at) VALUES
  ('B0000001-0006-0001-0001-000000000001', '劳动纠纷', 1, 17, 1, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO newspaper_categories (id, name, icon, sort, status, created_at, updated_at) VALUES
  ('B0000001-0007-0001-0001-000000000001', '宣传稿', 1, 18, 1, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------
-- 4. personal_doc_categories / personal_doc_items
-- ---------------------------------------------------
INSERT INTO personal_doc_categories (id, name, "desc", color, icon, sort, status, created_at, updated_at) VALUES
  ('PDC001-0001-0001-0001-000000000001', '身份证', '身份证遗失声明', '#5B6FE8', 'idcard', 1, 1, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
INSERT INTO personal_doc_categories (id, name, "desc", color, icon, sort, status, created_at, updated_at) VALUES
  ('PDC002-0001-0001-0001-000000000001', '户口本', '户口本遗失声明', '#7B5CFA', 'hukou', 2, 1, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
INSERT INTO personal_doc_categories (id, name, "desc", color, icon, sort, status, created_at, updated_at) VALUES
  ('PDC003-0001-0001-0001-000000000001', '护照', '护照遗失声明', '#9254DE', 'passport', 3, 1, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
INSERT INTO personal_doc_categories (id, name, "desc", color, icon, sort, status, created_at, updated_at) VALUES
  ('PDC004-0001-0001-0001-000000000001', '驾驶证', '驾驶证遗失声明', '#FA8C16', 'driver', 4, 1, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
INSERT INTO personal_doc_categories (id, name, "desc", color, icon, sort, status, created_at, updated_at) VALUES
  ('PDC005-0001-0001-0001-000000000001', '银行卡', '银行卡遗失声明', '#52C41A', 'bankcard', 5, 1, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
INSERT INTO personal_doc_categories (id, name, "desc", color, icon, sort, status, created_at, updated_at) VALUES
  ('PDC006-0001-0001-0001-000000000001', '执照证书', '营业执照及各类证书遗失', '#F5222D', 'license', 6, 1, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
INSERT INTO personal_doc_categories (id, name, "desc", color, icon, sort, status, created_at, updated_at) VALUES
  ('PDC007-0001-0001-0001-000000000001', '房产证', '房产证遗失声明', '#FA541C', 'house', 7, 1, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
INSERT INTO personal_doc_categories (id, name, "desc", color, icon, sort, status, created_at, updated_at) VALUES
  ('PDC008-0001-0001-0001-000000000001', '学历证书', '学历学位证书遗失声明', '#13C2C2', 'diploma', 8, 1, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- 17条个人证件模板
DO $$
DECLARE
  item_id TEXT;
  items_arr TEXT[][] := ARRAY[
    ['PDC001-0001-0001-0001-000000000001', '居民身份证遗失声明', '[姓名]遗失居民身份证，证件编号：[身份证号码]，声明作废。', '适用于居民身份证遗失'],
    ['PDC001-0001-0001-0001-000000000001', '第二代身份证遗失声明', '[姓名]遗失第二代居民身份证，证件编号：[号码]，有效期至[日期]，声明作废。', '第二代身份证遗失'],
    ['PDC002-0001-0001-0001-000000000001', '户口簿遗失声明', '[姓名]遗失户口簿，户号：[户号]，声明作废。', '适用于户口簿遗失'],
    ['PDC002-0001-0001-0001-000000000001', '常住人口登记卡遗失', '[姓名]遗失常住人口登记卡，卡号：[卡号]，声明作废。', '常住人口登记卡遗失'],
    ['PDC003-0001-0001-0001-000000000001', '护照遗失声明', '[姓名]遗失中华人民共和国护照，护照号码：[号码]，声明作废。', '适用于护照遗失'],
    ['PDC003-0001-0001-0001-000000000001', '往来港澳通行证遗失声明', '[姓名]遗失往来港澳通行证，证件号码：[号码]，声明作废。', '往来港澳通行证遗失'],
    ['PDC004-0001-0001-0001-000000000001', '机动车驾驶证遗失声明', '[姓名]遗失机动车驾驶证，证号：[证号]，声明作废。', '机动车驾驶证遗失'],
    ['PDC004-0001-0001-0001-000000000001', '行驶证遗失声明', '[姓名]遗失机动车行驶证，车牌号：[车牌号]，声明作废。', '行驶证遗失'],
    ['PDC005-0001-0001-0001-000000000001', '银行卡遗失声明', '[姓名]遗失[银行名称]银行卡，卡号：[卡号]，声明作废。', '银行卡遗失'],
    ['PDC005-0001-0001-0001-000000000001', '信用卡遗失声明', '[姓名]遗失[银行名称]信用卡，卡号：[卡号]，声明作废。', '信用卡遗失'],
    ['PDC006-0001-0001-0001-000000000001', '营业执照遗失声明', '[公司名称]遗失营业执照，注册号：[号码]，声明作废。', '企业营业执照遗失'],
    ['PDC006-0001-0001-0001-000000000001', '公章遗失声明', '[公司名称]遗失公章（编号：[编号]），声明作废。', '企业公章遗失'],
    ['PDC006-0001-0001-0001-000000000001', '食品经营许可证遗失声明', '[公司名称]遗失食品经营许可证，许可证号：[号码]，声明作废。', '食品经营许可证遗失'],
    ['PDC007-0001-0001-0001-000000000001', '房产证遗失声明', '[权利人]遗失位于[地址]的房屋所有权证，证号：[号码]，声明作废。', '房产证遗失'],
    ['PDC007-0001-0001-0001-000000000001', '不动产权证遗失声明', '[权利人]遗失不动产权证，证号：[号码]，声明作废。', '不动产权证遗失'],
    ['PDC008-0001-0001-0001-000000000001', '大学毕业证遗失声明', '[姓名]遗失[学校名称][学历]毕业证书，证书编号：[号码]，声明作废。', '大学毕业证遗失'],
    ['PDC008-0001-0001-0001-000000000001', '学位证书遗失声明', '[姓名]遗失[学校名称][学位]学位证书，证书编号：[号码]，声明作废。', '学位证书遗失']
  ];
  arr_elem TEXT[];
BEGIN
  FOR i IN 1..array_length(items_arr, 1) LOOP
    arr_elem := items_arr[i];
    item_id := 'PDI' || lpad(i::TEXT, 3, '0') || '-0001-0001-0001-000000000001';
    INSERT INTO personal_doc_items (id, category_id, name, content, "desc", sort, status, created_at, updated_at)
    VALUES (item_id, arr_elem[1], arr_elem[2], arr_elem[3], arr_elem[4], i, 1, NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content;
  END LOOP;
END $$;

-- ---------------------------------------------------
-- 5. 公告声明模板 (9分组，34条)
-- groupConfig keys: company/estate/seal/debt/lost/property/stock/notary/vehicle
-- ---------------------------------------------------
DO $$
DECLARE
  ANNOUNCEMENT TEXT := 'C0000001-0002-0001-0001-000000000001';
  templates_arr TEXT[][] := ARRAY[
    -- company (9条)
    ['减资公告', 'company', '[公司名称]经股东会决议，拟将注册资本由[原金额]万元减少至[新金额]万元，请债权人于见报之日起45日内申报债权。'],
    ['清算公告', 'company', '[公司名称]因[原因]，经股东会决议成立清算组进行清算。请各债权人于见报之日起45日内向清算组申报债权。'],
    ['公司更名公告', 'company', '[公司名称]经工商行政管理机关核准，自[日期]起正式更名为"[新名称]"，原公司名称一切业务由新名称继续承接。'],
    ['吸收合并公告', 'company', '[存续公司名称]与[注销公司名称]经各自股东会决议决定吸收合并，合并后[存续公司]存续经营，[注销公司]依法注销。'],
    ['注销公告', 'company', '[公司名称]因[原因]经股东会决议解散，请债权人在见报之日起45日内向公司清算组申报债权，逾期未报视为放弃债权。'],
    ['简易注销公告', 'company', '[公司名称]（统一社会信用代码：[代码]）拟申请简易注销登记，请有债权债务的债权人自公告之日起45日内申报。'],
    ['股权变更公告', 'company', '[公司名称]股权发生变更，[转让方]将持有的[百分比]%股权转让给[受让方]，特此公告。'],
    ['股权转让公告', 'company', '[公司名称]股东[原股东]将其持有的公司[百分比]%股权以人民币[金额]元转让给[新股东]，请相关方知悉。'],
    ['简易注销债权人公告', 'company', '[公司名称]申请简易注销，请有债权债务的债权人于公告之日起45日内持债权证明材料至[地址]申报，过期不予受理。'],
    -- estate (5条)
    ['工程款结算公告', 'estate', '[项目名称]工程已竣工验收，请各施工单位于[日期]前携带相关凭证到[地址]办理工程款结算手续，逾期不予办理。'],
    ['竣工验收公告', 'estate', '[项目名称]工程已按设计文件要求完成建设，定于[日期]组织竣工验收，届时请相关单位派员参加，特此公告。'],
    ['交房公告', 'estate', '[楼盘名称]项目已通过竣工验收，符合交付条件。通知各业主于[日期]起办理交房手续，详情请咨询：[电话]。'],
    ['道路封闭公告', 'estate', '因[原因]施工需要，决定对[道路名称]实施封闭管理。封闭时间：[日期]，请过往车辆及行人绕行，带来不便敬请谅解。'],
    ['房屋租赁催告', 'estate', '[承租人姓名]租赁[地址]房屋，租金已逾期[天数]日未付。请于[日期]前支付所欠租金共计[金额]元，逾期将依法追究。'],
    -- seal (4条)
    ['合同作废声明', 'seal', '[公司名称]遗失[合同名称]，合同编号：[号码]，签约日期：[日期]，声明作废，自作废之日起不再具有法律效力。'],
    ['未备案公章免责声明', 'seal', '[公司名称]声明：本公司现有公章[数量]枚，已在公安机关备案。未备案公章不具备法律效力，由此产生的一切后果本公司不承担。'],
    ['公章被盗免责声明', 'seal', '[公司名称]公章（编号：[编号]）于[日期]被盗，已向公安机关报案并声明作废。擅用此公章者须承担法律责任。'],
    ['证照印章作废公告', 'seal', '[公司名称]遗失以下证照/印章，声明作废：[名称]，证号：[号码]。如有使用均属非法，本公司概不负责。'],
    -- debt (4条)
    ['催告函', 'debt', '[债务人]欠[债权人]款项人民币[金额]元，还款期限已过。请接函后[天数]日内归还全部欠款，逾期将依法采取法律手段追索。'],
    ['债务逾期催收通知书', 'debt', '致[债务人]：截至[日期]，贵方共欠付[金额]元，已逾期[天数]日。请于本通知送达之日起[天数]日内清偿全部债务。'],
    ['债权转让公告', 'debt', '[原债权人]将持有的[债务人]债权人民币[金额]元依法转让给[受让人]，债务人请直接向受让人清偿债务。'],
    ['资产处置公告', 'debt', '[公司名称]依法对以下资产进行公开处置：[资产清单]，有意者请于[日期]前与本公司联系，联系电话：[号码]。'],
    -- lost (3条)
    ['挂失公告', 'lost', '[单位/个人名称]遗失[物品名称]，[编号]：[号码]，声明作废，由此引起的一切纠纷由遗失者自负。'],
    ['发票遗失声明', 'lost', '[公司名称]遗失[类型]发票，发票代码：[代码]，发票号码：[号码]，开票日期：[日期]，金额：[金额]，声明作废。'],
    ['支票遗失声明', 'lost', '[公司名称]遗失[空白/已填]支票，支票号码：[号码]，出票日期：[日期]，票面金额：[金额]，声明作废并办理挂失止付。'],
    -- property (2条)
    ['财产转让公告', 'property', '[转让方名称]将以下财产依法公开转让：[财产清单]，转让价格：[金额]，有意者请于[日期]前联系：[联系方式]。'],
    ['知识产权转让公告', 'property', '[权利人]将拥有的以下知识产权依法转让给[受让人]：[商标/专利/著作权名称]，转让后原权利人不再享有相关权益。'],
    -- stock (2条)
    ['增资扩股公告', 'stock', '[公司名称]为发展需要，拟增加注册资本至[金额]万元，现有股东按持股比例优先认缴，欢迎有实力的投资者参与。'],
    ['股权激励授予公告', 'stock', '[公司名称]经股东会决议，决定对[员工/高管名单]授予限制性股票[数量]股，授予价格：[金额]元/股，自[日期]起生效。'],
    -- notary (2条)
    ['公证公告', 'notary', '[公证处名称]受[申请人]委托，对[事项]进行公证，定于[日期]在[地点]办理，请相关当事人准时到场。公证员：[姓名]。'],
    ['遗嘱公证公告', 'notary', '[立遗嘱人姓名]于[日期]在我处立有公证遗嘱一份，内容涉及[财产简要]，现依《公证法》规定予以保密。'],
    -- vehicle (3条)
    ['车辆转让公告', 'vehicle', '[车主姓名]名下车辆[车牌号]，车型[车型]，车架号[车架号]，发动机号[发动机号]，现依法转让给[买方]，请尽快办理过户。'],
    ['车辆报废公告', 'vehicle', '[单位名称]名下车辆[车牌号]已达到报废标准，现依法申请注销登记。请相关部门办理注销手续，特此公告。'],
    ['车辆证件遗失声明', 'vehicle', '[车主]遗失车辆[行驶证/登记证书]，车号[车牌号]，证号[号码]，声明作废，停止使用，遗失其间产生的一切法律责任自负。']
  ];
  arr_elem TEXT[];
  t_id TEXT;
BEGIN
  FOR i IN 1..array_length(templates_arr, 1) LOOP
    arr_elem := templates_arr[i];
    t_id := 'ANN' || lpad(i::TEXT, 3, '0') || '-0001-0001-0001-000000000001';
    INSERT INTO newspaper_templates (id, newspaper_id, category_id, name, content, sample_data, sort, status, created_at, updated_at, "templateType")
    VALUES (t_id, NULL, ANNOUNCEMENT, arr_elem[1], arr_elem[3], NULL, (i % 5) + 1, 1, NOW(), NOW(), arr_elem[2])
    ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content, "templateType" = EXCLUDED."templateType";
  END LOOP;
END $$;

-- ---------------------------------------------------
-- 6. 发票收据模板 (11条，INVOICE 分类)
-- ---------------------------------------------------
DO $$
DECLARE
  INVOICE TEXT := 'C0000001-0001-0001-0001-000000000001';
  templates_inv TEXT[][] := ARRAY[
    ['发票遗失声明', 'invoice', '[单位名称]遗失[类型]发票，发票号：[号码]，声明作废。'],
    ['发票开具证明', 'invoice', '[单位名称]于[日期]开具的[类型]发票，经核实为真实有效，特此证明。'],
    ['发票作废声明', 'invoice', '[单位名称]开具有误的发票[号码]，现声明作废。'],
    ['发票挂失公告', 'invoice', '[公司名称]遗失[类型]发票[数量]份，声明作废。'],
    ['增值税发票遗失', 'invoice', '[公司名称]遗失增值税发票，发票代码：[代码]，号码：[号码]，声明作废。'],
    ['电子发票遗失声明', 'invoice', '[单位名称]遗失电子[类型]发票，发票号：[号码]，声明作废。'],
    ['定额发票遗失声明', 'invoice', '[单位名称]遗失定额发票[面额]元×[份数]份，声明作废。'],
    ['运费发票遗失', 'invoice', '[公司名称]遗失运输发票，发票号：[号码]，声明作废。'],
    ['通用发票遗失', 'invoice', '[名称]遗失[类型]发票[份数]份，发票号：[号码]，声明作废。'],
    ['发票复印件证明', 'invoice', '[单位名称]声明，以下发票复印件与原件相符：'],
    ['专业发票遗失', 'invoice', '[企业名称]遗失[行业]专用发票，发票号：[号码]，声明作废。']
  ];
  arr_elem TEXT[];
  inv_id TEXT;
BEGIN
  FOR i IN 1..array_length(templates_inv, 1) LOOP
    arr_elem := templates_inv[i];
    inv_id := 'INV' || lpad(i::TEXT, 3, '0') || '-0001-0001-0001-000000000001';
    INSERT INTO newspaper_templates (id, newspaper_id, category_id, name, content, sample_data, sort, status, created_at, updated_at, "templateType")
    VALUES (inv_id, NULL, INVOICE, arr_elem[1], arr_elem[3], NULL, i, 1, NOW(), NOW(), arr_elem[2])
    ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content;
  END LOOP;
END $$;

-- ---------------------------------------------------
-- 7. 表扬信模板 (5条，PRAISE 分类)
-- ---------------------------------------------------
DO $$
DECLARE
  PRAISE TEXT := 'C0000001-0003-0001-0001-000000000001';
  templates_pra TEXT[][] := ARRAY[
    ['个人表扬信', '表扬[被表扬人姓名]，特此致谢。', 'personal'],
    ['企业表扬信', '表扬[企业/团队名称]，特此致谢。', 'company'],
    ['员工表扬信', '表扬[员工姓名]在[事件]中的出色表现，特此嘉奖。', 'employee'],
    ['致谢表扬信', '感谢[对方单位/个人]的鼎力支持，特此致谢。', 'company'],
    ['单位表扬信', '对[单位名称]的优质服务/支持表示感谢，特此表扬。', 'unit']
  ];
  arr_elem TEXT[];
  pra_id TEXT;
BEGIN
  FOR i IN 1..array_length(templates_pra, 1) LOOP
    arr_elem := templates_pra[i];
    pra_id := 'PRA' || lpad(i::TEXT, 3, '0') || '-0001-0001-0001-000000000001';
    INSERT INTO newspaper_templates (id, newspaper_id, category_id, name, content, sample_data, sort, status, created_at, updated_at, "templateType")
    VALUES (pra_id, NULL, PRAISE, arr_elem[1], arr_elem[2], NULL, i, 1, NOW(), NOW(), arr_elem[3])
    ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content, "templateType" = EXCLUDED."templateType";
  END LOOP;
END $$;

-- ---------------------------------------------------
-- 8. 企业证件模板 (12条，COMPANY_DOC 分类)
-- ---------------------------------------------------
DO $$
DECLARE
  COMPANY_DOC TEXT := 'B0000001-0001-0001-0001-000000000001';
  templates_cd TEXT[][] := ARRAY[
    ['营业执照遗失声明', 'stamp_cert', '[公司名称]遗失营业执照正/副本，注册号：[号码]，声明作废。'],
    ['公章遗失声明', 'stamp_cert', '[公司名称]遗失公章（编号：[编号]），声明作废，由此引起的一切后果由本公司承担。'],
    ['食品经营许可证遗失', 'license_qualification', '[公司名称]遗失食品经营许可证，许可证号：[号码]，声明作废。'],
    ['税务登记证遗失声明', 'license_qualification', '[公司名称]遗失税务登记证，证号：[号码]，声明作废。'],
    ['开户许可证遗失声明', 'license_qualification', '[公司名称]遗失开户许可证，核准号：[号码]，声明作废。'],
    ['公司章程遗失声明', 'contract_agreement', '[公司名称]遗失公司章程一份，声明作废，如需使用请至工商部门重新打印。'],
    ['公司更名公告', 'stamp_cert', '[公司名称]经工商部门核准，公司名称由"[原名称]"变更为"[新名称]"，注册号：[号码]，特此公告。'],
    ['吸收合并公告', 'stamp_cert', '[公司A]与[公司B]经各自股东会决议实施吸收合并。[公司A]存续经营，[公司B]注销，债权债务由存续公司承继。'],
    ['注销公告', 'stamp_cert', '[公司名称]经股东会决议解散，请债权人于见报之日起45日内向公司清算组申报债权，逾期未报视为放弃债权。'],
    ['环境影响评价公示', 'contract_agreement', '[项目名称]环境影响评价工作正在进行，依据《环境影响评价法》，现将项目基本情况公示如下：[项目概况]。'],
    ['致谢表扬信', 'contract_agreement', '[单位名称]对[合作单位/个人]在[项目/事项]中给予的大力支持与帮助表示衷心感谢，特此表扬。'],
    ['证件到期提醒声明', 'license_qualification', '[公司名称]持有的[证件名称]，证号：[号码]，有效期至[日期]，请相关单位知悉。']
  ];
  arr_elem TEXT[];
  cd_id TEXT;
BEGIN
  FOR i IN 1..array_length(templates_cd, 1) LOOP
    arr_elem := templates_cd[i];
    cd_id := 'CD' || lpad(i::TEXT, 3, '0') || '-0001-0001-0001-000000000001';
    INSERT INTO newspaper_templates (id, newspaper_id, category_id, name, content, sample_data, sort, status, created_at, updated_at, "templateType")
    VALUES (cd_id, NULL, COMPANY_DOC, arr_elem[1], arr_elem[3], NULL, i, 1, NOW(), NOW(), arr_elem[2])
    ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content, "templateType" = EXCLUDED."templateType";
  END LOOP;
END $$;

-- ---------------------------------------------------
-- 9. 法院公告/政府公告/招标/拍卖/债权/道歉/劳动/宣传 已有模板
-- 已在 fix_all.js / pg_final2.js 中正确分配，此处补充缺失的 groupConfig keys
-- ---------------------------------------------------
DO $$
DECLARE
  COURT TEXT := 'c46fc618-f7c9-407f-b78a-035fe35d47bd';
  GOVERNMENT TEXT := '05d76e21-066c-4f08-85cf-a9477244d37d';
  BIDDING TEXT := 'B0000001-0002-0001-0001-000000000001';
  AUCTION TEXT := 'B0000001-0003-0001-0001-000000000001';
  CREDITOR TEXT := 'B0000001-0004-0001-0001-000000000001';
  APOLOGY TEXT := 'B0000001-0005-0001-0001-000000000001';
  LABOR TEXT := 'B0000001-0006-0001-0001-000000000001';
  PUBLICITY TEXT := 'B0000001-0007-0001-0001-000000000001';

  -- 补充各分类缺失的 templateType keys
  extra_arr TEXT[][] := ARRAY[
    -- 法院公告补充 judicial (court)
    ['司法送达公告', COURT, 'judicial', '[法院名称]依法向[当事人]送达[文书名称]，[案号]，特此公告送达，自公告之日起60日视为送达。'],
    -- 拍卖公告补充 judicial (auction)
    ['司法拍卖公告', AUCTION, 'judicial', '[法院名称]依法对[被执行人]名下[财产名称]进行公开拍卖，起拍价[金额]元，请有意竞买者于[日期]前报名。'],
    -- 债权债务补充 finance_release
    ['金融保险债权解除', CREDITOR, 'finance_release', '[保险公司名称]与[债务人]之间的[保险合同号]债权债务关系已依法解除，特此公告。'],
    -- 登报道歉补充 other
    ['其他道歉声明', APOLOGY, 'other', '[道歉人姓名]就[事件]向[被道歉方]公开道歉，特此声明。'],
    -- 劳动纠纷补充 labor_injury
    ['工伤认定公告', LABOR, 'labor_injury', '[单位名称]员工[姓名]于[日期]发生工伤事故，现申请工伤认定，特此公示。'],
    -- 宣传稿补充 legal
    ['普法公益宣传', PUBLICITY, 'legal', '普及法律知识，弘扬法治精神。依法治国，人人有责。']
  ];
  arr_elem TEXT[];
  extra_id TEXT;
BEGIN
  FOR i IN 1..array_length(extra_arr, 1) LOOP
    arr_elem := extra_arr[i];
    extra_id := 'EXTRA' || lpad(i::TEXT, 3, '0') || '-0001-0001-0001-000000000001';
    INSERT INTO newspaper_templates (id, newspaper_id, category_id, name, content, sample_data, sort, status, created_at, updated_at, "templateType")
    VALUES (extra_id, NULL, arr_elem[2], arr_elem[1], arr_elem[3], NULL, i, 1, NOW(), NOW(), arr_elem[2])
    ON CONFLICT (id) DO NOTHING;
  END LOOP;
END $$;

-- ---------------------------------------------------
-- 验证查询
-- ---------------------------------------------------
-- SELECT c.name as category, COUNT(t.id) as template_count
-- FROM newspaper_categories c
-- LEFT JOIN newspaper_templates t ON t.category_id = c.id AND t.status = 1
-- GROUP BY c.name ORDER BY template_count DESC;
