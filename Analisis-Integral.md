# 📝 Análisis Integral: `pulpa.work`

*Última actualización: 29 de junio de 2025, 20:06:24 (GMT-3)*

---

## 🚀 1. Visión General y Arquitectura

*   **Proyecto:** `pulpa.work`, una aplicación web para la autorreflexión guiada por voz.
*   **Concepto:** Un "entrevistador estoico" de IA que ayuda al usuario a profundizar en sus pensamientos a través de un diálogo hablado.
*   **Stack Tecnológico:**
    *   **💻 Frontend:** React, TypeScript, Vite, TailwindCSS.
    *   **☁️ Backend & DB:** Supabase (PostgreSQL, Auth, Edge Functions en Deno/TypeScript).
    *   **🤖 Servicios IA:** Google Cloud STT, Google Gemini Pro, ElevenLabs.

### 🔄 Flujo Principal del Usuario

1.  **Hablar:** El usuario graba su voz en el navegador.
2.  **Transcribir:** El audio se envía a la Edge Function `transcribe` (Google STT).
3.  **Pensar:** El texto transcrito se envía a `chat-ai` (Google Gemini Pro) para generar una pregunta.
4.  **Sintetizar:** La respuesta de la IA se envía a `text-to-speech` (ElevenLabs).
5.  **Escuchar:** El audio resultante se reproduce al usuario.
6.  El ciclo se repite.

---

## 🗃️ 2. Base de Datos (`DB_SCHEMA.md`)

La estructura de la base de datos ha sido normalizada y optimizada para la nueva arquitectura.

*   **Tablas Activas:**
    *   `profiles`: Almacena datos del perfil del usuario, extendiendo `auth.users`.
    *   `conversations`: Registra cada sesión de conversación.
    *   `messages`: Guarda cada mensaje individual (`user` o `model`) con su correspondiente `embedding`.
*   **Tabla Obsoleta:**
    *   `reflections_old`: Una tabla de una versión anterior que ha sido reemplazada y está pendiente de eliminación.
*   **Lógica Central:** La inserción de datos se centraliza en la función de base de datos `insert_message_with_embedding`, que es llamada por la Edge Function `add-message`. Este enfoque reemplaza al antiguo sistema de triggers, mejorando la atomicidad y la fiabilidad.
*   **Seguridad:** La seguridad se garantiza mediante políticas de RLS (Row Level Security) que aseguran que los usuarios solo puedan acceder a sus propios datos.

---

## 💻 3. Frontend (`src/`)

*   **Punto de Entrada:** `main.tsx` -> Renderiza `<App />`.
*   **Cliente Supabase:** `supabaseClient.ts` -> Inicializa el cliente con variables de entorno.
*   **Componente Principal:** `App.tsx`
    *   **Rol:** Mayormente presentacional. Delega la lógica.
    *   **Lógica:** Consume el hook `useAppLogic`.
    *   **Renderizado Condicional:** Muestra `Login/Signup`, el `OnboardingFlow` o la interfaz principal según el estado de autenticación y el campo `onboarding_completed` del perfil.
    *   **Gestión de Estado con Zustand:** El flujo de onboarding utiliza su propio store de Zustand (`stores/onboardingStore.ts`) para gestionar el estado de los pasos, los datos del perfil y las selecciones del usuario. Esto desacopla completamente el flujo del componente `App.tsx`, haciéndolo más modular y mantenible.

*   **Flujo de Onboarding:** `components/OnboardingFlow.tsx`
    *   **Rol:** Un componente autónomo que guía al usuario a través de una serie de pasos para configurar su perfil.
    *   **Lógica:** Consume el hook `useOnboardingStore` para leer y actualizar el estado del onboarding. Al finalizar, invoca una única función `onOnboardingComplete` pasada como prop desde `App.tsx`.
    *   **UI:** Utiliza el componente `ModalPanel` para presentar el flujo dentro de una ventana modal unificada.

*   **Explorador de Recuerdos:** `components/MemoryLane.tsx`
    *   **Rol:** Permite a los usuarios navegar, leer y buscar en sus reflexiones pasadas.
    *   **UI:** Utiliza `ModalPanel` para mostrar tanto la lista de conversaciones como el detalle de una reflexión seleccionada.

