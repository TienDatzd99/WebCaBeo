import test from 'node:test';
import assert from 'node:assert/strict';
import { openYouTube } from '../src/utils/openYouTube.js';

function setup(userAgent, extraNavigator = {}) {
  const document = new EventTarget();
  document.visibilityState = 'visible';
  const browser = new EventTarget();
  const destinations = [];
  const timers = new Map();
  let id = 0;
  Object.assign(browser, {
    document,
    navigator: { userAgent, ...extraNavigator },
    location: { assign: (url) => destinations.push(url) },
    setTimeout: (callback) => { timers.set(++id, callback); return id; },
    clearTimeout: (key) => timers.delete(key),
  });
  const event = { button: 0, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
  const runTimers = () => { for (const callback of [...timers.values()]) callback(); };
  return { browser, event, destinations, timers, runTimers };
}

const video = 'https://www.youtube.com/watch?v=abcdefghijk&t=30';

test('Android targets YouTube and includes an encoded web fallback', () => {
  const s = setup('Android');
  openYouTube(video, s.event, s.browser);
  assert.equal(s.event.defaultPrevented, true);
  assert.equal(s.destinations[0], `intent://www.youtube.com/watch?v=abcdefghijk&t=30#Intent;scheme=https;package=com.google.android.youtube;S.browser_fallback_url=${encodeURIComponent(video)};end;`);
  s.runTimers();
  assert.deepEqual(s.destinations.slice(1), [video]);
  assert.equal(s.timers.size, 0);
});

test('iPhone and iPad desktop mode use the YouTube scheme', () => {
  for (const s of [setup('iPhone'), setup('Macintosh', { platform: 'MacIntel', maxTouchPoints: 5 })]) {
    openYouTube(video, s.event, s.browser);
    assert.equal(s.destinations[0], 'youtube://www.youtube.com/watch?v=abcdefghijk&t=30');
    s.runTimers();
    assert.equal(s.destinations[1], video);
  }
});

test('switching to the app cancels fallback even after returning', () => {
  const s = setup('iPhone');
  openYouTube(video, s.event, s.browser);
  s.browser.document.visibilityState = 'hidden';
  s.browser.document.dispatchEvent(new Event('visibilitychange'));
  s.browser.document.visibilityState = 'visible';
  s.runTimers();
  assert.equal(s.destinations.length, 1);
  assert.equal(s.timers.size, 0);
});

test('pagehide and unmount cleanup cancel pending navigation', () => {
  for (const pagehide of [true, false]) {
    const s = setup('Android');
    const cleanup = openYouTube(video, s.event, s.browser);
    if (pagehide) s.browser.dispatchEvent(new Event('pagehide'));
    else cleanup();
    s.runTimers();
    assert.equal(s.destinations.length, 1);
  }
});

test('desktop, modified clicks, and unrelated or unsafe URLs keep normal navigation', () => {
  for (const [ua, href, overrides] of [
    ['Windows', video, {}],
    ['Android', video, { ctrlKey: true }],
    ['Android', video, { button: 1 }],
    ['Android', video, { defaultPrevented: true }],
    ['Android', 'https://youtube.com.example.org/watch?v=id', {}],
    ['Android', 'javascript:alert(1)', {}],
    ['Android', 'invalid', {}],
  ]) {
    const s = setup(ua);
    Object.assign(s.event, overrides);
    assert.equal(openYouTube(href, s.event, s.browser), undefined);
    assert.equal(s.destinations.length, 0);
    assert.equal(s.timers.size, 0);
  }
});

test('short URLs, Shorts, playlists, and channel subscription queries are retained', () => {
  for (const [href, path] of [
    ['https://youtu.be/abcdefghijk?t=20', '/watch?t=20&v=abcdefghijk'],
    ['https://m.youtube.com/shorts/abcdefghijk', '/shorts/abcdefghijk'],
    ['https://www.youtube.com/playlist?list=PL123', '/playlist?list=PL123'],
    ['https://www.youtube.com/@CaBeoAudio?sub_confirmation=1', '/@CaBeoAudio?sub_confirmation=1'],
  ]) {
    const s = setup('iPhone');
    openYouTube(href, s.event, s.browser);
    assert.equal(s.destinations[0], `youtube://www.youtube.com${path}`);
  }
});

test('a synchronous app navigation error falls back immediately', () => {
  const s = setup('iPhone');
  s.browser.location.assign = (url) => {
    if (url.startsWith('youtube:')) throw new Error('Blocked scheme');
    s.destinations.push(url);
  };
  openYouTube(video, s.event, s.browser);
  assert.deepEqual(s.destinations, [video]);
  assert.equal(s.timers.size, 0);
});
