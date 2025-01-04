export function cleanUpString(str: string) {
  // Remove leading and trailing spaces, newlines, and tabs
  str = str.trim().replace(/[\n\t]/g, '');
  // Remove extra spaces between words
  str = str.replace(/\s+/g, ' ');
  str = str.toLowerCase();

  return str;
}
