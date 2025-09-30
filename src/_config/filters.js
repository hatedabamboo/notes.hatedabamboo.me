import {
  toISOString,
  formatDate,
  readableDate,
  year,
  postDate,
  currentYear,
} from "./filters/dates.js";
import { excerpt, readingTime, extractTitleImage } from "./filters/content.js";
import { groupBy, getPostNavigation } from "./filters/collections.js";

export default {
  toISOString,
  formatDate,
  readableDate,
  year,
  postDate,
  currentYear,
  excerpt,
  readingTime,
  extractTitleImage,
  groupBy,
  getPostNavigation,
};
