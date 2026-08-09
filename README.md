# Distrito BG Web

Tienda pública de Distrito BG. Esta aplicación presenta el catálogo, administra el
carrito y envía pedidos a la API. No contiene rutas ni componentes administrativos.

## Funciones

- Carga de productos activos, categorías, configuración y campaña vigente.
- Filtrado de productos por categoría.
- Carrito con cantidades, subtotal, costo de domicilio configurado y total visible.
- Formulario de cliente, entrega y método de pago.
- Autocompletado de direcciones con Google Places, mapa de confirmación y marcador
  movible orientado a Valledupar, Colombia.
- Consulta de horarios y bloqueo del checkout cuando el restaurante está cerrado.
- Seguimiento por identificador y teléfono, actualizado cada 30 segundos.
- Identidad, logo, contacto, pagos y tema visual recibidos desde Configuración.
- Productos agotados bloqueados antes de llegar al carrito.
- Calificación de productos con prevención local de votos repetidos.
- Registro opcional de suscripciones Web Push cuando el navegador lo permite.
- Aviso de instalación cuando el navegador emite `beforeinstallprompt`.
- Imágenes con carga diferida y decodificación asíncrona.
- Campañas con descripción, CTA y programación centralizados; frecuencia por
  sesión o día aplicada localmente sin duplicar la regla de vigencia de la API.

## Preparación local

```powershell
Copy-Item .env.example .env
npm ci
npm run dev
```

Comandos disponibles:

| Comando | Función |
| --- | --- |
| `npm run dev` | Servidor Vite de desarrollo |
| `npm run build` | Build optimizado en `dist/` |
| `npm run preview` | Previsualiza el build localmente |
| `npm run prod` | Compila y abre la previsualización |
| `npm run ci` | Instalación reproducible con lockfile |

## Configuración de API

```env
VITE_API_URL=http://localhost:3001
```

`VITE_API_URL` representa únicamente el origen:

- Correcto: `https://distrito-api.onrender.com`
- Incorrecto: `https://distrito-api.onrender.com/api/pedidos`

`src/config/api.js` elimina la barra final y agrega `/api/pedidos`. Todos los
consumos HTTP deben importar `API_URL` desde ese archivo.

Para la ejecución mediante `../start-local.ps1`, `VITE_API_URL=auto` hace que el
cliente use el hostname visible en el navegador y `VITE_API_PORT` define el puerto
de la API. Esto permite usar el mismo build desde localhost, LAN o IP pública.

## Configuración de Google Maps

La dirección exacta requiere una clave de navegador de Google Maps Platform:

```env
VITE_GOOGLE_MAPS_API_KEY=tu_clave_restringida_por_dominio
VITE_GOOGLE_MAPS_MAP_ID=tu_map_id
```

En el proyecto de Google Cloud habilita **Maps JavaScript API** y **Places API
(New)**. La clave se entrega al navegador por diseño, por lo que debe restringirse
por referentes HTTP a los dominios reales (`distritobg.app`, previews autorizados,
localhost y la IP LAN usada para pruebas). No reutilices una clave de servidor.

Para el entorno local actual deben autorizarse, como mínimo, estos orígenes web en
la misma clave (Google Cloud > APIs y servicios > Credenciales):

```text
http://127.0.0.1:5173
http://localhost:5173
http://192.168.1.80:5173
http://127.0.0.1:5174
http://localhost:5174
http://192.168.1.80:5174
```

Si cambia la IP LAN, debe agregarse el nuevo origen con los puertos de tienda y
administración. El mensaje `Requests from referer ... are blocked` confirma que
falta ese origen en la restricción de sitios web; no es un fallo del formulario.

Si la clave no existe o Google Maps no puede cargar, el formulario conserva una
entrada manual para no bloquear la operación. En producción debe configurarse la
clave para exigir la selección y confirmación del punto exacto.

## Estructura

```text
distrito-web/
├── src/
│   ├── App.jsx             # Experiencia completa de tienda y checkout
│   ├── components/OrderTracker.jsx # Seguimiento público
│   ├── utils/theme.js       # Tema publicado desde administración
│   ├── main.jsx            # Montaje de React
│   ├── index.css           # Estilos públicos
│   ├── config/api.js       # URL única de API
│   └── assets/             # Logos locales
├── .env.example
└── vite.config.mjs
```

El selector de dirección no vive dentro de esta aplicación. Se importa desde
`../distrito-shared` mediante `@distrito/shared-ui`, la misma dependencia local
usada por el panel administrativo. El componente usa un `input` controlado por
React y la API de datos de Place Autocomplete para dibujar su propia lista
adaptativa; así el foco, el scroll y los errores no dependen del DOM interno del
Web Component de Google.

La estructura compacta es intencional. No deben copiarse páginas del panel dentro
de esta aplicación. Las nuevas funciones administrativas pertenecen a
`distrito-admin`.

## Contrato de datos

Al cargar la aplicación se consulta `GET /init`. La API responde productos con una
URL de imagen cacheable; el frontend no debe asumir que recibe una imagen Base64.
El mismo contrato incluye la campaña con `is_visible`; la tienda solo la abre cuando
ese valor es verdadero y registra localmente la frecuencia indicada.

Al confirmar un pedido se envía un carrito mínimo:

```json
{
  "cart": [
    { "id": "uuid-del-producto", "quantity": 1 }
  ]
}
```

Para un domicilio, `customer` añade `address`, `barrio`, `latitude`, `longitude`,
`placeId`, `locationAdjusted`, `apartment`, `tower`, `floor` y `reference`. Las
coordenadas son el destino operativo; la dirección formateada y el Place ID
mantienen el contexto de Google. Si el marcador fue movido, el Place ID conserva
la selección original y las coordenadas conservan el punto final confirmado.

