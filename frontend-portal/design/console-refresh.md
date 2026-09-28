# 控制台质感改版

2026-09-28 · 属于 [M0](../docs/roadmap.md#m0)，覆盖 M2–M4 控制台各页 · 视觉规范见 [前端设计 · 控制台表面](../docs/前端设计.md#控制台表面与控件)

## 0. 目标与已定取舍

用户给出一张参考控制台：浅灰底、白卡不描边、胶囊控件、紧凑工具栏、克制图表，要求控制台做出同样的质感。已定：

- 指标卡不加「比上期」涨跌标签；
- 控制台金额统一两位小数；
- 直接实施，不先出效果图。

范围：控制台全部页面（概览、用量、密钥、余额订单、团队、团队用量、设置）及其弹窗、下拉、气泡层。官网、帮助、登录注册不变。界面不加说明性文字。

## 1. 表面与层次

- 作用域：控制台外壳根节点带 `data-surface="console"`；弹窗、下拉、气泡层经 `components/ui/surface.tsx` 的区域上下文写入同样的标记。控制台专属样式集中在 `styles/console.css`，共享组件本身（表格、分段切换）只放通用外观，控制台外观一律经该标记套上。
- 令牌（`styles/tokens.css`，`--console-*`）：

| 令牌 | 浅色 | 深色 |
|---|---|---|
| 页面底 canvas | `#F1F3F6` | 同 `--background` |
| 卡片表面 surface | `#FFFFFF` | 同 `--card` |
| 卡片描边 | 无 | `--border` 65% |
| 分段底槽 track | `#E7EAEF` | 前景 7% 混入底色 |
| 卡片阴影 | `0 1px 2px / 4%` + `0 2px 10px / 4%` | 无 |
| 浮起阴影（选中块、侧栏当前项） | `0 1px 2px / 10%` + `0 1px 1px / 4%` | `0 1px 2px / 45%` |
| 卡片圆角 | 20px | 20px |

- 侧栏、手机顶栏与页面底同色；侧栏右侧、侧栏底部设置区上方与手机顶栏底部保留分界线。最初按参考图去掉了分界线，用户反馈侧栏边界看不出、显得变窄（实际宽度仍是 216px），已恢复。

## 2. 形状

- 按钮、输入框、下拉触发器：胶囊（999px）。文本域、日历格保持原样。
- 分段切换统一用 `components/ui/segmented-control.tsx`：底槽 + 浮起的白色选中块，选中文字前景色、未选中次级色；控制台节奏 180ms。用于：用量与成员分布的 Token/消费切换、团队页签、额度编辑与批量额度的模式切换。充值预设金额、注册方式保持现状。基础样式在 `styles/segmented-control.css`，缺省取通用底色 `--muted` 与卡片色、无阴影；控制台区域把 `--segmented-track`、`--segmented-thumb`、`--segmented-thumb-shadow` 换成控制台底槽色、表面色与浮起阴影。
- 侧栏当前项：表面色胶囊 + 浮起阴影，文字前景色；悬停只轻微加深底色。

## 3. 页头与工具栏（概览、团队用量）

- 删除筛选卡片及「时间范围」「粒度」字段名。
- 页头左侧路径行 + 标题；概览右侧保留余额与充值。
- 工具栏在页头下方一行，右对齐：时间预选、日期区间、粒度，全部胶囊，宽度按内容，不拉满整行。手机上换行左对齐。

## 4. 指标卡

- 四张等高：图标 + 标签（14px 次级色）在上，数字（28px、600 字重、等宽数字）在下。
- 总 Token 卡不再列四项分项；输入、输出、缓存写入、缓存读取的合计放进「Token 使用趋势」卡的图例，例如「输入 122.31K」。

## 5. 图表

- 折线：平滑、2.5px、不画数据点。
- 网格线：描边色 50% 透明；不画轴线；刻度文字 12px 次级色；日期刻度写成 月/日（9/22）。
- 图例：右上角，8px 圆点。
- 环图：分段间留 2px 缝、圆角端，环宽不变。
- 提示框：表面色底、12px 圆角、浮起阴影。
- 配色沿用 `--chart-*`，不新增颜色。

## 6. 表格

- 表头：底槽色底的圆角条（两端 8px）、高 40px、12px 次级色文字；数据行高 52px；行间细分隔线（描边 60%）；悬停行轻微加深（前景 5%）。
- 选中行在行上写 `data-state="selected"`，底色为主色 10%，悬停时保持选中色；不用行上的底色工具类表达选中，避免被悬停规则盖掉。
- 紧凑表格（环图旁的分布表）在表格上写 `data-density="compact"`：表头 32px，行高随留白，单元格左右 8px、上下 6px。
- 表头圆角要求分离边框，控制台表格改为分离边框、行间距 0，行间线画在单元格上。
- 以上规则都在 `styles/console.css` 的控制台区域内；`components/ui/table.tsx` 保持通用外观，控制台外的表格不受影响。
- 行内图标按钮随胶囊规则变成圆形。

## 7. 金额格式

- 余额、冻结、消费、费用、额度与申请金额统一走 `lib/money.ts`：`$1,234.56`、`-$3.20`；不为零但不足半分显示「< $0.01」（负数「> -$0.01」）；无效值「—」。
- 调用处不再手动拼 `$`；表头去掉重复的「（USD）」。
- 密钥额度（`keys/key-format.tsx`）与订单到账金额（`billing/billing-ui-format.tsx`）同样走 `lib/money.ts`，原先的 `US$` 写法随之统一为 `$`。
- 图表环心的合计用 `formatUsdCompact`：一千以下同上，一千起写成 `$1.2K`、`$3.4M`。
- 环图提示框改为自行拼接 HTML，其中的名称与数值（可能来自用户自填的成员名、分组名）先经 `lib/html.ts` 转义；折线图沿用图表库默认提示框。
- 模型单价与充值订单的支付币种金额不在此列。

## 8. 实施分工与验收

| 实施路 | 文件 | 内容 |
|---|---|---|
| 主控 | tokens.css、console.css、segmented-control.css、globals.css、ui/surface.tsx、ui/segmented-control.tsx、ui/dialog/popover/select 的区域标记、layout/console-shell.tsx 根节点、lib/money.ts、usage-format.ts、organization/format.ts、本文档与模块文档 | 共用底层与接口 |
| 概览与团队用量 | usage/overview-view.tsx、usage/breakdown-card.tsx、organization-usage/organization-usage-view.tsx、org-summary.tsx、member-distribution.tsx、console/metric-card.tsx、console/date-range-control.tsx、layout/page-header.tsx | 第 3、4 节；两处分布切换换成分段切换；这些文件的金额与表头 |
| 图表 | components/charts/* | 第 5 节 |
| 外壳与表格 | layout/console-shell.tsx（侧栏样式）、ui/table.tsx、organization/team-view.tsx、quota-editor.tsx、batch-quota-dialog.tsx、usage/usage-view.tsx、usage-record-detail.tsx、organization-usage/organization-records.tsx | 第 2 节侧栏与分段切换、第 6 节、这些文件的金额与表头 |
| 测试 | tests/money.test.ts、tests/html.test.ts | 第 7 节金额格式与提示框转义的行为测试 |

验收：完整 `pnpm check`；独立评审；浏览器效果由用户查看。
