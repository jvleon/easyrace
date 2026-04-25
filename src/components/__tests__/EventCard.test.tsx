import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import EventCard from '../EventCard';

/**
 * Unit test para el componente EventCard.
 * Este componente es puramente presentacional, ideal para unit tests.
 */

const mockProps = {
  id: 'event-1',
  name: 'Carrera de Prueba 2025',
  slug: 'carrera-de-prueba-2025',
  date: '2025-10-15T09:00:00Z',
  location: 'Ciudad de México',
  bannerUrl: null,
  mobileBannerUrl: null,
};

describe('EventCard', () => {
  it('renderiza el nombre del evento', () => {
    render(<EventCard {...mockProps} />);
    expect(screen.getByText('Carrera de Prueba 2025')).toBeInTheDocument();
  });

  it('renderiza la ubicación del evento', () => {
    render(<EventCard {...mockProps} />);
    expect(screen.getByText(/Ciudad de México/i)).toBeInTheDocument();
  });

  it('contiene un enlace que apunta al slug del evento', () => {
    render(<EventCard {...mockProps} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/eventos/carrera-de-prueba-2025');
  });

  it('muestra la inicial del nombre cuando no hay banner', () => {
    render(<EventCard {...mockProps} />);
    expect(screen.getByText('C')).toBeInTheDocument();
  });
});
