import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";
import { siteConfig } from "./config";

// 文件名和嵌套目录决定文章 ID；只移除扩展名，统一 Windows 路径分隔符。
const generateId = ({ entry }: { entry: string }) =>
  entry.replace(/\\/g, "/").replace(/\.(md|mdx)$/, "");

/**
 * 文章集合（posts）
 *
 * 定义博客文章的 frontmatter 字段校验规则。
 * 所有 Markdown 文件放在 src/content/posts/ 下，由 Astro Content Collections 管理。
 */
const postsCollection = defineCollection({
  loader: glob({ base: "./src/content/posts", pattern: "**/*.{md,mdx}", generateId }),
  schema: z
    .object({
      /** 文章标题 */
      title: z.string().trim().min(1),
      /** 文章简介，用于列表卡片和 SEO 描述 */
      description: z.string().default(""),
      /** 发布日期 */
      published: z.coerce.date(),
      /** 最后更新日期（可选） */
      updated: z.coerce.date().optional(),
      /** 标签列表，用于分类筛选 */
      tags: z
        .array(z.string().trim().min(1))
        .default([])
        .transform((tags) => [...new Set(tags)]),
      /** 分类名称 */
      category: z
        .string()
        .trim()
        .default("")
        .refine(
          (value) => !/[\\/:*?"<>|\x00-\x1f]/.test(value) && !/^\.{1,2}$/.test(value),
          "分类名称必须能作为独立目录名，不能包含路径或 Windows 非法字符",
        ),
      /** 是否置顶，置顶文章排在列表最前面 */
      pinned: z.boolean().default(false),
      /** 是否隐藏，隐藏后不在任何列表中显示 */
      hidden: z.boolean().default(false),
      /** 是否为草稿，草稿不会出现在正式页面中 */
      draft: z.boolean().default(false),
      /** 作者名，默认值可在 config.ts 中修改 */
      author: z.string().default(siteConfig.author),
      /** 封面图片路径（可选） */
      image: z.string().optional(),
    })
    .refine((data) => !data.updated || data.updated >= data.published, {
      message: "更新时间不能早于发布日期",
      path: ["updated"],
    }),
});

/**
 * 碎碎念集合（status）
 *
 * 简短的状态更新，类似微博或 Twitter 时间线。
 * 数据文件放在 src/content/status/ 中。
 */
const statusCollection = defineCollection({
  loader: glob({ base: "./src/content/status", pattern: "**/*.md", generateId }),
  schema: z.object({
    /** 日期 */
    date: z.coerce.date(),
    /** 外部链接（可选） */
    link: z.url({ protocol: /^https?$/ }).optional(),
    draft: z.boolean().default(false),
    hidden: z.boolean().default(false),
  }),
});

/** 导出所有内容集合，供 Astro 自动识别和校验 */
export const collections = {
  posts: postsCollection,
  status: statusCollection,
};
