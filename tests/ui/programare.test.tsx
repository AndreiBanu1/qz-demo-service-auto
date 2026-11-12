import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Programare } from '../../src/pages/Programare';

afterEach(() => vi.unstubAllGlobals());

describe('Programare', () => {
  it('logged-out submit shows demo notice and does not post', async () => {
    const fetchMock = vi.fn(async (..._args: unknown[]) => new Response(JSON.stringify({ admin: false }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    render(
      <MemoryRouter>
        <Programare />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText('Prenume'), { target: { value: 'Ion' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ion@turbo-garaj.test' } });
    fireEvent.change(screen.getByLabelText('Marca'), { target: { value: 'Dacia' } });
    fireEvent.change(screen.getByLabelText('Modelul'), { target: { value: 'Logan' } });
    fireEvent.click(screen.getByRole('button', { name: 'Trimite programarea' }));

    expect(await screen.findByText('Formular demonstrativ, programarea nu a fost trimisă.')).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const posts = fetchMock.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === 'POST');
    expect(posts).toHaveLength(0);
  });
});
