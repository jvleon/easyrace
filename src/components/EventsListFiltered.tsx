import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import EventCard from './EventCard';
import { getBannerUrl } from '../utils/imageUrl';
import { isDemoSubdomain } from '../utils/subdomain';

interface Event {
  id: string;
  name: string;
  slug: string;
  date: string;
  banner_url: string | null;
  mobile_banner_url: string | null;
  location: string | null;
  status: string;
  is_demo?: boolean;
  sport_type_id?: string | null;
}

interface SportType {
  id: string;
  name: string;
}

export default function EventsListFiltered() {
  const [events, setEvents] = useState<Event[]>([]);
  const [sportTypes, setSportTypes] = useState<SportType[]>([]);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const isDemo = isDemoSubdomain();

      // Fetch events — try with sport_type_id first, fallback without it
      let data: any[] | null = null;
      let queryError: any = null;

      const result = await supabase
        .from('events')
        .select('id, name, slug, date, banner_url, mobile_banner_url, location, status, is_demo, sport_type_id')
        .in('status', ['published', 'completed'])
        .not('name', 'is', null)
        .not('date', 'is', null)
        .order('date', { ascending: true });

      if (result.error) {
        // Fallback: query without sport_type_id in case column doesn't exist
        const fallback = await supabase
          .from('events')
          .select('id, name, slug, date, banner_url, mobile_banner_url, location, status, is_demo')
          .in('status', ['published', 'completed'])
          .not('name', 'is', null)
          .not('date', 'is', null)
          .order('date', { ascending: true });

        if (fallback.error) throw fallback.error;
        data = fallback.data;
      } else {
        data = result.data;
      }

      const validEvents = (data || []).filter((event) => {
        if (!event.name || event.name.trim() === '' || !event.date) return false;
        const eventIsDemo = event.is_demo === true;
        return isDemo ? eventIsDemo : !eventIsDemo;
      }) as Event[];

      setEvents(validEvents);

      // Try to load sport types for filters (non-critical, won't break if table doesn't exist)
      try {
        const { data: typesData, error: typesError } = await supabase
          .from('sport_types')
          .select('id, name')
          .order('name', { ascending: true });

        if (!typesError && typesData) {
          const eventTypeIds = new Set(validEvents.map((e) => e.sport_type_id).filter(Boolean));
          const relevantTypes = typesData.filter((t) => eventTypeIds.has(t.id));
          setSportTypes(relevantTypes);
        }
      } catch {
        // sport_types table may not exist yet — filters simply won't show
        console.warn('Could not load sport types for filtering');
      }
    } catch (err: any) {
      console.error('Error loading events:', err);
      setError(err.message || 'Error al cargar los eventos');
    } finally {
      setLoading(false);
    }
  };

  const filteredEvents = activeFilter
    ? events.filter((e) => e.sport_type_id === activeFilter)
    : events;

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
          onClick={loadData}
          className="mt-4 px-4 py-2 bg-orange-primary hover:bg-red-fire text-white-pure rounded-lg transition-colors"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Filter bar */}
      {sportTypes.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-8">
          <button
            onClick={() => setActiveFilter(null)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              activeFilter === null
                ? 'bg-orange-primary text-white-pure'
                : 'bg-white-pure/10 text-white-pure/70 hover:bg-white-pure/20'
            }`}
          >
            Todos
          </button>
          {sportTypes.map((type) => (
            <button
              key={type.id}
              onClick={() => setActiveFilter(type.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeFilter === type.id
                  ? 'bg-orange-primary text-white-pure'
                  : 'bg-white-pure/10 text-white-pure/70 hover:bg-white-pure/20'
              }`}
            >
              {type.name}
            </button>
          ))}
        </div>
      )}

      {/* Events grid */}
      {filteredEvents.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-white-pure/70 text-lg">
            {activeFilter
              ? 'No hay eventos para este tipo de deporte.'
              : 'No hay eventos disponibles en este momento.'}
          </p>
          {activeFilter && (
            <button
              onClick={() => setActiveFilter(null)}
              className="mt-4 px-4 py-2 bg-white-pure/10 hover:bg-white-pure/20 text-white-pure rounded-lg transition-colors text-sm"
            >
              Ver todos los eventos
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {filteredEvents.map((event) => (
            <EventCard
              key={event.id}
              id={event.id}
              name={event.name}
              slug={event.slug}
              date={event.date}
              location={event.location}
              bannerUrl={getBannerUrl(event.banner_url, false)}
              mobileBannerUrl={getBannerUrl(event.mobile_banner_url, true)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
