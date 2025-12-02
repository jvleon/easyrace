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
  buttonText?: string;
  disabledText?: string;
  generalPrice?: number | null;
  currency?: string;
}

export default function RegistrationButton({
  eventId,
  eventSlug,
  registrationConfig,
  registrationOpen,
  buttonText = 'Registrarse',
  disabledText = 'Próximamente',
  generalPrice,
  currency = 'MXN',
}: RegistrationButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [eventPricing, setEventPricing] = useState<EventPricing | null>(null);

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
        onClick={() => registrationOpen && setIsModalOpen(true)}
        className={`w-full md:w-auto px-8 py-3 rounded-lg font-semibold text-lg transition-colors ${
          registrationOpen
            ? 'bg-orange-primary hover:bg-red-fire text-white-pure cursor-pointer'
            : 'bg-white-pure/20 text-white-pure/50 cursor-not-allowed'
        }`}
        disabled={!registrationOpen}
      >
        {registrationOpen ? buttonText : disabledText}
      </button>
      <RegistrationModal
        eventId={eventId}
        eventSlug={eventSlug}
        registrationConfig={registrationConfig}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        eventPricing={eventPricing}
      />
    </>
  );
}


