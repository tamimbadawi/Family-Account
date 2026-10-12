import { describe, expect, it } from 'vitest';
import { shownInvites, type SentInvite } from './family-invites';

const NOW = Date.parse('2026-10-12T12:00:00Z');
const invite = (status: SentInvite['status'], hoursAgo: number): SentInvite => ({
  id: `${status}-${hoursAgo}`,
  friendName: 'Sara',
  email: 'sara@example.com',
  status,
  createdAt: new Date(NOW - hoursAgo * 3_600_000).toISOString(),
});

describe('shownInvites', () => {
  it('shows a waiting invite with the hours it has left', () => {
    expect(shownInvites([invite('pending', 0)], NOW)[0].hoursLeft).toBe(24);
    expect(shownInvites([invite('pending', 2.5)], NOW)[0].hoursLeft).toBe(22);
    expect(shownInvites([invite('pending', 23.9)], NOW)[0].hoursLeft).toBe(1);
  });

  it('removes a waiting invite once 24 hours have passed', () => {
    expect(shownInvites([invite('pending', 24)], NOW)).toEqual([]);
    expect(shownInvites([invite('pending', 68)], NOW)).toEqual([]);
  });

  it('removes expired invites and keeps started and declined ones as they are', () => {
    const started = invite('approved', 100);
    const declined = invite('declined', 100);
    expect(shownInvites([started, invite('expired', 30), declined], NOW)).toEqual([started, declined]);
  });
});
