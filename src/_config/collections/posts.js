const getPosts = (collection) =>
  collection.getFilteredByGlob("src/posts/*.md").sort((a, b) => b.date - a.date);

export const posts = (collection) => getPosts(collection);

export const pinnedPosts = (collection) =>
  getPosts(collection).filter((post) => post.data.pinned === true);

export const featuredPosts = (collection) =>
  getPosts(collection).filter((post) => post.data.featured === true);

export const recommendablePosts = (collection) =>
  getPosts(collection).filter((post) => !post.data.excluded_from_recommendations);
