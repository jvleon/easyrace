-- ============================================================================
-- MIGRACIÓN: Permitir Email Duplicado para Registros de Parejas
-- Descripción: Modifica la función insert_competitor para permitir que parejas
--              compartan el mismo email, recibiendo un parámetro adicional
--              'allow_duplicate_email' en los datos del competidor.
-- Fecha: 2026-02-04
-- ============================================================================

CREATE OR REPLACE FUNCTION public.insert_competitor(competitor_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  event_record public.events%ROWTYPE;
  kit_record public.kits%ROWTYPE;
  competitor_count integer;
  inserted_row jsonb;
  kit_id_value uuid;
  allow_duplicate_email boolean;
BEGIN
  -- ============================================
  -- 0. OBTENER PARÁMETROS ESPECIALES
  -- ============================================
  -- Permite duplicar email para registros de parejas
  allow_duplicate_email := COALESCE((competitor_data->>'allow_duplicate_email')::boolean, false);

  -- ============================================
  -- 1. VALIDAR EVENTO PUBLICADO
  -- ============================================
  SELECT * INTO event_record
  FROM public.events
  WHERE id = (competitor_data->>'event_id')::uuid
    AND status IN ('published', 'completed');
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Evento no encontrado o no disponible para registro';
  END IF;

  -- ============================================
  -- 2. VALIDAR MÁXIMO DE COMPETIDORES
  -- ============================================
  IF event_record.max_competitors IS NOT NULL THEN
    SELECT COUNT(*) INTO competitor_count
    FROM public.competitors
    WHERE event_id = event_record.id;
    
    IF competitor_count >= event_record.max_competitors THEN
      RAISE EXCEPTION 'Evento lleno. Máximo de competidores alcanzado: %', event_record.max_competitors;
    END IF;
  END IF;

  -- ============================================
  -- 3. VALIDAR EMAIL ÚNICO POR EVENTO
  --    (Solo si allow_duplicate_email es FALSE)
  -- ============================================
  IF NOT allow_duplicate_email THEN
    IF EXISTS (
      SELECT 1 FROM public.competitors
      WHERE event_id = event_record.id
        AND email = competitor_data->>'email'
    ) THEN
      RAISE EXCEPTION 'El email ya está registrado en este evento';
    END IF;
  END IF;

  -- ============================================
  -- 4. VALIDAR CATEGORÍA PERTENECE AL EVENTO
  -- ============================================
  IF NOT EXISTS (
    SELECT 1 FROM public.categories
    WHERE id = (competitor_data->>'category_id')::uuid
      AND event_id = event_record.id
  ) THEN
    RAISE EXCEPTION 'La categoría no pertenece a este evento';
  END IF;

  -- ============================================
  -- 5. VALIDAR KIT (SI SE PROPORCIONA)
  -- ============================================
  kit_id_value := CASE 
    WHEN competitor_data->>'kit_id' = '' OR competitor_data->>'kit_id' IS NULL 
    THEN NULL 
    ELSE (competitor_data->>'kit_id')::uuid 
  END;

  IF kit_id_value IS NOT NULL THEN
    SELECT * INTO kit_record
    FROM public.kits
    WHERE id = kit_id_value
      AND event_id = event_record.id
      AND is_active = true;
    
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Kit no encontrado o no disponible';
    END IF;
    
    -- Validar disponibilidad del kit (max_quantity)
    IF kit_record.max_quantity IS NOT NULL THEN
      IF kit_record.sold_quantity >= kit_record.max_quantity THEN
        RAISE EXCEPTION 'Kit agotado. Disponibles: %, Vendidos: %', 
          kit_record.max_quantity, kit_record.sold_quantity;
      END IF;
    END IF;
    
    -- Validar deadline de venta
    IF kit_record.sale_deadline IS NOT NULL THEN
      IF NOW() > kit_record.sale_deadline THEN
        RAISE EXCEPTION 'La venta de este kit ha finalizado';
      END IF;
    END IF;
  END IF;

  -- ============================================
  -- 6. INSERTAR EL COMPETIDOR
  -- ============================================
  INSERT INTO public.competitors (
    event_id,
    gender,
    category_id,
    kit_id,
    kit_size,
    first_name,
    last_name,
    email,
    phone,
    birth_date,
    club_id,
    club,
    emergency_contact_name,
    emergency_contact_phone,
    blood_type,
    id_photo_url,
    social_media_photo_url,
    payment_proof_url,
    club_photo_url,
    origin
  )
  VALUES (
    event_record.id,
    competitor_data->>'gender',
    (competitor_data->>'category_id')::uuid,
    kit_id_value,
    competitor_data->>'kit_size',
    competitor_data->>'first_name',
    competitor_data->>'last_name',
    competitor_data->>'email',
    competitor_data->>'phone',
    CASE 
      WHEN competitor_data->>'birth_date' = '' OR competitor_data->>'birth_date' IS NULL 
      THEN NULL 
      ELSE (competitor_data->>'birth_date')::date 
    END,
    CASE 
      WHEN competitor_data->>'club_id' = '' OR competitor_data->>'club_id' IS NULL 
      THEN NULL 
      ELSE (competitor_data->>'club_id')::uuid 
    END,
    competitor_data->>'club',
    competitor_data->>'emergency_contact_name',
    competitor_data->>'emergency_contact_phone',
    competitor_data->>'blood_type',
    competitor_data->>'id_photo_url',
    competitor_data->>'social_media_photo_url',
    competitor_data->>'payment_proof_url',
    competitor_data->>'club_photo_url',
    CASE 
      WHEN competitor_data->>'origin' = '' OR competitor_data->>'origin' IS NULL 
      THEN NULL 
      ELSE competitor_data->>'origin' 
    END
  )
  RETURNING to_jsonb(competitors.*) INTO inserted_row;

  -- ============================================
  -- 7. INCREMENTAR SOLD_QUANTITY DEL KIT
  -- ============================================
  IF kit_id_value IS NOT NULL THEN
    -- Usar la función RPC increment_kit_sold_quantity para incremento atómico
    PERFORM increment_kit_sold_quantity(
      kit_id_value,
      event_record.id,
      1
    );
  END IF;

  -- ============================================
  -- 8. RETORNAR COMPETIDOR INSERTADO
  -- ============================================
  RETURN inserted_row;

EXCEPTION
  WHEN OTHERS THEN
    -- Re-lanzar la excepción con el mensaje original
    RAISE;
END;
$function$;

-- ============================================
-- COMENTARIOS Y DOCUMENTACIÓN
-- ============================================

COMMENT ON FUNCTION public.insert_competitor(jsonb) IS 
'Función RPC segura para insertar competidores con validaciones.

Validaciones implementadas:
1. Evento existe y está publicado (status IN (''published'', ''completed''))
2. No exceder max_competitors del evento
3. Email único por evento (EXCEPTO cuando allow_duplicate_email=true para parejas)
4. Categoría pertenece al evento
5. Kit disponible (si se proporciona): activo, no agotado, dentro de deadline
6. Incremento atómico de sold_quantity del kit

NUEVO: Parámetro allow_duplicate_email
- Cuando es true, permite insertar un competidor con un email que ya existe
- Se usa para registros de PAREJAS donde ambos comparten el mismo email
- El frontend debe validar que realmente es una pareja antes de usar este flag

Uso desde TypeScript:
const { data, error } = await supabase.rpc(''insert_competitor'', {
  competitor_data: {
    event_id: ''uuid'',
    first_name: ''Juan'',
    last_name: ''Pérez'',
    email: ''juan@example.com'',
    category_id: ''uuid'',
    kit_id: ''uuid'',
    allow_duplicate_email: true, // Para parejas con mismo email
    // ... otros campos
  }
});

Errores posibles:
- ''Evento no encontrado o no disponible para registro''
- ''Evento lleno. Máximo de competidores alcanzado: X''
- ''El email ya está registrado en este evento''
- ''La categoría no pertenece a este evento''
- ''Kit no encontrado o no disponible''
- ''Kit agotado. Disponibles: X, Vendidos: Y''
- ''La venta de este kit ha finalizado''
';
