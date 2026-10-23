# ADR 0002: `PUT` parcial con una sola sentencia `UPDATE`

- **Estado:** aceptada
- **Fecha:** 2026-10-23

## Contexto

El enunciado nombra `PUT /api/tasks/:id` para editar. La interfaz necesita marcar una tarea como completada sin reenviar el título y la descripción, y en el futuro podrá editar un solo campo a la vez. En REST estricto, `PUT` reemplaza el recurso completo y la actualización parcial es `PATCH`.

Para el SQL había dos caminos: armar el `UPDATE` con texto según los campos recibidos, o una sentencia fija que sirva para cualquier combinación.

## Decisión

- Se conserva el método del enunciado, **`PUT`, con semántica parcial**: acepta cualquier combinación de campos (al menos uno) y no cambia los que no recibe. El esquema `updateTaskSchema` (`backend/src/validation/tasks.ts`) declara cada campo como opcional y rechaza un cuerpo vacío.
- El SQL es **una sola sentencia fija** con `COALESCE` (`updateTask` en `backend/src/db/tasks.ts`): cada campo que no llega se envía como `null` y `COALESCE($n, columna)` deja el valor actual.

```sql
UPDATE tasks
   SET title = COALESCE($2, title),
       description = COALESCE($3, description),
       completed = COALESCE($4, completed)
 WHERE id = $1
RETURNING ...
```

## Consecuencias

- Nunca se arma SQL con texto: la sentencia se revisa una vez y todos los valores viajan como parámetros.
- Agregar un campo editable es una línea más en el `SET` y un parámetro más ([cómo agregar un campo](../adding-a-field.md#4-sql-de-express)).
- **Límite: no sirve para campos que admiten `null`.** Con `COALESCE` no se puede distinguir «no enviado» de «enviado como `null`», así que un campo opcional que el usuario quiera vaciar (una fecha límite, un responsable) no se podría borrar. Las columnas actuales son todas `NOT NULL`. Si aparece una que admita `null`, hay dos salidas:
  - enviar junto al valor un indicador de «este campo llegó» y usar `CASE WHEN <indicador> THEN <valor> ELSE columna END` para esa columna;
  - o representar «sin valor» con algo que no sea `null` (por ejemplo, cadena vacía para texto, como `description`).

  Cualquiera de las dos se registra en un ADR nuevo cuando se tome.
- Quien lea la API esperando `PUT` de reemplazo completo puede sorprenderse: [`api.md`](../api.md) lo documenta en la fila del endpoint.
