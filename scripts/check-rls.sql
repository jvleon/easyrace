-- Script para verificar políticas RLS en Supabase
-- Ejecutar en el SQL Editor de Supabase Dashboard

-- 1. Verificar que RLS está habilitado en todas las tablas críticas
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
    AND tablename IN ('events', 'competitors', 'categories', 'kits', 'clubs')
ORDER BY tablename;

-- 2. Ver todas las políticas RLS configuradas
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd as command,
    qual as using_expression,
    with_check as with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 3. Verificar tablas sin RLS habilitado (CRÍTICO)
SELECT 
    tablename,
    'RLS NO HABILITADO - CRÍTICO' as status
FROM pg_tables
WHERE schemaname = 'public'
    AND rowsecurity = false
    AND tablename IN ('events', 'competitors', 'categories', 'kits', 'clubs');

-- 4. Verificar tablas sin políticas (puede ser intencional para tablas públicas de solo lectura)
SELECT 
    t.tablename,
    CASE 
        WHEN COUNT(p.policyname) = 0 THEN 'SIN POLÍTICAS'
        ELSE CONCAT(COUNT(p.policyname), ' política(s)')
    END as policy_count
FROM pg_tables t
LEFT JOIN pg_policies p ON t.tablename = p.tablename AND p.schemaname = 'public'
WHERE t.schemaname = 'public'
    AND t.tablename IN ('events', 'competitors', 'categories', 'kits', 'clubs')
GROUP BY t.tablename
ORDER BY t.tablename;

-- 5. Verificar permisos de roles anónimos (debe ser restrictivo)
SELECT 
    grantee,
    table_schema,
    table_name,
    privilege_type
FROM information_schema.role_table_grants
WHERE grantee = 'anon'
    AND table_schema = 'public'
    AND table_name IN ('events', 'competitors', 'categories', 'kits', 'clubs')
ORDER BY table_name, privilege_type;

-- RECOMENDACIONES:
-- 
-- Para la tabla 'events':
--   - RLS debe estar habilitado
--   - Política SELECT: Solo eventos con status = 'published' o 'completed'
--   - Política INSERT/UPDATE/DELETE: Solo para roles autenticados (service_role o authenticated)
--
-- Para la tabla 'competitors':
--   - RLS debe estar habilitado
--   - Política SELECT: Solo para el propio competidor o roles admin
--   - Política INSERT: Solo a través de Edge Functions (no desde cliente anónimo)
--   - Política UPDATE: Solo para el propio competidor o roles admin
--   - Política DELETE: Solo para roles admin
--
-- Para la tabla 'categories':
--   - RLS puede estar habilitado o no (depende si quieres restricción)
--   - Si RLS está habilitado: Solo lectura pública para eventos publicados
--
-- Para la tabla 'kits':
--   - Similar a categories, solo lectura pública
--
-- Para la tabla 'clubs':
--   - Solo lectura pública




