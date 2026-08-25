import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DiscreetMedia } from './DiscreetMedia';

describe('DiscreetMedia', () => {
  it('shows media clear when the server flag is off', () => {
    render(
      <MemoryRouter>
        <DiscreetMedia blur={false}>
          <img alt="clear" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" />
        </DiscreetMedia>
      </MemoryRouter>,
    );
    expect(screen.queryByTestId('discreet-media-blur')).not.toBeInTheDocument();
    expect(screen.getByAltText('clear')).toBeInTheDocument();
  });

  it('applies the blur gate and Premium unlock when the server flag is on', () => {
    render(
      <MemoryRouter>
        <DiscreetMedia blur>
          <img alt="hidden" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" />
        </DiscreetMedia>
      </MemoryRouter>,
    );
    expect(screen.getByTestId('discreet-media-blur')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /unlock with premium/i })).toHaveAttribute('href', '/premium');
  });
});
