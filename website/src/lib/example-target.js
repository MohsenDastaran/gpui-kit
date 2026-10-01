// A gallery card scrolls to the usage section that shows that sample.
// The card's title is matched to the heading that received the sample.
// A shared index into the code list is not a title: sections without a fence
// of their own would land on a different example.

export function exampleWords(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .join(' ');
}

export function galleryTitlesOf(value) {
  return String(value ?? '')
    .split('|')
    .map((title) => title.trim())
    .filter(Boolean);
}

/**
 * @param {{ text: string, titles?: string }[]} headings
 * @param {string} title
 */
export function findExampleHeading(headings, title) {
  const wanted = exampleWords(title);
  if (!wanted) return undefined;
  const tagged = headings.find((heading) =>
    galleryTitlesOf(heading.titles).some((item) => exampleWords(item) === wanted),
  );
  if (tagged) return tagged;
  return headings.find((heading) => exampleWords(heading.text) === wanted);
}
