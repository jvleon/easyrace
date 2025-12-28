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
        JSON.stringify({ error: 'Configuración de reCAPTCHA no disponible' }),
        {
          status: 500,
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
        JSON.stringify({ error: 'Token de reCAPTCHA no proporcionado', valid: false }),
        {
          status: 400,
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
      return new Response(
        JSON.stringify({
          valid: false,
          error: 'Token de reCAPTCHA inválido',
          errorCodes: verifyData['error-codes'],
        }),
        {
          status: 400,
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
    return new Response(
      JSON.stringify({
        error: 'Error interno del servidor',
        valid: false,
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
});

