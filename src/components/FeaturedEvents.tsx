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
}

export default function FeaturedEvents() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFeaturedEvents();
  }, []);

  const loadFeaturedEvents = async () => {
    try {
      const isDemo = isDemoSubdomain();

      const { data, error } = await supabase
        .from('events')
        .select('id, name, slug, date, banner_url, mobile_banner_url, location, status, is_demo')
        .in('status', ['published', 'completed'])
        .not('name', 'is', null)
        .not('date', 'is', null)
        .order('date', { ascending: true });

      if (error) throw error;

      const filtered = (data || []).filter((event) => {
        if (!event.name || event.name.trim() === '' || !event.date) return false;
        const eventIsDemo = event.is_demo === true;
        return isDemo ? eventIsDemo : !eventIsDemo;
      }) as Event[];

      // Take latest 3
      setEvents(filtered.slice(0, 3));
    } catch (err) {
      console.error('Error loading featured events:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <section className="py-16 md:py-24 bg-black-asphalt">
        <div className="container mx-auto px-4">
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-orange-primary"></div>
          </div>
        </div>
      </section>
    );
  }

  if (events.length === 0) return null;

  return (
    <section className="py-16 md:py-24 bg-black-asphalt/80">
      <div className="container mx-auto px-4">
        <div className="flex items-end justify-between mb-10">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold text-white-pure">
              Eventos Destacados
            </h2>
            <p className="text-white-pure/60 mt-2">Los eventos más recientes en la plataforma</p>
          </div>
          <a
            href="/eventos"
            className="hidden md:inline-flex items-center gap-2 text-orange-primary hover:text-red-fire transition-colors font-medium"
          >
            Ver Todos
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {events.map((event) => (
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

        <div className="md:hidden mt-8 text-center">
          <a
            href="/eventos"
            className="inline-flex items-center gap-2 text-orange-primary hover:text-red-fire transition-colors font-medium"
          >
            Ver Todos los Eventos
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </a>
        </div>
      </div>
    </section>
  );
}
