# Documentación de Funciones RPC - EasyRace

## 📋 Resumen

Este documento describe las funciones RPC (Remote Procedure Call) implementadas en Supabase para operaciones seguras de la base de datos.

**Ubicación**: `supabase/migrations/20250112000000_create_secure_rpc_functions.sql`

---

## 🔐 Funciones Implementadas

### 1. `create_competitor_pair`

**Propósito**: Crea una pareja de competidores y actualiza automáticamente sus `pair_id`.

**Parámetros**:
- `p_event_id` (uuid): ID del evento
- `p_competitor_1_id` (uuid): ID del primer competidor
- `p_competitor_2_id` (uuid): ID del segundo competidor

**Retorna**: `jsonb` con la información del pair creado

**Validaciones de Seguridad**:
1. ✅ Valida que el evento existe y está publicado
2. ✅ Valida que ambos competidores existen
3. ✅ Valida que ambos competidores pertenecen al mismo evento
4. ✅ Valida que los competidores son diferentes
5. ✅ Valida que ninguno ya tiene un `pair_id`
6. ✅ Valida que no existe ya un pair con estos competidores
7. ✅ Actualiza ambos competidores de forma atómica
8. ✅ Rollback automático si algo falla

**Uso en TypeScript**:
```typescript
const { data: pairData, error } = await supabase.rpc('create_competitor_pair', {
  p_event_id: eventId,
  p_competitor_1_id: competitor1Id,
  p_competitor_2_id: competitor2Id
});
```

**Ejemplo de Respuesta**:
```json
{
  "id": "uuid-del-pair",
  "event_id": "uuid-del-evento",
  "competitor_1_id": "uuid-competidor-1",
  "competitor_2_id": "uuid-competidor-2",
  "payment_confirmed": false,
  "created_at": "2025-01-12T10:30:00Z"
}
```

**Errores Posibles**:
- `Evento no encontrado o no disponible para registro`
- `Competidor 1 no encontrado o no pertenece a este evento`
- `Competidor 2 no encontrado o no pertenece a este evento`
- `Los competidores deben ser diferentes`
- `El competidor 1 ya está en una pareja`
- `Uno o ambos competidores ya están en una pareja`

---

### 2. `increment_kit_sold_quantity`

**Propósito**: Incrementa el contador de kits vendidos de forma atómica (evita race conditions).

**Parámetros**:
- `p_kit_id` (uuid): ID del kit
- `p_event_id` (uuid): ID del evento
- `p_quantity` (integer, opcional): Cantidad a incrementar (default: 1)

**Retorna**: `jsonb` con información del incremento

**Validaciones de Seguridad**:
1. ✅ Valida que el kit existe
2. ✅ Valida que el kit pertenece al evento
3. ✅ Valida que el evento existe y está publicado
4. ✅ Valida que la cantidad es positiva
5. ✅ Valida que no se exceda `max_quantity` (si existe)
6. ✅ Incremento atómico (una sola operación SQL)

**Uso en TypeScript**:
```typescript
const { data: result, error } = await supabase.rpc('increment_kit_sold_quantity', {
  p_kit_id: kitId,
  p_event_id: eventId,
  p_quantity: 1
});
```

**Ejemplo de Respuesta**:
```json
{
  "kit_id": "uuid-del-kit",
  "event_id": "uuid-del-evento",
  "previous_quantity": 10,
  "new_quantity": 11,
  "incremented_by": 1
}
```

**Errores Posibles**:
- `Kit no encontrado`
- `El kit no pertenece a este evento`
- `Evento no encontrado o no disponible`
- `La cantidad debe ser mayor a 0`
- `No hay suficientes kits disponibles. Disponibles: X, Solicitados: Y`

---

### 3. `update_competitor_pair_id`

**Propósito**: Actualiza el `pair_id` de un competidor (función auxiliar, normalmente no se usa directamente).

**Parámetros**:
- `p_competitor_id` (uuid): ID del competidor
- `p_pair_id` (uuid): ID del pair
- `p_event_id` (uuid): ID del evento

**Retorna**: `jsonb` con información de la actualización

**Validaciones de Seguridad**:
1. ✅ Valida que el competidor existe
2. ✅ Valida que el competidor pertenece al evento
3. ✅ Valida que el pair existe
4. ✅ Valida que el pair pertenece al evento
5. ✅ Valida que el competidor no tiene ya otro pair_id
6. ✅ Valida que el competidor es parte de este pair

**Nota**: Esta función normalmente no se usa directamente, ya que `create_competitor_pair` actualiza ambos competidores automáticamente.

---

## 🔒 Características de Seguridad

### SECURITY DEFINER
Todas las funciones usan `SECURITY DEFINER`, lo que significa que:
- ✅ Ejecutan con permisos del creador de la función (no del usuario que la llama)
- ✅ Pueden hacer operaciones que el usuario anónimo no podría hacer directamente
- ✅ Las validaciones se ejecutan en el servidor (no pueden ser bypasseadas)

