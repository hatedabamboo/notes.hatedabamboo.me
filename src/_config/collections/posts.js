export const posts = (collection) =>
  collection
    .getFilteredByGlob("src/posts/*.md")
    .sort((a, b) => b.date - a.date);