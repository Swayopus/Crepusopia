/**
 * @module utils/date
 * @description 统一的日期格式化工具。消除项目中重复的 toLocaleDateString 调用。
 */

import { siteConfig } from "../config.ts";
/** 归档分组也采用站点时区，不依赖构建机器所在地区。 */
export function dateParts(date: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: siteConfig.timezone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);
  const get = (name: string) => Number(parts.find((part) => part.type === name)!.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}
/** 按站点时区格式化为 "YYYY/MM/DD" 中文日期字符串。 */
export function formatDate(date: Date): string {
  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: siteConfig.timezone,
  });
}
