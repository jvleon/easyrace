-- ============================================
-- POLÍTICAS RLS SEGURAS PARA EASYRACE
-- Permiten registros públicos pero con restricciones
-- ============================================

-- ============================================
-- 1. TABLA: events
-- ============================================
-- Objetivo: Solo lectura pública para eventos publicados

-- Habilitar RLS
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Política: Permitir lectura solo de eventos publicados o completados
CREATE POLICY "Public can view published events"
ON events
FOR SELECT
TO anon, authenticated
USING (status IN ('published', 'completed'));

-- Política: Solo service_role puede insertar/actualizar/eliminar
-- (No crear política para anon/authenticated = solo service_role puede modificar)

-- ============================================
-- 2. TABLA: competitors
-- ============================================
-- Objetivo: Permitir INSERT público pero con validaciones, restringir SELECT/UPDATE/DELETE

-- Habilitar RLS
ALTER TABLE competitors ENABLE ROW LEVEL SECURITY;

-- Política: NO permitir SELECT directo desde anon
-- (Los usuarios no pueden ver otros competidores)
-- Si necesitas que vean su propio registro, usa una función RPC

-- Política: Permitir INSERT solo a través de función RPC
-- ⚠️ IMPORTANTE: Esta política permite INSERT pero con validaciones
CREATE POLICY "Allow insert via RPC function only"
ON competitors
FOR INSERT
TO anon, authenticated
WITH CHECK (
  -- Validar que el evento existe y está publicado
  EXISTS (
    SELECT 1 FROM events 
    WHERE id = competitors.event_id 
    AND status IN ('published', 'completed')
  )
  -- Validar que no se exceda el máximo de competidores
  -- (Esto se valida en la función RPC insert_competitor)
);

-- Política: NO permitir UPDATE desde anon
-- (Solo service_role o funciones RPC pueden actualizar)

-- Política: NO permitir DELETE desde anon
-- (Solo service_role puede eliminar)

-- ============================================
-- 3. TABLA: categories
-- ============================================
-- Objetivo: Solo lectura pública

-- Habilitar RLS
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Política: Permitir lectura de categorías de eventos publicados
CREATE POLICY "Public can view categories of published events"
ON categories
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM events 
    WHERE id = categories.event_id 
    AND status IN ('published', 'completed')
  )
);

-- ============================================
-- 4. TABLA: kits
-- ============================================
-- Objetivo: Solo lectura pública

-- Habilitar RLS
ALTER TABLE kits ENABLE ROW LEVEL SECURITY;

-- Política: Permitir lectura de kits de eventos publicados
CREATE POLICY "Public can view kits of published events"
ON kits
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM events 
    WHERE id = kits.event_id 
    AND status IN ('published', 'completed')
  )
);

-- ============================================
-- 5. TABLA: clubs
-- ============================================
-- Objetivo: Solo lectura pública

-- Habilitar RLS (opcional, puede ser pública)
ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;

-- Política: Permitir lectura pública de clubs
CREATE POLICY "Public can view clubs"
ON clubs
FOR SELECT
TO anon, authenticated
USING (true);

-- ============================================
-- 6. TABLA: competitor_pairs
-- ============================================
-- Objetivo: Similar a competitors

-- Habilitar RLS
ALTER TABLE competitor_pairs ENABLE ROW LEVEL SECURITY;

-- Política: Permitir INSERT solo para eventos publicados
CREATE POLICY "Allow insert pairs for published events"
ON competitor_pairs
FOR INSERT
TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM events 
    WHERE id = competitor_pairs.event_id 
    AND status IN ('published', 'completed')
  )
);

-- ============================================
-- FUNCIONES RPC RECOMENDADAS
-- ============================================

-- Función: insert_competitor (ya la tienes)
-- Esta función debe:
-- 1. Validar que el evento existe y está publicado
-- 2. Validar que no se exceda max_competitors
-- 3. Validar que el email no esté duplicado en el evento
-- 4. Validar que la categoría pertenece al evento
-- 5. Validar que el kit pertenece al evento (si aplica)
-- 6. Insertar el competidor con datos validados

-- Ejemplo de validaciones en la función:
/*
CREATE OR REPLACE FUNCTION insert_competitor(
  competitor_data jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER -- Ejecuta con permisos del creador
AS $$
DECLARE
  event_record events%ROWTYPE;
  competitor_count integer;
  email_exists boolean;
BEGIN
  -- 1. Validar evento
  SELECT * INTO event_record
  FROM events
  WHERE id = (competitor_data->>'event_id')::uuid
    AND status IN ('published', 'completed');
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Evento no encontrado o no disponible';
  END IF;
  
  -- 2. Validar máximo de competidores
  IF event_record.max_competitors IS NOT NULL THEN
    SELECT COUNT(*) INTO competitor_count
    FROM competitors
    WHERE event_id = event_record.id;
    
    IF competitor_count >= event_record.max_competitors THEN
      RAISE EXCEPTION 'Evento lleno';
    END IF;
  END IF;
  
  -- 3. Validar email único por evento
  SELECT EXISTS(
    SELECT 1 FROM competitors
    WHERE event_id = event_record.id
      AND email = competitor_data->>'email'
  ) INTO email_exists;
  
  IF email_exists THEN
    RAISE EXCEPTION 'Email ya registrado en este evento';
  END IF;
  
  -- 4. Insertar competidor
  INSERT INTO competitors (
    event_id,
    first_name,
    last_name,
    email,
    -- ... otros campos
  )
  VALUES (
    (competitor_data->>'event_id')::uuid,
    competitor_data->>'first_name',
    competitor_data->>'last_name',
    competitor_data->>'email',
    -- ... otros campos
  )
  RETURNING * INTO competitor_record;
  
  RETURN row_to_json(competitor_record)::jsonb;
END;
$$;
*/

-- ============================================
-- VERIFICACIÓN DE SEGURIDAD
-- ============================================

-- Verificar que RLS está habilitado
SELECT 
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
    AND tablename IN ('events', 'competitors', 'categories', 'kits', 'clubs', 'competitor_pairs')
ORDER BY tablename;

-- Ver todas las políticas
SELECT 
    tablename,
    policyname,
    cmd as command,
    roles
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ============================================
-- NOTAS IMPORTANTES
-- ============================================

/*
1. ANON KEYS NO SON UN PROBLEMA:
   - Las anon keys son públicas por diseño
   - La seguridad viene de RLS, no de ocultar las keys
   - Cualquiera puede ver tu anon key en el código fuente (es normal)

2. RLS ES LA PROTECCIÓN:
   - RLS filtra qué datos puede ver/modificar cada usuario
   - Aunque tengan la anon key, solo pueden hacer lo que RLS permite

3. FUNCIONES RPC SON MÁS SEGURAS:
   - Ejecutan código en el servidor (no en el cliente)
   - Pueden tener validaciones complejas
   - Pueden usar SECURITY DEFINER para permisos elevados

4. POLÍTICAS SELECTIVAS:
   - Puedes permitir INSERT pero restringir SELECT
   - Puedes permitir INSERT solo con validaciones (WITH CHECK)
   - Puedes usar funciones RPC para operaciones complejas

5. MEJORES PRÁCTICAS:
   - ✅ Usar funciones RPC para INSERT/UPDATE/DELETE
   - ✅ Validar todo en el servidor (funciones RPC)
   - ✅ RLS para restringir SELECT
   - ✅ Rate limiting en Edge Functions
   - ✅ Validación de inputs en funciones RPC
*/


