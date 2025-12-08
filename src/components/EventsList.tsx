import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import EventCard from './EventCard';
import { getBannerUrl } from '../utils/imageUrl';

interface Event {
  id: string;
  name: string;
  slug: string;
  date: string;
  banner_url: string | null;
  mobile_banner_url: string | null;
  status: string;
}

export default function EventsList() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: queryError } = await supabase
        .from('events')
        .select('id, name, slug, date, banner_url, mobile_banner_url, status')
        .in('status', ['published', 'completed'])
        .not('name', 'is', null)
        .not('date', 'is', null)
        .order('date', { ascending: true });

      if (queryError) {
        throw queryError;
      }

      // Filtro adicional para asegurar que name y date existan
      const validEvents = (data || []).filter(
        (event) => event.name && event.name.trim() !== '' && event.date
      ) as Event[];

      setEvents(validEvents);
    } catch (err: any) {
      console.error('Error loading events:', err);
      setError(err.message || 'Error al cargar los eventos');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-orange-primary"></div>
        <p className="text-white-pure/70 mt-4">Cargando eventos...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-fire/20 border border-red-fire rounded-lg p-6 text-center">
        <p className="text-white-pure">{error}</p>
        <button
          onClick={loadEvents}
          className="mt-4 px-4 py-2 bg-orange-primary hover:bg-red-fire text-white-pure rounded-lg transition-colors"
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-white-pure/70 text-lg">
          No hay eventos disponibles en este momento.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
      {events.map((event) => (
        <EventCard
          key={event.id}
          id={event.id}
          name={event.name}
          slug={event.slug}
          date={event.date}
          bannerUrl={getBannerUrl(event.banner_url)}
          mobileBannerUrl={getBannerUrl(event.mobile_banner_url)}
        />
      ))}
    </div>
  );
}