*   **Patrón de UI Reutilizable:** `components/ui/ModalPanel.tsx`
    *   **Rol:** Un componente de presentación que encapsula la apariencia y el comportamiento de todos los modales de la aplicación.
    *   **Props:** Acepta `title`, `onClose`, y `children` para renderizar contenido dinámico dentro de un marco de modal consistente y con estilo (glassmorphism).
*   **🧠 Orquestador del Frontend:** `hooks/useAppLogic.ts`
    *   **Rol Post-Refactorización:** Actúa como un **orquestador central** que integra diferentes piezas de la lógica de la aplicación, en lugar de contenerla toda.
    *   **Responsabilidades Principales:**
        *   Gestiona el estado complejo de la grabación y la conversación (`recordingState`, `conversationHistory`).
        *   Orquesta el ciclo de vida de la grabación de audio usando `MediaRecorder`.
        *   Coordina las llamadas al backend a través de la capa de servicios.
    *   **Colaboradores:**
        *   **`hooks/useAuth.ts`:** Consume este hook para toda la lógica de autenticación. `useAppLogic` ya no maneja directamente el login, signup o logout, sino que expone los métodos y el estado de `useAuth`.
        *   **`services/api.ts`:** Delega todas las llamadas a las Edge Functions (`transcribe`, `chat-ai`, `text-to-speech`) a este servicio, manteniendo el hook libre de la implementación directa de `fetch` o `supabase.functions.invoke`.

---

### 🧠 Flujo de Datos Detallado: Arquitectura Centrada en Backend

El flujo de datos ha sido refactorizado para centralizar la lógica de negocio en el backend, haciendo el frontend más ligero y la aplicación más robusta.

**Fase 1: Grabación y Transcripción (Frontend → Google STT)**
1.  **Grabación:** El hook `useAppLogic` gestiona la grabación de audio en el cliente.
2.  **Orquestación de Transcripción:** Al detener la grabación, el `Blob` de audio se envía a la capa de servicios (`services/api.ts`), que llama a las Edge Functions `/transcribe` y `/get-transcription-status` para obtener el texto final.

**Fase 2: Persistencia Centralizada (Frontend → Supabase)**
1.  **Disparador:** El frontend tiene un texto que necesita ser guardado (ya sea la transcripción del usuario o la respuesta de la IA).
2.  **Llamada Única:** Se invoca la Edge Function `add-message`, pasándole el `conversation_id`, el `text` y el `role` (`'user'` o `'model'`).
3.  **Lógica de `add-message`:**
    *   Valida al usuario.
    *   Invoca la función `generate-embedding` para vectorizar el texto.
    *   Invoca la función de base de datos `insert_message_with_embedding` (RPC) para guardar el mensaje y su embedding de forma atómica.

**Fase 3: Generación de Respuesta (Frontend → Google Gemini)**
1.  **Disparador:** La llamada a `add-message` para el mensaje del usuario finaliza con éxito.
2.  **Llamada a la IA:** El frontend llama a la Edge Function `chat-ai` con el historial de la conversación para obtener la respuesta del modelo.

**Fase 4: Persistencia y Síntesis de Voz (Frontend → Supabase → ElevenLabs)**
1.  **Guardado de Respuesta IA:** Al recibir la respuesta de `chat-ai`, el frontend vuelve a ejecutar la **Fase 2**, esta vez con `role: 'model'`.
2.  **Síntesis de Voz:** Una vez que la respuesta de la IA se ha guardado, el frontend llama a la Edge Function `text-to-speech` para convertir el texto en audio y reproducirlo.

Este nuevo flujo asegura que cada mensaje tenga un embedding y se guarde de forma transaccional antes de continuar, eliminando la responsabilidad del frontend de escribir directamente en la base de datos.

---

## ☁️ 4. Backend (Supabase Edge Functions)

### `transcribe/index.ts` (Inicio de Transcripción Asíncrona)
*   **Responsabilidad:** Iniciar un trabajo de transcripción para audios de larga duración sin causar timeouts.
*   **Flujo de Trabajo:**
    1.  Recibe el audio del cliente.
    2.  Lo sube a un bucket privado en **Google Cloud Storage (GCS)**.
    3.  Inicia un trabajo de reconocimiento de larga duración en la API de **Google Cloud Speech-to-Text**.
    4.  **Respuesta Inmediata (HTTP 202 Accepted):** Devuelve al cliente un `operationName` y el `gcsFileName` para que pueda consultar el estado más tarde. No espera el resultado.
*   **🛡️ Autenticación:** Doble capa (JWT de Supabase + Token de servicio de Google).

