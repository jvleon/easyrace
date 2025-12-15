-- ============================================
-- FUNCIONES RPC SEGURAS PARA EASYRACE
-- Con validaciones de seguridad completas
-- ============================================

-- ============================================
-- 1. FUNCIÓN: create_competitor_pair
-- ============================================
-- Crea un par de competidores y actualiza sus pair_id
-- Valida que ambos competidores pertenezcan al mismo evento

CREATE OR REPLACE FUNCTION create_competitor_pair(
  p_event_id uuid,
  p_competitor_1_id uuid,
  p_competitor_2_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER -- Ejecuta con permisos del creador de la función
AS $$
DECLARE
  v_event_record events%ROWTYPE;
  v_competitor_1 competitors%ROWTYPE;
  v_competitor_2 competitors%ROWTYPE;
  v_pair_id uuid;
  v_result jsonb;
BEGIN
  -- ============================================
  -- VALIDACIONES DE SEGURIDAD
  -- ============================================
  
  -- 1. Validar que el evento existe y está publicado
  SELECT * INTO v_event_record
  FROM events
  WHERE id = p_event_id
    AND status IN ('published', 'completed');
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Evento no encontrado o no disponible para registro';
  END IF;
  
  -- 2. Validar que competitor_1 existe y pertenece al evento
  SELECT * INTO v_competitor_1
  FROM competitors
  WHERE id = p_competitor_1_id
    AND event_id = p_event_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Competidor 1 no encontrado o no pertenece a este evento';
  END IF;
  
  -- 3. Validar que competitor_2 existe y pertenece al evento
  SELECT * INTO v_competitor_2
  FROM competitors
  WHERE id = p_competitor_2_id
    AND event_id = p_event_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Competidor 2 no encontrado o no pertenece a este evento';
  END IF;
  
  -- 4. Validar que los competidores son diferentes
  IF p_competitor_1_id = p_competitor_2_id THEN
    RAISE EXCEPTION 'Los competidores deben ser diferentes';
  END IF;
  
  -- 5. Validar que ninguno de los competidores ya tiene un pair_id
  IF v_competitor_1.pair_id IS NOT NULL THEN
    RAISE EXCEPTION 'El competidor 1 ya está en una pareja';
  END IF;
  
  IF v_competitor_2.pair_id IS NOT NULL THEN
    RAISE EXCEPTION 'El competidor 2 ya está en una pareja';
  END IF;
  
  -- 6. Validar que no existe ya un pair con estos competidores
  IF EXISTS (
    SELECT 1 FROM competitor_pairs
    WHERE (competitor_1_id = p_competitor_1_id AND competitor_2_id = p_competitor_2_id)
       OR (competitor_1_id = p_competitor_2_id AND competitor_2_id = p_competitor_1_id)
       OR competitor_1_id = p_competitor_1_id
       OR competitor_2_id = p_competitor_1_id
       OR competitor_1_id = p_competitor_2_id
       OR competitor_2_id = p_competitor_2_id
  ) THEN
    RAISE EXCEPTION 'Uno o ambos competidores ya están en una pareja';
  END IF;
  
  -- ============================================
  -- CREAR EL PAIR
  -- ============================================
  
  INSERT INTO competitor_pairs (
    event_id,
    competitor_1_id,
    competitor_2_id,
    payment_confirmed
  )
  VALUES (
    p_event_id,
    p_competitor_1_id,
    p_competitor_2_id,
    false
  )
  RETURNING id INTO v_pair_id;
  
  -- ============================================
  -- ACTUALIZAR AMBOS COMPETIDORES CON EL PAIR_ID
  -- ============================================
  
  UPDATE competitors
  SET pair_id = v_pair_id
  WHERE id IN (p_competitor_1_id, p_competitor_2_id)
    AND event_id = p_event_id; -- Validación adicional de seguridad
  
  -- Verificar que se actualizaron ambos
  IF NOT FOUND OR (SELECT COUNT(*) FROM competitors WHERE pair_id = v_pair_id) != 2 THEN
    -- Rollback: eliminar el pair creado
    DELETE FROM competitor_pairs WHERE id = v_pair_id;
    RAISE EXCEPTION 'Error al actualizar competidores con pair_id';
  END IF;
  
  -- ============================================
  -- RETORNAR RESULTADO
  -- ============================================
  
  SELECT jsonb_build_object(
    'id', v_pair_id,
    'event_id', p_event_id,
    'competitor_1_id', p_competitor_1_id,
    'competitor_2_id', p_competitor_2_id,
    'payment_confirmed', false,
    'created_at', NOW()
  ) INTO v_result;
  
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Log del error (en producción, usar un sistema de logging)
    RAISE EXCEPTION 'Error al crear pareja de competidores: %', SQLERRM;
END;
$$;

-- ============================================
-- 2. FUNCIÓN: increment_kit_sold_quantity
-- ============================================
-- Incrementa el contador de kits vendidos de forma atómica
-- Valida que el kit pertenezca al evento

CREATE OR REPLACE FUNCTION increment_kit_sold_quantity(
  p_kit_id uuid,
  p_event_id uuid,
  p_quantity integer DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_kit_record kits%ROWTYPE;
  v_event_record events%ROWTYPE;
  v_new_quantity integer;
  v_result jsonb;
BEGIN
  -- ============================================
  -- VALIDACIONES DE SEGURIDAD
  -- ============================================
  
  -- 1. Validar que el kit existe
  SELECT * INTO v_kit_record
  FROM kits
  WHERE id = p_kit_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Kit no encontrado';
  END IF;
  
  -- 2. Validar que el kit pertenece al evento
  IF v_kit_record.event_id != p_event_id THEN
    RAISE EXCEPTION 'El kit no pertenece a este evento';
  END IF;
  
  -- 3. Validar que el evento existe y está publicado
  SELECT * INTO v_event_record
  FROM events
  WHERE id = p_event_id
    AND status IN ('published', 'completed');
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Evento no encontrado o no disponible';
  END IF;
  
  -- 4. Validar cantidad positiva
  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'La cantidad debe ser mayor a 0';
  END IF;
  
  -- 5. Validar que no se exceda max_quantity (si existe)
  IF v_kit_record.max_quantity IS NOT NULL THEN
    IF (v_kit_record.sold_quantity + p_quantity) > v_kit_record.max_quantity THEN
      RAISE EXCEPTION 'No hay suficientes kits disponibles. Disponibles: %, Solicitados: %', 
        (v_kit_record.max_quantity - v_kit_record.sold_quantity), 
        p_quantity;
    END IF;
  END IF;
  
  -- ============================================
  -- INCREMENTAR CANTIDAD DE FORMA ATÓMICA
  -- ============================================
  
  UPDATE kits
  SET sold_quantity = sold_quantity + p_quantity
  WHERE id = p_kit_id
    AND event_id = p_event_id -- Validación adicional
  RETURNING sold_quantity INTO v_new_quantity;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Error al actualizar cantidad de kits vendidos';
  END IF;
  
  -- ============================================
  -- RETORNAR RESULTADO
  -- ============================================
  
  SELECT jsonb_build_object(
    'kit_id', p_kit_id,
    'event_id', p_event_id,
    'previous_quantity', v_kit_record.sold_quantity,
    'new_quantity', v_new_quantity,
    'incremented_by', p_quantity
  ) INTO v_result;
  
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error al incrementar cantidad de kits: %', SQLERRM;
END;
$$;

-- ============================================
-- 3. FUNCIÓN: update_competitor_pair_id
-- ============================================
-- Actualiza el pair_id de un competidor
-- Solo permite actualizar si el competidor no tiene pair_id y el pair existe

CREATE OR REPLACE FUNCTION update_competitor_pair_id(
  p_competitor_id uuid,
  p_pair_id uuid,
  p_event_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_competitor competitors%ROWTYPE;
  v_pair competitor_pairs%ROWTYPE;
  v_result jsonb;
BEGIN
  -- ============================================
  -- VALIDACIONES DE SEGURIDAD
  -- ============================================
  
  -- 1. Validar que el competidor existe
  SELECT * INTO v_competitor
  FROM competitors
  WHERE id = p_competitor_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Competidor no encontrado';
  END IF;
  
  -- 2. Validar que el competidor pertenece al evento
  IF v_competitor.event_id != p_event_id THEN
    RAISE EXCEPTION 'El competidor no pertenece a este evento';
  END IF;
  
  -- 3. Validar que el pair existe
  SELECT * INTO v_pair
  FROM competitor_pairs
  WHERE id = p_pair_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pareja no encontrada';
  END IF;
  
  -- 4. Validar que el pair pertenece al evento
  IF v_pair.event_id != p_event_id THEN
    RAISE EXCEPTION 'La pareja no pertenece a este evento';
  END IF;
  
  -- 5. Validar que el competidor no tiene ya un pair_id
  IF v_competitor.pair_id IS NOT NULL AND v_competitor.pair_id != p_pair_id THEN
    RAISE EXCEPTION 'El competidor ya tiene una pareja asignada';
  END IF;
  
  -- 6. Validar que el competidor es parte de este pair
  IF v_pair.competitor_1_id != p_competitor_id AND v_pair.competitor_2_id != p_competitor_id THEN
    RAISE EXCEPTION 'El competidor no es parte de esta pareja';
  END IF;
  
  -- ============================================
  -- ACTUALIZAR PAIR_ID
  -- ============================================
  
  UPDATE competitors
  SET pair_id = p_pair_id
  WHERE id = p_competitor_id
    AND event_id = p_event_id; -- Validación adicional
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Error al actualizar pair_id del competidor';
  END IF;
  
  -- ============================================
  -- RETORNAR RESULTADO
  -- ============================================
  
  SELECT jsonb_build_object(
    'competitor_id', p_competitor_id,
    'pair_id', p_pair_id,
    'event_id', p_event_id,
    'updated_at', NOW()
  ) INTO v_result;
  
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error al actualizar pair_id: %', SQLERRM;
END;
$$;

-- ============================================
-- COMENTARIOS Y DOCUMENTACIÓN
-- ============================================

COMMENT ON FUNCTION create_competitor_pair IS 
'Crea una pareja de competidores y actualiza sus pair_id. Valida que ambos competidores pertenezcan al mismo evento y no estén ya en otra pareja.';

COMMENT ON FUNCTION increment_kit_sold_quantity IS 
'Incrementa el contador de kits vendidos de forma atómica. Valida que el kit pertenezca al evento y no se exceda max_quantity.';

COMMENT ON FUNCTION update_competitor_pair_id IS 
'Actualiza el pair_id de un competidor. Solo permite actualizar si el competidor es parte del pair y pertenece al mismo evento.';

-- ============================================
-- PERMISOS
-- ============================================

-- Permitir que usuarios anónimos y autenticados ejecuten estas funciones
GRANT EXECUTE ON FUNCTION create_competitor_pair TO anon, authenticated;
GRANT EXECUTE ON FUNCTION increment_kit_sold_quantity TO anon, authenticated;
GRANT EXECUTE ON FUNCTION update_competitor_pair_id TO anon, authenticated;


