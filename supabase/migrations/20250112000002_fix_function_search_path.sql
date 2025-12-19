-- ============================================
-- CORRECCIÓN: Agregar SET search_path a funciones RPC
-- Previene ataques de schema injection
-- ============================================

-- Función: create_competitor_pair
ALTER FUNCTION create_competitor_pair(uuid, uuid, uuid) 
SET search_path = public, pg_temp;

-- Función: increment_kit_sold_quantity
ALTER FUNCTION increment_kit_sold_quantity(uuid, uuid, integer) 
SET search_path = public, pg_temp;

-- Función: update_competitor_pair_id
ALTER FUNCTION update_competitor_pair_id(uuid, uuid, uuid) 
SET search_path = public, pg_temp;

-- ============================================
-- NOTA: Otras funciones del sistema también deberían
-- tener search_path configurado, pero estas son las
-- funciones RPC críticas que creamos para seguridad.
-- ============================================




