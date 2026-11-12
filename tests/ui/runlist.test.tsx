import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RunList } from '../../src/components/RunList';
import type { Run } from '../../core/types';

const run = (items: Run['items']): Run => ({
  id: 'r1',
  job: 'remindere-zilnice',
  trigger: 'cron',
  startedAt: '2026-11-12T05:00:00.000Z',
  finishedAt: '2026-11-12T05:00:01.000Z',
  durationMs: 1000,
  result: 'ok',
  items,
});

describe('RunList', () => {
  it('shows sms-simulat as „SMS (simulare, netrimis)”', () => {
    render(
      <RunList runs={[run([{ channel: 'sms-simulat', to: 'i***@turbo-garaj.test', subject: 'ITP', outcome: 'simulat' }])]} />,
    );
    expect(screen.getByText('SMS (simulare, netrimis)')).toBeInTheDocument();
  });

  it('shows netrimis-limita copy', () => {
    render(
      <RunList runs={[run([{ channel: 'email', to: 'i***@turbo-garaj.test', subject: 'ITP', outcome: 'netrimis-limita' }])]} />,
    );
    expect(screen.getByText('netrimis: limita lunară a sandbox-ului')).toBeInTheDocument();
  });

  it('shows trigger and result in Romanian and Bucharest time', () => {
    render(<RunList runs={[run([])]} />);
    expect(screen.getByText('pornit automat')).toBeInTheDocument();
    expect(screen.getByText(/07:00/)).toBeInTheDocument();
  });
});
