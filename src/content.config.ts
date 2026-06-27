import { defineCollection, z } from "astro:content";

/**
 * 文章集合（posts）
 *
 * 定义博客文章的 frontmatter 字段校验规则。
 * 所有 Markdown 文件放在 src/content/posts/ 下，由 Astro Content Collections 管理。
 */
const postsCollection = defineCollection({
  schema: z.object({
    /** 文章标题 */
    title: z.string(),
    /** 文章简介，用于列表卡片和 SEO 描述 */
    description: z.string().default(""),
    /** 发布日期 */
    published: z.date(),
    /** 最后更新日期（可选） */
    updated: z.date().optional(),
    /** 标签列表，用于分类筛选 */
    tags: z.array(z.string()).default([]),
    /** 分类名称 */
    category: z.string().default(""),
    /** 是否置顶，置顶文章排在列表最前面 */
    pinned: z.boolean().default(false),
    /** 是否隐藏，隐藏后不在任何列表中显示 */
    hidden: z.boolean().default(false),
    /** 是否为草稿，草稿不会出现在正式页面中 */
    draft: z.boolean().default(false),
    /** 作者名，默认值可在 config.ts 中修改 */
    author: z.string().default("Merrick Jun Ouyang"),
    /** 封面图片路径（可选） */
    image: z.string().optional(),
  }),
});

/**
 * 碎碎念集合（status）
 *
 * 简短的状态更新，类似微博或 Twitter 时间线。
 * 数据文件放在 src/data/status.ts 中，这里定义校验规则。
 */
const statusCollection = defineCollection({
  schema: z.object({
    /** 日期 */
    date: z.date(),
    /** 外部链接（可选） */
    link: z.string().optional(),
  }),
});

/** 导出所有内容集合，供 Astro 自动识别和校验 */
export const collections = {
  posts: postsCollection,
  status: statusCollection,
};
