import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getBannerUrl } from '../utils/imageUrl';

interface Kit {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  price: number;
  has_sizes: boolean; // Calculado desde kit_sizes
}

interface KitsSectionProps {
  eventId: string;
}

export default function KitsSection({ eventId }: KitsSectionProps) {
  const [kits, setKits] = useState<Kit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadKits();
  }, [eventId]);

  const loadKits = async () => {
    try {
      setLoading(true);
      setError(null);

      const now = new Date().toISOString();

      // Cargar kits disponibles para el evento
      const { data: kitsData, error: kitsError } = await supabase
        .from('kits')
        .select('id, name, description, image_url, price')
        .eq('event_id', eventId)
        .eq('is_active', true)
        .or(`sale_deadline.is.null,sale_deadline.gte.${now}`)
        .order('price', { ascending: true });

      if (kitsError) {
        throw kitsError;
      }

      if (!kitsData || kitsData.length === 0) {
        setKits([]);
        setLoading(false);
        return;
      }

      // Verificar cuáles kits tienen tallas
      const kitsWithSizes = await Promise.all(
        kitsData.map(async (kit) => {
          const { data: sizesData } = await supabase
            .from('kit_sizes')
            .select('id')
            .eq('kit_id', kit.id)
            .limit(1);

          return {
            ...kit,
            has_sizes: (sizesData?.length || 0) > 0,
          } as Kit;
        })
      );

      // Filtrar por disponibilidad (max_quantity)
      const availableKits = kitsWithSizes.filter((kit) => {
        // Esta verificación se hace en el cliente ya que necesitamos sold_quantity
        // que puede no estar disponible en la consulta inicial
        return true; // Se filtrará después si es necesario
      });

      setKits(availableKits);
    } catch (err: any) {
      console.error('Error loading kits:', err);
      setError(err.message || 'Error al cargar los kits');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-orange-primary"></div>
        <p className="text-white-pure/70 mt-4">Cargando kits...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-fire/20 border border-red-fire rounded-lg p-6 text-center">
        <p className="text-white-pure">{error}</p>
      </div>
    );
  }

  if (kits.length === 0) {
    return null; // No mostrar sección si no hay kits
  }

  return (
    <section className="mb-12">
      <h2 className="text-2xl md:text-3xl font-bold text-white-pure mb-8">
        Kits Disponibles
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {kits.map((kit) => (
          <div
            key={kit.id}
            className="bg-white-pure/10 border border-white-pure/20 rounded-lg overflow-hidden hover:bg-white-pure/15 transition-colors"
          >
            {kit.image_url && (
              <div className="w-full aspect-square bg-black-asphalt/30 overflow-hidden">
                <img
                  src={getBannerUrl(kit.image_url)}
                  alt={kit.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
            )}
            <div className="p-6">
              <h3 className="text-xl font-semibold text-white-pure mb-2">
                {kit.name}
              </h3>
              {kit.description && (
                <p className="text-white-pure/70 text-sm mb-4 whitespace-pre-line">
                  {kit.description}
                </p>
              )}
              <div className="flex items-center justify-between">
                <p className="text-orange-primary font-bold text-lg">
                  ${Number(kit.price).toLocaleString('es-MX', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
                {kit.has_sizes && (
                  <span className="text-white-pure/60 text-xs">
                    Disponible en tallas
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

