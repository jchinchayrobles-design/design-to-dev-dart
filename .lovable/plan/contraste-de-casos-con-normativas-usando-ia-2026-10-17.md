# Contraste de casos con normativas usando IA

## Qué podrá hacer el consultor
1. En Biblioteca, al subir un archivo, marcarlo como **Normativa** o **Caso** (se puede cambiar después).
2. En Consultor, elegir uno o varios **casos** y las **normativas** a aplicar (por defecto todas las normativas guardadas), y pulsar "Contrastar".
3. Ver el progreso real (lectura de documentos → búsqueda de normas → contraste → dictamen) con la animación existente.
4. Recibir hallazgos: por cada hecho del caso, estado (Cumple / Riesgo / Requiere excepción / Sin evidencia suficiente), la norma aplicable y **citas textuales** con documento y página/sección, enlazadas a la ficha del documento.
5. Consultar el historial de contrastes realizados y reabrir cualquiera.
6. Preguntas libres (sin caso) también responden solo con citas de las normativas guardadas; si no hay sustento, lo dice.
7. Validaciones deja de estar vacía: lista los hallazgos de riesgo/excepción de los contrastes guardados.

## Reglas de honestidad
- Toda cita se verifica contra el texto extraído del documento; si la IA cita algo que no aparece, se descarta y se marca "cita no verificada".
- Sin normativas guardadas, no se ejecuta el contraste.
- Archivos que no se pueden leer (imágenes escaneadas, formatos no soportados) se avisan y no se inventa contenido.
- No se infiere vigencia automáticamente.

## Detalles técnicos
- **Base de datos** (migración): `documents` añade `kind` ('caso'|'normativa'), `extracted_text`, `extraction_status`; nuevas tablas `contrasts` (pregunta, documentos usados, resumen, estado) y `contrast_findings` (hecho, estado, regla, cita, documento, ubicación, verificada). RLS por propietario + GRANTs.
- **Extracción de texto** (server function autenticada): PDF y Word/Excel/TXT se convierten a texto tras subir; PDF y documentos se envían al modelo como entrada de archivo cuando la extracción local no sea posible (compatible con Workers).
- **Contraste** (server function con `requireSupabaseAuth`): carga los textos del usuario, llama al AI Gateway por `/v1/responses` con `openai/gpt-6-astra`, salida estructurada estricta (json_schema) con hallazgos y citas, streaming consumido en servidor; verifica citas por coincidencia de texto; guarda en `contrasts`/`contrast_findings`. Manejo de 402/429/403 con mensajes claros.
- **Servicios**: `askQuestion`, `runValidations`, `getProcessingStatus` implementados en `src/services`; nuevos `setDocumentKind`, `listContrasts`, `getContrast`. La interfaz sigue llamando solo a `services`.
- `src/start.ts`: registrar middleware que adjunta el token de sesión.
- Pruebas: verificación de citas y mapeo de estados en `src/lib/domain`.
- Verificación final real: subir una normativa y un caso, contrastar, y confirmar hallazgos con citas.
