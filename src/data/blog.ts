export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  date: string;
  category: string;
  readTime: string;
}

export const blogPosts: BlogPost[] = [
  {
    slug: 'como-organizar-primera-carrera-5k',
    title: 'Cómo organizar tu primera carrera de 5K paso a paso',
    excerpt: 'Desde el permiso municipal hasta la logística del agua y la meta. Una guía práctica para organizadores novatos.',
    date: '12 Mar 2026',
    category: 'Guías',
    readTime: '8 min',
    content: `
      <p>Organizar una carrera de 5K parece complicado al principio, pero con la lista correcta de pasos se convierte en un proceso manejable. Esta guía te lleva desde la idea inicial hasta el día del evento.</p>
      <h2>1. Permisos y autorización</h2>
      <p>El primer paso es solicitar el permiso al ayuntamiento. Necesitarás presentar el recorrido propuesto, fecha, hora, número estimado de participantes y plan de seguridad. Este proceso puede tardar entre 2 y 6 semanas.</p>
      <h2>2. El recorrido</h2>
      <p>Escoge una ruta que sea segura, medida con precisión y accesible para todos los niveles. Un circuito cerrado de 2.5 km recorrido dos veces es una opción popular para carreras urbanas.</p>
      <h2>3. Logística el día del evento</h2>
      <p>Planifica: zona de salida y meta, puestos de hidratación (uno cada 2.5 km mínimo), señalización del recorrido, personal de apoyo y servicio médico básico.</p>
      <h2>4. Registro digital</h2>
      <p>Usa una plataforma como EasyRace para automatizar el registro: los datos de los participantes, la asignación de dorsales y la validación de pagos se gestionan solos, sin hojas de cálculo.</p>
      <h2>5. Comunicación</h2>
      <p>Mantén a los participantes informados: confirmación de inscripción, instrucciones previas al evento (lugar de registro, horarios, qué llevar) y resultados post-evento.</p>
    `,
  },
  {
    slug: 'registro-digital-reduce-trabajo-administrativo',
    title: 'Por qué el registro digital reduce un 60% el trabajo administrativo',
    excerpt: 'Comparativa real entre organizadores que usaban Excel y los que migraron a una plataforma de registro automatizado.',
    date: '05 Mar 2026',
    category: 'Plataforma',
    readTime: '5 min',
    content: `
      <p>Durante años, los organizadores de eventos deportivos en México gestionaron sus inscripciones con hojas de cálculo, grupos de WhatsApp y transferencias bancarias manuales. El resultado: horas de trabajo administrativo que podrían dedicarse a mejorar el evento.</p>
      <h2>El costo real del Excel</h2>
      <p>Un organizador con 200 participantes dedicaba en promedio 40 horas entre captura de datos, verificación de pagos, asignación de dorsales y comunicación individual. Con una plataforma digital, ese tiempo se reduce a menos de 15 horas.</p>
      <h2>Qué se automatiza</h2>
      <ul>
        <li>Captura de datos del participante (el atleta los llena directamente)</li>
        <li>Recepción y registro del comprobante de pago</li>
        <li>Asignación de número de dorsal según categoría</li>
        <li>Confirmaciones automáticas de inscripción</li>
      </ul>
      <h2>El resultado</h2>
      <p>Los organizadores que migraron a EasyRace reportan usar ese tiempo recuperado en mejorar la experiencia del participante: mejor señalización, más puestos de hidratación, mejor fotografía del evento.</p>
    `,
  },
  {
    slug: 'dorsal-perfecto-diseno-materiales-numeracion',
    title: 'El dorsal perfecto: diseño, materiales y numeración automática',
    excerpt: 'Todo lo que necesitas saber sobre dorsales para tu evento: desde el diseño hasta cómo EasyRace los asigna automáticamente.',
    date: '25 Feb 2026',
    category: 'Tips',
    readTime: '6 min',
    content: `
      <p>El dorsal es más que un número. Es la primera cosa que ve el fotógrafo, lo que identifica al participante en la meta y, bien diseñado, un recuerdo que el atleta querrá guardar.</p>
      <h2>Material</h2>
      <p>El Tyvek es el estándar para dorsales de running: es resistente al agua, ligero y no se arruga. Para ciclismo, el vinilo adhesivo para casco y los dorsales para manillar son las opciones más comunes.</p>
      <h2>Diseño</h2>
      <p>El número debe ser el elemento más grande y visible. Incluye el logo del evento y el nombre del patrocinador principal. Añade el nombre del participante si el presupuesto lo permite, genera mucha satisfacción.</p>
      <h2>Numeración automática con EasyRace</h2>
      <p>En EasyRace, la numeración se asigna automáticamente en el momento del registro: cada categoría tiene su propio rango de números y se asignan en orden de inscripción. El organizador descarga el listado completo listo para imprimir.</p>
    `,
  },
  {
    slug: 'como-definir-categorias-evento-deportivo',
    title: 'Cómo definir las categorías de tu evento deportivo',
    excerpt: 'Rangos de edad, categorías especiales, élite y máster. Una guía para estructurar correctamente la competencia.',
    date: '18 Feb 2026',
    category: 'Guías',
    readTime: '7 min',
    content: `
      <p>Definir bien las categorías de tu evento es fundamental para que la competencia sea justa y para que los participantes encuentren su lugar. Una mala estructura de categorías puede generar reclamos y una experiencia negativa.</p>
      <h2>Categorías por edad (running)</h2>
      <p>La estructura más común en México es: Sub-23, Open (23-34), Máster A (35-44), Máster B (45-54), Máster C (55+). Para categoría femenil y varonil por separado.</p>
      <h2>Élite vs Amateur</h2>
      <p>Si esperas participantes de alto nivel, considera abrir una categoría Élite con salida especial y premiación diferenciada. El criterio de clasificación puede ser tiempo en eventos previos.</p>
      <h2>Categorías especiales</h2>
      <p>Equipos, relevos familiares, categoría corporativa: estas categorías aumentan la participación y el sentido de comunidad del evento.</p>
      <h2>Configuración en EasyRace</h2>
      <p>Al publicar tu evento en EasyRace, puedes definir tantas categorías como necesites, con su rango de edad, precio de inscripción y cupo máximo por separado.</p>
    `,
  },
  {
    slug: 'patrocinadores-evento-como-conseguirlos',
    title: 'Patrocinadores para tu evento: cómo conseguirlos y qué ofrecerles',
    excerpt: 'Estrategias probadas para atraer marcas locales y nacionales a tu carrera o fondo ciclista.',
    date: '10 Feb 2026',
    category: 'Negocios',
    readTime: '9 min',
    content: `
      <p>El patrocinio puede marcar la diferencia entre un evento que apenas cubre costos y uno que ofrece una experiencia de calidad. La clave está en saber qué valor ofrecer a cada tipo de patrocinador.</p>
      <h2>Tipos de patrocinadores</h2>
      <p>Distingue entre patrocinador principal (naming rights, logo en dorsal), patrocinadores de categoría (hidratación, kit del participante) y colaboradores (descuentos en productos o servicios).</p>
      <h2>Qué ofrecerles</h2>
      <ul>
        <li>Visibilidad: logo en dorsal, banner en meta, mención en redes</li>
        <li>Base de datos: con permiso del participante, alcance a tu audiencia</li>
        <li>Activación en expo: stand en el área de salida/meta</li>
        <li>Contenido: fotos y video del evento con su producto visible</li>
      </ul>
      <h2>Cómo acercarte</h2>
      <p>Prepara un dossier profesional con datos del evento anterior (participantes, alcance en redes, demografía del participante) y una propuesta de valor clara. La información del registro digital de EasyRace te da exactamente esos datos.</p>
    `,
  },
  {
    slug: 'comunicacion-participantes-whatsapp-email-plataforma',
    title: 'Comunicación con participantes: WhatsApp, email o plataforma',
    excerpt: 'Qué canal usar en cada etapa del evento y cómo automatizar los mensajes clave para reducir dudas frecuentes.',
    date: '03 Feb 2026',
    category: 'Tips',
    readTime: '4 min',
    content: `
      <p>Una de las mayores fuentes de trabajo manual para los organizadores es responder preguntas repetitivas: ¿cuándo son los dorsales? ¿dónde es la salida? ¿cuál es mi número? La solución está en comunicar proactivamente y en el canal correcto.</p>
      <h2>WhatsApp: para urgencias</h2>
      <p>Reserva WhatsApp para comunicación de último momento el día del evento: cambios de ruta, clima, horarios. Un grupo de participantes puede volverse inmanejable si se usa para información general.</p>
      <h2>Email: para información formal</h2>
      <p>Usa correo electrónico para: confirmación de inscripción, instructivo previo al evento (5 días antes), resultados (24h después). Son comunicaciones con contenido extenso que el participante necesita guardar.</p>
      <h2>La página del evento: la fuente de verdad</h2>
      <p>Toda la información del evento (recorrido, reglamento, categorías, horarios) debe estar en la página del evento en EasyRace. Cuando alguien pregunte, la respuesta es: "está en la página del evento".</p>
    `,
  },
];
