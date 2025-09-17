import { DateTime } from 'luxon';

export const toISOString = (dateString) => DateTime.fromJSDate(dateString, { zone: 'utc' }).toISODate();

export const formatDate = (date, format) => DateTime.fromJSDate(date, { zone: 'utc' }).toFormat(format);

export const readableDate = (date) => DateTime.fromJSDate(date, { zone: 'utc' }).toLocaleString(DateTime.DATE_FULL);

export const year = (date) => DateTime.fromJSDate(date, { zone: 'utc' }).toFormat('yyyy');

export const postDate = (dateObj) => {
  return DateTime.fromJSDate(dateObj).toLocaleString(DateTime.DATE_MED);
};

export const currentYear = () => {
  return new Date().getFullYear();
};