### `get-transcription-status/index.ts` (Nueva Función)
*   **Responsabilidad:** Consultar el estado de un trabajo de transcripción y devolver el resultado final.
*   **Flujo de Trabajo:**
    1.  Recibe el `operationName` y `gcsFileName` de la función `transcribe`.
    2.  Consulta la API de Google para verificar si el trabajo ha finalizado.
    3.  **Si está completado:**
        *   Extrae el texto transcrito.
        *   **Elimina el archivo de audio de GCS** para ahorrar costos.
        *   Devuelve el `transcript` al cliente.
    4.  **Si no está completado:** Devuelve un estado `done: false` para que el cliente pueda reintentar.
*   **🛡️ Autenticación:** Doble capa (JWT de Supabase + Token de servicio de Google).

### `chat-ai/index.ts`
*   **Responsabilidad:** Generar respuestas de IA manteniendo el contexto de la conversación.
*   **Integración:** Google Gemini Pro.
*   **Lógica Clave y Mejoras:**
    *   **Contexto Persistente:** Utiliza el campo `systemInstruction` de la API de Gemini para proporcionar el prompt del sistema. Esto asegura que la IA mantenga su personalidad y contexto a lo largo de toda la conversación, solucionando la "amnesia" anterior.
    *   **Prompt Suavizado:** El prompt del sistema fue reescrito para ser una guía sutil en lugar de un guion estricto, resultando en interacciones más naturales.
    *   **Validación de Payload:** Filtra mensajes vacíos del historial de conversación para prevenir errores `400 Bad Request` de la API.
    *   **Longitud de Respuesta Flexible:** El prompt del sistema fue ajustado para que la IA genere respuestas breves por defecto, pero pueda extenderse hasta ~1500 caracteres si el tema lo requiere, optimizando el balance entre agilidad y coste.
*   **🛡️ Autenticación:** Doble capa (JWT de Supabase + `GOOGLE_API_KEY`).

### `text-to-speech/index.ts`
*   **Responsabilidad:** Convertir texto a audio.
*   **Integración:** ElevenLabs.
*   **Lógica Clave y Mejoras:**
    *   Selecciona una voz específica según el `languageCode`.
    *   **Solución a Corrupción de Audio:** Para solucionar el problema de audios que se cortaban, la función ahora lee el stream de audio de ElevenLabs en *chunks*, los ensambla en un `Uint8Array` completo y finalmente usa la función `encode` de la librería estándar de Deno para una conversión a **Base64** robusta y segura. Esto elimina la corrupción de datos y asegura una reproducción completa.
*   **🛡️ Autenticación:** Doble capa.
    1.  **Cliente:** Requiere JWT de usuario de Supabase (`verify_jwt: true`).
    2.  **Servidor:** Usa la `ELEVENLABS_API_KEY`.

