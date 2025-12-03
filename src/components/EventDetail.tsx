import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { formatEventDate, isRegistrationOpen } from '../utils/dateFormatter';
import { slateToHtml } from '../utils/slateToHtml';
import { getBannerUrl } from '../utils/imageUrl';
import RegistrationButton from './RegistrationButton';
import Countdown from './Countdown';

interface EventDetailProps {
  slug: string;
}

interface CategoryWithDistance {
  id: string;
  name: string;
  price: number | null;
  distance: string | null;
  gender: string | null;
  distance_id: string | null;
  event_distances: {
    id: string;
    name: string;
    strava_embed_url: string | null;
    description: string | null;
  } | null;
}

interface DistanceGroup {
  distanceId: string | null;
  distanceName: string;
  stravaEmbed: string | null;
  description: string | null;
  categories: CategoryWithDistance[];
}

export default function EventDetail({ slug }: EventDetailProps) {
  const [event, setEvent] = useState<any>(null);
  const [categories, setCategories] = useState<CategoryWithDistance[]>([]);
  const [distanceGroups, setDistanceGroups] = useState<DistanceGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadEventData();
  }, [slug]);

  const loadEventData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Cargar evento
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('*')
        .eq('slug', slug)
        .in('status', ['published', 'completed'])
        .single();

      if (eventError || !eventData) {
        throw new Error('Evento no encontrado');
      }

      setEvent(eventData);

      // Cargar categorías
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('categories')
        .select(`
          id,
          name,
          price,
          distance,
          gender,
          distance_id,
          event_distances (
            id,
            name,
            strava_embed_url,
            description
          )
        `)
        .eq('event_id', eventData.id)
        .order('name');

      if (categoriesError) {
        console.error('Error loading categories:', categoriesError);
      } else {
        const categoriesWithDistance = (categoriesData || []) as CategoryWithDistance[];
        setCategories(categoriesWithDistance);

        // Agrupar por distancia
        const groups: DistanceGroup[] = [];
        const categoriesWithoutDistance: CategoryWithDistance[] = [];

        categoriesWithDistance.forEach((category) => {
          if (category.distance_id && category.event_distances) {
            const distanceId = category.distance_id;
            let group = groups.find((g) => g.distanceId === distanceId);

            if (!group) {
              group = {
                distanceId,
                distanceName: category.event_distances.name,
                stravaEmbed: category.event_distances.strava_embed_url,
                description: category.event_distances.description,
                categories: [],
              };
              groups.push(group);
            }

            group.categories.push(category);
          } else {
            // Solo agregar a "Otras categorías" si realmente no tiene distancia asignada
            categoriesWithoutDistance.push(category);
          }
        });

        // Solo mostrar "Otras categorías" si:
        // 1. Hay categorías sin distancia asignada
        // 2. Y hay al menos una distancia registrada en el evento (para evitar mostrar "Otras categorías" cuando el evento no tiene distancias)
        // Si el evento no tiene distancias registradas, no mostrar "Otras categorías"
        if (categoriesWithoutDistance.length > 0 && groups.length > 0) {
          groups.push({
            distanceId: null,
            distanceName: 'Otras categorías',
            stravaEmbed: null,
            description: null,
            categories: categoriesWithoutDistance,
          });
        }

        groups.sort((a, b) => {
          if (a.distanceId === null) return 1;
          if (b.distanceId === null) return -1;
          return a.distanceName.localeCompare(b.distanceName);
        });

        setDistanceGroups(groups);
      }
    } catch (err: any) {
      console.error('Error loading event:', err);
      setError(err.message || 'Error al cargar el evento');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-orange-primary"></div>
        <p className="text-white-pure/70 mt-4">Cargando evento...</p>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="bg-red-fire/20 border border-red-fire rounded-lg p-6 text-center">
        <p className="text-white-pure">{error || 'Evento no encontrado'}</p>
        <button
          onClick={loadEventData}
          className="mt-4 px-4 py-2 bg-orange-primary hover:bg-red-fire text-white-pure rounded-lg transition-colors"
        >
          Reintentar
        </button>
      </div>
    );
  }

  const isCompleted = event.status === 'completed';
  const registrationOpen = !isCompleted && isRegistrationOpen(
    event.registration_start_date,
    event.registration_end_date
  );

  const eventDate = event.date ? new Date(event.date) : null;
  const now = new Date();
  const isUpcoming = eventDate && eventDate > now && !isCompleted;

  return (
    <>
      {(event.banner_url || event.mobile_banner_url) && (
        <div className="w-full h-[400px] relative overflow-hidden bg-black-asphalt/30">
          {event.mobile_banner_url && (
            <img
              src={getBannerUrl(event.mobile_banner_url)}
              alt={event.name}
              className="w-full h-full object-cover object-center max-[500px]:block hidden"
              loading="eager"
            />
          )}
          {event.banner_url && (
            <img
              src={getBannerUrl(event.banner_url)}
              alt={event.name}
              className={`w-full h-full object-cover object-center ${event.mobile_banner_url ? 'max-[500px]:hidden block' : 'block'}`}
              loading="eager"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black-asphalt/50 to-transparent pointer-events-none"></div>
        </div>
      )}

      {isUpcoming && event.date && (
        <Countdown targetDate={event.date} />
      )}

      <div className="container mx-auto px-4 pt-6 pb-8 md:pt-8 md:pb-12">
        <div className="max-w-4xl mx-auto">
          <header className="mb-8">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white-pure mb-4">
              {event.name}
            </h1>
            {event.date && (
              <p className="text-white-pure/70 text-lg">
                {formatEventDate(event.date)}
              </p>
            )}
            {event.location && (
              <p className="text-white-pure/70 text-base mt-2">
                Ubicación: {event.location}
              </p>
            )}
          </header>

          <div className="mb-8 flex flex-col items-center md:items-start gap-4">
            {isCompleted ? (
              <div className="w-full md:w-auto px-8 py-3 rounded-lg font-semibold text-lg bg-white-pure/20 text-white-pure/70 text-center">
                Evento completado, gracias a los participantes
              </div>
            ) : (
              <RegistrationButton
                eventId={event.id}
                eventSlug={event.slug}
                registrationConfig={event.registration_config}
                registrationOpen={registrationOpen}
                generalPrice={event.general_price}
                currency={event.currency || 'MXN'}
              />
            )}
          </div>

          {event.page_description && (
            <div
              className="prose prose-invert max-w-none text-white-pure mb-12"
              dangerouslySetInnerHTML={{ __html: slateToHtml(event.page_description) }}
            />
          )}

          {!event.page_description && event.description && (
            <div className="prose prose-invert max-w-none mb-12">
              <p className="text-white-pure/90 text-lg leading-relaxed">
                {event.description}
              </p>
            </div>
          )}

          {distanceGroups.length > 0 && (
            <section className="mb-12">
              <h2 className="text-2xl md:text-3xl font-bold text-white-pure mb-8">
                Distancias y Categorías
              </h2>
              <div className="space-y-12">
                {distanceGroups.map((group) => (
                  <div key={group.distanceId || 'no-distance'} className="space-y-6">
                    <div className="border-b border-white-pure/20 pb-4">
                      <h3 className="text-xl md:text-2xl font-bold text-white-pure">
                        {group.distanceName}
                      </h3>
                      {group.description && (
                        <p className="text-white-pure/70 mt-2">{group.description}</p>
                      )}
                    </div>

                    {group.stravaEmbed && (
                      <div className="w-full rounded-lg overflow-hidden border border-white-pure/20 bg-white-pure/5 p-4">
                        <h4 className="text-lg font-semibold text-white-pure mb-4">
                          Ruta en Strava
                        </h4>
                        <div dangerouslySetInnerHTML={{ __html: group.stravaEmbed }} />
                      </div>
                    )}

                    {group.categories.length > 0 && (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {group.categories.map((category) => (
                          <div
                            key={category.id}
                            className="bg-white-pure/10 border border-white-pure/20 rounded-lg p-6 hover:bg-white-pure/15 transition-colors"
                          >
                            <h4 className="text-lg font-semibold text-white-pure mb-3">
                              {category.name}
                            </h4>
                            <div className="space-y-2">
                              {category.price !== null && category.price > 0 ? (
                                <p className="text-white-pure/80">
                                  <span className="font-medium">Precio:</span>{' '}
                                  ${Number(category.price).toLocaleString('es-MX', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}{' '}
                                  {event.currency || 'MXN'}
                                </p>
                              ) : (
                                <p className="text-orange-primary font-medium">Gratis</p>
                              )}
                              {category.gender && (
                                <p className="text-white-pure/60 text-sm">
                                  {category.gender === 'male'
                                    ? 'Masculino'
                                    : category.gender === 'female'
                                    ? 'Femenino'
                                    : 'Mixto'}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}

