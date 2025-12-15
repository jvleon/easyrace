import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { formatEventDate, isRegistrationOpen } from '../utils/dateFormatter';
import { slateToHtml } from '../utils/slateToHtml';
import { getBannerUrl } from '../utils/imageUrl';
import { sanitizeHtml, sanitizeStravaEmbed } from '../utils/sanitizeHtml';
import RegistrationButton from './RegistrationButton';
import Countdown from './Countdown';
import KitsSection from './KitsSection';
import PaymentProofModal from './PaymentProofModal';
import EventGallery from './EventGallery';
import EventNavigation from './EventNavigation';
import { FiDownload, FiUpload, FiHome, FiInfo, FiPackage, FiList, FiImage } from 'react-icons/fi';
import { FaFacebook, FaInstagram, FaWhatsapp } from 'react-icons/fa';

interface EventDetailProps {
  slug: string | undefined;
}

interface EventData {
  id: string;
  name: string;
  slug: string;
  date: string;
  max_competitors: number | null;
  [key: string]: any;
}

interface CategoryWithDistance {
  id: string;
  name: string;
  price: number | null;
  distance: string | null;
  gender: string | null; // 'male', 'female', 'mixed', or null
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
  const [event, setEvent] = useState<EventData | null>(null);
  const [categories, setCategories] = useState<CategoryWithDistance[]>([]);
  const [distanceGroups, setDistanceGroups] = useState<DistanceGroup[]>([]);
  const [registeredCount, setRegisteredCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPaymentProofModalOpen, setIsPaymentProofModalOpen] = useState(false);

  useEffect(() => {
    // Siempre obtener el slug desde la URL del navegador para que funcione con eventos nuevos
    // Esto permite que eventos agregados después del build funcionen sin rebuild
    let currentSlug: string | undefined = undefined;

    if (typeof window !== 'undefined') {
      // Extraer el slug de la URL: /eventos/reto-chacamax-2026 -> reto-chacamax-2026
      const pathParts = window.location.pathname.split('/eventos/');
      if (pathParts.length > 1) {
        currentSlug = pathParts[1].split('/')[0];
      }
    }

    // Si no se puede obtener de la URL, usar el prop como fallback
    if (!currentSlug) {
      currentSlug = slug;
    }

    // Ignorar slugs especiales como 'dynamic' o '*'
    if (currentSlug && currentSlug !== '*' && currentSlug !== 'dynamic') {
      loadEventData(currentSlug);
    }
  }, [slug]);

  // Efecto para cargar el script de Strava cuando hay embeds
  useEffect(() => {
    if (distanceGroups.length > 0 && distanceGroups.some(g => g.stravaEmbed)) {
      // Verificar si el script ya está cargado
      const existingScript = document.querySelector('script#strava-embed-script');
      if (!existingScript) {
        const script = document.createElement('script');
        script.src = 'https://strava-embeds.com/embed.js';
        script.async = true;
        script.id = 'strava-embed-script';
        document.body.appendChild(script);

        // Forzar re-render de los embeds después de cargar el script
        script.onload = () => {
          // Esperar a que el DOM se actualice completamente
          setTimeout(() => {
            if (typeof window !== 'undefined' && (window as any).StravaEmbeds) {
              if (typeof (window as any).StravaEmbeds.load === 'function') {
                (window as any).StravaEmbeds.load();
              } else if (typeof (window as any).StravaEmbeds.init === 'function') {
                (window as any).StravaEmbeds.init();
              }
            }
          }, 1000);
        };
      } else {
        // Si el script ya está cargado, esperar a que el DOM se actualice y forzar re-inicialización
        setTimeout(() => {
          if (typeof window !== 'undefined' && (window as any).StravaEmbeds) {
            if (typeof (window as any).StravaEmbeds.load === 'function') {
              (window as any).StravaEmbeds.load();
            } else if (typeof (window as any).StravaEmbeds.init === 'function') {
              (window as any).StravaEmbeds.init();
            }
          }
        }, 1000);
      }
    }
  }, [distanceGroups]);

  // Efecto adicional para re-inicializar Strava cuando el contenido cambia
  // Esto asegura que los embeds se inicialicen después de que React renderice el HTML
  useEffect(() => {
    if (distanceGroups.length > 0 && distanceGroups.some(g => g.stravaEmbed)) {
      // Usar requestAnimationFrame para esperar a que React termine de renderizar
      const frame1 = requestAnimationFrame(() => {
        const frame2 = requestAnimationFrame(() => {
          setTimeout(() => {
            if (typeof window !== 'undefined') {
              // Buscar todos los contenedores de Strava en el DOM
              const stravaContainers = document.querySelectorAll('.strava-embed-container');

              if (stravaContainers.length > 0) {
                // Si el script ya está cargado, inicializar
                if ((window as any).StravaEmbeds) {
                  if (typeof (window as any).StravaEmbeds.load === 'function') {
                    (window as any).StravaEmbeds.load();
                  } else if (typeof (window as any).StravaEmbeds.init === 'function') {
                    (window as any).StravaEmbeds.init();
                  }
                }
              }
            }
          }, 500);
        });

        return () => cancelAnimationFrame(frame2);
      });

      return () => cancelAnimationFrame(frame1);
    }
  }, [distanceGroups]);

