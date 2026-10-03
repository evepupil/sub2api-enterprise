/**
 * 和输入框、下拉框、日期范围排在同一行的按钮（标题行操作、筛选行按钮）统一叠加这组类：高 40px，
 * 与旁边的控件齐平（圆角由控制台按钮统一成 6px，见 ./button.tsx）。
 * 用法：`<Button className={CONTROL_BUTTON}>`、`buttonClass({ variant: 'secondary', className: CONTROL_BUTTON })`。
 */
export const CONTROL_BUTTON = 'h-10';
