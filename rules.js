/**
 * 内容模板生成器 — 按模板名 + 关键 pattern 生成对应 content
 * 参照声明公告 e0a7a143 中 30 条 company 模板的 content 规律
 */

function genContent(name) {
  // 1. "公告声明·XXX" 系列
  if (name.startsWith('公告声明·')) {
    const sub = name.slice(5)
    return `【公告声明·${sub}】

XXXX公司郑重公告：
本公告涉及${sub}相关事项，请相关方及时关注并按照公告内容履行相关手续。

特此公告。
公告日期：XXXX年XX月XX日`
  }

  // 2. 通用版
  if (name === '公告声明通用版' || name === '声明公告通用版') {
    return `【公告声明】
现就XXXXXXXXXXXXXXXX相关事项，依法予以公告。
特此公告。
公告日期：XXXX年XX月XX日`
  }

  // 3. "声明公告·XXX" 系列
  if (name.startsWith('声明公告·')) {
    const sub = name.slice(5)
    return `【声明公告·${sub}】
本公司就${sub}相关事项，特此声明：
XXXXXXXXXXXXXXXXXXXXXXXX。

特此声明。
声明日期：XXXX年XX月XX日`
  }

  // 4. 开业/停业歇业公告
  if (/开业公告$/.test(name)) {
    return `${name}

XXXX公司定于XXXX年XX月XX日起正式开业/成立。地址：XXXX。主营：XXXXXXXX。
欢迎各界朋友莅临指导。
特此公告。`
  }

  if (/停业|歇业|关闭|退出市场/.test(name)) {
    return `${name}

XXXX公司郑重声明：
因经营调整需要，本公司自XXXX年XX月XX日起停止相关业务/关闭经营场所/退出市场。
请相关债权人、客户、合作伙伴于公告之日起30日内办理业务变更或债权申报手续。
逾期未办理的，后果自负。

特此公告。
公告日期：XXXX年XX月XX日`
  }

  // 5. 注销/简易注销/撤销注销
  if (/注销/.test(name) && !/公告/.test(name.replace(/公告/g, ''))) {
    if (/简易/.test(name)) {
      return `${name}

XXXX公司（统一社会信用代码：XXXXXXXXXXXXXXXXXX）经决议，现就注销登记事项公告如下：
本公司全体投资人/股东承诺本公司无债权债务（或债权债务已清理完毕），申请简易注销登记，请相关债权人自本公告发布之日起45日内向本公司申报债权。

特此公告。
公告日期：XXXX年XX月XX日`
    }
    return `${name}

XXXX公司（统一社会信用代码：XXXXXXXXXXXXXXXXXX）经决议，现就注销登记事项公告如下：
本公司决定解散并成立清算组，请各债权人自本公告发布之日起45日内向本公司清算组申报债权。
逾期未申报的，后果自负。

特此公告。
公告日期：XXXX年XX月XX日`
  }

  // 6. 清算公告
  if (/清算/.test(name)) {
    return `${name}

XXXX公司（统一社会信用代码：XXXXXXXXXXXXXXXXXX）经决议，现就公司清算事项公告如下：
本公司已成立清算组，请各债权人自本公告发布之日起45日内持相关债权证明文件向清算组申报债权。
逾期未申报的，后果自负。

特此公告。
公告日期：XXXX年XX月XX日`
  }

  // 7. 减资
  if (/减资/.test(name)) {
    return `${name}

XXXX公司（统一社会信用代码：XXXXXXXXXXXXXXXXXX）经决议，现就减少注册资本事项公告如下：
本公司注册资本由XXXX万元减少至XXXX万元。请相关债权人自本公告发布之日起45日内向本公司提出清偿债务或提供相应担保的要求。

特此公告。
公告日期：XXXX年XX月XX日`
  }

  // 8. 股权变更/转让/优先购买
  if (/股权|股东/.test(name)) {
    return `${name}

XXXX公司（统一社会信用代码：XXXXXXXXXXXXXXXXXX）经决议，现就工商变更事项公告如下：
本公司股东XX将所持XX%股权转让给XX，其他股东放弃优先购买权。
股权转让后，本公司股东及出资情况为：XXXXXXXXXXXX。

特此公告。
公告日期：XXXX年XX月XX日`
  }

  // 9. 合并/分立/吸收合并
  if (/合并|分立|派生分立|新设分立/.test(name)) {
    return `${name}

XXXX公司（统一社会信用代码：XXXXXXXXXXXXXXXXXX）经决议，现就公司合并/分立事项公告如下：
本公司与XXXX公司进行吸收合并/新设合并/派生分立/新设分立。
合并/分立后各方债权债务由合并后存续的公司/新设公司承继。
请各债权人自本公告发布之日起30日内向本公司申报债权或提出清偿要求。

特此公告。
公告日期：XXXX年XX月XX日`
  }

  // 10. 法人/经营地址/分支机构/分公司变更
  if (/法人变更|经营地址|分支机构设立|分公司设立|出资人变更|合伙企业变更/.test(name)) {
    return `${name}

XXXX公司（统一社会信用代码：XXXXXXXXXXXXXXXXXX）经决议，现就工商变更事项公告如下：
本公司法定代表人/经营地址/分支机构/出资人/合伙人由XX变更为XX。
相关业务关系延续不变。

特此公告。
公告日期：XXXX年XX月XX日`
  }

  // 11. 解除类（解除合同/解除公告/解除抵押/解除委托/解除代持）
  if (/^解除/.test(name)) {
    return `${name}

XXXX公司郑重声明：
本公司与XXXX（对方当事人/单位）签订的《XXXX合同》/《XXXX协议》（合同编号：XXXX），自XXXX年XX月XX日起正式解除。
双方权利义务自解除之日起终止，请相关方知悉。

特此声明。
声明日期：XXXX年XX月XX日`
  }

  // 12. 致歉/道歉/严正声明
  if (/致歉|道歉|严正声明|严正/.test(name)) {
    return `${name}

XXXX公司郑重声明：
因XXXXXXXXXXXXXXXXXXXXXXXX，给相关方造成不便/损失，本公司深表歉意。
现就相关事项予以澄清/纠正/说明：XXXXXXXXXXXXXXXXXXXXXXXX。
本公司承诺今后将严格规范相关业务，避免类似情况再次发生。

特此致歉/声明。
日期：XXXX年XX月XX日`
  }

  // 13. 招聘/求职/启事
  if (/招聘|求职|启事|公示/.test(name)) {
    return `${name}

XXXX公司因业务发展需要，现面向社会公开招聘/诚聘以下岗位：
1. 岗位名称：XXXX；要求：XXXXXXXX；薪资：XXXX
2. 岗位名称：XXXX；要求：XXXXXXXX；薪资：XXXX

有意者请将个人简历发送至XXXX@XXXX.com，或致电XXXX-XXXXXXXX详询。
报名截止日期：XXXX年XX月XX日

特此公告。`
  }

  // 14. 招标/中标/竞价/拍卖/采购
  if (/招标|中标|竞价|拍卖|采购/.test(name)) {
    return `${name}

XXXX公司现就XXXX项目进行公开招标/拍卖，公告如下：
项目名称：XXXX
项目编号：XXXX
投标/竞买截止时间：XXXX年XX月XX日
开标/拍卖时间：XXXX年XX月XX日
联系人：XXXX；联系电话：XXXX-XXXXXXXX

欢迎符合资格条件的投标人/竞买人参与。

特此公告。
公告日期：XXXX年XX月XX日`
  }

  // 15. 通知类（股东会议通知/催告/协商函）
  if (/通知$|通知书$|通知函$|催告$|协商函$|协办/.test(name)) {
    return `${name}

致：XXXX
因相关事项，现通知如下：
1. XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
2. XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
3. XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

请贵方/相关方于XXXX年XX月XX日前按上述要求办理相关事宜。
逾期未办理的，本公司将依法采取相应措施/后果自负。

特此通知。
XXXX公司
XXXX年XX月XX日`
  }

  // 16. 公告通用
  if (name === '公告') {
    return `【公告】
XXXX公司就XXXXXXXXXXXXXXXX相关事项，现公告如下：
1. XXXXXXXXXXXXXXXXXXXX
2. XXXXXXXXXXXXXXXXXXXX

请相关方知悉并配合办理。

特此公告。
公告日期：XXXX年XX月XX日`
  }

  // 17. 更正类
  if (/更正/.test(name)) {
    return `${name}

XXXX公司郑重声明：
本公司于XXXX年XX月XX日在XXXX报纸上刊登的《XXXX公告》中存在笔误/内容不准确之处，现更正如下：
原文：XXXXXXXXXXXX
现更正为：XXXXXXXXXXXX

除上述更正内容外，原公告其他内容不变。

特此更正公告。
更正日期：XXXX年XX月XX日`
  }

  // 18. 声明类（严正/防诈骗/混淆/假冒/认领/迁坟/弃货）
  if (/声明$|严正|防诈骗|混淆|假冒|认领|迁坟|弃货|无主|换证|迁走|户口/.test(name)) {
    return `${name}

XXXX公司郑重声明：
近期发现有不法分子/相关方冒用本公司名义/损害本公司合法权益，从事XXXXXXXXXXXXXXXX的行为。
本公司特此严正声明/声明如下：
1. 本公司从未授权/从事XXXXXXXXXXXXXXXX。
2. 请相关方提高警惕，避免上当受骗。
3. 本公司保留依法追究相关方法律责任的权利。

特此声明。
声明日期：XXXX年XX月XX日`
  }

  // 19. 寻人寻车
  if (/寻人|寻车/.test(name)) {
    return `${name}

XXXX公司/XXXX（姓名）寻找：
姓名/物品：XXXX
性别/特征：XXXX
最后出现时间/地点：XXXX
联系方式：XXXX-XXXXXXXX

如有线索者，请速与本公司/本人联系。
酬谢：XXXX

特此启事。
日期：XXXX年XX月XX日`
  }

  // 20. 学校/商会/公益/民办/社团
  if (/学校|商会|公益|民办|社团|成立|终止办学/.test(name)) {
    return `${name}

XXXX公司/XXXX机构郑重公告：
经相关部门批准/决议，本机构自XXXX年XX月XX日起正式成立/终止办学/注销。
业务范围/相关权益由XXXX承继/清算。

特此公告。
公告日期：XXXX年XX月XX日`
  }

  // 21. 公积金/工伤/仲裁/行政/送达
  if (/住房公积金|工伤|仲裁|送达|行政处罚/.test(name)) {
    return `${name}

致：XXXX（当事人姓名/单位名称）
案号：XXXX
现就XXXXXXXXXXXXXXXX事项，依法向你方公告送达XXXX文书。
请你方自本公告发布之日起60日内到XXXX地点领取，逾期不领取即视为送达。

特此公告。
XXXX机构
XXXX年XX月XX日`
  }

  // 22. 召回/产品/食品
  if (/召回|产品/.test(name)) {
    return `${name}

XXXX公司郑重公告：
因XXXXXXXXXXXXXXXX原因，本公司决定召回XXXX产品（批次：XXXX）。
请已购买相关产品的消费者/客户立即停止使用，并联系本公司办理退货/更换/退款手续。

联系电话：XXXX-XXXXXXXX
特此公告。
公告日期：XXXX年XX月XX日`
  }

  // 23. 网签合同撤销/迁址/搬迁/欠费/收费
  if (/网签|搬迁|欠费|收费|设施|认领|货物/.test(name)) {
    return `${name}

XXXX公司郑重通知：
因XXXXXXXXXXXXXXXX，现就相关事项公告如下：
请涉及方/相关方于XXXX年XX月XX日前办理相关手续（搬迁/缴费/撤销/认领）。
逾期未办理的，后果自负。

联系电话：XXXX-XXXXXXXX

特此公告/通知。
公告日期：XXXX年XX月XX日`
  }

  // 24. 商标/品牌/取消加盟/合作招商
  if (/商标|品牌|加盟|招商|合作/.test(name)) {
    return `${name}

XXXX公司郑重声明：
本公司自XXXX年XX月XX日起取消/终止与XXXX的加盟/品牌授权/合作关系。
原授权书/合同/商标使用许可一律作废。
未经本公司书面授权，任何单位或个人不得继续使用本公司商标/品牌。

特此声明。
声明日期：XXXX年XX月XX日`
  }

  // 25. 企业表扬信（这 3 条之前在 e1023）
  if (/表扬信$/.test(name)) {
    return `${name}

XXXX公司现就XXXXXXXXXXXXXXXX相关人员/单位进行公开表扬：
被表扬人/单位：XXXX
事由：XXXXXXXXXXXXXXXXXXXXXXXX。

该人员/单位的敬业精神/服务质量/职业操守值得全体员工/行业学习。
特此表扬。
XXXX公司
XXXX年XX月XX日`
  }

  // 26. 默认兜底
  return `${name}

XXXX公司（统一社会信用代码：XXXXXXXXXXXXXXXXXX）现就相关事项公告如下：
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX。

请相关方知悉。

特此公告。
公告日期：XXXX年XX月XX日`
}

module.exports = { genContent }