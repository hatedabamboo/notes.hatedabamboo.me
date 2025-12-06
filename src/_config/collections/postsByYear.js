import { DateTime } from "luxon";

export const postsByYear = (collection) => {
  const posts = collection.getFilteredByGlob("src/posts/*.md");
  const grouped = {};
  posts.forEach((post) => {
    const year = DateTime.fromJSDate(post.date).year;
    if (!grouped[year]) grouped[year] = [];
    grouped[year].push(post);
  });
  return Object.keys(grouped)
    .sort((a, b) => a - b)
    .map((year) => ({
      year,
      posts: grouped[year].sort((a, b) => a.date - b.date),
    }));
};
