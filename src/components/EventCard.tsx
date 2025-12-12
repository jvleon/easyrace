import { formatDateShort } from '../utils/dateFormatter';
import { getBannerUrl } from '../utils/imageUrl';
import { FiCalendar, FiMapPin } from 'react-icons/fi';

interface EventCardProps {
  id: string;
  name: string;
  slug: string;
  date: string;
  location: string | null;
  bannerUrl: string | null;
  mobileBannerUrl?: string | null;
}

export default function EventCard({ name, slug, date, location, bannerUrl, mobileBannerUrl }: EventCardProps) {
  const hasMobileBanner = mobileBannerUrl && mobileBannerUrl.trim() !== '';
  const hasBanner = bannerUrl && bannerUrl.trim() !== '';
  
  return (
    <a
      href={`/eventos/${slug}`}
      className="block bg-black-asphalt rounded-lg overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300 border border-white-pure/10 hover:border-orange-primary/50"
    >
      <div className="relative w-full aspect-square bg-gray-800 overflow-hidden">
        {hasMobileBanner || hasBanner ? (
          <>
            {/* Banner móvil (siempre visible en todas las resoluciones para las cards) */}
            {hasMobileBanner ? (
              <img
                src={getBannerUrl(mobileBannerUrl, true)}
                alt={name}
                className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                loading="lazy"
              />
            ) : (
              /* Fallback al banner desktop si no hay banner móvil */
              <img
                src={getBannerUrl(bannerUrl, false)}
                alt={name}
                className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                loading="lazy"
              />
            )}
          </>
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-orange-primary to-red-fire flex items-center justify-center">
            <span className="text-white-pure text-2xl font-bold opacity-50">{name.charAt(0)}</span>
          </div>
        )}
      </div>
      <div className="p-4">
        <h3 className="text-xl font-bold text-white-pure mb-2 line-clamp-2">{name}</h3>
        <div className="space-y-1">
          <div className="flex items-center text-white-pure/70 text-sm">
            <FiCalendar className="mr-2" />
            <span>{formatDateShort(date)}</span>
          </div>
          {location && (
            <div className="flex items-center text-white-pure/70 text-sm">
              <FiMapPin className="mr-2" />
              <span className="line-clamp-1">{location}</span>
            </div>
          )}
        </div>
      </div>
    </a>
  );
}