  const loadEventData = async (eventSlug?: string) => {
    try {
      setLoading(true);
      setError(null);

      // Usar el slug proporcionado o el de la prop, o extraerlo de la URL
      const currentSlug = eventSlug || slug || (typeof window !== 'undefined' ? window.location.pathname.split('/eventos/')[1]?.split('/')[0] : '');

      if (!currentSlug) {
        throw new Error('Slug no encontrado');
      }

      // Cargar evento
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('*, whatsapp_url, facebook_url, instagram_url')
        .eq('slug', currentSlug)
        .in('status', ['published', 'completed'])
        .single();

      if (eventError || !eventData) {
        throw new Error('Evento no encontrado');
      }

      setEvent(eventData);

      // Cargar conteo de competidores registrados usando función de BD
      // Esto evita problemas con RLS y no expone datos sensibles
      const { data: countData, error: countError } = await supabase.rpc('get_competitors_count', {
        event_id_param: eventData.id
      });

      if (!countError && countData !== null && countData !== undefined) {
        const count = typeof countData === 'number' ? countData : parseInt(countData, 10) || 0;
        setRegisteredCount(count);
      } else {
        console.error('[EventDetail] Error cargando conteo con función:', countError);
        // Fallback: intentar con consulta directa si la función falla
        const { data: competitorsData, error: dataError } = await supabase
          .from('competitors')
          .select('id')
          .eq('event_id', eventData.id);

        if (!dataError && competitorsData) {
          const count = competitorsData.length;
          setRegisteredCount(count);
        } else {
          setRegisteredCount(0);
        }
      }

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
  // El envío de comprobantes se habilita desde la fecha de inicio de inscripciones y permanece disponible después
  const registrationStartDate = event.registration_start_date ? new Date(event.registration_start_date) : null;
  const paymentProofEnabled = !registrationStartDate || registrationStartDate <= new Date();

  const eventDate = event.date ? new Date(event.date) : null;
  const now = new Date();
  const isUpcoming = eventDate && eventDate > now && !isCompleted;

  return (
    <div className="w-full m-0 p-0">
      {(event.banner_url || event.mobile_banner_url) && (
        <div className="w-full max-w-[1920px] mx-auto h-[420px] relative overflow-hidden bg-black-asphalt/30 m-0 p-0">
          {event.mobile_banner_url && (
            <img
              src={getBannerUrl(event.mobile_banner_url, true)}
              alt={event.name}
              className="w-full h-full object-cover object-center max-[500px]:block hidden"
              loading="eager"
            />
          )}
          {event.banner_url && (
            <img
              src={getBannerUrl(event.banner_url)}
              alt={event.name}
              className={`w-full h-full object-contain object-center ${event.mobile_banner_url ? 'max-[500px]:hidden block' : 'block'}`}
              loading="eager"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black-asphalt/50 to-transparent pointer-events-none"></div>
        </div>
      )}

      {isUpcoming && event.date && (
        <Countdown targetDate={event.date} />
      )}

      <EventNavigation
        sections={[
          { id: 'inicio', label: 'Inicio', icon: <FiHome className="w-5 h-5" /> },
          { id: 'datos-evento', label: 'Datos del Evento', icon: <FiInfo className="w-5 h-5" /> },
          { id: 'kits', label: 'Kits', icon: <FiPackage className="w-5 h-5" /> },
          { id: 'categorias', label: 'Categorías', icon: <FiList className="w-5 h-5" /> },
          { id: 'fotos', label: 'Fotos', icon: <FiImage className="w-5 h-5" /> },
        ]}
      />

      <div className="container mx-auto px-4 pt-6 pb-8 md:pt-8 md:pb-12">
        <div className="max-w-4xl mx-auto">
          <header
            {...(!isUpcoming || !event.date ? { id: 'inicio' } : {})}
            className={`mb-8 ${!isUpcoming || !event.date ? 'scroll-mt-32' : ''}`}
          >
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

            {/* Redes sociales del evento */}
            {(event.facebook_url || event.instagram_url || event.whatsapp_url) && (
              <div className="flex gap-4 mt-4">
                {event.facebook_url && (
                  <a
                    href={event.facebook_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white-pure/70 hover:text-orange-primary transition-colors"
                    aria-label="Facebook"
                  >
                    <FaFacebook size={28} />
                  </a>
                )}
                {event.instagram_url && (
                  <a
                    href={event.instagram_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white-pure/70 hover:text-orange-primary transition-colors"
                    aria-label="Instagram"
                  >
                    <FaInstagram size={28} />
                  </a>
                )}
                {event.whatsapp_url && (
                  <a
                    href={event.whatsapp_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white-pure/70 hover:text-orange-primary transition-colors"
                    aria-label="WhatsApp"
                  >
                    <FaWhatsapp size={28} />
                  </a>
                )}
              </div>
            )}
          </header>

          <div className="mb-8 flex flex-col items-center md:items-start gap-4 md:flex-row">
            {isCompleted ? (
              <div className="w-full md:w-auto px-8 py-3 rounded-lg font-semibold text-lg bg-white-pure/20 text-white-pure/70 text-center">
                Evento completado, gracias a los participantes
              </div>
            ) : (
              <RegistrationButton
                key={`${event.id}-${registeredCount}`}
                eventId={event.id}
                eventSlug={event.slug}
                registrationConfig={event.registration_config}
                registrationOpen={registrationOpen}
                generalPrice={event.general_price}
                currency={event.currency || 'MXN'}
                maxCompetitors={event.max_competitors}
                registeredCount={registeredCount}
              />
            )}

            {event.liability_waiver_pdf_url && (
              <a
                href={event.liability_waiver_pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full md:w-auto px-8 py-3 rounded-lg font-semibold text-lg transition-colors bg-white-pure/10 hover:bg-white-pure/20 text-white-pure flex items-center justify-center gap-2"
              >
                <FiDownload className="h-5 w-5" />
                Carta Responsiva
              </a>
            )}

            <button
              onClick={() => paymentProofEnabled && setIsPaymentProofModalOpen(true)}
              disabled={!paymentProofEnabled}
              className={`w-full md:w-auto px-8 py-3 rounded-lg font-semibold text-lg transition-colors flex items-center justify-center gap-2 ${paymentProofEnabled
                  ? 'bg-white-pure/10 hover:bg-white-pure/20 text-white-pure cursor-pointer'
                  : 'bg-white-pure/20 text-white-pure/50 cursor-not-allowed'
                }`}
            >
              <FiUpload className="h-5 w-5" />
              Enviar Comprobante de Pago
            </button>
          </div>

          <PaymentProofModal
            eventId={event.id}
            eventSlug={event.slug}
            isOpen={isPaymentProofModalOpen}
            onClose={() => setIsPaymentProofModalOpen(false)}
          />

          <div id="datos-evento" className="scroll-mt-32">
            {event.page_description && (
              <div
                className="prose prose-invert max-w-none text-white-pure mb-12"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(slateToHtml(event.page_description)) }}
              />
            )}

            {!event.page_description && event.description && (
              <div className="prose prose-invert max-w-none mb-12">
                <p className="text-white-pure/90 text-lg leading-relaxed">
                  {event.description}
                </p>
              </div>
            )}
          </div>

          {/* Sección de Kits */}
          <div id="kits" className="scroll-mt-32">
            <KitsSection eventId={event.id} />
          </div>

          {distanceGroups.length > 0 && (
            <section id="categorias" className="mb-12 scroll-mt-32">
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

                    {/* Categorías primero - en formato de lista (bullets) */}
                    {group.categories.length > 0 && (
                      <div className="mb-6">
                        <h4 className="text-lg font-semibold text-white-pure mb-3">
                          Categorías
                        </h4>
                        <ul className="space-y-3 text-white-pure/90 ml-6 pl-2 list-disc list-outside category-list">
                          {group.categories.map((category) => (
                            <li key={category.id} className="font-medium text-white-pure">
                              {category.name}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Strava embed después de las categorías */}
                    {group.stravaEmbed && (
                      <div className="w-full rounded-lg overflow-hidden border border-white-pure/20 bg-white-pure/5 p-4">
                        <h4 className="text-lg font-semibold text-white-pure mb-4">
                          Ruta en Strava
                        </h4>
                        <div
                          dangerouslySetInnerHTML={{ __html: sanitizeStravaEmbed(group.stravaEmbed) }}
                          className="strava-embed-container"
                          data-strava-embed={group.distanceId || 'no-distance'}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Sección de Galería - Después de categorías */}
          <div id="fotos" className="scroll-mt-32">
            <EventGallery eventId={event.id} />
          </div>
        </div>
      </div>
    </div>
  );
}

