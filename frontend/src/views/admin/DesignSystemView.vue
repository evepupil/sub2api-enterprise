<template>
  <div class="pb-16">
    <!-- 顶部：标题 + 明暗切换 -->
    <div class="mb-5 flex items-start justify-between gap-3">
      <div>
        <h1 class="page-title">设计规范示范页</h1>
        <p class="page-description">控制台统一视觉的参照基准。先在这里定样，再逐页替换。</p>
      </div>
      <button class="btn btn-secondary" type="button" @click="toggleDark">
        <Icon :name="isDark ? 'sun' : 'moon'" size="sm" />
        {{ isDark ? '浅色' : '深色' }}
      </button>
    </div>

    <div class="tabs mb-5">
      <button
        v-for="section in sections"
        :key="section.id"
        type="button"
        class="tab"
        :class="{ 'tab-active': activeSection === section.id }"
        @click="activeSection = section.id"
      >
        {{ section.label }}
      </button>
    </div>

    <!-- ========== 概览页：舒展档 ========== -->
    <div v-show="activeSection === 'overview'" class="space-y-4">
      <DesignBlock
        heading="概览页排布"
        hint="留白给足、数字当主角。仪表盘、组织首页这类看数的页面用这一档。"
      >
        <!-- 页头：大标题 + 描述，右侧一张重点卡 -->
        <div class="card card-glow mb-3 p-6">
          <div class="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div class="min-w-0">
              <h2 class="text-[28px] font-semibold leading-tight text-content-strong">组织概览</h2>
              <p class="mt-2 max-w-xl text-sm text-content-muted">
                一个组织一套密钥，成员共用管理员余额。分组范围和消费上限由管理员分配。
              </p>
            </div>
            <div
              class="shrink-0 rounded-xl border border-line-subtle bg-surface-sunken px-5 py-4 lg:w-64"
            >
              <div class="stat-label">本月可用额度</div>
              <div class="stat-value text-primary-700 dark:text-primary-400">1,284.50</div>
              <div class="stat-caption">总额 2,000.00 · 已用 715.50</div>
            </div>
          </div>
        </div>

        <!-- 分段控件 -->
        <div class="segmented mb-3">
          <button
            v-for="view in overviewViews"
            :key="view"
            type="button"
            class="segmented-item"
            :class="{ 'segmented-item-active': overviewView === view }"
            @click="overviewView = view"
          >
            {{ view }}
          </button>
        </div>

        <!-- 大数字便当格 -->
        <div class="mb-3 grid gap-3 lg:grid-cols-3">
          <div v-for="figure in bigFigures" :key="figure.label" class="stat-card">
            <div class="stat-label">{{ figure.label }}</div>
            <div class="stat-value">{{ figure.value }}</div>
            <div class="stat-caption">{{ figure.caption }}</div>
          </div>
        </div>

        <!-- 小格：一格只说一件事，没有图标没有箭头 -->
        <div class="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div v-for="cell in smallCells" :key="cell.label" class="stat-card">
            <div class="stat-label">{{ cell.label }}</div>
            <div class="stat-value-sm">{{ cell.value }}</div>
            <div class="stat-caption">{{ cell.caption }}</div>
          </div>
        </div>

        <!-- 极细进度条，两端配小字 -->
        <div class="card p-5">
          <div class="mb-4 flex items-start justify-between gap-3">
            <div>
              <div class="text-sm font-semibold text-content-strong">本月消费上限</div>
              <p class="mt-1 text-xs text-content-muted">全组织成员共用管理员余额与每月上限。</p>
            </div>
            <div class="stat-value-sm text-primary-700 dark:text-primary-400">36%</div>
          </div>
          <div class="progress"><div class="progress-bar" style="width: 36%"></div></div>
          <div class="mt-2 flex items-center justify-between text-xs text-content-muted">
            <span>已用 715.50</span>
            <span>剩余 1,284.50</span>
          </div>
        </div>
      </DesignBlock>
    </div>

    <!-- ========== 列表页：紧凑档 ========== -->
    <div v-show="activeSection === 'list'" class="space-y-4">
      <DesignBlock
        heading="列表页排布"
        hint="密度优先。密钥、使用记录、成员这类干活的页面用这一档，一屏多看几行。"
      >
        <div class="page-header">
          <div>
            <h2 class="page-title">成员管理</h2>
            <p class="page-description">共 {{ demoRows.length }} 名成员</p>
          </div>
          <div class="flex items-center gap-2">
            <button class="btn btn-secondary btn-sm" type="button">批量分配额度</button>
            <button class="btn btn-primary btn-sm" type="button">
              <Icon name="plus" size="xs" />
              邀请成员
            </button>
          </div>
        </div>

        <div class="mb-3 flex flex-wrap items-center gap-2">
          <div class="relative w-56">
            <Icon
              name="search"
              size="sm"
              class="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-content-subtle"
            />
            <input v-model="demoSearch" class="input pl-8" placeholder="搜索邮箱或用户名" />
          </div>
          <select v-model="demoStatus" class="input w-32">
            <option value="">全部状态</option>
            <option value="active">正常</option>
            <option value="disabled">已停用</option>
          </select>
          <button class="btn btn-ghost btn-sm" type="button">重置</button>
        </div>

        <div class="table-container">
          <table class="table">
            <thead>
              <tr>
                <th class="w-9">
                  <input type="checkbox" class="h-3.5 w-3.5 rounded border-line-strong" />
                </th>
                <th>成员</th>
                <th>状态</th>
                <th class="text-right">消费额度</th>
                <th class="text-right">已用</th>
                <th>加入时间</th>
                <th class="w-20 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in demoRows" :key="row.id">
                <td><input type="checkbox" class="h-3.5 w-3.5 rounded border-line-strong" /></td>
                <td>
                  <div class="font-medium text-content-strong">{{ row.name }}</div>
                  <div class="text-xs text-content-muted">{{ row.email }}</div>
                </td>
                <td>
                  <span
                    class="badge"
                    :class="row.status === 'active' ? 'badge-success' : 'badge-danger'"
                  >
                    {{ row.status === 'active' ? '正常' : '已停用' }}
                  </span>
                </td>
                <td class="text-right tabular-nums">{{ row.limit ?? '不限额' }}</td>
                <td class="text-right tabular-nums text-content-muted">{{ row.used }}</td>
                <td class="text-content-muted">{{ row.joinedAt }}</td>
                <td class="text-right">
                  <button class="btn btn-ghost btn-sm" type="button">编辑</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="mt-3 flex items-center justify-between text-xs text-content-muted">
          <span>第 1-{{ demoRows.length }} 条，共 {{ demoRows.length }} 条</span>
          <div class="flex items-center gap-1">
            <button class="btn btn-secondary btn-sm" type="button" disabled>上一页</button>
            <button class="btn btn-secondary btn-sm" type="button" disabled>下一页</button>
          </div>
        </div>
      </DesignBlock>
    </div>

    <!-- ========== 色彩 ========== -->
    <div v-show="activeSection === 'color'" class="space-y-4">
      <DesignBlock
        heading="主色刻度 · 深海蓝"
        hint="操作用 600，悬停 700，按下 800；深色底上的强调文字用 400。"
      >
        <div class="flex flex-wrap gap-2">
          <div v-for="step in primarySteps" :key="step.label" class="w-[72px]">
            <div class="h-12 rounded-lg border border-line-subtle" :class="step.cls"></div>
            <div class="mt-1 text-xs text-content-muted">{{ step.label }}</div>
          </div>
        </div>
      </DesignBlock>

      <DesignBlock
        heading="中性色"
        hint="换成暖调，不带蓝。冷蓝灰是后台模板的标配底色，暖中性更像挑过颜色。"
      >
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <div
            v-for="token in surfaceTokens"
            :key="token.cls"
            class="rounded-lg border border-line-subtle p-2.5"
          >
            <div class="mb-2 h-10 rounded border border-line-subtle" :class="token.cls"></div>
            <div class="text-xs font-medium text-content-strong">{{ token.name }}</div>
            <div class="text-xs text-content-muted">{{ token.usage }}</div>
          </div>
        </div>
      </DesignBlock>

      <DesignBlock
        heading="文字层级"
        hint="只留四档，跨度拉开。中间档位一多，每一档都不突出，整页就糊。"
      >
        <div class="space-y-3">
          <div v-for="tier in typeTiers" :key="tier.size" class="flex items-baseline gap-4">
            <code class="w-9 shrink-0 text-xs text-content-subtle">{{ tier.size }}</code>
            <div class="min-w-0 flex-1" :class="tier.cls">{{ tier.sample }}</div>
            <div class="shrink-0 text-xs text-content-muted">{{ tier.usage }}</div>
          </div>
        </div>
      </DesignBlock>

      <DesignBlock
        heading="状态色"
        hint="只用在徽章上。收敛到四档，主色和紫色留给身份标识，别拿来表状态。"
      >
        <div class="flex flex-wrap gap-2">
          <span class="badge badge-success">正常</span>
          <span class="badge badge-warning">额度不足</span>
          <span class="badge badge-danger">已停用</span>
          <span class="badge badge-gray">未启用</span>
        </div>
      </DesignBlock>
    </div>

    <!-- ========== 尺度 ========== -->
    <div v-show="activeSection === 'scale'" class="space-y-4">
      <DesignBlock heading="圆角" hint="最大到 12。弹窗 10、卡片 8、控件 6、标签 4。">
        <div class="flex flex-wrap items-end gap-3">
          <div v-for="radius in radiusScale" :key="radius.cls" class="text-center">
            <div
              class="h-14 w-14 border border-line-strong bg-surface-sunken"
              :class="radius.cls"
            ></div>
            <div class="mt-1 text-xs text-content-muted">{{ radius.label }}</div>
          </div>
        </div>
      </DesignBlock>

      <DesignBlock heading="控件与行高" hint="密度的关键。列表页一屏能多看几行全靠这几档。">
        <div class="space-y-2">
          <div v-for="size in heightScale" :key="size.label" class="flex items-center gap-3">
            <div class="w-24 shrink-0 text-xs text-content-muted">{{ size.label }}</div>
            <div class="rounded-lg bg-primary-600/15" :class="size.cls"></div>
            <div class="text-xs text-content-subtle">{{ size.usage }}</div>
          </div>
        </div>
      </DesignBlock>

      <DesignBlock
        heading="投影与光晕"
        hint="卡片靠 1px 边框分层。投影只留给浮层，光晕只给概览页的重点卡。"
      >
        <div class="flex flex-wrap gap-4">
          <div
            class="flex h-16 w-40 items-center justify-center rounded-xl border border-line-subtle bg-surface-raised text-xs text-content-muted"
          >
            卡片 · 无投影
          </div>
          <div
            class="flex h-16 w-40 items-center justify-center rounded-xl bg-surface-raised text-xs text-content-muted shadow-pop"
          >
            浮层 · 下拉气泡
          </div>
          <div
            class="flex h-16 w-40 items-center justify-center rounded-2xl bg-surface-raised text-xs text-content-muted shadow-dialog"
          >
            弹窗
          </div>
          <div
            class="card card-glow flex h-16 w-40 items-center justify-center text-xs text-content-muted"
          >
            <span>重点卡 · 环境光晕</span>
          </div>
        </div>
      </DesignBlock>
    </div>

    <!-- ========== 控件 ========== -->
    <div v-show="activeSection === 'control'" class="space-y-4">
      <DesignBlock heading="按钮" hint="纯色填充，不用渐变，按下不缩放。主操作一屏只给一个。">
        <div class="space-y-3">
          <div class="flex flex-wrap items-center gap-2">
            <button class="btn btn-primary" type="button">主操作</button>
            <button class="btn btn-secondary" type="button">次操作</button>
            <button class="btn btn-ghost" type="button">弱操作</button>
            <button class="btn btn-danger" type="button">删除</button>
            <button class="btn btn-success" type="button">启用</button>
            <button class="btn btn-warning" type="button">停用</button>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <button class="btn btn-primary btn-sm" type="button">小号 28</button>
            <button class="btn btn-primary btn-md" type="button">常规 34</button>
            <button class="btn btn-primary btn-lg" type="button">大号 38</button>
            <button class="btn btn-secondary btn-icon" type="button" aria-label="刷新">
              <Icon name="refresh" size="sm" />
            </button>
            <button class="btn btn-primary" type="button" disabled>不可用</button>
            <button class="btn btn-primary" type="button">
              <span class="spinner h-3.5 w-3.5"></span>
              处理中
            </button>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <button class="btn btn-primary" type="button">
              <Icon name="plus" size="sm" />
              新建密钥
            </button>
            <button class="btn btn-secondary" type="button">
              <Icon name="download" size="sm" />
              导出
            </button>
          </div>
        </div>
      </DesignBlock>

      <DesignBlock heading="输入" hint="和按钮同高。焦点只加一层描边和一圈淡环，不做外发光。">
        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <label class="input-label">组织名称</label>
            <input v-model="demoText" class="input" placeholder="请输入名称" />
            <p class="input-hint">对外展示的名称，成员在注册页看到。</p>
          </div>
          <div>
            <label class="input-label">消费额度</label>
            <input class="input input-error" value="-10" readonly />
            <p class="input-error-text">额度不能为负数。</p>
          </div>
          <div>
            <label class="input-label">分组</label>
            <select v-model="demoSelect" class="input">
              <option value="default">默认分组</option>
              <option value="enterprise">企业专属</option>
            </select>
          </div>
          <div>
            <label class="input-label">只读字段</label>
            <input class="input" value="不可修改" disabled />
          </div>
          <div class="sm:col-span-2">
            <label class="input-label">备注</label>
            <textarea v-model="demoTextarea" class="input" rows="3" placeholder="选填"></textarea>
          </div>
        </div>
      </DesignBlock>

      <DesignBlock heading="标签栏两种">
        <div class="space-y-5">
          <div>
            <div class="mb-2 text-xs text-content-muted">下划线式 · 页面级切换</div>
            <div class="tabs">
              <button class="tab tab-active" type="button">全部</button>
              <button class="tab" type="button">正常</button>
              <button class="tab" type="button">已停用</button>
            </div>
          </div>
          <div>
            <div class="mb-2 text-xs text-content-muted">分段控件 · 同一块数据换视图</div>
            <div class="segmented">
              <button class="segmented-item segmented-item-active" type="button">概览</button>
              <button class="segmented-item" type="button">按模型</button>
              <button class="segmented-item" type="button">按成员</button>
            </div>
          </div>
        </div>
      </DesignBlock>

      <DesignBlock heading="开关、进度与骨架">
        <div class="flex flex-wrap items-center gap-8">
          <div class="flex items-center gap-2">
            <div
              class="switch"
              :class="{ 'switch-active': demoSwitch }"
              role="switch"
              :aria-checked="demoSwitch"
              tabindex="0"
              @click="demoSwitch = !demoSwitch"
              @keydown.enter.prevent="demoSwitch = !demoSwitch"
            >
              <div class="switch-thumb"></div>
            </div>
            <span class="text-sm text-content">限制公开分组</span>
          </div>
          <div class="w-48">
            <div class="mb-1 flex justify-between text-xs text-content-muted">
              <span>额度已用</span>
              <span>68%</span>
            </div>
            <div class="progress"><div class="progress-bar" style="width: 68%"></div></div>
          </div>
          <div class="w-40 space-y-1.5">
            <div class="skeleton h-3 w-full"></div>
            <div class="skeleton h-3 w-2/3"></div>
          </div>
        </div>
      </DesignBlock>
    </div>

    <!-- ========== 容器 ========== -->
    <div v-show="activeSection === 'container'" class="space-y-4">
      <DesignBlock heading="卡片" hint="头、身、脚三段。悬停只加深边框，不浮起。">
        <div class="grid gap-3 lg:grid-cols-2">
          <div class="card">
            <div class="card-header flex items-center justify-between">
              <span class="text-sm font-semibold text-content-strong">基础卡片</span>
              <span class="badge badge-success">正常</span>
            </div>
            <div class="card-body text-sm text-content">
              卡片正文。标题靠字重拉层级，不靠加大字号，省下一个字号档位。
            </div>
            <div class="card-footer">
              <button class="btn btn-ghost btn-sm" type="button">取消</button>
              <button class="btn btn-primary btn-sm ml-2" type="button">保存</button>
            </div>
          </div>
          <div class="card card-hover p-4">
            <div class="text-sm font-semibold text-content-strong">可点击卡片</div>
            <p class="mt-1 text-sm text-content-muted">用于可进入的列表项，鼠标移上去边框加深。</p>
          </div>
        </div>
      </DesignBlock>

      <DesignBlock heading="空态">
        <div class="card">
          <div class="empty-state">
            <Icon name="inbox" class="empty-state-icon" />
            <div class="empty-state-title">暂无数据</div>
            <div class="empty-state-description">调整筛选条件后再试。</div>
          </div>
        </div>
      </DesignBlock>
    </div>

    <!-- ========== 浮层 ========== -->
    <div v-show="activeSection === 'overlay'" class="space-y-4">
      <DesignBlock heading="弹窗" hint="静态预览，实际带遮罩。头尾各一条分隔线，操作按钮靠右。">
        <div class="mx-auto max-w-md">
          <div class="modal-content">
            <div class="modal-header">
              <span class="modal-title">调整消费额度</span>
              <button class="btn btn-ghost btn-icon" type="button" aria-label="关闭">
                <Icon name="x" size="sm" />
              </button>
            </div>
            <div class="modal-body space-y-3">
              <div>
                <label class="input-label">成员</label>
                <input class="input" value="zhangsan@example.com" disabled />
              </div>
              <div>
                <label class="input-label">额度上限</label>
                <input class="input" placeholder="留空表示不限额" />
                <p class="input-hint">额度用完后该成员的调用会被拒绝，不影响其他成员。</p>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary" type="button">取消</button>
              <button class="btn btn-primary" type="button">保存</button>
            </div>
          </div>
        </div>
      </DesignBlock>

      <DesignBlock heading="下拉与通知">
        <div class="flex flex-wrap items-start gap-6">
          <div class="dropdown">
            <button class="dropdown-item" type="button">查看详情</button>
            <button class="dropdown-item" type="button">复制密钥</button>
            <button class="dropdown-item text-red-600 dark:text-red-400" type="button">删除</button>
          </div>
          <div
            class="w-[300px] rounded-xl border border-line-subtle border-l-2 border-l-emerald-500 bg-surface-raised p-3 shadow-pop"
          >
            <div class="text-sm font-medium text-content-strong">保存成功</div>
            <div class="text-xs text-content-muted">额度已更新，立即生效。</div>
          </div>
        </div>
      </DesignBlock>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Icon } from '@/components/icons'
