const CANONICAL_TAG = '{{unsubscribe_url}}';
const URL_ENCODED = '%7B%7Bunsubscribe_url%7D%7D';
const HTML_ENTITY = '&#123;&#123;unsubscribe_url&#125;&#125;';

const RE_CANONICAL = /\{\{unsubscribe_url\}\}/gi;
const RE_URL_ENCODED = /%7B%7Bunsubscribe_url%7D%7D/gi;
const RE_HTML_ENTITY = /&#123;&#123;unsubscribe_url&#125;&#125;/gi;

export function normalizeUnsubscribeHtml(html: string): string {
  return html
    .replace(RE_URL_ENCODED, CANONICAL_TAG)
    .replace(RE_HTML_ENTITY, CANONICAL_TAG);
}

export function hasUnsubscribePlaceholder(html: string): boolean {
  const normalized = normalizeUnsubscribeHtml(html);
  return RE_CANONICAL.test(normalized);
}

export function hasUnsubscribeInHref(html: string): boolean {
  const normalized = normalizeUnsubscribeHtml(html);
  const hrefPattern = /href\s*=\s*["']?\{\{unsubscribe_url\}\}["']?/i;
  return hrefPattern.test(normalized);
}

export function replaceUnsubscribePlaceholder(
  html: string,
  recipientUrl: string,
): string {
  const normalized = normalizeUnsubscribeHtml(html);
  return normalized.replace(RE_CANONICAL, recipientUrl);
}

export const PREVIEW_UNSUBSCRIBE_URL = '#unsubscribe-preview';

export function replaceForPreview(html: string): string {
  const normalized = normalizeUnsubscribeHtml(html);
  return normalized.replace(RE_CANONICAL, PREVIEW_UNSUBSCRIBE_URL);
}

export const UNSUB_TAG = CANONICAL_TAG;
