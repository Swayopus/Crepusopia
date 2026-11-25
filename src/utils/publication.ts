export const isPublished = (entry: { data: { draft?: boolean; hidden?: boolean } }) =>
  !entry.data.draft && !entry.data.hidden;

/** 返回新数组，避免置顶排序污染归档、RSS 和相邻文章的真实时间顺序。 */
export function sortPosts<T extends { id: string; data: { published: Date; pinned?: boolean } }>(
  posts: T[],
  pinnedFirst = false,
): T[] {
  return [...posts].sort(
    (a, b) =>
      (pinnedFirst ? Number(Boolean(b.data.pinned)) - Number(Boolean(a.data.pinned)) : 0) ||
      b.data.published.getTime() - a.data.published.getTime() ||
      a.id.localeCompare(b.id, "en"),
  );
}
