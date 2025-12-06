export const tagList = (collection) => {
  const tags = new Set();
  collection.getAll().forEach((item) => {
    item.data.tags?.forEach((tag) => tags.add(tag));
  });
  return [...tags].sort();
};
