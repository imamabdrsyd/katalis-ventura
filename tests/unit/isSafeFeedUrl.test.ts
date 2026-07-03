import { describe, it, expect } from 'vitest';
import { isSafeFeedUrl } from '@/lib/api/icalSync';

describe('isSafeFeedUrl (guard SSRF feed iCal)', () => {
  it('menerima URL feed OTA https publik', () => {
    expect(isSafeFeedUrl('https://www.airbnb.com/calendar/ical/12345.ics?s=abc')).toBe(true);
    expect(isSafeFeedUrl('https://admin.booking.com/hotel/ical.ics')).toBe(true);
  });

  it('menolak non-https', () => {
    expect(isSafeFeedUrl('http://www.airbnb.com/calendar/ical/12345.ics')).toBe(false);
    expect(isSafeFeedUrl('file:///etc/passwd')).toBe(false);
    expect(isSafeFeedUrl('ftp://example.com/cal.ics')).toBe(false);
  });

  it('menolak host lokal & suffix internal', () => {
    expect(isSafeFeedUrl('https://localhost/cal.ics')).toBe(false);
    expect(isSafeFeedUrl('https://foo.local/cal.ics')).toBe(false);
    expect(isSafeFeedUrl('https://metadata.internal/computeMetadata/v1/')).toBe(false);
  });

  it('menolak IP privat/loopback/link-local (IPv4)', () => {
    expect(isSafeFeedUrl('https://127.0.0.1/cal.ics')).toBe(false);
    expect(isSafeFeedUrl('https://10.0.0.5/cal.ics')).toBe(false);
    expect(isSafeFeedUrl('https://192.168.1.1/cal.ics')).toBe(false);
    expect(isSafeFeedUrl('https://169.254.169.254/latest/meta-data/')).toBe(false);
    expect(isSafeFeedUrl('https://172.16.0.1/cal.ics')).toBe(false);
    expect(isSafeFeedUrl('https://172.31.255.255/cal.ics')).toBe(false);
  });

  it('IP 172.x di luar rentang privat tetap diterima', () => {
    expect(isSafeFeedUrl('https://172.15.0.1/cal.ics')).toBe(true);
    expect(isSafeFeedUrl('https://172.32.0.1/cal.ics')).toBe(true);
  });

  it('menolak IP literal IPv6 & string bukan URL', () => {
    expect(isSafeFeedUrl('https://[::1]/cal.ics')).toBe(false);
    expect(isSafeFeedUrl('bukan url')).toBe(false);
    expect(isSafeFeedUrl('')).toBe(false);
  });
});