import DesignBlock from './design/DesignBlock.vue'

const sections = [
  { id: 'overview', label: '概览页' },
  { id: 'list', label: '列表页' },
  { id: 'color', label: '色彩' },
  { id: 'scale', label: '尺度' },
  { id: 'control', label: '控件' },
  { id: 'container', label: '容器' },
  { id: 'overlay', label: '浮层' }
] as const

type SectionId = (typeof sections)[number]['id']

const activeSection = ref<SectionId>('overview')

const isDark = ref(document.documentElement.classList.contains('dark'))
const toggleDark = (): void => {
  isDark.value = !isDark.value
  document.documentElement.classList.toggle('dark', isDark.value)
  localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
}

// 类名写全，样式扫描才认得出来。
const primarySteps = [
  { label: '50', cls: 'bg-primary-50' },
  { label: '100', cls: 'bg-primary-100' },
  { label: '200', cls: 'bg-primary-200' },
  { label: '300', cls: 'bg-primary-300' },
  { label: '400', cls: 'bg-primary-400' },
  { label: '500', cls: 'bg-primary-500' },
  { label: '600', cls: 'bg-primary-600' },
  { label: '700', cls: 'bg-primary-700' },
  { label: '800', cls: 'bg-primary-800' },
  { label: '900', cls: 'bg-primary-900' },
  { label: '950', cls: 'bg-primary-950' }
]

