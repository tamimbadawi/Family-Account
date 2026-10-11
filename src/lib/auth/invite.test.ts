import { afterEach, describe, expect, it, vi } from 'vitest';
import { inviteLink, sendInvite } from './invite';

describe('inviteLink', () => {
  it('points at the sign-in page in the given language', () => {
    expect(inviteLink('https://app.example', 'ar')).toBe('https://app.example/ar/login');
    expect(inviteLink('https://app.example/', 'en')).toBe('https://app.example/en/login');
  });
});

describe('sendInvite', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('uses the share sheet when there is one', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { share });
    expect(await sendInvite('T', 'Hi', 'https://x/en/login')).toBe('shared');
    expect(share).toHaveBeenCalledWith({ title: 'T', text: 'Hi', url: 'https://x/en/login' });
  });

  it('stays quiet when the share sheet is closed', async () => {
    const writeText = vi.fn();
    vi.stubGlobal('navigator', {
      share: vi.fn().mockRejectedValue(new DOMException('closed', 'AbortError')),
      clipboard: { writeText },
    });
    expect(await sendInvite('T', 'Hi', 'u')).toBe('cancelled');
    expect(writeText).not.toHaveBeenCalled();
  });

  it('copies the message when there is no share sheet', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    expect(await sendInvite('T', 'Hi', 'u')).toBe('copied');
    expect(writeText).toHaveBeenCalledWith('Hi\nu');
  });

  it('reports failure when neither works', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('no')) } });
    expect(await sendInvite('T', 'Hi', 'u')).toBe('failed');
  });
});
