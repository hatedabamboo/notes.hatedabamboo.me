import { DateTime } from "luxon";

export const groupBy = (array, key, subkey) => {
  const grouped = {};
  array.forEach((item) => {
    const groupKey =
      subkey === "year" ? DateTime.fromJSDate(item[key]).year : item[key];
    if (!grouped[groupKey]) grouped[groupKey] = [];
    grouped[groupKey].push(item);
  });
  return Object.keys(grouped)
    .sort((a, b) => b - a)
    .reduce((result, key) => ({ ...result, [key]: grouped[key] }), {});
};

export const getPostNavigation = (posts, currentPost) => {
  const sortedPosts = posts.sort((a, b) => b.date - a.date);
  const currentIndex = sortedPosts.findIndex(
    (post) => post.url === currentPost.url
  );
  return {
    prev:
      currentIndex < sortedPosts.length - 1
        ? sortedPosts[currentIndex + 1]
        : null,
    next: currentIndex > 0 ? sortedPosts[currentIndex - 1] : null,
  };
};