const surfaceTokens = [
  { name: '页面底', cls: 'bg-surface', usage: '整页背景' },
  { name: '卡片面', cls: 'bg-surface-raised', usage: '卡片、弹窗、表格' },
  { name: '凹陷区', cls: 'bg-surface-sunken', usage: '表头、悬停、禁用' },
  { name: '浅线条', cls: 'bg-line-subtle', usage: '卡片边框、行线' },
  { name: '重线条', cls: 'bg-line-strong', usage: '输入框、次操作按钮' }
]

const typeTiers = [
  {
    size: '12',
    cls: 'text-xs text-content-muted',
    sample: '标签、表头、注解',
    usage: '最小一档，不再往下分'
  },
  { size: '14', cls: 'text-sm text-content', sample: '正文、表格、按钮', usage: '主力字号' },
  {
    size: '18',
    cls: 'text-lg font-semibold text-content-strong',
    sample: '页面标题',
    usage: '卡片标题靠字重，不占档位'
  },
  { size: '30', cls: 'stat-value', sample: '1,284.50', usage: '概览页的数字' }
]

const radiusScale = [
  { cls: 'rounded', label: '4 标签' },
  { cls: 'rounded-lg', label: '6 控件' },
  { cls: 'rounded-xl', label: '8 卡片' },
  { cls: 'rounded-2xl', label: '10 弹窗' },
  { cls: 'rounded-3xl', label: '12 最大' }
]

