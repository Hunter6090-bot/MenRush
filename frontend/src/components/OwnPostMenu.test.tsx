import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OwnPostMenu } from './OwnPostMenu';

describe('OwnPostMenu (••• on your own post)', () => {
  it('44×44 trigger, 15px / 44px rows, Escape returns focus to the trigger', async () => {
    const onDelete = vi.fn();
    const user = userEvent.setup();
    render(
      <OwnPostMenu
        testId="more"
        items={[{ label: 'Delete post', danger: true, testId: 'del', onSelect: onDelete }]}
      />,
    );
    const trigger = screen.getByTestId('more');
    expect(trigger).toHaveClass('h-11', 'w-11');
    expect(screen.queryByTestId('del')).not.toBeInTheDocument();

    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('del')).toHaveClass('min-h-[44px]', 'text-[15px]');

    await user.keyboard('{Escape}');
    expect(screen.queryByTestId('del')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();

    await user.click(trigger);
    await user.click(screen.getByRole('menuitem', { name: 'Delete post' }));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
