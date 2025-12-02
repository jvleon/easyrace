import { formatDateShort } from '../utils/dateFormatter';
import { FiCalendar } from 'react-icons/fi';

interface EventCardProps {
  id: string;
  name: string;
  slug: string;
  date: string;
  bannerUrl: string | null;
}

export default function EventCard({ name, slug, date, bannerUrl }: EventCardProps) {
  return (
    <a
      href={`/eventos/${slug}`}
      className="block bg-black-asphalt rounded-lg overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300 border border-white-pure/10 hover:border-orange-primary/50"
    >
      <div className="relative w-full h-48 bg-gray-800 overflow-hidden">
        {bannerUrl ? (
          <img
            src={bannerUrl}
            alt={name}
            className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-orange-primary to-red-fire flex items-center justify-center">
            <span className="text-white-pure text-2xl font-bold opacity-50">{name.charAt(0)}</span>
          </div>
        )}
      </div>
      <div className="p-4">
        <h3 className="text-xl font-bold text-white-pure mb-2 line-clamp-2">{name}</h3>
        <div className="flex items-center text-white-pure/70 text-sm">
          <FiCalendar className="mr-2" />
          <span>{formatDateShort(date)}</span>
        </div>
      </div>
    </a>
  );
}

