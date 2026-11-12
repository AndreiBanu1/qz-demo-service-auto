import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { Layout } from '../../src/components/Layout';

describe('Layout', () => {
  it('renders the demo banner', () => {
    render(
      <MemoryRouter>
        <Layout>
          <p>x</p>
        </Layout>
      </MemoryRouter>,
    );
    const link = screen.getByText('Site demonstrativ realizat de Quality Zone');
    expect(link).toBeInTheDocument();
    expect(link.closest('a')).toHaveAttribute('href', 'https://qualityzone.netlify.app/ro');
  });
});
