# Gresk Vision — Scroll-Driven 3D Storytelling Experience

Sitio web interactivo de alto rendimiento estilo **Awwwards**, guiado por scroll continuo en tiempo real mediante **HTML5 Canvas**, **Vanilla CSS3** y **JavaScript**.

---

## Características Técnicas

- **Canvas 60 FPS con Inercia Lerp**: Movimiento fluido con interpolación cinemática continua sin saltos bruscos.
- **Buffer de Streaming Inteligente**: Carga inicial ultraligera (<1.8 MB) con precarga lookahead en segundo plano según la posición de scroll del usuario.
- **Aspect Ratio Matemático (`object-fit: cover`)**: Escala y se adapta perfectamente a monitores ultrawide, pantallas 16:9, laptops y dispositivos móviles verticales.
- **271 Fotogramas WebP Optimizados (1080p)**: Nitidez de nivel cinemático con compresión moderna para un peso total óptimo (~22 MB).
- **Control de Entrada Universal**:
  - Rueda del mouse y trackpad con inercia amortiguada.
  - Gestos táctiles (*touch swipe / drag*) en smartphones y tablets.
  - Navegación por teclado (`↑` / `↓`, `PageUp` / `PageDown`, `Espacio`, `Home` / `End`).
  - Línea de tiempo vertical interactiva (clic directo a cada capítulo).
  - Scrubber / barra de reproducción inferior interactiva para arrastre continuo.
- **HUD & Navegación**:
  - Menú superior con navegación a servicios (*IA & Automatización, Desarrollo Web, Diseño & Branding, Soporte TI & Redes, Portafolio & Contacto*).
  - Enlaces directos a WhatsApp y redes sociales.
  - Indicador de fotogramas en tiempo real (`FRAME XXX / 271`).
  - Modo pantalla completa y feedback háptico/sonoro con Web Audio API.

---

## Estructura del Proyecto

```text
├── index.html           # Estructura principal y overlays de narrativa
├── logo.png             # Logotipo corporativo de Gresk
├── css/
│   └── style.css        # Sistema de diseño de lujo y glassmorphism
├── js/
│   └── app.js           # Motor de canvas, física de scroll y sincronización
├── videos/              # Secuencia de fotogramas WebP organizados por capítulo
│   ├── 01 ENTRADA/
│   ├── 02 INFOGRAFIA/
│   ├── 03 IA AUTO/
│   ├── 04 WEB/
│   ├── 05 DESIGN/
│   └── 06 FIN CONTACTO/
└── imagenes/            # Recursos visuales complementarios
```

---

## Ejecución Local

Para levantar el servidor de desarrollo local:

```bash
python -m http.server 3000
```

Abre en tu navegador: `http://localhost:3000`
