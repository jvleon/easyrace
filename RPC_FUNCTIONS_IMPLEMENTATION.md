# Guía de Implementación de Funciones RPC

## 🎯 Objetivo

Reemplazar todas las operaciones directas de INSERT/UPDATE con funciones RPC seguras que incluyen validaciones de seguridad.

---

## 📋 Estado Actual vs. Estado Objetivo

### ✅ Ya Implementado
- `insert_competitor` - Insertar competidores individuales

### ✅ Nuevas Funciones Creadas
- `create_competitor_pair` - Crear parejas de competidores
- `increment_kit_sold_quantity` - Incrementar contador de kits
- `update_competitor_pair_id` - Actualizar pair_id (auxiliar)

### ✅ Código Actualizado
- `src/components/RegistrationModal.tsx` - Usa nuevas funciones RPC

---

## 🚀 Pasos de Implementación

### Paso 1: Aplicar Migración SQL

1. **Ir a Supabase Dashboard** → SQL Editor
2. **Ejecutar**: `supabase/migrations/20250112000000_create_secure_rpc_functions.sql`
3. **Verificar**: Ejecutar `supabase/migrations/20250112000001_test_rpc_functions.sql`

### Paso 2: Verificar Funciones

```sql
-- Verificar que las funciones existen
SELECT routine_name, security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'create_competitor_pair',
    'increment_kit_sold_quantity',
    'update_competitor_pair_id'
  );
```

### Paso 3: Probar en Desarrollo

1. **Probar registro individual**:
   - Abrir formulario de registro
   - Completar datos
   - Verificar que se registra correctamente
   - Verificar que el kit se incrementa

2. **Probar registro de pareja**:
   - Seleccionar categoría de parejas
   - Completar datos del primer competidor
   - Completar datos del segundo competidor
   - Verificar que se crea el pair
   - Verificar que ambos competidores tienen el mismo pair_id

3. **Probar errores**:
   - Intentar registrar con email duplicado
   - Intentar registrar en evento lleno
   - Intentar crear pair con competidores de diferentes eventos

---

## 🔍 Validaciones Implementadas

### create_competitor_pair

| Validación | Propósito |
|------------|-----------|
| Evento existe y está publicado | Prevenir registros en eventos no disponibles |
| Competidores existen | Prevenir referencias inválidas |
| Competidores pertenecen al evento | Prevenir asociaciones incorrectas |
| Competidores son diferentes | Prevenir pairs inválidos |
| Competidores no tienen pair_id | Prevenir duplicados |
| No existe pair previo | Prevenir duplicados |

### increment_kit_sold_quantity

| Validación | Propósito |
|------------|-----------|
| Kit existe | Prevenir referencias inválidas |
| Kit pertenece al evento | Prevenir asociaciones incorrectas |
| Evento está publicado | Prevenir operaciones en eventos no disponibles |
| Cantidad positiva | Prevenir valores inválidos |
| No excede max_quantity | Prevenir sobreventa |
| Operación atómica | Prevenir race conditions |

---

## 🧪 Casos de Prueba

### Caso 1: Registro Individual Exitoso
```
1. Usuario completa formulario
2. Selecciona kit
3. Envía formulario
4. ✅ Competidor se inserta
5. ✅ Kit se incrementa
```

### Caso 2: Registro de Pareja Exitoso
```
1. Usuario selecciona categoría de parejas
2. Completa datos competidor 1
3. Completa datos competidor 2
4. Envía formulario
5. ✅ Ambos competidores se insertan
6. ✅ Pair se crea
7. ✅ Ambos competidores tienen pair_id
8. ✅ Kit se incrementa 2 veces
```

### Caso 3: Error - Email Duplicado
```
1. Usuario intenta registrarse con email ya usado
2. ✅ Función RPC rechaza el registro
3. ✅ Mensaje de error claro
```

### Caso 4: Error - Evento Lleno
```
1. Usuario intenta registrarse en evento con max_competitors alcanzado
2. ✅ Función RPC rechaza el registro
3. ✅ Mensaje de error claro
```

### Caso 5: Error - Kit Excedido
```
1. Usuario intenta registrar con kit que ya alcanzó max_quantity
2. ✅ Función RPC rechaza el incremento
3. ✅ Mensaje de error claro
```

