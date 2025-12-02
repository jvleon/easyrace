import { useState, useEffect } from 'react';

interface CountdownProps {
  targetDate: string; // ISO date string
}

export default function Countdown({ targetDate }: CountdownProps) {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const target = new Date(targetDate).getTime();
      const difference = target - now;

      if (difference <= 0) {
        setIsExpired(true);
        return { days: 0, hours: 0, minutes: 0, seconds: 0 };
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      return { days, hours, minutes, seconds };
    };

    // Calcular inmediatamente
    setTimeLeft(calculateTimeLeft());

    // Actualizar cada segundo
    const interval = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(interval);
  }, [targetDate]);

  if (isExpired) {
    return null; // No mostrar cuenta regresiva si el evento ya pasó
  }

  return (
    <div className="w-full bg-black-asphalt/80 backdrop-blur-sm border-y border-white-pure/20 py-4 md:py-6">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          <p className="text-white-pure/70 text-sm md:text-base text-center mb-3 md:mb-4">
            El evento comienza en:
          </p>
          <div className="flex justify-center gap-3 md:gap-6">
            {/* Días */}
            <div className="flex flex-col items-center">
              <div className="bg-orange-primary text-white-pure rounded-lg px-4 py-2 md:px-6 md:py-3 min-w-[60px] md:min-w-[80px] text-center">
                <span className="text-2xl md:text-3xl font-bold">{String(timeLeft.days).padStart(2, '0')}</span>
              </div>
              <span className="text-white-pure/60 text-xs md:text-sm mt-1 md:mt-2">Días</span>
            </div>

            {/* Horas */}
            <div className="flex flex-col items-center">
              <div className="bg-orange-primary text-white-pure rounded-lg px-4 py-2 md:px-6 md:py-3 min-w-[60px] md:min-w-[80px] text-center">
                <span className="text-2xl md:text-3xl font-bold">{String(timeLeft.hours).padStart(2, '0')}</span>
              </div>
              <span className="text-white-pure/60 text-xs md:text-sm mt-1 md:mt-2">Horas</span>
            </div>

            {/* Minutos */}
            <div className="flex flex-col items-center">
              <div className="bg-orange-primary text-white-pure rounded-lg px-4 py-2 md:px-6 md:py-3 min-w-[60px] md:min-w-[80px] text-center">
                <span className="text-2xl md:text-3xl font-bold">{String(timeLeft.minutes).padStart(2, '0')}</span>
              </div>
              <span className="text-white-pure/60 text-xs md:text-sm mt-1 md:mt-2">Minutos</span>
            </div>

            {/* Segundos */}
            <div className="flex flex-col items-center">
              <div className="bg-orange-primary text-white-pure rounded-lg px-4 py-2 md:px-6 md:py-3 min-w-[60px] md:min-w-[80px] text-center">
                <span className="text-2xl md:text-3xl font-bold">{String(timeLeft.seconds).padStart(2, '0')}</span>
              </div>
              <span className="text-white-pure/60 text-xs md:text-sm mt-1 md:mt-2">Segundos</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

