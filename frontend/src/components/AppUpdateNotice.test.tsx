import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AppUpdateNotice } from './AppUpdateNotice';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('safe application update notice', () => {
  it.each([
    { ok: true, json: async () => ({ buildId: 'current' }) },
    { ok: false, json: async () => ({}) },
    { ok: true, json: async () => ({ unexpected: 'html fallback' }) },
  ])('stays quiet for unchanged or unavailable version data', async response => {
    const fetcher = vi.fn().mockResolvedValue(response);
    vi.stubGlobal('fetch', fetcher);
    render(<AppUpdateNotice buildId="current" enabled />);
    await waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  });

  it('keeps drafts and supports postponing a reload', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ buildId: 'next' }) }));
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<><textarea aria-label="Draft" defaultValue="Keep this draft" /><AppUpdateNotice buildId="current" enabled /></>);
    await screen.findByRole('complementary', { name: 'App update' });
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(confirm).toHaveBeenCalledOnce();
    expect(screen.getByRole('textbox', { name: 'Draft' })).toHaveValue('Keep this draft');
    fireEvent.click(screen.getByRole('button', { name: 'Later' }));
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Draft' })).toHaveValue('Keep this draft');
  });

  it('does not poll when disabled', () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    render(<AppUpdateNotice buildId="current" enabled={false} />);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
