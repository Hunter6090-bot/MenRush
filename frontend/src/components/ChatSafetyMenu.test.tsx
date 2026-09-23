import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ChatSafetyMenu } from './ChatSafetyMenu';
import { ConversationItem } from './ConversationItem';

const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('../api/client', () => ({
  usersAPI: {
    blockUser: vi.fn().mockResolvedValue({ data: { success: true } }),
    reportUser: vi.fn().mockResolvedValue({ data: { success: true } }),
  },
}));

function renderMenu(props: {
  peerId?: string;
  peerName?: string;
  onNotice?: (msg: string, tone?: 'success' | 'error') => void;
  onBlocked?: () => void;
} = {}) {
  return render(
    <MemoryRouter>
      <ChatSafetyMenu
        peerId={props.peerId ?? 'peer-1'}
        peerName={props.peerName ?? 'Nick'}
        onNotice={props.onNotice}
        onBlocked={props.onBlocked}
      />
    </MemoryRouter>,
  );
}

describe('ChatSafetyMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders options trigger button without menu initially open', () => {
    renderMenu();
    const trigger = screen.getByRole('button', { name: 'Chat options' });
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('opens menu with Report, Block, and Manage blocked people actions', () => {
    renderMenu({ peerName: 'Nick' });
    const trigger = screen.getByRole('button', { name: 'Chat options' });

    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const menu = screen.getByRole('menu');
    expect(menu).toBeInTheDocument();

    expect(screen.getByRole('menuitem', { name: 'Report Nick' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Block Nick' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Manage blocked people' })).toBeInTheDocument();
  });

  it('closes menu on Escape key', () => {
    renderMenu();
    const trigger = screen.getByRole('button', { name: 'Chat options' });
    fireEvent.click(trigger);
    expect(screen.getByRole('menu')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('closes menu on outside click', () => {
    renderMenu();
    const trigger = screen.getByRole('button', { name: 'Chat options' });
    fireEvent.click(trigger);
    expect(screen.getByRole('menu')).toBeInTheDocument();

    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('opens report modal when Report is clicked', () => {
    renderMenu({ peerName: 'Nick' });
    fireEvent.click(screen.getByRole('button', { name: 'Chat options' }));

    fireEvent.click(screen.getByRole('menuitem', { name: 'Report Nick' }));

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Report Nick' })).toBeInTheDocument();
  });

  it('opens block modal when Block is clicked', () => {
    renderMenu({ peerName: 'Nick' });
    fireEvent.click(screen.getByRole('button', { name: 'Chat options' }));

    fireEvent.click(screen.getByRole('menuitem', { name: 'Block Nick' }));

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Block Nick?' })).toBeInTheDocument();
  });

  it('navigates to /settings#blocked when Manage blocked people is clicked', () => {
    renderMenu();
    fireEvent.click(screen.getByRole('button', { name: 'Chat options' }));

    fireEvent.click(screen.getByRole('menuitem', { name: 'Manage blocked people' }));

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(navigateMock).toHaveBeenCalledWith('/settings#blocked');
  });

  it('opens from a ConversationItem row with unclipped actions in document.body portal', () => {
    render(
      <MemoryRouter>
        <ConversationItem
          userId="u-123"
          name="Nick"
          lastMessage="hi"
          variant="sidebar"
        />
      </MemoryRouter>,
    );

    const trigger = screen.getByRole('button', { name: 'Chat options' });
    fireEvent.click(trigger);

    const menu = screen.getByRole('menu');
    expect(menu).toBeInTheDocument();
    expect(document.body.contains(menu)).toBe(true);
    expect(screen.getByRole('menuitem', { name: 'Report Nick' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Block Nick' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Manage blocked people' })).toBeInTheDocument();
  });
});
