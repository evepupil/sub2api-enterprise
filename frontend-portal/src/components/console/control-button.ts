/**
 * 和输入框、下拉框、日期范围排在同一行的按钮（标题行操作、筛选行按钮）统一叠加这组类：
 * 高 40px、6px 小圆角，与旁边的控件齐平。其余位置（弹窗底部、面板里的主操作）保持胶囊按钮。
 * 用法：`<Button className={CONTROL_BUTTON}>`、`buttonClass({ variant: 'secondary', className: CONTROL_BUTTON })`。
 */
export const CONTROL_BUTTON = 'h-10 rounded-md';
