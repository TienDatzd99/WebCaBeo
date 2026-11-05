// Called synchronously from a click so the browser retains the user gesture.
export function openYouTube(href, event, browser = window) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

  let url;
  try {
    url = new URL(href);
  } catch {
    return;
  }
  if (!['http:', 'https:'].includes(url.protocol)
    || !['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'].includes(url.hostname)) return;

  const { navigator, document } = browser;
  const isAndroid = /Android/i.test(navigator.userAgent);
  const isIOS = /iPad|iPhone|iPod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (!isAndroid && !isIOS) return;

  if (url.hostname === 'youtu.be') {
    const videoId = url.pathname.slice(1).split('/')[0];
    if (!videoId) return;
    url.pathname = '/watch';
    url.searchParams.set('v', videoId);
  }
  url.protocol = 'https:';
  url.hostname = 'www.youtube.com';
  // Fragments cannot be part of the Intent data URI.
  url.hash = '';
  const webUrl = url.href;
  const destination = `${url.host}${url.pathname}${url.search}`;
  const appUrl = isAndroid
    ? `intent://${destination}#Intent;scheme=https;package=com.google.android.youtube;S.browser_fallback_url=${encodeURIComponent(webUrl)};end;`
    : `youtube://${destination}`;

  event.preventDefault();
  const cleanup = () => {
    browser.clearTimeout(timer);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    browser.removeEventListener('pagehide', cleanup);
  };
  const onVisibilityChange = () => {
    if (document.visibilityState === 'hidden') cleanup();
  };
  const timer = browser.setTimeout(() => {
    cleanup();
    if (document.visibilityState !== 'hidden') browser.location.assign(webUrl);
  }, 1800);
  document.addEventListener('visibilitychange', onVisibilityChange);
  browser.addEventListener('pagehide', cleanup);
  try {
    browser.location.assign(appUrl);
  } catch {
    cleanup();
    browser.location.assign(webUrl);
  }
  return cleanup;
}
