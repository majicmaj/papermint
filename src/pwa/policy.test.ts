import { describe, expect, it } from 'vitest';
import { classify, type RequestInfo } from './policy';

const ORIGIN = 'https://app.test';
function request(path: string, over: Partial<RequestInfo> = {}): RequestInfo {
  return { url: new URL(path, ORIGIN), method: 'GET', mode: 'cors', origin: ORIGIN, ...over };
}

describe('what the service worker leaves to the network', () => {
  it('every API request, whatever it asks for', () => {
    for (const path of [
      '/api/documents/?page_size=200&fields=id,title,content',
      '/api/documents/?fields=id,notes',
      '/api/documents/5/preview/?version=7',
      '/api/documents/5/thumb/',
      '/api/documents/5/download/?original=true',
      '/api/documents/5/',
      '/api/tags/',
      '/api/ui_settings/',
      '/api/custom_fields/',
      '/api/tasks/',
      '/api/documents/?query=ein',
    ]) {
      expect(classify(request(path)), path).toBe('network');
      expect(classify(request(path, { method: 'HEAD' })), `HEAD ${path}`).toBe('network');
    }
  });

  it('recovery files, backups, media, static files and the theme', () => {
    for (const path of [
      '/recovery-files/code.txt',
      '/recovery-files/packet.pdf',
      '/backups/originals',
      '/media/x.pdf',
      '/static/x.js',
      '/theme/custom.css',
      '/recovery-files/example.pdf',
      '/accounts/login/',
      '/admin/',
      '/config.json',
    ]) {
      expect(classify(request(path)), path).toBe('network');
      expect(classify(request(path, { mode: 'navigate' })), `navigate ${path}`).toBe('network');
    }
  });

  it('writes and other origins', () => {
    expect(classify(request('/api/documents/5/', { method: 'PATCH' }))).toBe('network');
    expect(classify(request('/index.html', { method: 'POST' }))).toBe('network');
    expect(classify(request('https://other.test/assets/x.js'))).toBe('network');
  });
});

describe('what it answers from the app shell', () => {
  it('every page navigation', () => {
    for (const path of ['/', '/pending', '/recovery', '/r/12', '/f/code']) {
      expect(classify(request(path, { mode: 'navigate' })), path).toBe('shell');
    }
  });

  it('the built files of the app', () => {
    for (const path of [
      '/assets/index-abc.js',
      '/icons/icon-192.png',
      '/manifest.webmanifest',
      '/favicon.png',
      '/robots.txt',
    ]) {
      expect(classify(request(path)), path).toBe('shell');
    }
  });

  it('nothing else', () => {
    expect(classify(request('/something-else.json'))).toBe('network');
  });
});