### Validaciones Múltiples
Cada función valida:
- ✅ Existencia de registros
- ✅ Relaciones entre tablas (event_id, etc.)
- ✅ Estados válidos (eventos publicados, etc.)
- ✅ Integridad de datos (no duplicados, etc.)

### Transacciones Atómicas
Las operaciones complejas (como crear pair y actualizar competidores) se hacen de forma atómica:
- ✅ Si algo falla, se hace rollback automático
- ✅ No deja datos inconsistentes

---

## 📝 Migración

### Aplicar las funciones:

1. **En Supabase Dashboard**:
   - Ir a SQL Editor
   - Ejecutar: `supabase/migrations/20250112000000_create_secure_rpc_functions.sql`

2. **O usando Supabase CLI**:
   ```bash
   supabase db push
   ```

### Verificar que se crearon:

```sql
-- Ver todas las funciones RPC
SELECT 
    routine_name,
    routine_type,
    security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
    AND routine_type = 'FUNCTION'
    AND routine_name IN (
        'create_competitor_pair',
        'increment_kit_sold_quantity',
        'update_competitor_pair_id'
    )
ORDER BY routine_name;
```

---

## 🧪 Testing

### Test 1: create_competitor_pair

```sql
-- Preparar datos de prueba
-- (Asumiendo que tienes un evento y dos competidores)

-- Test exitoso
SELECT create_competitor_pair(
    'event-id-uuid'::uuid,
    'competitor-1-id-uuid'::uuid,
    'competitor-2-id-uuid'::uuid
);

-- Test: Competidores del mismo ID (debe fallar)
SELECT create_competitor_pair(
    'event-id-uuid'::uuid,
    'competitor-1-id-uuid'::uuid,
    'competitor-1-id-uuid'::uuid  -- Mismo ID
);
-- Esperado: Error "Los competidores deben ser diferentes"

-- Test: Evento no publicado (debe fallar)
SELECT create_competitor_pair(
    'draft-event-id-uuid'::uuid,  -- Evento en draft
    'competitor-1-id-uuid'::uuid,
    'competitor-2-id-uuid'::uuid
);
-- Esperado: Error "Evento no encontrado o no disponible"
```

### Test 2: increment_kit_sold_quantity

```sql
-- Test exitoso
SELECT increment_kit_sold_quantity(
    'kit-id-uuid'::uuid,
    'event-id-uuid'::uuid,
    1
);

-- Test: Exceder max_quantity (debe fallar)
SELECT increment_kit_sold_quantity(
    'kit-id-uuid'::uuid,
    'event-id-uuid'::uuid,
    999999  -- Cantidad muy grande
);
-- Esperado: Error "No hay suficientes kits disponibles"

-- Test: Kit de otro evento (debe fallar)
SELECT increment_kit_sold_quantity(
    'kit-id-uuid'::uuid,
    'otro-event-id-uuid'::uuid,  -- Evento diferente
    1
);
-- Esperado: Error "El kit no pertenece a este evento"
```

---

## 🔄 Cambios en el Código Frontend

### Antes (Inseguro):
```typescript
// INSERT directo
await supabase.from('competitor_pairs').insert([{...}]);

// UPDATE directo
await supabase.from('competitors').update({ pair_id: ... });

// UPDATE directo con race condition
await supabase.from('kits').update({ sold_quantity: ... });
```

### Después (Seguro):
```typescript
// Función RPC con validaciones
await supabase.rpc('create_competitor_pair', {...});

// Función RPC atómica
await supabase.rpc('increment_kit_sold_quantity', {...});
```

---

## ✅ Checklist de Implementación

- [ ] Ejecutar migración SQL en Supabase
- [ ] Verificar que las funciones se crearon correctamente
- [ ] Actualizar código TypeScript (ya hecho ✅)
- [ ] Probar registro de competidor individual
- [ ] Probar registro de pareja de competidores
- [ ] Probar incremento de kits
- [ ] Verificar que los errores se manejan correctamente
- [ ] Verificar que RLS está configurado (ejecutar `scripts/check-rls.sql`)

---

## 🚨 Notas Importantes

1. **No eliminar las funciones antiguas** hasta verificar que todo funciona
2. **Las funciones son idempotentes** en cuanto a validaciones (pueden fallar de forma segura)
3. **Los errores son descriptivos** para facilitar debugging
4. **Todas las operaciones son atómicas** (todo o nada)

---

## 📚 Referencias

- [Supabase RPC Functions](https://supabase.com/docs/guides/database/functions)
- [PostgreSQL SECURITY DEFINER](https://www.postgresql.org/docs/current/sql-createfunction.html#SQL-CREATEFUNCTION-SECURITY)
- [OWASP: SQL Injection Prevention](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html)


