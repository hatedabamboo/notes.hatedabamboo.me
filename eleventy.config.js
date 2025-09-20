import filters from "./src/_config/filters.js";
import collections from "./src/_config/collections.js";
import pluginRss from "@11ty/eleventy-plugin-rss";
import { IdAttributePlugin } from "@11ty/eleventy";
import markdownIt from "markdown-it";
import markdownItContainer from "markdown-it-container";
import markdownItAttrs from "markdown-it-attrs";
import markdownItLinkAttributes from "markdown-it-link-attributes";
import Prism from "prismjs";
import markdownItAnchor from "markdown-it-anchor";
import loadLanguages from "prismjs/components/index.js";
import EleventyPluginOgImage from 'eleventy-plugin-og-image';
import fs from 'fs';
loadLanguages([
  "yaml",
  "python",
  "bash",
  "shell",
  "json",
  "javascript",
  "typescript",
  "css",
  "html",
  "markdown",
  "sql",
  "dockerfile",
  "nginx",
  "hcl",
]);

export default async function (eleventyConfig) {
  eleventyConfig.addGlobalData("permalink", () => (data) => {
    if (data.page.inputPath.includes("/posts/")) {
      return `/${data.slug || data.page.fileSlug}/`;
    }
    return false;
  });

  eleventyConfig.addPlugin(pluginRss);
  eleventyConfig.addPlugin(IdAttributePlugin, {
    selector: "h1,h2,h3,h4",
    decodeEntities: true,
    checkDuplicates: "error",
    slugify: eleventyConfig.getFilter("slugify"),
    filter: function ({ page }) {
      if (page.inputPath.endsWith("test-skipped.html")) {
        return false;
      }
      return true;
    },
  });
  eleventyConfig.addPlugin(EleventyPluginOgImage, {
    satoriOptions: {
      fonts: [
        {
          name: 'Inter',
          data: fs.readFileSync('./src/css/OpenSans600.ttf'),
          weight: 600,
          style: 'normal',
        },
      ],
    },
    shortcodeOutput: async (ogImage) => {
      return ogImage.outputUrl();
    }
  });

  eleventyConfig.addPassthroughCopy("src/assets");
  eleventyConfig.addPassthroughCopy("src/css");
  eleventyConfig.addPassthroughCopy("src/CNAME");
  eleventyConfig.addPassthroughCopy("src/robots.txt");

  const createAdmonition = (type, defaultTitle) => ({
    render: (tokens, idx) => {
      const m = tokens[idx].info.trim().match(new RegExp(`^${type}\\s*(.*)$`));
      return tokens[idx].nesting === 1
        ? `<div class="admonition ${type}">\n<p class="admonition-title">${
            m[1] || defaultTitle
          }</p>\n`
        : "</div>\n";
    },
  });

  const markdownLib = markdownIt({ html: true, breaks: true, linkify: true })
    .use(markdownItAttrs)
    .use((await import("markdown-it-prism")).default)
    .use((await import("markdown-it-footnote")).default)
    .use(markdownItLinkAttributes, [
      {
        matcher: (href) =>
          href.match(/^https?:\/\//) && !href.includes("notes.hatedabamboo.me"),
        attrs: { target: "_blank", rel: "noopener noreferrer" },
      },
    ])
    .use(markdownItContainer, "note", createAdmonition("note", "Note"))
    .use(markdownItContainer, "info", createAdmonition("info", "Info"))
    .use(markdownItContainer, "tip", createAdmonition("tip", "Tip"))
    .use(markdownItContainer, "warning", createAdmonition("warning", "Warning"))
    .use(markdownItContainer, "danger", createAdmonition("danger", "Danger"))
    .use(markdownItContainer, "quote", createAdmonition("quote", "Quote"))
    .use(markdownItAnchor, {
      tabIndex: false,
      level: [2, 3],
      permalink: markdownItAnchor.permalink.linkInsideHeader({
        symbol: '#',
        placement: 'after',
        assistiveText: (title) => `Permalink to “${title}”`,
        class: 'headerlink',
      }),
    });

  const defaultRender =
    markdownLib.renderer.rules.fence ||
    ((tokens, idx, options, env, renderer) =>
      renderer.renderToken(tokens, idx, options));
  markdownLib.renderer.rules.fence = (tokens, idx, options, env, renderer) => {
    const langName = tokens[idx].info?.trim().split(/\s+/g)[0];
    let result = defaultRender(tokens, idx, options, env, renderer);
    if (langName && result.includes('class="language-')) {
      result = result.replace(
        /(<pre[^>]*>)/,
        `$1<span class="code-lang">${langName}</span>`
      );
    }
    return result;
  };

  eleventyConfig.setLibrary("md", markdownLib);

  // Collections
  eleventyConfig.addCollection("posts", collections.posts);
  eleventyConfig.addCollection("tagList", collections.tagList);
  eleventyConfig.addCollection("postsByYear", collections.postsByYear);

  // Filters
  eleventyConfig.addFilter("postDate", filters.postDate);
  eleventyConfig.addFilter("currentYear", filters.currentYear);
  eleventyConfig.addFilter("excerpt", filters.excerpt);
  eleventyConfig.addFilter("readingTime", filters.readingTime);
  eleventyConfig.addFilter("groupBy", filters.groupBy);
  eleventyConfig.addFilter("getPostNavigation", filters.getPostNavigation);
  eleventyConfig.addFilter("toIsoString", filters.toISOString);
  eleventyConfig.addFilter("formatDate", filters.formatDate);
  eleventyConfig.addFilter("readableDate", filters.readableDate);
  eleventyConfig.addFilter("year", filters.year);

  return {
    dir: {
      input: "src",
      output: "dist",
      includes: "_includes",
      data: "_data",
    },
    markdownTemplateEngine: "njk",
  };
}
