import {
  toISOString,
  formatDate,
  readableDate,
  year,
  postDate,
  currentYear,
} from "./filters/dates.js";
import { excerpt, firstParagraph, readingTime } from "./filters/content.js";
import { groupBy, getPostNavigation } from "./filters/collections.js";

export default {
  toISOString,
  formatDate,
  readableDate,
  year,
  postDate,
  currentYear,
  excerpt,
  firstParagraph,
  readingTime,
  groupBy,
  getPostNavigation,
};
