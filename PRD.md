Documento de Requisitos del Producto (PRD) - pulpa.work (Versión 2.0)

*Última actualización: 29 de junio de 2025, 20:21:14 (GMT-3)*
1. Introducción
pulpa.work es una aplicación web impulsada por IA diseñada para facilitar la autorreflexión diaria guiada por voz. Su propósito es "sacar la pulpa" del usuario, el verdadero "meat and juice" de sus pensamientos y experiencias. Inspirada en los principios estoicos, la aplicación actúa como un entrevistador empático y perspicaz, ayudando a los usuarios a explorar sus experiencias, emociones y aprendizajes de una manera estructurada pero natural.

Su objetivo principal es ayudar al usuario a descubrir ideas más profundas de sus experiencias diarias, las cuales son luego transcritas, analizadas y almacenadas en una base de conocimiento personal. A largo plazo, esta base de conocimiento permitirá al usuario dialogar con sus propios pensamientos para generar contenido estructurado y descubrir patrones de pensamiento.

2. Objetivos
Objetivo Principal: Proporcionar un mecanismo consistente, efectivo y atractivo para la autorreflexión e introspección diaria hablada, ayudando al usuario a extraer la esencia de sus pensamientos.

Objetivo 1 (Reflexión): Permitir al usuario verbalizar pensamientos, sentimientos y aprendizajes de manera espontánea y sin inhibiciones diariamente.

Objetivo 2 (Perspectivas): Facilitar la identificación de patrones recurrentes, perspectivas personales y áreas de expertise a partir de las reflexiones del usuario.

Objetivo 3 (Generación de Contenido): Generar contenido estructurado y articulado (ej., artículos, publicaciones en redes sociales, historias) en la voz aprendida del usuario.

Objetivo 4 (Base de Conocimiento): Crear una base de datos personal, buscable y analizable, de los pensamientos y experiencias del usuario a lo largo del tiempo.

Objetivo 5 (Crecimiento Personal): Servir como catalizador para una mayor autoconciencia, inteligencia emocional y aplicación filosófica en la vida diaria.

3. Usuario Objetivo
Individuos que buscan una forma más profunda de llevar un diario, creadores de contenido, entusiastas del desarrollo personal, coaches, y cualquier persona interesada en aprovechar la IA para el autodescubrimiento y la comunicación auténtica.

4. Roadmap de Funcionalidades por Fases
4.1. Funcionalidad Central (Implementada)
Ciclo de Conversación por Voz: Flujo completo de grabación, transcripción, respuesta de IA y síntesis de voz.

Transcripción Asíncrona: Soporte para audios de larga duración sin timeouts mediante un sistema de dos pasos (transcribe y get-transcription-status).

Entrevistador de IA Personalizado: La IA (Gemini Pro) mantiene el contexto de la conversación y adapta sus preguntas utilizando la información del perfil del usuario (nombre, rol, objetivos).

Gestión de Perfil de Usuario: Los usuarios pueden crear una cuenta y gestionar su información de perfil para personalizar la experiencia.

4.2. Fase 1: Unificación y Pulido de la Experiencia de Usuario (UI/UX) - [Implementada]
Consistencia Visual: Unificar la estética de la página de Login/Signup con el diseño de la aplicación principal.

Onboarding de Perfil: Crear un flujo de bienvenida guiado para que los nuevos usuarios completen su perfil.

Diseño Responsivo: Adaptar la interfaz para una experiencia de usuario óptima en dispositivos móviles.

Mejora de la Interfaz de Conversación: Refinar el diseño visual del historial de la conversación para mejorar la legibilidad y la estética.

Controles de Audio: Implementar botones para pausar, reanudar e interrumpir la reproducción del audio de la IA.

Unificación de Modales: Se ha implementado un componente `ModalPanel` reutilizable para estandarizar la apariencia de todas las ventanas emergentes (Onboarding, Perfil, Memory Lane).

4.3. Fase 2: La Base de Conocimiento (Acceso a la Memoria) - [Implementada]
Guardado de Conversaciones: [Implementado] Almacenamiento persistente de cada turno de la conversación.

Generación de Resúmenes: [Implementado] Función automática que genera y almacena un resumen de la sesión.

Interfaz de "Mi Memoria": [Implementado] Sección donde los usuarios pueden ver, leer y explorar conversaciones pasadas.