No se deben enviar ni confiar como fuente de verdad:

- título del producto;
- precio;
- categoría;
- imagen;
- total calculado.

La API resuelve esos valores desde PostgreSQL. El total mostrado en pantalla es una
ayuda visual; el valor persistido lo calcula el backend. La tienda no inventa un
número local: si la API no confirma la transacción, el pedido se detiene.

La respuesta de checkout contiene `subtotal`, `delivery_fee` y `total`. Para
recoger, el costo de domicilio es cero. Para domicilio, se usa el valor vigente de
**Configuración → Domicilios**, incluso si la pantalla llevaba abierta antes de un
cambio administrativo.

## Integraciones utilizadas

| Ruta relativa | Uso |
| --- | --- |
| `GET /init` | Datos iniciales |
| `GET /horarios/status` | Estado de atención |
| `POST /checkout` | Creación del pedido |
| `GET /track/:id?phone=` | Seguimiento limitado del pedido |
| `GET /track/:id/stream?phone=` | Eventos de estado y GPS validados por teléfono |
| `GET /track/:id?token=` | Acceso mediante enlace temporal firmado |
| `GET /track/:id/stream?token=` | Estados y GPS del enlace temporal |
| `POST /rate` | Calificación de producto |
| `POST /push/subscribe` | Suscripción a notificaciones |
| `GET /media/products/:id` | Imagen de producto |

Todas parten de `API_URL`.

## Rendimiento

- El build validado genera aproximadamente 192 KB de JavaScript inicial sin comprimir.
- Las imágenes del catálogo usan `loading="lazy"` y `decoding="async"`.
- El JSON inicial no incluye blobs Base64 de productos.
- El checkout no vuelve a enviar las imágenes almacenadas en el carrito.
- El checkout abre primero el detalle de WhatsApp y deja preparada la pantalla de
  seguimiento para cuando el cliente regrese al navegador.
- El mensaje cambia entre **Entrega a domicilio** y **Recoger en local**, incluye
  productos, pago, cambio, total y enlace de rastreo. La URL se construye con
  `encodeURIComponent`, por lo que conserva emojis y texto UTF-8.
- Los pedidos para recoger muestran el flujo Pedido recibido → En preparación →
  Listo para recoger → Entregado. Al marcar Listo, el ERP puede abrir el mensaje
  específico de recogida para el cliente.
- WhatsApp incluye debajo del barrio un enlace firmado de 48 horas como máximo. El
  estado final tiene 15 minutos de cortesía para mostrar “Entregado” y después el
  enlace deja de autorizar consultas; el acceso manual por pedido/teléfono continúa.
- El seguimiento abre SSE después de validar teléfono o token. Cuando el pedido
  está `En camino`, muestra el mapa compartido con restaurante, destino, recorrido
  y una motocicleta identificada con el domiciliario. Cada evento GPS mueve el
  marcador sin recargar la página; antes de la primera señal conserva visibles el
  punto de salida y el destino.
- La vista no publica mensajes técnicos sobre el acceso temporal. El token sigue
  caducando en la API al finalizar la entrega aunque ese detalle de seguridad no se
  muestre al cliente.

## Diseño adaptativo

`src/index.css` es la única fuente de estilos del escaparate. Los rangos de diseño
se prueban como móvil pequeño (`<= 480 px`), móvil/tablet (`481-900 px`), escritorio
compacto (`901-1199 px`) y escritorio amplio (`>= 1200 px`).

- En móvil, el catálogo usa una columna, el carrito ocupa todo el ancho y los
  controles táctiles conservan al menos 44-48 px.
- En tablet, el catálogo usa dos columnas y el carrito funciona como un drawer.
- En escritorio compacto se reduce el ancho del carrito y el catálogo se ajusta a
  dos columnas sin desbordar.
- Los avisos, la instalación PWA y el carrito respetan `safe-area-inset-*` y
  `100dvh` para dispositivos con barras o recortes de pantalla.
- Se respeta `prefers-reduced-motion` para reducir animaciones cuando el sistema lo
  solicita.

La tarjeta completa de un producto es accionable con clic, Enter o barra
espaciadora. Los botones de cantidad y las estrellas detienen esa acción para no
duplicar unidades. Cuando el restaurante está cerrado o no hay existencias, la
tarjeta queda deshabilitada igual que el botón Agregar.

La tienda aplica `web_logo`, nombre de página, título/subtítulo principal, paleta,
tipografía y estilo de tarjetas desde Configuración. Las campañas consultan la
audiencia anónima (nuevo o recurrente), respetan frecuencia y programación, y
registran vista/clic sin almacenar identidad del visitante.

No deben agregarse selectores `.admin-*` a esta hoja: los estilos del panel viven
exclusivamente en `distrito-admin/src/styles/design-system.css`.

## Validación y despliegue

Antes de integrar cambios:

```powershell
npm run build
npm audit --omit=dev
```

Para Vercel, configura `VITE_API_URL` en los ambientes correspondientes y publica
el contenido generado por Vite. Este repositorio no despliega automáticamente desde
el entorno local.

## Reglas para próximos cambios

- Mantener la experiencia pública libre de módulos de administración.
- Reutilizar `src/config/api.js` para todas las rutas HTTP.
- Enviar al checkout solo identificador y cantidad.
- Mantener lógica de precios, permisos e inventario en la API.
- Diseñar primero con anchos fluidos y validar los cuatro rangos adaptativos.
- Evitar dependencias administrativas como router o gráficas en esta aplicación.
- Ejecutar el contrato de la API y el build del frontend antes de publicar.
