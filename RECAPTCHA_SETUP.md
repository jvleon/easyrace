# Configuración de reCAPTCHA

Este documento explica cómo configurar reCAPTCHA para el formulario de registro.

## Variables de Entorno Necesarias

### Frontend (`.env` o variables de entorno del servidor)

```env
PUBLIC_RECAPTCHA_SITE_KEY=tu_site_key_aqui
```

Esta es la clave pública (site key) de Google reCAPTCHA que se usa en el frontend.

### Supabase Edge Function

La secret key debe configurarse como variable de entorno en Supabase:

1. Ve a tu proyecto en Supabase Dashboard
2. Navega a **Edge Functions** > **Settings**
3. Agrega la variable de entorno:
   - **Nombre**: `RECAPTCHA_SECRET_KEY`
   - **Valor**: Tu secret key de Google reCAPTCHA

## Desplegar la Edge Function

Para desplegar la edge function `verify-recaptcha`:

```bash
# Asegúrate de tener el CLI de Supabase instalado
npm install -g supabase

# Login en Supabase
supabase login

# Link tu proyecto (si no está linkeado)
supabase link --project-ref tu-project-ref

# Desplegar la función
supabase functions deploy verify-recaptcha
```

O desde el Dashboard de Supabase:
1. Ve a **Edge Functions**
2. Crea una nueva función llamada `verify-recaptcha`
3. Copia el contenido de `supabase/functions/verify-recaptcha/index.ts`
4. Guarda y despliega

## Obtener las Keys de reCAPTCHA

1. Ve a [Google reCAPTCHA Admin Console](https://www.google.com/recaptcha/admin)
2. Crea un nuevo sitio o selecciona uno existente
3. Elige el tipo de reCAPTCHA (v2 Checkbox recomendado)
4. Agrega tus dominios (ej: `easyrace.com.mx`, `demo.easyrace.com.mx`)
5. Copia la **Site Key** (para `PUBLIC_RECAPTCHA_SITE_KEY`)
6. Copia la **Secret Key** (para `RECAPTCHA_SECRET_KEY` en Supabase)

## Funcionamiento

1. El usuario completa el formulario de registro
2. Antes de enviar, debe completar el reCAPTCHA
3. Al hacer submit, el token de reCAPTCHA se valida con la edge function
4. La edge function verifica el token con Google reCAPTCHA API
5. Solo si la validación es exitosa, se procede con el registro

## Notas

- El reCAPTCHA solo se muestra en el paso final del formulario (no en el paso 1 de categorías de parejas)
- Si el reCAPTCHA expira o hay un error, el usuario debe completarlo nuevamente
- El token se resetea automáticamente después de un registro exitoso o al cerrar el modal

