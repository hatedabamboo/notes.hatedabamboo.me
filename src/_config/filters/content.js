const extractContent = (input) =>
  typeof input === "string" ? input : input?.content || "";

export const firstParagraph = (input) => {
  const content = extractContent(input);
  const match = content.replace(/<[^>]*>/g, "").match(/^\s*(.+?)(\n\n|\n|$)/s);
  return match ? match[1].trim() : "";
};

export const excerpt = (input) => {
  const content = extractContent(input);
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
