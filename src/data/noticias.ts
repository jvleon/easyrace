export interface Noticia {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  date: string;
  category: string;
}

export const noticias: Noticia[] = [
  {
    slug: 'nueva-temporada-ciclismo-ruta-2026',
    title: 'Nueva temporada de ciclismo de ruta 2026',
    excerpt: 'Conoce los eventos más importantes de ciclismo de ruta que se llevarán a cabo en el sureste mexicano durante este año.',
    date: '10 Mar 2026',
    category: 'Ciclismo',
    content: `
      <p>La temporada 2026 de ciclismo de ruta en el sureste de México promete ser una de las más activas de los últimos años. Con más de 15 eventos programados entre marzo y noviembre, los aficionados al ciclismo tendrán opciones para todos los niveles.</p>
      <h2>Eventos destacados</h2>
      <p>Entre los eventos más esperados se encuentran el Gran Fondo Tabasco, la Vuelta Ciclista del Sureste y el Criterium Nocturno de Mérida. Cada uno con categorías para amateur, máster y élite.</p>
      <h2>¿Cómo inscribirse?</h2>
      <p>Todos los eventos estarán disponibles para registro en la plataforma EasyRace. Los organizadores habilitarán las inscripciones con al menos 30 días de anticipación a cada evento.</p>
      <p>Mantente al tanto de las fechas publicando tu alerta en nuestra plataforma y síguenos en redes sociales para no perderte ningún anuncio.</p>
    `,
  },
  {
    slug: 'tips-primera-carrera-10k',
    title: 'Tips para tu primera carrera de 10K',
    excerpt: 'Guía completa para prepararte y disfrutar tu primera carrera de 10 kilómetros.',
    date: '05 Mar 2026',
    category: 'Running',
    content: `
      <p>Correr tu primera carrera de 10 kilómetros es un hito importante. Con la preparación adecuada, no solo llegarás a la meta, sino que lo disfrutarás y querrás repetirlo.</p>
      <h2>Entrenamiento previo</h2>
      <p>Idealmente necesitas al menos 8 semanas de entrenamiento antes del evento. Empieza corriendo 3 veces por semana con distancias cortas (3-4 km) e incrementa gradualmente.</p>
      <h2>El día de la carrera</h2>
      <p>Llega al menos 45 minutos antes, hidrátateteprano y no pruebes ropa o calzado nuevo. Come algo ligero 2-3 horas antes.</p>
      <h2>Ritmo</h2>
      <p>El error más común es salir demasiado rápido. Empieza a un ritmo cómodo donde puedas mantener una conversación y acelera en los últimos 2 kilómetros.</p>
    `,
  },
  {
    slug: 'easyrace-expande-nuevos-estados',
    title: 'EasyRace se expande a nuevos estados',
    excerpt: 'La plataforma ahora está disponible para organizadores en toda la república mexicana.',
    date: '28 Feb 2026',
    category: 'Plataforma',
    content: `
      <p>EasyRace anuncia su expansión a nivel nacional. Hasta 2025, la plataforma operaba principalmente en el sureste del país; a partir de 2026, cualquier organizador en la república mexicana puede publicar su evento.</p>
      <h2>Qué cambia para los organizadores</h2>
      <p>El proceso de registro de eventos es el mismo: contactas al equipo de EasyRace, configuras las categorías y distancias de tu evento, y en menos de 48 horas tu evento está publicado y listo para recibir inscripciones.</p>
      <h2>Nuevas ciudades</h2>
      <p>Durante el primer trimestre de 2026 ya se han publicado eventos en Ciudad de México, Guadalajara, Monterrey, Puebla y San Luis Potosí.</p>
    `,
  },
  {
    slug: 'mejores-eventos-triatlon-sureste-2026',
    title: 'Los mejores eventos de triatlón del sureste 2026',
    excerpt: 'Agenda completa de eventos de triatlón en Tabasco, Yucatán, Campeche y Quintana Roo para este año.',
    date: '20 Feb 2026',
    category: 'Triatlón',
    content: `
      <p>El triatlón en el sureste mexicano vive un momento de auge. La combinación de clima cálido, cuerpos de agua y carreteras con poco tráfico hace de esta región un destino ideal para la práctica del deporte.</p>
      <h2>Agenda 2026</h2>
      <p>Aquí el resumen de los principales eventos de triatlón en la región:</p>
      <ul>
        <li><strong>Abril:</strong> Triatlón del Sureste, Villahermosa (olímpico y sprint)</li>
        <li><strong>Junio:</strong> Triatlón Laguna de Términos, Campeche</li>
        <li><strong>Agosto:</strong> Triatlón Costera, Cancún (distancia olímpica)</li>
        <li><strong>Octubre:</strong> Triatlón Chichén, Mérida (sprint y olímpico)</li>
      </ul>
      <h2>Cómo inscribirse</h2>
      <p>Todos los eventos estarán disponibles en EasyRace. Te recomendamos inscribirte con anticipación ya que los cupos suelen agotarse en los primeros días.</p>
    `,
  },
  {
    slug: 'como-prepararte-gran-fondo-100km',
    title: 'Cómo prepararte para un Gran Fondo de 100km',
    excerpt: 'Plan de entrenamiento de 12 semanas para completar tu primer Gran Fondo ciclista.',
    date: '15 Feb 2026',
    category: 'Ciclismo',
    content: `
      <p>Un Gran Fondo de 100 kilómetros es el objetivo perfecto para ciclistas con algo de experiencia que quieren dar el salto a distancias largas. Con 12 semanas de preparación estructurada, es un objetivo alcanzable.</p>
      <h2>Semanas 1-4: Base aeróbica</h2>
      <p>Enfócate en volumen a baja intensidad. Rides de 40-60 km dos veces por semana más una salida larga de 70-80 km los fines de semana.</p>
      <h2>Semanas 5-8: Desarrollo</h2>
      <p>Introduce intervalos y trabajo en subidas. La salida larga del fin de semana debe llegar a 90 km.</p>
      <h2>Semanas 9-11: Pico</h2>
      <p>Una semana con tu salida más larga (100-110 km) seguida de una semana de descarga.</p>
      <h2>Semana 12: Tapering</h2>
      <p>Reduce el volumen al 50%, mantén la intensidad y llega fresco al evento.</p>
    `,
  },
  {
    slug: 'resultados-carrera-nocturna-villahermosa-2026',
    title: 'Resultados: Carrera Nocturna Villahermosa 2026',
    excerpt: 'Todos los tiempos y posiciones de la carrera nocturna de 5K y 10K celebrada en el Parque Tomás Garrido.',
    date: '08 Feb 2026',
    category: 'Resultados',
    content: `
      <p>La Carrera Nocturna Villahermosa 2026 se celebró el pasado sábado con la participación de más de 450 corredores en las categorías de 5K y 10K.</p>
      <h2>Podio 10K Varonil</h2>
      <ol>
        <li>Carlos Méndez — 00:34:12</li>
        <li>Roberto Sánchez — 00:35:48</li>
        <li>Miguel Ángel Torres — 00:36:05</li>
      </ol>
      <h2>Podio 10K Femenil</h2>
      <ol>
        <li>Ana Laura García — 00:39:22</li>
        <li>Patricia Ruiz — 00:40:17</li>
        <li>Daniela Hernández — 00:41:55</li>
      </ol>
      <h2>Podio 5K</h2>
      <ol>
        <li>Diego Ramírez — 00:17:44</li>
        <li>Fernanda López — 00:19:02</li>
        <li>José Luis Castro — 00:19:38</li>
      </ol>
      <p>Los resultados completos están disponibles para descarga en el sitio del evento.</p>
    `,
  },
];
