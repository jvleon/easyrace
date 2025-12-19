import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import RegistrationModal from './RegistrationModal';

interface Category {
  id: string;
  name: string;
  price: number | null;
}

interface EventPricing {
  general_price: number | null;
  currency: string;
  categories: Category[];
}

interface RegistrationButtonProps {
  eventId: string;
  eventSlug: string; // Slug del evento para el custom ID de Cloudflare
  registrationConfig: any;
  registrationOpen: boolean;
  registrationsClosed?: boolean; // Flag que indica si las inscripciones están cerradas manualmente
  buttonText?: string;
  disabledText?: string;
  generalPrice?: number | null;
  currency?: string;
  maxCompetitors?: number | null;
  registeredCount?: number;
}

export default function RegistrationButton({
  eventId,
  eventSlug,
  registrationConfig,
  registrationOpen,
  registrationsClosed = false,
  buttonText = 'Registrarse',
  disabledText = 'Próximamente',
  generalPrice,
  currency = 'MXN',
  maxCompetitors,
  registeredCount = 0,
}: RegistrationButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [eventPricing, setEventPricing] = useState<EventPricing | null>(null);

  // Verificar si se alcanzó el máximo de competidores
  // Convertir a números para asegurar comparación correcta
  const maxCompetitorsNum = maxCompetitors !== null && maxCompetitors !== undefined ? Number(maxCompetitors) : null;
  const registeredCountNum = Number(registeredCount) || 0;
  
  // Si maxCompetitors está definido y registeredCount >= maxCompetitors, se alcanzó el máximo
  const isMaxReached = 
    maxCompetitorsNum !== null && 
    maxCompetitorsNum > 0 && 
    registeredCountNum >= maxCompetitorsNum;
  
  const isDisabled = !registrationOpen || isMaxReached;
  
  // Determinar el texto a mostrar según el motivo de deshabilitación
  let displayText = buttonText;
  if (isMaxReached) {
    displayText = 'Sin lugares disponibles';
  } else if (!registrationOpen) {
    // Si está cerrado por la flag registrations_closed, mostrar "Registro cerrado"
    // Si no, mostrar el texto por defecto (Próximamente)
    displayText = registrationsClosed ? 'Registro cerrado' : disabledText;
  }



  useEffect(() => {
    if (isModalOpen) {
      loadEventPricing();
    }
  }, [isModalOpen, eventId]);

  const loadEventPricing = async () => {
    try {
      const { data: categories, error } = await supabase
        .from('categories')
        .select('id, name, price')
        .eq('event_id', eventId);

      if (error) {
        console.error('Error loading categories:', error);
        return;
      }

      setEventPricing({
        general_price: generalPrice || null,
        currency: currency,
        categories: categories || [],
      });
    } catch (error) {
      console.error('Error loading event pricing:', error);
    }
  };

  return (
    <>
      <button
        onClick={() => !isDisabled && setIsModalOpen(true)}
        className={`w-full md:w-auto px-8 py-3 rounded-lg font-semibold text-lg transition-colors ${
          !isDisabled
            ? 'bg-orange-primary hover:bg-red-fire text-white-pure cursor-pointer'
            : 'bg-white-pure/20 text-white-pure/50 cursor-not-allowed'
        }`}
        disabled={isDisabled}
      >
        {displayText}
      </button>
      <RegistrationModal
        eventId={eventId}
        eventSlug={eventSlug}
        registrationConfig={registrationConfig}
        isOpen={isModalOpen && !isMaxReached}
        onClose={() => setIsModalOpen(false)}
        eventPricing={eventPricing}
        maxCompetitors={maxCompetitorsNum}
        registeredCount={registeredCountNum}
      />
    </>
  );
}