Búsqueda Semántica Avanzada: [Implementado] Búsqueda por significado utilizando embeddings vectoriales (pgvector). Permite al usuario encontrar los pensamientos más relevantes a una pregunta en lenguaje natural, cumpliendo y superando el requisito de una búsqueda por palabra clave.

Navegación desde Resultados: [Implementado] Los resultados de la búsqueda son clickables y navegan directamente a la conversación correspondiente, replicando la experiencia de usuario de `MemoryLane`.

4.4. Fase 3: Insights Activos (Diálogo con la Memoria)

Interfaz "Pregúntale a tu Pulpa": Crear una nueva interfaz de chat que permita a los usuarios hacer preguntas en lenguaje natural sobre su propio historial de reflexiones.

Integración de Contexto Histórico: Permitir que la IA principal utilice los resultados de la búsqueda semántica como contexto para responder a las preguntas del usuario sobre sus propios patrones de pensamiento.

5. Historias de Usuario por Fase
5.1. Historias de la Funcionalidad Central (Implementadas)
Como usuario, quiero iniciar una nueva sesión de reflexión para poder hablar sobre mi día.

Como usuario, quiero que la IA me haga preguntas reflexivas basadas en mi última declaración para poder profundizar en mis pensamientos.

Como usuario, quiero que mis palabras habladas sean transcritas con precisión para poder ver lo que he dicho.

5.2. Historias para la Fase 2 (Base de Conocimiento)
Como usuario, quiero que toda mi sesión (audio y texto) se guarde automáticamente para no perder mis reflexiones.

Como usuario, quiero poder ver una lista de mis conversaciones pasadas para recordar sobre qué he reflexionado.

Como usuario, quiero poder leer la transcripción completa de una conversación antigua para revivir una idea en detalle.

Como usuario, quiero que la IA resuma una sesión para poder recordar rápidamente sus puntos principales.

Como usuario, quiero poder buscar en mis sesiones pasadas usando lenguaje natural para encontrar pensamientos específicos y relevantes.

Como usuario, cuando veo un resultado de búsqueda interesante, quiero poder hacer clic en él para navegar directamente a la conversación completa y entender el contexto original.

5.3. Historias para la Fase 3 (Insights Activos)
Como usuario, quiero preguntarle a la aplicación "¿Qué es lo que más me ha preocupado este mes?" para identificar patrones emocionales.

Como usuario, quiero saber "¿Qué ideas he tenido sobre el 'proyecto X' a lo largo del tiempo?" para ver la evolución de mi pensamiento.

Como usuario, quiero que la IA use mis reflexiones pasadas para ayudarme a redactar un artículo sobre un tema recurrente en mi vida.

6. Consideraciones Técnicas
Frontend (UI): React / TypeScript.

Lógica de Backend / Serverless: Supabase Edge Functions (Deno / TypeScript).

Base de Datos: Supabase PostgreSQL (con la extensión pgvector para la Fase 2).

APIs de IA: Google Cloud Speech-to-Text, Google Gemini Pro, ElevenLabs.

7. Iteraciones Futuras / Visión
Una vez completado el roadmap principal, la visión a largo plazo podría incluir:

Visualización de Datos: Gráficos y visualizaciones de patrones de pensamiento y tendencias emocionales a lo largo del tiempo.

Generación Sofisticada de Contenido: Generación de artículos de formato largo o guiones utilizando marcos narrativos (Hero's Journey) a partir de las experiencias del usuario.

Integración con Arte Visual: Sugerir temas para nuevas obras de arte basadas en las reflexiones del usuario.

Aplicación Dedicada: Una aplicación de escritorio o móvil para una experiencia más integrada.

Características de Comunidad/Compartir: Opciones para compartir de forma segura reflexiones o contenido generado con coaches, terapeutas o colaboradores.

8. Métricas de Éxito
Compromiso: Uso diario/semanal consistente por parte del usuario.

Profundidad de la Reflexión: Evaluación subjetiva de cuán profundamente la IA impulsa la introspección.

Utilidad de la Base de Conocimiento: Frecuencia con la que los usuarios revisan y buscan en sus reflexiones pasadas.

Estabilidad Técnica: Fiabilidad de la transcripción, las respuestas de la IA y el almacenamiento de datos.