import { useState, useEffect, useRef } from 'react';
import { FiHome, FiInfo, FiPackage, FiList, FiImage } from 'react-icons/fi';

interface EventNavigationProps {
  sections: {
    id: string;
    label: string;
    icon: React.ReactNode;
  }[];
}

export default function EventNavigation({ sections }: EventNavigationProps) {
  const [activeSection, setActiveSection] = useState<string>('inicio');
  const [showNavigation, setShowNavigation] = useState(false);
  const [isDimmed, setIsDimmed] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Función para limpiar el timer de dim
  const clearDimTimer = () => {
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = null;
    }
  };

  // Función para iniciar el timer de dim
  const startDimTimer = () => {
    clearDimTimer();
    scrollTimeoutRef.current = setTimeout(() => {
      setIsDimmed(true);
    }, 1000);
  };

  useEffect(() => {

    // Función para detectar la sección activa basada en el scroll
    const handleScroll = () => {
      const scrollY = window.scrollY;
      
      // Mostrar navegación solo cuando se hace scroll hacia abajo (más de 200px)
      const shouldShow = scrollY > 200;
      setShowNavigation(shouldShow);

      // Si la navegación está visible, restaurar opacidad normal y resetear timer
      if (shouldShow) {
        setIsDimmed(false);
        startDimTimer();
      } else {
        // Si no se muestra, no aplicar dim
        setIsDimmed(false);
        clearDimTimer();
      }

      const scrollPosition = scrollY + 400; // Offset para activar antes de llegar a la sección

      // Encontrar la sección activa (de abajo hacia arriba)
      let found = false;
      for (let i = sections.length - 1; i >= 0; i--) {
        const section = document.getElementById(sections[i].id);
        if (section) {
          const sectionTop = section.offsetTop;
          if (scrollPosition >= sectionTop && !found) {
            setActiveSection(sections[i].id);
            found = true;
          }
        }
      }

      // Si estamos en la parte superior, activar "inicio"
      if (scrollY < 200) {
        setActiveSection('inicio');
      }
    };

    // Throttle para mejorar el rendimiento
    let ticking = false;
    const throttledScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          handleScroll();
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', throttledScroll, { passive: true });
    handleScroll(); // Llamar una vez al cargar

    return () => {
      window.removeEventListener('scroll', throttledScroll);
      clearDimTimer();
    };
  }, [sections]);

  const scrollToSection = (sectionId: string) => {
    const section = document.getElementById(sectionId);
    if (section) {
      // Offset mayor para tener en cuenta el header sticky (aprox 100px) + espacio adicional
      const headerOffset = 120;
      const elementPosition = section.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      });
    }
  };

  return (
    <>
      {/* Navegación vertical para desktop (lg y superior) */}
      <nav 
        className={`fixed left-4 top-1/2 -translate-y-1/2 z-50 hidden lg:block transition-all duration-300 ${
          showNavigation 
            ? isDimmed
              ? 'opacity-50 translate-x-0 hover:opacity-100'
              : 'opacity-100 translate-x-0'
            : 'opacity-0 -translate-x-4 pointer-events-none'
        }`}
        aria-label="Navegación del evento"
        onMouseEnter={() => {
          setIsDimmed(false);
          clearDimTimer();
        }}
        onMouseLeave={() => {
          // Reiniciar el timer cuando se sale del hover
          if (showNavigation) {
            startDimTimer();
          }
        }}
      >
        <div className="bg-black-asphalt/90 backdrop-blur-sm border border-white-pure/20 rounded-lg p-2 shadow-xl">
          <ul className="flex flex-col gap-2">
            {sections.map((section) => {
              const isActive = activeSection === section.id;
              return (
                <li key={section.id}>
                  <button
                    onClick={() => scrollToSection(section.id)}
                    className={`
                      w-12 h-12 flex items-center justify-center rounded-lg transition-all duration-200
                      ${isActive
                        ? 'bg-orange-primary text-white-pure shadow-lg scale-110 ring-2 ring-orange-primary/50'
                        : 'bg-white-pure/10 text-white-pure/70 hover:bg-white-pure/20 hover:text-white-pure hover:scale-105'
                      }
                    `}
                    title={section.label}
                    aria-label={section.label}
                    aria-current={isActive ? 'true' : 'false'}
                  >
                    {section.icon}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>

      {/* Navegación horizontal para móviles (menor a lg) */}
      <nav 
        className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-50 lg:hidden transition-all duration-300 ${
          showNavigation 
            ? isDimmed
              ? 'opacity-50 translate-y-0 active:opacity-100'
              : 'opacity-100 translate-y-0'
            : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
        aria-label="Navegación del evento"
        onTouchStart={() => {
          setIsDimmed(false);
          clearDimTimer();
        }}
        onTouchEnd={() => {
          // Reiniciar el timer cuando se termina el touch
          if (showNavigation) {
            startDimTimer();
          }
        }}
      >
        <div className="bg-black-asphalt/90 backdrop-blur-sm border border-white-pure/20 rounded-full px-3 py-2 shadow-xl">
          <ul className="flex gap-1">
            {sections.map((section) => {
              const isActive = activeSection === section.id;
              return (
                <li key={section.id}>
                  <button
                    onClick={() => scrollToSection(section.id)}
                    className={`
                      w-10 h-10 flex items-center justify-center rounded-full transition-all duration-200
                      ${isActive
                        ? 'bg-orange-primary text-white-pure shadow-lg scale-110 ring-2 ring-orange-primary/50'
                        : 'bg-white-pure/10 text-white-pure/70 active:bg-white-pure/20 active:text-white-pure active:scale-105'
                      }
                    `}
                    title={section.label}
                    aria-label={section.label}
                    aria-current={isActive ? 'true' : 'false'}
                  >
                    {section.icon}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>
    </>
  );
}

