export const excerpt = (input) => {
  const content = typeof input === "string" ? input : input?.content || "";
  if (content.includes("<!-- more -->")) {
    return content.split("<!-- more -->")[0];
  }
  return content;
};

export const readingTime = (content) => {
  const wordsPerMinute = 200;
  const words = content.replace(/<[^>]*>/g, "").split(/\s+/).length;
  return Math.ceil(words / wordsPerMinute);
};
