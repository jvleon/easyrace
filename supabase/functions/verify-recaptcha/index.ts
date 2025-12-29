// Edge function para validar tokens de reCAPTCHA
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RECAPTCHA_SECRET_KEY = Deno.env.get('RECAPTCHA_SECRET_KEY');
const RECAPTCHA_VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';

interface RecaptchaVerifyRequest {
  token: string;
}

interface RecaptchaVerifyResponse {
  success: boolean;
  challenge_ts?: string;
  hostname?: string;
  'error-codes'?: string[];
}

serve(async (req) => {
  // Manejar CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    // Verificar que la secret key esté configurada
    if (!RECAPTCHA_SECRET_KEY) {
      console.error('RECAPTCHA_SECRET_KEY no está configurada');
      return new Response(
        JSON.stringify({
          error: 'Error de configuración del servidor. Por favor, contacta al administrador.',
          valid: false
        }),
        {
          status: 200, // Cambiar a 200 para que el cliente pueda leer el mensaje
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // Parsear el body de la request
    const { token }: RecaptchaVerifyRequest = await req.json();

    if (!token) {
      return new Response(
        JSON.stringify({
          error: 'Por favor, completa el reCAPTCHA antes de continuar.',
          valid: false
        }),
        {
          status: 200, // Cambiar a 200 para que el cliente pueda leer el mensaje
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // Validar el token con Google reCAPTCHA API
    const verifyResponse = await fetch(RECAPTCHA_VERIFY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `secret=${RECAPTCHA_SECRET_KEY}&response=${token}`,
    });

    const verifyData: RecaptchaVerifyResponse = await verifyResponse.json();

    if (!verifyData.success) {
      console.error('reCAPTCHA validation failed:', verifyData['error-codes']);

      // Traducir códigos de error de Google a mensajes amigables
      const errorCodes = verifyData['error-codes'] || [];
      let userMessage = 'No se pudo verificar el reCAPTCHA. Por favor, intenta de nuevo.';

      if (errorCodes.includes('missing-input-secret') || errorCodes.includes('invalid-input-secret')) {
        userMessage = 'Error de configuración del servidor. Por favor, contacta al administrador.';
      } else if (errorCodes.includes('missing-input-response') || errorCodes.includes('invalid-input-response')) {
        userMessage = 'El reCAPTCHA expiró o es inválido. Por favor, completa el reCAPTCHA nuevamente.';
      } else if (errorCodes.includes('bad-request')) {
        userMessage = 'Solicitud inválida. Por favor, intenta de nuevo.';
      } else if (errorCodes.includes('timeout-or-duplicate')) {
        userMessage = 'El reCAPTCHA expiró. Por favor, completa el reCAPTCHA nuevamente.';
      }

      return new Response(
        JSON.stringify({
          valid: false,
          error: userMessage,
          errorCodes: errorCodes,
        }),
        {
          status: 200, // Cambiar a 200 para que el cliente pueda leer el mensaje
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // Token válido
    return new Response(
      JSON.stringify({
        valid: true,
        challenge_ts: verifyData.challenge_ts,
        hostname: verifyData.hostname,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (error) {
    console.error('Error en verify-recaptcha:', error);

    // Determinar el tipo de error y dar un mensaje apropiado
    let userMessage = 'Ocurrió un error al verificar el reCAPTCHA. Por favor, intenta de nuevo.';

    if (error instanceof SyntaxError) {
      userMessage = 'Error al procesar la solicitud. Por favor, intenta de nuevo.';
    } else if (error instanceof TypeError && error.message.includes('fetch')) {
      userMessage = 'No se pudo conectar con el servidor de verificación. Por favor, verifica tu conexión e intenta de nuevo.';
    }

    return new Response(
      JSON.stringify({
        error: userMessage,
        valid: false,
      }),
      {
        status: 200, // Cambiar a 200 para que el cliente pueda leer el mensaje
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
});

