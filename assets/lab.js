// Keep bookmarks to both modes of the earlier assessment homepage usable.
const original = new URL(window.location.href);
const fragment = original.hash.slice(1);
const legacyMode = ['startup', 'personal'].includes(original.searchParams.get('mode'));
const labSection = fragment && document.getElementById(fragment);
const oldAnchors = new Set([
  'review', 'what', 'flow', 'report', 'method', 'principles', 'axes', 'tiers', 'stages', 'gates',
  'overall', 'focus', 'cases', 'sample', 'case-1', 'case-2', 'case-3', 'human', 'who', 'gene',
  'where', 'team', 'judgment', 'personal', 'example', 'try', 'open', 'anchors', 'files', 'versions'
]);
if (oldAnchors.has(fragment) || (legacyMode && (!labSection || fragment === 'top'))) {
  const archive = new URL('advisory.html', original);
  archive.search = original.search;
  archive.hash = original.hash;
  window.location.replace(archive);
} else {
  const language = document.querySelector('.lab .lang');
  function syncLanguage() { language.hash = window.location.hash; }
  syncLanguage();
  window.addEventListener('hashchange', syncLanguage);
}
