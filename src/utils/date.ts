/**
 * @module utils/date
 * @description 统一的日期格式化工具。消除项目中重复的 toLocaleDateString 调用。
 */

/** 格式化为 "YYYY/MM/DD" 中文日期字符串 */
export function formatDate(date: Date): string {
  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}
