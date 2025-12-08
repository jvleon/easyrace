import { useState, useEffect, useCallback } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import { supabase } from '../lib/supabase';
import { getBannerUrl } from '../utils/imageUrl';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';

interface GalleryImage {
  id: string;
  image_url: string;
  order_index: number;
}

interface EventGalleryProps {
  eventId: string;
}

export default function EventGallery({ eventId }: EventGalleryProps) {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: true, align: 'start' },
    [Autoplay({ delay: 3000, stopOnInteraction: false })]
  );
  const [prevBtnDisabled, setPrevBtnDisabled] = useState(true);
  const [nextBtnDisabled, setNextBtnDisabled] = useState(true);

  const scrollPrev = useCallback(() => {
    if (emblaApi) emblaApi.scrollPrev();
  }, [emblaApi]);

  const scrollNext = useCallback(() => {
    if (emblaApi) emblaApi.scrollNext();
  }, [emblaApi]);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setPrevBtnDisabled(!emblaApi.canScrollPrev());
    setNextBtnDisabled(!emblaApi.canScrollNext());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on('select', onSelect);
    emblaApi.on('reInit', onSelect);
  }, [emblaApi, onSelect]);

  useEffect(() => {
    loadGalleryImages();
  }, [eventId]);

  const loadGalleryImages = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: galleryError } = await supabase
        .from('event_gallery')
        .select('id, image_url, order_index')
        .eq('event_id', eventId)
        .order('order_index', { ascending: true })
        .limit(6); // Máximo 6 fotos

      if (galleryError) {
        throw galleryError;
      }

      setImages((data || []) as GalleryImage[]);
    } catch (err: any) {
      console.error('Error loading gallery images:', err);
      setError(err.message || 'Error al cargar la galería');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-orange-primary"></div>
        <p className="text-white-pure/70 mt-4">Cargando galería...</p>
      </div>
    );
  }

  if (error) {
    return null; // No mostrar error, simplemente no mostrar la galería
  }

  if (images.length === 0) {
    return null; // No mostrar sección si no hay imágenes
  }

  return (
    <section className="mb-12">
      <h2 className="text-2xl md:text-3xl font-bold text-white-pure mb-8">
        Galería de Fotos
      </h2>
      <div className="relative">
        <div className="overflow-hidden rounded-lg" ref={emblaRef}>
          <div className="flex">
            {images.map((image) => (
              <div
                key={image.id}
                className="flex-[0_0_100%] min-w-0 md:flex-[0_0_50%] lg:flex-[0_0_33.333%] px-2"
              >
                <div className="relative w-full aspect-square bg-black-asphalt/30 overflow-hidden rounded-lg">
                  <img
                    src={getBannerUrl(image.image_url)}
                    alt={`Galería ${image.order_index + 1}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Flechas de navegación */}
        <button
          className="absolute left-2 top-1/2 -translate-y-1/2 z-10 bg-white-pure/20 hover:bg-white-pure/30 backdrop-blur-sm rounded-full p-3 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          onClick={scrollPrev}
          disabled={prevBtnDisabled}
          aria-label="Imagen anterior"
        >
          <FiChevronLeft className="w-6 h-6 text-white-pure" />
        </button>
        <button
          className="absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-white-pure/20 hover:bg-white-pure/30 backdrop-blur-sm rounded-full p-3 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          onClick={scrollNext}
          disabled={nextBtnDisabled}
          aria-label="Imagen siguiente"
        >
          <FiChevronRight className="w-6 h-6 text-white-pure" />
        </button>
      </div>
    </section>
  );
}

