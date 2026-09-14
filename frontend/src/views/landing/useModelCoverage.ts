import { computed, onMounted, ref, type ComputedRef } from 'vue'
import { getModelPlaza } from '@/api/modelPlaza'

/**
 * 从模型广场取真实的模型和分组数量。
 *
 * 「模型多」这种话必须有数字撑着，而且数字得是真的——所以直接读广场那份
 * 公开目录，客户点进广场就能自己数一遍。广场开关关掉时接口返回 404，
 * 这时不显示数量，只保留文字描述，不退回写死的数。
 */
export interface ModelCoverage {
  /** 去重后的模型总数，未取到时为 0 */
  modelCount: ComputedRef<number>
  /** 分组总数，未取到时为 0 */
  groupCount: ComputedRef<number>
  /** 是否拿到了可用数字 */
  hasCounts: ComputedRef<boolean>
}

export function useModelCoverage(): ModelCoverage {
  const models = ref(0)
  const groups = ref(0)

  onMounted(async () => {
    try {
      const data = await getModelPlaza()
      const names = new Set<string>()
      for (const group of data.groups ?? []) {
        for (const model of group.models ?? []) {
          if (model?.name) names.add(model.name)
        }
      }
      models.value = names.size
      groups.value = (data.groups ?? []).length
    } catch {
      // 广场关闭或请求失败时保持 0，页面据此隐藏数字
      models.value = 0
      groups.value = 0
    }
  })

  return {
    modelCount: computed(() => models.value),
    groupCount: computed(() => groups.value),
    hasCounts: computed(() => models.value > 0)
  }
}
