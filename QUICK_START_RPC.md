# Guía Rápida: Implementar Funciones RPC

## 🚀 Pasos Rápidos (5 minutos)

### 1. Aplicar Migración SQL
```sql
-- En Supabase Dashboard → SQL Editor
-- Copiar y pegar el contenido de:
supabase/migrations/20250112000000_create_secure_rpc_functions.sql
```

### 2. Verificar que se Crearon
```sql
-- Ejecutar en SQL Editor
SELECT routine_name 
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'create_competitor_pair',
    'increment_kit_sold_quantity',
    'update_competitor_pair_id'
  );
```

**Deberías ver 3 funciones listadas.**

### 3. Probar en el Navegador
1. Abrir `http://localhost:4321`
2. Intentar registrar un competidor
3. Verificar en la consola del navegador que no hay errores

---

## ✅ Verificación Rápida

### ¿Funcionan las funciones?
```bash
# Opción 1: Test automatizado (requiere dotenv)
npm run rpc:test

# Opción 2: Test manual en Supabase Dashboard
# Ejecutar: supabase/migrations/20250112000001_test_rpc_functions.sql
```

### ¿El código está actualizado?
```bash
# Verificar que no hay INSERT/UPDATE directos
grep -r "\.from.*\.insert\|\.from.*\.update" src/components/RegistrationModal.tsx
# No debería encontrar resultados (excepto comentarios)
```

---

## 📋 Checklist Mínimo

- [ ] Migración SQL ejecutada
- [ ] 3 funciones aparecen en `information_schema.routines`
- [ ] Registro individual funciona
- [ ] Registro de pareja funciona
- [ ] No hay errores en consola del navegador

---

## 🐛 Problemas Comunes

### "function does not exist"
**Solución**: La migración SQL no se ejecutó. Ejecutar paso 1.

### "permission denied"
**Solución**: Verificar que los `GRANT EXECUTE` se ejecutaron en la migración.

### "Evento no encontrado"
**Solución**: Verificar que el evento existe y tiene `status = 'published'` o `'completed'`.

---

## 📚 Documentación Completa

- **`RPC_FUNCTIONS_DOCUMENTATION.md`** - Documentación detallada
- **`RPC_FUNCTIONS_IMPLEMENTATION.md`** - Guía de implementación
- **`RPC_FUNCTIONS_SUMMARY.md`** - Resumen ejecutivo

---

## 🎯 Resultado Esperado

Después de implementar:
- ✅ Todas las operaciones usan funciones RPC
- ✅ Validaciones en el servidor
- ✅ Sin race conditions
- ✅ Transacciones atómicas
- ✅ Mayor seguridad




