# 🧬 DB_SCHEMA.md - Esquema de la Base de Datos

*Última actualización: 29 de junio de 2025, 20:06:24 (GMT-3)*

Este documento describe la arquitectura, reglas de seguridad y lógica automatizada de la base de datos del proyecto en Supabase. Sirve como la fuente de la verdad para el esquema de datos.

## Tablas Principales

### Tabla: `profiles`

Almacena la información del perfil de cada usuario, extendiendo la tabla `auth.users` de Supabase.

| Columna | Tipo de Dato | Nulable | Valor por Defecto / Clave Foránea | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| **id** | `uuid` | No | **Primary Key**, FK a `auth.users.id` | Identificador único del usuario. |
| `created_at` | `timestamptz` | No | `now()` | Fecha y hora de creación del perfil. |
| `updated_at` | `timestamptz` | Sí | `NULL` | Fecha y hora de la última actualización. |
| `full_name` | `text` | Sí | `NULL` | Nombre completo del usuario. |
| `timezone` | `text` | Sí | `NULL` | Zona horaria del usuario (e.g., 'America/Mexico_City'). |
| `goals` | `text` | Sí | `NULL` | Objetivos o metas definidos por el usuario. |
| `role` | `text` | Sí | `NULL` | Rol o profesión del usuario. |
| `preferred_language` | `text` | Sí | `NULL` | Idioma de preferencia del usuario. |
| `preferred_voice_id` | `text` | Sí | `NULL` | ID de la voz preferida para la síntesis de voz. |
| `onboarding_completed`| `boolean` | No | `false` | Indica si el usuario ha completado el proceso de onboarding. |

### Tabla: `conversations`

Registra cada sesión de conversación que un usuario tiene con el asistente.

| Columna | Tipo de Dato | Nulable | Valor por Defecto / Clave Foránea | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| **id** | `uuid` | No | `gen_random_uuid()` / **Primary Key** | Identificador único de la conversación. |
| `user_id` | `uuid` | No | FK a `profiles.id` | Usuario al que pertenece la conversación. |
| `created_at` | `timestamptz` | No | `now()` | Fecha y hora de inicio de la conversación. |
| `summary` | `text` | Sí | `NULL` | Resumen generado automáticamente de la conversación. |

### Tabla: `messages`

Guarda cada mensaje individual (del usuario o del asistente) dentro de una conversación.

| Columna | Tipo de Dato | Nulable | Valor por Defecto / Clave Foránea | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| **id** | `uuid` | No | `gen_random_uuid()` / **Primary Key** | Identificador único del mensaje. |
| `conversation_id` | `uuid` | No | FK a `conversations.id` | Conversación a la que pertenece el mensaje. |
| `role` | `text` | No | `NULL` | Rol del emisor ('user' o 'assistant'). |
| `text` | `text` | No | `NULL` | Contenido del mensaje. |
| `created_at` | `timestamptz` | No | `now()` | Fecha y hora de creación del mensaje. |
| `embedding` | `vector(768)` | Sí | `NULL` | Vector de embedding del texto para búsquedas semánticas. |

## Políticas de Seguridad (RLS)

Las siguientes políticas de seguridad a nivel de fila están activas para garantizar que los usuarios solo puedan acceder a sus propios datos.

| Tabla | Nombre de la Política | Comando | Propósito |
| :--- | :--- | :--- | :--- |
| `profiles` | `Allow authenticated users to read their own profile` | `SELECT` | Permite a un usuario leer únicamente su propio perfil. |
| `profiles` | `Allow authenticated users to insert their own profile` | `INSERT` | Permite a un usuario crear su propio perfil. |
| `profiles` | `Allow authenticated users to update their own profile` | `UPDATE` | Permite a un usuario actualizar únicamente su propio perfil. |
| `conversations` | `Los usuarios pueden gestionar sus propias conversaciones` | `ALL` | Permite a un usuario realizar cualquier operación sobre sus propias conversaciones. |
| `messages` | `Los usuarios pueden gestionar los mensajes de sus conversacione` | `ALL` | Permite a un usuario gestionar los mensajes que pertenecen a sus conversaciones. |

## Funciones y Triggers de la Base de Datos

La lógica de negocio se automatiza y expone a través de las siguientes funciones.

### Funciones RPC (Remote Procedure Call)

Estas funciones están diseñadas para ser llamadas de forma segura desde las Edge Functions.

1.  **`insert_message_with_embedding(p_conversation_id, p_role, p_text, p_embedding)`**
    *   **Propósito:** Es el método principal y atómico para guardar nuevos mensajes. Recibe los detalles del mensaje y su vector de embedding pre-calculado, y los inserta en la tabla `messages`.
    *   **Flujo:** Es invocada por la Edge Function `add-message` después de que esta última genera el embedding. Este enfoque centralizado reemplaza al antiguo sistema de triggers.

2.  **`pulpa_match_messages(p_user_id, query_embedding, match_threshold, match_count)`**
    *   **Propósito:** Es el motor de la búsqueda semántica. Recibe un embedding de consulta y devuelve los mensajes más similares de un usuario específico.
    *   **Invocación:** Utilizada por la Edge Function `semantic-search`.

### Funciones de Trigger

1.  **`handle_new_user()`**
    *   **Propósito:** Crea automáticamente un perfil en la tabla `profiles` cuando un nuevo usuario se registra en `auth.users`.

### Triggers

1.  **`on_auth_user_created`**
    *   **Tabla:** `auth.users`
    *   **Evento:** `AFTER INSERT`
    *   **Acción:** Ejecuta la función `handle_new_user()`.

## Tablas Obsoletas

Durante la auditoría, se identificaron las siguientes tablas que ya no están en uso y se recomienda su eliminación para mantener la base de datos limpia.

| Tabla | Descripción | Acción Recomendada |
| :--- | :--- | :--- |
| `reflections_old` | Tabla de una versión anterior del sistema. Ha sido reemplazada por la estructura de `conversations` y `messages`. | Eliminar (`DROP TABLE public.reflections_old;`) |

---