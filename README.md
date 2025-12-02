# EasyRace Landing Page

Landing page para mostrar eventos deportivos de EasyRace, construida con Astro, React y Tailwind CSS.

## Características

- Listado de eventos deportivos con cards responsivas
- Página de detalle de cada evento con banner y contenido WYSIWYG
- Formulario de registro dinámico basado en configuración del evento
- Integración con Supabase para datos y registro de competidores
- Diseño responsive y accesible
- Colores personalizados según la identidad de marca

## Tecnologías

- [Astro](https://astro.build/) - Framework web
- [React](https://react.dev/) - Biblioteca UI
- [Tailwind CSS](https://tailwindcss.com/) - Framework CSS
- [Supabase](https://supabase.com/) - Backend y base de datos
- [React Icons](https://react-icons.github.io/react-icons/) - Iconos

## Configuración

1. Instalar dependencias:
```bash
npm install
```

2. Configurar variables de entorno:
Crea un archivo `.env` y configura las variables de Supabase:
```
PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
PUBLIC_SUPABASE_ANON_KEY=tu-clave-anon
```

**Nota**: En Astro, las variables de entorno del cliente deben tener el prefijo `PUBLIC_`.

3. Ejecutar en desarrollo:
```bash
npm run dev
```

4. Construir para producción:
```bash
npm run build
```

5. Previsualizar build de producción:
```bash
npm run preview
```

## Despliegue

Este proyecto está configurado como sitio estático (client-side), perfecto para hosting estático como Hostinger.

### Desplegar en Hostinger:

1. **Construir el proyecto**:
```bash
npm run build
```

2. **Subir archivos**: Sube todo el contenido de la carpeta `dist/` a tu servidor Hostinger (generalmente a la carpeta `public_html` o `www`)

3. **Configurar variables de entorno**: Asegúrate de que las variables `PUBLIC_SUPABASE_URL` y `PUBLIC_SUPABASE_ANON_KEY` estén configuradas en tu entorno de producción, o inclúyelas en el build si es necesario.

### Nota sobre rutas dinámicas:

Las páginas de eventos se generan estáticamente en build time usando `getStaticPaths()`. Si agregas nuevos eventos, necesitarás hacer un nuevo build y subir los archivos actualizados.

### Otras opciones de despliegue:

- **Netlify**: Compatible con sitios estáticos
- **Vercel**: Compatible con sitios estáticos
- **GitHub Pages**: Compatible con sitios estáticos
- **Cualquier hosting estático**: El proyecto genera HTML estático en `dist/`

## Estructura del Proyecto

```
/
├── public/          # Archivos estáticos
├── src/
│   ├── components/  # Componentes React
│   ├── lib/         # Utilidades y clientes (Supabase)
│   ├── pages/       # Páginas Astro
│   ├── styles/      # Estilos globales
│   └── utils/       # Funciones auxiliares
└── package.json
```

## Componentes Principales

- `EventCard`: Card para mostrar eventos en el listado
- `RegistrationModal`: Modal con formulario de registro dinámico
- `RegistrationButton`: Botón que controla el modal de registro

## Variables de Entorno

El proyecto usa variables de entorno con prefijo `VITE_` o `PUBLIC_` para compatibilidad con Astro:

- `VITE_SUPABASE_URL`: URL del proyecto Supabase
- `VITE_SUPABASE_ANON_KEY`: Clave anónima de Supabase

## Base de Datos

El proyecto se conecta a Supabase y utiliza las siguientes tablas:

- `events`: Eventos deportivos
- `categories`: Categorías de cada evento
- `competitors`: Registros de competidores

## Colores de Marca

- Naranja: `#FF5722`
- Rojo fuego: `#D50000`
- Negro asfalto: `#212121`
- Blanco puro: `#FFF`