### `_shared/` (Código Modularizado)
*   **Rol:** Un nuevo directorio que centraliza la lógica reutilizable para interactuar con las APIs de Google, siguiendo el principio **DRY (Don't Repeat Yourself)**.
*   **Contenido:**
    *   `google-helpers.ts`: Funciones para autenticación (JWT, Access Token), gestión de archivos en GCS (subir, borrar) y comunicación con la API de Speech-to-Text (iniciar trabajo, obtener resultado).
    *   `types.ts`: Interfaces de TypeScript compartidas para los objetos de Google, asegurando consistencia de tipos en todo el backend.

---

## ⚙️ 5. Configuración del Proyecto

*   `supabase/config.toml`: Configuración del proyecto Supabase local.
*   `supabase/functions/**/deno.json`: Cada Edge Function tiene su propio archivo `deno.json` para gestionar dependencias y configuración de Deno.
*   **Archivo Obsoleto:** `supabase/functions/import_map.json` - Este archivo es un remanente de un sistema de importación anterior y ya no es utilizado por las Edge Functions. Se recomienda su eliminación para evitar confusiones.
*   `package.json`: Dependencias y scripts del frontend.
*   `*.config.js/ts`: Archivos de configuración para Vite, Tailwind, PostCSS, y ESLint.

---

## 🏛️ 6. Decisiones de Diseño y Patrones

*   **Arquitectura de Microservicios Ligeros:** Cada tarea de backend está aislada en su propia Edge Function, facilitando el mantenimiento.
*   **🛡️ Seguridad Robusta y Uniforme:**
    *   **Autenticación de Cliente Obligatoria:** Todas las funciones principales están protegidas por `verify_jwt: true`, exigiendo un token de usuario válido.
    *   **Aislamiento de Claves:** Las credenciales de servicios externos **nunca** se exponen en el frontend.
    *   **Autenticación Servidor-Servidor:** Se usan métodos seguros para la comunicación entre el backend y las APIs de IA.
*   **Frontend Desacoplado:** La UI (`App.tsx`) está separada de la lógica de negocio (`useAppLogic.ts`).
*   **Soporte Multilenguaje:** El `languageCode` se propaga a través de todo el flujo para una experiencia coherente.
*   **Manejo de Estado Centralizado:** El hook `useAppLogic` actúa como un "cerebro" central, simplificando la gestión del estado de la aplicación.

---

## 🔬 7. Análisis Detallado de Edge Functions

Esta sección desglosa la lógica interna de cada Edge Function desplegada en el proyecto.

### **Función: `transcribe`**

**Propósito:** Iniciar de forma asíncrona un trabajo de transcripción de audio de larga duración.

1.  **Recepción y CORS:** La función se activa con una petición `POST`. Primero gestiona las peticiones `OPTIONS` para el pre-vuelo de CORS.
2.  **Carga de Secretos:** Obtiene las credenciales de la cuenta de servicio de Google (`GOOGLE_SERVICE_ACCOUNT_CREDENTIALS`) y el nombre del bucket de Google Cloud Storage (`GCS_BUCKET_NAME`) desde las variables de entorno.
3.  **Parseo de Petición:** Lee el cuerpo de la petición JSON, esperando un objeto que contenga el audio en formato Base64 (`audioContent`) y parámetros opcionales como `languageCode`.
4.  **Autenticación con Google:** Utiliza las credenciales para obtener un token de acceso de corta duración de Google Cloud, con permisos para la plataforma (`cloud-platform`).
5.  **Subida a Google Cloud Storage (GCS):** Genera un nombre de archivo único para el audio y lo sube al bucket de GCS especificado.
6.  **Inicio de Transcripción:** Llama a la API de Google Speech-to-Text para iniciar un trabajo de reconocimiento de larga duración (`long-running recognition`), pasándole la URI del archivo recién subido a GCS.
7.  **Respuesta Inmediata (202 Accepted):** En lugar de esperar a que la transcripción termine, la función responde inmediatamente al cliente con un estado `202 Accepted`, devolviendo el `operationName` del trabajo de transcripción y el `gcsFileName`. Esto permite al cliente consultar el estado más tarde sin sufrir timeouts.

### **Función: `get-transcription-status`**

**Propósito:** Consultar el estado de un trabajo de transcripción asíncrono y devolver el resultado cuando esté listo.

1.  **Recepción y CORS:** Maneja peticiones `POST` y `OPTIONS` para CORS.
2.  **Carga de Secretos y Petición:** Obtiene las credenciales de Google y el nombre del bucket de GCS. Espera un `operationName` y un `gcsFileName` en el cuerpo de la petición.
3.  **Autenticación con Google:** Obtiene un token de acceso de Google Cloud, al igual que la función `transcribe`.
4.  **Consulta de Estado:** Llama a la API de Google para obtener el estado de la operación de larga duración identificada por el `operationName`.
5.  **Manejo de Estado "En Progreso":** Si la operación aún no ha terminado (`done: false`), la función devuelve una respuesta inmediata indicando que el trabajo sigue en progreso, para que el cliente pueda volver a consultar más tarde.
6.  **Procesamiento del Resultado Final:** Si la operación ha terminado (`done: true`):
    *   Verifica si hubo un error en la operación de Google y lo lanza si existe.
    *   Si fue exitosa, extrae y concatena los fragmentos de texto transcrito del resultado.
7.  **Limpieza y Respuesta Final:**
    *   Llama a la API de Google Cloud Storage para **eliminar el archivo de audio original** del bucket, ahorrando costos de almacenamiento.
    *   Devuelve una respuesta `200 OK` al cliente con el `transcript` final.

### **Función: `chat-ai`**

**Propósito:** Generar una respuesta de IA coherente y contextual, actuando como el "cerebro" de la conversación.

1.  **Recepción y CORS:** Maneja peticiones `POST` y `OPTIONS`.
2.  **Carga de Secretos:** Obtiene la `GOOGLE_API_KEY` desde las variables de entorno.
3.  **Parseo de Petición:** Lee el cuerpo de la petición, esperando un `userMessage`, un `conversationHistory` opcional, un `languageCode` y un `userProfile` opcional (con `fullName` y `role`).
4.  **Construcción del Prompt del Sistema:**
    *   Crea un `systemInstruction` persistente para la API de Gemini.
    *   Este prompt establece la personalidad de la IA ("entrevistador estoico y empático") y le proporciona el nombre y el rol del usuario para dar contexto a la conversación.
    *   Incluye directivas sobre la longitud de la respuesta (breve por defecto, pero flexible si es necesario).
5.  **Preparación del Historial:**
    *   Filtra el `conversationHistory` para eliminar mensajes vacíos o inválidos.
    *   Mapea el historial al formato que espera la API de Gemini (`{role: 'user' | 'model', parts: [...]}`).
    *   Añade el `userMessage` actual al final del historial.
6.  **Llamada a la API de Gemini:**
    *   Construye el cuerpo de la petición final, incluyendo el historial (`contents`), el prompt del sistema (`systemInstruction`) y la configuración de generación (`temperature`, `maxOutputTokens`, etc.).
    *   Llama al endpoint `generateContent` del modelo `gemini-1.5-flash`.
7.  **Procesamiento y Respuesta:**
    *   Si la llamada es exitosa, extrae el texto de la respuesta del primer `candidate`.
    *   Si la respuesta fue bloqueada por políticas de seguridad de Google, devuelve un mensaje genérico al usuario.
    *   Devuelve la respuesta de la IA al cliente en un objeto JSON.

### **Función: `text-to-speech`**

**Propósito:** Convertir una cadena de texto en audio hablado usando la API de ElevenLabs.

1.  **Recepción y CORS:** Maneja peticiones `POST` y `OPTIONS`.
2.  **Verificación de JWT (Manual):**
    *   Extrae el token de autenticación del header `Authorization`.
    *   Crea un cliente de Supabase específico para esta petición, usando el token del usuario.
    *   Llama a `supabaseClient.auth.getUser()` para validar el token y confirmar que el usuario es válido. Si falla, devuelve un error 401.
3.  **Carga de Secretos y Petición:** Obtiene la `ELEVENLABS_API_KEY` de las variables de entorno. Espera un `text` y opcionalmente un `languageCode` y `voiceId` en el cuerpo de la petición.
4.  **Selección de Voz:** Determina qué voz usar con la siguiente prioridad: `voiceId` (si se provee), la voz correspondiente al `languageCode`, o una voz por defecto en español.
5.  **Llamada a la API de ElevenLabs:**
    *   Realiza una petición `POST` al endpoint de ElevenLabs, pasando el texto, el `model_id` (`eleven_multilingual_v2`) y la configuración de la voz.
6.  **Manejo de Stream de Audio:**
    *   Para evitar la corrupción de datos en audios largos, la función no devuelve el stream directamente.
    *   Lee la respuesta de la API en `chunks` y los almacena en un array.
    *   Una vez que el stream ha terminado, combina todos los `chunks` en un único `Uint8Array`.
7.  **Codificación y Respuesta:**
    *   Codifica el `Uint8Array` completo a formato **Base64**.
    *   Devuelve una respuesta `200 OK` con un objeto JSON que contiene el audio en Base64 (`audioData`).

### **Función: `generate-embedding`**

**Propósito:** Convertir un fragmento de texto en un vector numérico (embedding) para su uso en búsqueda semántica.

1.  **Recepción y CORS:** Maneja peticiones `POST` y `OPTIONS`.
2.  **Carga de Secretos y Petición:** Obtiene la `GOOGLE_API_KEY`. Espera un `text` en el cuerpo de la petición.
3.  **Llamada a la API de Google Embeddings:**
    *   Realiza una petición `POST` al endpoint del modelo `text-embedding-004` de Google.
    *   Envía el texto dentro de la estructura requerida por la API (`{model, content: {parts: [{text}]}}`).
4.  **Procesamiento y Respuesta:**
    *   Si la llamada es exitosa, extrae el array de valores del embedding (`embedding.values`).
    *   Devuelve una respuesta `200 OK` con un objeto JSON que contiene el vector del embedding (`{success: true, embedding: [...]}`).

### **Función: `semantic-search`**

**Propósito:** Encontrar mensajes relevantes en la base de datos que coincidan semánticamente con una consulta de texto del usuario.

1.  **Recepción y CORS:** Maneja peticiones `POST` y `OPTIONS`.
2.  **Autenticación:**
    *   Crea un cliente de Supabase con el token de autorización del usuario.
    *   Verifica que el usuario esté autenticado. Si no, devuelve un error 401.
3.  **Generación de Embedding para la Consulta:**
    *   Invoca la función `generate-embedding` **internamente**, pasándole el texto de la consulta (`query`).
    *   Recibe el vector de embedding correspondiente a la consulta del usuario.
4.  **Búsqueda en Base de Datos:**
    *   Llama a la función de base de datos `pulpa_match_messages` (vía RPC).
    *   **Nota de Implementación:** Se utiliza `pulpa_match_messages` en lugar de la función original `match_messages` para evitar un conflicto de sobrecarga de funciones en PostgreSQL que causaba errores 400.
    *   Le pasa el `user_id` del usuario autenticado, el `query_embedding` generado en el paso anterior, un `match_threshold` (umbral de similitud) y un `match_count` (número máximo de resultados).
5.  **Respuesta:**
    *   Devuelve una respuesta `200 OK` con un array de los mensajes encontrados (`matches`).

### **Función: `summarize-conversation`**

**Propósito:** Generar un resumen conciso de una conversación completa y guardarlo en la base de datos.

1.  **Recepción y CORS:** Maneja peticiones `POST` y `OPTIONS`.
2.  **Autenticación:** Valida al usuario a través de su token JWT, igual que otras funciones seguras.
3.  **Obtención de Mensajes:**
    *   Recibe un `conversationId` en el cuerpo de la petición.
    *   Consulta la tabla `messages` para obtener todos los mensajes de esa conversación, ordenados cronológicamente.
4.  **Formateo de la Conversación:**
    *   Concatena todos los mensajes en una única cadena de texto, identificando el rol de cada uno ("Usuario: ...", "Guía: ...").
5.  **Llamada a Gemini para Resumen:**
    *   Llama a la API de Gemini (`gemini-1.5-flash`) con un prompt específico que le pide generar un resumen en primera persona, conciso y revelador.
6.  **Actualización en Base de Datos:**
    *   Toma el resumen generado por la IA.
    *   Realiza una operación `UPDATE` en la tabla `conversations` para guardar el resumen en la columna `summary` de la conversación correspondiente.
7.  **Respuesta:**
    *   Devuelve una respuesta `200 OK` con el `summary` generado.

### **Función: `add-message` (Nueva Arquitectura)**

**Propósito:** Centralizar y robustecer el proceso de añadir un nuevo mensaje a una conversación. Esta función es el nuevo pilar de la persistencia de datos.

1.  **Recepción y CORS:** Maneja peticiones `POST` y `OPTIONS`.
2.  **Autenticación:** Valida al usuario a través de su token JWT.
3.  **Recepción de Datos:** Espera `conversation_id`, `role` (`user` o `model`) y `text` en el cuerpo de la petición.
4.  **Generación de Embedding:** Invoca la función `generate-embedding` internamente para obtener el vector del `text`.
5.  **Inserción Atómica en DB:** Llama a la función de base de datos `insert_message_with_embedding` vía RPC, pasándole todos los datos del mensaje junto con el embedding generado. Esto asegura que el mensaje y su embedding se guarden en una única transacción.
6.  **Respuesta:** Devuelve el registro completo del mensaje recién creado desde la base de datos.

### **Función: `backfill-embeddings` (Mantenimiento)**

**Propósito:** Una herramienta de desarrollo y mantenimiento para generar embeddings para mensajes antiguos que no lo tengan.

1.  **Seguridad:** Requiere una clave de servicio (`service_role_key`) para ser ejecutada, ya que realiza operaciones masivas. No es accesible por los usuarios finales.
2.  **Lógica:**
    *   Busca en la tabla `messages` todas las filas donde `embedding` es `NULL`.
    *   Itera sobre cada mensaje encontrado.
    *   Llama a `generate-embedding` para cada uno.
    *   Actualiza la fila correspondiente con el nuevo embedding.
3.  **Uso:** Ideal para correr después de una migración de datos o para reparar datos inconsistentes.

### **Función: `test-cors` (Depuración)**

**Propósito:** Una función simple utilizada únicamente durante el desarrollo para verificar que las políticas de CORS estén configuradas correctamente. No forma parte de la lógica de la aplicación.
**Recomendación:** Eliminar del despliegue de producción.