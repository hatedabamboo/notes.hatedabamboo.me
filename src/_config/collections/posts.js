export const posts = (collection) =>
  collection
    .getFilteredByGlob("src/posts/*.md")
    .sort((a, b) => b.date - a.date);

export const pinnedPosts = (collection) =>
  collection
    .getFilteredByGlob("src/posts/*.md")
    .filter((post) => post.data.pinned === true)
    .sort((a, b) => b.date - a.date);
