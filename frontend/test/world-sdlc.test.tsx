import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/lib/mdToHtml', () => ({
  mdToHtml: vi.fn((text: string) => text ? `<p>${text.slice(0, 50)}</p>` : ''),
}));

vi.mock('@/lib/api', () => ({
  api: {
    sdlc: { exportPrompt: vi.fn() },
    world: {},
  },
}));

import SdlcPanel from '../components/workspace/SdlcPanel';

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 'test-session-1',
    name: 'Test Session',
    created_at: '2025-01-01T00:00:00Z',
    workflow_state: 'done',
    chat_history: [],
    agent_outputs: { requirement: 'Build feature X' },
    jira_backlog: [],
    metrics: { tokens: 100 },
    ...overrides,
  } as Parameters<typeof SdlcPanel>[0]['session'];
}

const noop = () => {};
const baseProps = {
  editBA: '',
  editSA: '',
  editDevLead: '',
  busy: false,
  workflowRunning: false,
  streamingAgent: null as string | null,
  streamingText: '',
  onEditBA: noop,
  onEditSA: noop,
  onEditDevLead: noop,
  onApproveBA: noop,
  onApproveSA: noop,
  onApproveDevLead: noop,
  onStop: noop,
  onRestore: noop,
};

describe('SdlcPanel tool call rendering', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('renders tool call entries when toolCalls prop has entries', () => {
    const session = makeSession({ agent_outputs: { requirement: 'Build API', ba: 'BA analysis done' } });
    const toolCalls = {
      ba: [
        { server: 'my-server', tool: 'getData', args: { id: 1 } },
      ],
    };

    render(<SdlcPanel {...baseProps} session={session} toolCalls={toolCalls} />);

    expect(screen.getByText(/my-server\/getData/)).toBeTruthy();
  });

  it('expands and collapses tool call card on click', () => {
    const session = makeSession({ agent_outputs: { requirement: 'Build feature X', ba: 'BA analysis done' } });
    const toolCalls = {
      ba: [
        { server: 'srv', tool: 'search', args: { q: 'hello' } },
      ],
    };

    const { container } = render(
      <SdlcPanel {...baseProps} session={session} toolCalls={toolCalls} />,
    );

    const button = screen.getByText(/srv\/search/);
    expect(button).toBeTruthy();

    fireEvent.click(button);

    expect(container.textContent).toContain('"q":"hello"');

    fireEvent.click(button);

    expect(container.textContent).not.toContain('"q":"hello"');
  });

  it('shows error styling for tool calls with is_error=true', () => {
    const session = makeSession();
    const toolCalls = {
      security: [
        {
          server: 'vuln-srv',
          tool: 'scan',
          args: {},
          result: { content: [{ type: 'text', text: 'Connection refused' }], is_error: true },
        },
      ],
    };

    const { container } = render(
      <SdlcPanel {...baseProps} session={session} toolCalls={toolCalls} streamingAgent="security" />,
    );

    const errorEl = screen.getByText('error');
    expect(errorEl).toBeTruthy();
    expect(errorEl.tagName).toBe('SPAN');

    const button = screen.getByText(/vuln-srv\/scan/);
    fireEvent.click(button);

    expect(container.textContent).toContain('Connection refused');
  });

  it('shows waiting state when result is not yet available', () => {
    const session = makeSession();
    const toolCalls = {
      dev: [
        { server: 'ci-srv', tool: 'deploy', args: { env: 'staging' } },
      ],
    };

    const { container } = render(
      <SdlcPanel {...baseProps} session={session} toolCalls={toolCalls} streamingAgent="dev" />,
    );

    const button = screen.getByText(/ci-srv\/deploy/);
    fireEvent.click(button);

    expect(container.textContent).toContain('Waiting for result');
  });

  it('does not render tool section when toolCalls is empty', () => {
    const session = makeSession();

    const { container } = render(
      <SdlcPanel {...baseProps} session={session} toolCalls={{}} />,
    );

    expect(screen.queryByText(/server\/.*\/tool_name/)).toBeNull();
    expect(container.querySelector('.border-gray-200')).toBeNull();
  });

  it('renders successful tool result with green styling', () => {
    const session = makeSession();
    const toolCalls = {
      qa: [
        {
          server: 'test-srv',
          tool: 'runTest',
          args: { suite: 'smoke' },
          result: { content: [{ type: 'text', text: 'All tests passed' }], is_error: false },
        },
      ],
    };

    const { container } = render(
      <SdlcPanel {...baseProps} session={session} toolCalls={toolCalls} streamingAgent="qa" />,
    );

    const button = screen.getByText(/test-srv\/runTest/);
    fireEvent.click(button);

    expect(container.textContent).toContain('All tests passed');
  });
});