const heightScale = [
  { label: '小号 28', cls: 'h-[28px] w-24', usage: '表格行内操作' },
  { label: '常规 34', cls: 'h-[34px] w-28', usage: '按钮、输入框、筛选' },
  { label: '大号 38', cls: 'h-[38px] w-32', usage: '表单主操作' },
  { label: '表格行 36', cls: 'h-9 w-40', usage: '列表正文行' },
  { label: '导航项 36', cls: 'h-9 w-36', usage: '侧边栏' }
]

// ── 概览页假数据 ────────────────────────────────────────
const overviewViews = ['概览', '按模型', '按成员']
const overviewView = ref<string>('概览')

const bigFigures = [
  { label: '本月消费', value: '1,284.50', caption: '较上月增加 12%' },
  { label: '调用次数', value: '186,420', caption: '成功率 99.4%' },
  { label: '消耗 Token', value: '4.28 亿', caption: '输入 3.1 亿 · 输出 1.18 亿' }
]

const smallCells = [
  { label: '成员总数', value: '24', caption: '本月新增 3 人' },
  { label: '活跃密钥', value: '18', caption: '最多可建 50 个' },
  { label: '可用分组', value: '4', caption: '由平台管理员授权' },
  { label: '待处理邀请', value: '2', caption: '7 天后过期' }
]

// ── 列表页假数据 ────────────────────────────────────────
const demoText = ref('示例科技')
const demoSelect = ref('default')
const demoTextarea = ref('')
const demoSwitch = ref(true)
const demoSearch = ref('')
const demoStatus = ref('')

const demoRows = [
  {
    id: 1,
    name: '张三',
    email: 'zhangsan@example.com',
    status: 'active',
    limit: '200.00',
    used: '132.40',
    joinedAt: '2026-03-12'
  },
  {
    id: 2,
    name: '李四',
    email: 'lisi@example.com',
    status: 'active',
    limit: null,
    used: '486.20',
    joinedAt: '2026-04-02'
  },
  {
    id: 3,
    name: '王五',
    email: 'wangwu@example.com',
    status: 'disabled',
    limit: '50.00',
    used: '50.00',
    joinedAt: '2026-05-19'
  },
  {
    id: 4,
    name: '赵六',
    email: 'zhaoliu@example.com',
    status: 'active',
    limit: '100.00',
    used: '12.80',
    joinedAt: '2026-06-07'
  }
]
</script>