---

## 📊 Comparación: Antes vs. Después

### Antes (Inseguro)
```typescript
// ❌ INSERT directo - sin validaciones del servidor
await supabase.from('competitor_pairs').insert([{...}]);

// ❌ UPDATE directo - puede modificar cualquier registro
await supabase.from('competitors').update({ pair_id: ... });

// ❌ UPDATE con race condition
const kit = await supabase.from('kits').select('sold_quantity').single();
await supabase.from('kits').update({ sold_quantity: kit.sold_quantity + 1 });
```

**Problemas**:
- ❌ Sin validaciones del servidor
- ❌ Race conditions
- ❌ Depende completamente de RLS
- ❌ Puede dejar datos inconsistentes

### Después (Seguro)
```typescript
// ✅ Función RPC con validaciones completas
await supabase.rpc('create_competitor_pair', {...});

// ✅ Función RPC atómica
await supabase.rpc('increment_kit_sold_quantity', {...});
```

**Ventajas**:
- ✅ Validaciones en el servidor
- ✅ Operaciones atómicas
- ✅ No depende solo de RLS
- ✅ Transacciones (rollback automático)

---

## 🔒 Mejoras de Seguridad

### 1. Validaciones del Servidor
- ✅ No pueden ser bypasseadas desde el cliente
- ✅ Ejecutan siempre, incluso si el cliente está comprometido

### 2. Operaciones Atómicas
- ✅ No hay race conditions
- ✅ No hay estados inconsistentes

### 3. Transacciones
- ✅ Si algo falla, se hace rollback automático
- ✅ No deja datos parciales

### 4. Mensajes de Error Descriptivos
- ✅ Facilitan debugging
- ✅ No exponen información sensible

---

## 📝 Notas de Implementación

### Cambios en RegistrationModal.tsx

**Línea ~980**: Reemplazado INSERT directo de competitor_pairs
```typescript
// ANTES
await supabase.from('competitor_pairs').insert([{...}]);

// DESPUÉS
await supabase.rpc('create_competitor_pair', {...});
```

**Línea ~994**: Eliminado UPDATE directo (ahora lo hace la función RPC)
```typescript
// ANTES
await supabase.from('competitors').update({ pair_id: ... });

// DESPUÉS
// Ya no necesario, create_competitor_pair lo hace automáticamente
```

**Líneas ~1012, 1029**: Reemplazado UPDATE directo de kits
```typescript
// ANTES
const kit = await supabase.from('kits').select('sold_quantity').single();
await supabase.from('kits').update({ sold_quantity: kit.sold_quantity + 1 });

// DESPUÉS
await supabase.rpc('increment_kit_sold_quantity', {
  p_kit_id: selectedKitId,
  p_event_id: eventId,
  p_quantity: 1
});
```

---

## ✅ Checklist de Verificación

### Pre-Producción
- [ ] Funciones RPC creadas en Supabase
- [ ] Permisos configurados (anon, authenticated)
- [ ] Código TypeScript actualizado
- [ ] Tests básicos ejecutados
- [ ] Registro individual funciona
- [ ] Registro de parejas funciona
- [ ] Incremento de kits funciona
- [ ] Errores se manejan correctamente
- [ ] RLS configurado (ejecutar `scripts/check-rls.sql`)

### Post-Implementación
- [ ] Monitorear logs de errores
- [ ] Verificar que no hay regresiones
- [ ] Documentar cualquier problema encontrado

---

## 🐛 Troubleshooting

### Error: "function does not exist"
**Solución**: Verificar que la migración SQL se ejecutó correctamente

### Error: "permission denied"
**Solución**: Verificar que los permisos GRANT se ejecutaron

### Error: "Evento no encontrado"
**Solución**: Verificar que el evento existe y está publicado

### Error: "Competidor ya está en una pareja"
**Solución**: Verificar que el competidor no tiene pair_id previo

---

## 📚 Referencias

- Ver `RPC_FUNCTIONS_DOCUMENTATION.md` para documentación completa
- Ver `supabase/migrations/20250112000000_create_secure_rpc_functions.sql` para código SQL
- Ver `src/components/RegistrationModal.tsx` para implementación TypeScript


