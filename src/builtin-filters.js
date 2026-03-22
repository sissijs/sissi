/**
 * Serialize JSON
 * @param {any} arg any object to be serialized
 * @param {boolean} pretty whether to indent json
 * @returns 
 */
export function json(arg, pretty = false) {
  return pretty? JSON.stringify(arg, null, 2) : JSON.stringify(arg)
}

/**
 * Format date
 * @param {string|Date|number} date 
 * @param {Intl.DateTimeFormatOptions} options 
 * @param {Intl.LocalesArgument} locales the locale (default: 'en-US')
 * @returns {string} formatted date
 */
export function date(date, options = null, locales = 'en-US') {
  return new Intl.DateTimeFormat(locales, options).format(typeof date === 'string' ? Date.parse(date): date)
}

/**
 * Format as currency.
 * @param {number} amount 
 * @param {string?} currency 
 * @param {Intl.LocalesArgument} locales 
 * @returns 
 */
export function currency(amount, currency = 'usd', locales = 'en-US') {
  return new Intl.NumberFormat(locales, {style: 'currency', currency}).format(amount);
}

/**
 * Format number
 * @param {number} value 
 * @param {Intl.NumberFormatOptions} options 
 * @param {Intl.LocalesArgument} locales 
 * @returns {string} formatted number
 */
export function numberFormat(value, options, locales) {
  return new Intl.NumberFormat(locales || getEnvLocale(), options).format(value);
}

/**
 * Select a first N elements of an array
 * @param {Iterable} array 
 * @param {number} limit 
 * @returns 
 */
export function limit(array, limit) {
  if (limit < 0) {
    throw new Error(`Negative limits are not allowed: ${limit}.`);
  }
  return Array.from(array).slice(0, limit);
};

/**
 * Copy an array and reverse
 * @param {Iterable} array 
 * @returns new array, revered
 */
export function reverse(array) {
  return Array.from(array).reverse();
}

/**
 * Return a sorted copy of an array
 * @param {Iterable} array 
 * @returns new array, sorted
 */
export function sort(array) {
  const result = Array.from(array);
  result.sort();
  return result;
}

/**
 * Return the last N elements, in reverse order
 * @param {Iterable} array
 * @param {number} amount 
 */
export function last(amount = 1) {
  return Array.from(array).reverse().slice(0, amount);
}

/**
 * Escape HTML (replace angle brackets and ampersands with entities)
 * @param {string} str 
 * @returns escaped html
 */
export function htmlentities(str) {
  return str?.replace(/\&/gm, '&amp;').replace(/</gm, '&lt;').replace(/>/gm, '&gt;');
}

/**
 * URL-encode
 * @param {string} str 
 * @returns encoded string
 */
export function urlencode(str) {
  return encodeURIComponent(str);
}

export async function async(asyncInput) {
  const result = await asyncInput;
  return (typeof result === 'function') ? result() : result;
}

export function each(array, callback) {
  return array.map(callback).join('');
}

/**
 * Return the zero-based index of the current page in a collection.
 * Matches by page.inputPath. Returns -1 if not found.
 * @param {object[]} collection
 * @param {object} page
 * @returns {number}
 */
export function getCollectionItemIndex(collection, page) {
  if (!Array.isArray(collection) || !page) return -1;
  return collection.findIndex(item => item.page?.inputPath === page.inputPath);
}

/**
 * Return the item before the current page in a collection, or null.
 * @param {object[]} collection
 * @param {object} page
 * @returns {object|null}
 */
export function getPreviousCollectionItem(collection, page) {
  const idx = getCollectionItemIndex(collection, page);
  return idx > 0 ? collection[idx - 1] : null;
}

/**
 * Return the item after the current page in a collection, or null.
 * @param {object[]} collection
 * @param {object} page
 * @returns {object|null}
 */
export function getNextCollectionItem(collection, page) {
  const idx = getCollectionItemIndex(collection, page);
  return (idx !== -1 && idx < collection.length - 1) ? collection[idx + 1] : null;
}
