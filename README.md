# Hackatón COVID-19 — Explorador de Datos

Proyecto del Hackatón JS Avanzado. Consume la API pública [disease.sh](https://disease.sh) usando `fetch()`, `async/await` y JavaScript puro (Vanilla JS), con HTML5 semántico y Tailwind CSS por CDN.

## Estructura del proyecto

```
index.html      → Estructura HTML5 semántica + Tailwind CDN
css/style.css   → Animaciones y estilos complementarios
js/script.js    → Clases, fetch a la API, manipulación del DOM, eventos
```

## Endpoints usados

- `https://disease.sh/v3/covid-19/all` → estadísticas globales
- `https://disease.sh/v3/covid-19/countries` → ranking de países
- `https://disease.sh/v3/covid-19/continents` → comparativa por continente


## Funcionalidades implementadas

- Conexión a 3 endpoints en paralelo con `Promise.all()`
- 4 clases con responsabilidades separadas: `CovidApiService`, `CountryStat`, `GlobalStat`, `UIManager`, orquestadas por `CovidApp`
- Buscador de país + selector de continente (filtros combinables)
- Barras de progreso dinámicas calculadas en JavaScript
- Gráfico real con Chart.js (Top 10 países, casos vs muertes)
- Loading state con spinner y manejo de errores con reintento
- Tema claro/oscuro persistente con `localStorage`
- Formateo de números con `Intl.NumberFormat` y fecha de actualización con `toLocaleString()`
- Diseño responsivo (`sm:`, `md:`, `lg:`)
- Galería de imágenes reales de la pandemia con animación CSS al hacer scroll (`IntersectionObserver` + `animation-timeline: view()` como mejora progresiva)
