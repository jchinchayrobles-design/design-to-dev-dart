# Nueva estructura de respuesta del análisis de casos

Tomo del HTML solo la forma de presentar el resultado (sin su pantalla de carga ni sus datos de ejemplo) y la adapto al estilo actual del Consultor, simplificada para que se lea rápido y sirva para actuar.

## Cómo se verá el resultado (de arriba hacia abajo)

1. **Encabezado del caso**: nombre de los archivos analizados, fecha y una etiqueta de estado general (Sin observaciones / Requiere atención / Evidencia insuficiente).
2. **Conclusión en una frase** + 2–3 líneas de resumen. Debajo, un contador: X cumple · Y riesgos · Z requieren excepción · W sin evidencia. Al pulsar un contador se filtra la lista.
3. **Acciones prioritarias**: lista corta y numerada de lo que el gestor debe hacer, ordenada por gravedad (riesgos primero). Cada acción enlaza a su hallazgo.
4. **Hallazgos** (tarjeta por punto, riesgos arriba). Cada tarjeta responde siempre a las mismas cuatro preguntas del HTML, en este orden:
   - **Qué dice el caso** (dato observado)
   - **Qué exige la norma** (requisito esperado) + cita literal verificada con documento y página/sección
   - **Diferencia encontrada** (por qué cumple o no)
   - **Qué hacer** (corrección o siguiente paso)
   - Si falta información: **Qué falta para concluir** (documento o dato a aportar).
   Las tarjetas que cumplen se muestran plegadas para no distraer.
5. **Información faltante**: lista consolidada de lo que hay que aportar para cerrar el caso.
6. **Normativa usada**: documentos consultados con enlace a su ficha; la vigencia aparece como "pendiente de validación" (no se infiere).
7. Advertencias (texto truncado, citas no verificadas) al final, breves.

Mejoras respecto al HTML: sin tablas anchas repetidas ni pestañas; una sola tarjeta por hallazgo con etiquetas fijas; acciones arriba en vez de al final; se quitan textos de demostración.

## Reglas que se mantienen
- Toda cita se comprueba literalmente; si no aparece, el hallazgo pasa a "Sin evidencia suficiente" y no muestra conclusión.
- Contrastes antiguos (sin los campos nuevos) siguen abriéndose: los campos ausentes simplemente no se muestran.
- Preguntas sin caso usan la misma estructura (el "dato del caso" pasa a ser "punto consultado").

## Detalles técnicos
- `contrast.functions.ts`: ampliar el json_schema estricto con `conclusion`, `actions[]` (texto, prioridad, índice de hallazgo), `missing_info[]`, y por hallazgo `observed`, `expected`, `gap`, `action`, `missing` (nullable). Ajustar instrucciones del prompt. Mismo modelo y llamada.
- Migración: columnas nullable en `contrasts` (`conclusion`, `actions jsonb`, `missing_info jsonb`) y `contrast_findings` (`observed`, `expected`, `gap`, `action`, `missing`).
- `types.ts` / `services`: mapear los campos nuevos como opcionales.
- `src/routes/index.tsx`: reemplazar `AnswerView`/`ContrastView` por la nueva composición (componentes en `src/components/hz/contrast/`), con tokens existentes.
- Prueba pura en `src/lib/domain` para orden por gravedad y conteo por estado.
- Verificación: ejecutar un contraste real con los documentos del usuario y revisar la pantalla.
