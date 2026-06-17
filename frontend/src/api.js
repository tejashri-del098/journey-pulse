const API_BASE = 'http://localhost:3001/api';

export const api = {
  simulate: async (campaignText, channel, segment) => {
    const res = await fetch(`${API_BASE}/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaignText, channel, segment }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err?.error?.message || 'Failed to simulate campaign');
    }
    return res.json();
  },

  simulateJourney: async (sequence, segment) => {
    const res = await fetch(`${API_BASE}/journey`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sequence, segment }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err?.error?.message || 'Failed to simulate journey');
    }
    return res.json();
  },

  testCampaigns: async () => {
    const res = await fetch(`${API_BASE}/simulate/test-campaigns`);
    if (!res.ok) throw new Error('Failed to load test campaigns');
    return res.json();
  }
};
