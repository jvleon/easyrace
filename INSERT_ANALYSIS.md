# Análisis del INSERT de Competidores

## ✅ Lo que está BIEN

### 1. INSERT de Competidores Individuales
**Ubicación**: `src/components/RegistrationModal.tsx` línea 909

```typescript
// ✅ CORRECTO: Usa función RPC
const { data: insertedData, error } = await supabase.rpc('insert_competitor', {
  competitor_data: competitorData
});
```

**Por qué está bien**:
- ✅ Usa función RPC (`insert_competitor`)
- ✅ La función ejecuta en el servidor (no en el cliente)
- ✅ Puede tener validaciones complejas
- ✅ Más seguro que INSERT directo

---

## ⚠️ Lo que necesita MEJORARSE

### 2. INSERT de Competitor Pairs
**Ubicación**: `src/components/RegistrationModal.tsx` línea 980-989

```typescript
// ⚠️ PROBLEMA: INSERT directo sin función RPC
const { data: pairData, error: pairRelationError } = await supabase
  .from('competitor_pairs')
  .insert([{
    event_id: eventId,
    competitor_1_id: competitor1Id,
    competitor_2_id: competitor2Id,
    payment_confirmed: false,
  }])
  .select()
  .single();
```

**Problemas**:
- ⚠️ INSERT directo desde cliente
- ⚠️ No hay validación de que los competidores pertenezcan al mismo evento
- ⚠️ No hay validación de que los competidores existan
- ⚠️ Depende completamente de RLS (que puede no estar configurado)

**Solución recomendada**:
```typescript
// ✅ MEJOR: Usar función RPC
const { data: pairData, error: pairRelationError } = await supabase.rpc('create_competitor_pair', {
  event_id: eventId,
  competitor_1_id: competitor1Id,
  competitor_2_id: competitor2Id
});
```

---

### 3. UPDATE de Competitors (pair_id)
**Ubicación**: `src/components/RegistrationModal.tsx` línea 994-997

```typescript
// ⚠️ PROBLEMA: UPDATE directo desde cliente
const { error: updatePairIdError } = await supabase
  .from('competitors')
  .update({ pair_id: pairData.id })
  .in('id', [competitor1Id, competitor2Id]);
```

**Problemas**:
- ⚠️ UPDATE directo desde cliente anónimo
- ⚠️ Cualquiera podría actualizar cualquier competidor si RLS no está bien configurado
- ⚠️ No valida que los competidores pertenezcan al mismo evento

**Solución recomendada**:
```typescript
// ✅ MEJOR: Incluir en la función RPC create_competitor_pair
// La función RPC puede hacer el UPDATE internamente con permisos elevados
```

---

### 4. UPDATE de Kits (sold_quantity)
**Ubicación**: `src/components/RegistrationModal.tsx` líneas 1012, 1029

```typescript
// ⚠️ PROBLEMA: UPDATE directo desde cliente
await supabase
  .from('kits')
  .update({ sold_quantity: (kitData.sold_quantity || 0) + 1 })
  .eq('id', selectedKitId);
```

**Problemas**:
- ⚠️ UPDATE directo desde cliente anónimo
- ⚠️ Race condition: Dos usuarios podrían incrementar al mismo tiempo
- ⚠️ No es atómico (SELECT + UPDATE = 2 operaciones)

**Solución recomendada**:
```sql
-- ✅ MEJOR: Usar función RPC con UPDATE atómico
CREATE FUNCTION increment_kit_sold_quantity(kit_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE kits
  SET sold_quantity = sold_quantity + 1
  WHERE id = kit_id;
END;
$$;
```

O mejor aún, hacerlo dentro de `insert_competitor`:
```sql
-- En la función insert_competitor, después de insertar:
IF competitor_data->>'kit_id' IS NOT NULL THEN
  UPDATE kits
  SET sold_quantity = sold_quantity + 1
  WHERE id = (competitor_data->>'kit_id')::uuid;
END IF;
```

---

## 📊 Resumen

| Operación | Método Actual | Estado | Recomendación |
|-----------|---------------|--------|---------------|
| INSERT competitor | `supabase.rpc('insert_competitor')` | ✅ BIEN | Mantener |
| INSERT competitor_pairs | `.insert()` directo | ⚠️ MEJORAR | Crear función RPC |
| UPDATE competitors (pair_id) | `.update()` directo | ⚠️ MEJORAR | Incluir en función RPC |
| UPDATE kits (sold_quantity) | `.update()` directo | ⚠️ MEJORAR | Incluir en función RPC o crear función separada |

---

## 🔒 Impacto en Seguridad

### Con RLS bien configurado:
- ✅ INSERT de competitors: Seguro (función RPC)
- ⚠️ INSERT de pairs: Depende de RLS (menos seguro)
- ⚠️ UPDATE de competitors: Depende de RLS (menos seguro)
- ⚠️ UPDATE de kits: Depende de RLS (menos seguro)

### Sin RLS o RLS mal configurado:
- ❌ INSERT de pairs: Cualquiera puede crear pairs falsos
- ❌ UPDATE de competitors: Cualquiera puede modificar cualquier competidor
- ❌ UPDATE de kits: Cualquiera puede modificar contadores

---

## 🎯 Recomendación Final

**Opción 1: Mejorar funciones RPC (RECOMENDADO)**
1. Modificar `insert_competitor` para que también:
   - Cree el pair si es categoría de parejas
   - Actualice el pair_id en ambos competidores
   - Incremente sold_quantity del kit

**Opción 2: Crear funciones RPC adicionales**
1. `create_competitor_pair()` - Para crear pairs
2. `increment_kit_sold_quantity()` - Para incrementar contadores

**Opción 3: Configurar RLS muy restrictivo**
- Permitir INSERT/UPDATE solo con validaciones estrictas
- Menos seguro que funciones RPC, pero mejor que nada

---

## 📝 Próximos Pasos

1. ✅ Verificar que `insert_competitor` tiene todas las validaciones necesarias
2. ⚠️ Crear función RPC para `create_competitor_pair`
3. ⚠️ Mover lógica de UPDATE a funciones RPC
4. ⚠️ Mover lógica de kits a función RPC o dentro de `insert_competitor`




