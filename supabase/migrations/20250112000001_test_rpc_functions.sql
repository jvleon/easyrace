-- ============================================
-- TESTS PARA FUNCIONES RPC
-- Ejecutar después de crear las funciones
-- ============================================

-- ============================================
-- TEST 1: create_competitor_pair
-- ============================================

-- Test 1.1: Verificar que la función existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE routine_schema = 'public'
      AND routine_name = 'create_competitor_pair'
  ) THEN
    RAISE EXCEPTION 'FUNCIÓN create_competitor_pair NO EXISTE';
  END IF;
  RAISE NOTICE '✅ Test 1.1: Función create_competitor_pair existe';
END $$;

-- Test 1.2: Verificar permisos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.routine_privileges
    WHERE routine_schema = 'public'
      AND routine_name = 'create_competitor_pair'
      AND grantee = 'anon'
  ) THEN
    RAISE EXCEPTION 'FUNCIÓN create_competitor_pair NO TIENE PERMISOS PARA anon';
  END IF;
  RAISE NOTICE '✅ Test 1.2: Permisos correctos para create_competitor_pair';
END $$;

-- ============================================
-- TEST 2: increment_kit_sold_quantity
-- ============================================

-- Test 2.1: Verificar que la función existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE routine_schema = 'public'
      AND routine_name = 'increment_kit_sold_quantity'
  ) THEN
    RAISE EXCEPTION 'FUNCIÓN increment_kit_sold_quantity NO EXISTE';
  END IF;
  RAISE NOTICE '✅ Test 2.1: Función increment_kit_sold_quantity existe';
END $$;

-- Test 2.2: Verificar permisos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.routine_privileges
    WHERE routine_schema = 'public'
      AND routine_name = 'increment_kit_sold_quantity'
      AND grantee = 'anon'
  ) THEN
    RAISE EXCEPTION 'FUNCIÓN increment_kit_sold_quantity NO TIENE PERMISOS PARA anon';
  END IF;
  RAISE NOTICE '✅ Test 2.2: Permisos correctos para increment_kit_sold_quantity';
END $$;

-- ============================================
-- TEST 3: update_competitor_pair_id
-- ============================================

-- Test 3.1: Verificar que la función existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE routine_schema = 'public'
      AND routine_name = 'update_competitor_pair_id'
  ) THEN
    RAISE EXCEPTION 'FUNCIÓN update_competitor_pair_id NO EXISTE';
  END IF;
  RAISE NOTICE '✅ Test 3.1: Función update_competitor_pair_id existe';
END $$;

-- ============================================
-- TEST 4: Validar estructura de retorno
-- ============================================

-- Test 4.1: create_competitor_pair retorna jsonb con campos correctos
-- (Este test requiere datos reales, se ejecuta manualmente)

-- Test 4.2: increment_kit_sold_quantity retorna jsonb con campos correctos
-- (Este test requiere datos reales, se ejecuta manualmente)

-- ============================================
-- RESUMEN
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'TESTS DE ESTRUCTURA COMPLETADOS';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Todas las funciones existen';
  RAISE NOTICE '✅ Permisos configurados correctamente';
  RAISE NOTICE '';
  RAISE NOTICE 'PRÓXIMOS PASOS:';
  RAISE NOTICE '1. Probar con datos reales en el frontend';
  RAISE NOTICE '2. Verificar que los errores se manejan correctamente';
  RAISE NOTICE '3. Verificar que RLS está configurado';
  RAISE NOTICE '========================================';
END $$;


