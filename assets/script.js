/* ============================================================
   script.js — Explorador de Datos COVID-19
   JavaScript puro (Vanilla JS). Consume la API pública disease.sh
   ============================================================ */

/* ----------------------------------------------------------------
   1) CAPA DE DATOS
   ---------------------------------------------------------------- */

// URL base de la API (sin autenticación, todos los endpoints son GET)
const API_BASE = "https://disease.sh/v3/covid-19";

/**
 * CovidApiService
 * Responsabilidad única: hablar con la API. No sabe nada de HTML/DOM.
 * Centraliza fetch() + async/await + manejo de errores HTTP.
 */
class CovidApiService {
    async #get(endpoint) {
        const response = await fetch(`${API_BASE}${endpoint}`);
        if (!response.ok) {
            throw new Error(`Error ${response.status} al consultar ${endpoint}`);
        }
        return response.json();
    }

    getGlobal() {
        return this.#get("/all");
    }

    getCountries() {
        return this.#get("/countries");
    }

    getContinents() {
        return this.#get("/continents");
    }

    /**
     * Carga los tres endpoints en paralelo (Promise.all) en lugar de
     * uno detrás de otro. Esto cumple el requisito de "carga en paralelo".
     */
    async getAllData() {
        const [global, countries, continents] = await Promise.all([
            this.getGlobal(),
            this.getCountries(),
            this.getContinents(),
        ]);
        return {global, countries, continents};
    }
}

/* ----------------------------------------------------------------
   2) MODELOS — clases que representan los datos crudos de la API
   ---------------------------------------------------------------- */

/**
 * CountryStat
 * Modela un único país a partir del JSON crudo que entrega
 * /v3/covid-19/countries, exponiendo solo lo que la UI necesita.
 */
class CountryStat {
    constructor(raw) {
        this.name = raw.country;
        this.flag = raw.countryInfo?.flag ?? "";
        this.continent = raw.continent ?? "Desconocido";
        this.cases = raw.cases ?? 0;
        this.deaths = raw.deaths ?? 0;
        this.recovered = raw.recovered ?? 0;
        this.active = raw.active ?? 0;
    }

    // Porcentaje de letalidad, usado en las barras de progreso
    get fatalityRate() {
        return this.cases > 0 ? (this.deaths / this.cases) * 100 : 0;
    }
}

/**
 * GlobalStat
 * Modela el endpoint /v3/covid-19/all (resumen mundial).
 */
class GlobalStat {
    constructor(raw) {
        this.cases = raw.cases ?? 0;
        this.deaths = raw.deaths ?? 0;
        this.recovered = raw.recovered ?? 0;
        this.active = raw.active ?? 0;
        this.updated = raw.updated ?? Date.now();
    }

    get formattedDate() {
        return new Date(this.updated).toLocaleString("es-CL", {
            dateStyle: "medium",
            timeStyle: "short",
        });
    }

    // Mismo cálculo que en CountryStat: % de muertes sobre el total de casos
    get fatalityRate() {
        return this.cases > 0 ? (this.deaths / this.cases) * 100 : 0;
    }
}

/* ----------------------------------------------------------------
   3) CAPA DE PRESENTACIÓN — todo lo que toca el DOM vive aquí
   ---------------------------------------------------------------- */

/**
 * UIManager
 * Responsabilidad única: pintar datos en pantalla y manejar
 * estados visuales (loading / error / contenido).
 */
class UIManager {
    constructor() {
        this.$loading = document.getElementById("loading-state");
        this.$error = document.getElementById("error-state");
        this.$errorMessage = document.getElementById("error-message");
        this.$content = document.getElementById("app-content");
        this.$lastUpdated = document.getElementById("last-updated");

        this.$globalCards = document.getElementById("global-cards");
        this.$countriesList = document.getElementById("countries-list");
        this.$rankingCount = document.getElementById("ranking-count");
        this.$continentCards = document.getElementById("continent-cards");
        this.$continentSelect = document.getElementById("continent-select");

        this.chart = null;
    }

    showLoading() {
        this.$loading.classList.remove("hidden");
        this.$error.classList.add("hidden");
        this.$content.classList.add("hidden");
    }

    showError(message) {
        this.$loading.classList.add("hidden");
        this.$content.classList.add("hidden");
        this.$error.classList.remove("hidden");
        this.$errorMessage.textContent = message;
    }

    showContent() {
        this.$loading.classList.add("hidden");
        this.$error.classList.add("hidden");
        this.$content.classList.remove("hidden");
    }

    formatNumber(num) {
        return new Intl.NumberFormat("es-CL").format(num);
    }

    renderLastUpdated(globalStat) {
        this.$lastUpdated.textContent = `Datos actualizados: ${globalStat.formattedDate}`;
    }

    // ----- Tarjetas de estadísticas globales -----
    renderGlobalCards(globalStat) {
        const cards = [
            {label: "Casos totales", value: this.formatNumber(globalStat.cases), color: "text-brand-600", icon: "🦠"},
            {label: "Muertes", value: this.formatNumber(globalStat.deaths), color: "text-red-500", icon: "⚰️"},
            {
                label: "Recuperados",
                value: this.formatNumber(globalStat.recovered),
                color: "text-emerald-500",
                icon: "💚"
            },
            {label: "Activos", value: this.formatNumber(globalStat.active), color: "text-amber-500", icon: "⚡"},
            {label: "Letalidad", value: `${globalStat.fatalityRate.toFixed(2)}%`, color: "text-fuchsia-500", icon: "📉"},
        ];

        this.$globalCards.innerHTML = cards
            .map(
                (card, i) => `
        <div class="fade-in bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow"
             style="animation-delay:${i * 80}ms">
          <p class="text-2xl mb-1">${card.icon}</p>
          <p class="text-xs text-slate-500 dark:text-slate-400">${card.label}</p>
          <p class="text-xl md:text-2xl font-bold ${card.color}">${card.value}</p>
        </div>`
            )
            .join("");
    }

    // ----- Lista de países con barra de progreso -----
    renderCountriesList(countries) {
        const maxCases = Math.max(...countries.map((c) => c.cases), 1);

        this.$rankingCount.textContent = `${countries.length} países`;

        this.$countriesList.innerHTML = countries
            .map((country) => {
                const widthPct = ((country.cases / maxCases) * 100).toFixed(1);
                return `
        <li class="country-row p-4 flex items-center gap-4">
          <img src="${country.flag}" alt="Bandera de ${country.name}" class="w-8 h-6 object-cover rounded shadow-sm flex-shrink-0">
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between mb-1">
              <span class="font-medium truncate">${country.name}</span>
              <span class="text-sm text-slate-500 dark:text-slate-400 flex-shrink-0 ml-2">${this.formatNumber(country.cases)} casos</span>
            </div>
            <div class="progress-track">
              <div class="progress-fill" style="width:${widthPct}%"></div>
            </div>
          </div>
        </li>`;
            })
            .join("");
    }

    // ----- Cards de continentes -----
    renderContinentCards(continents) {
        this.$continentCards.innerHTML = continents
            .map(
                (c) => `
        <article class="fade-in bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-700">
          <h3 class="font-semibold mb-2">${c.continent}</h3>
          <dl class="text-sm space-y-1 text-slate-600 dark:text-slate-300">
            <div class="flex justify-between"><dt>Casos</dt><dd class="font-medium">${this.formatNumber(c.cases)}</dd></div>
            <div class="flex justify-between"><dt>Muertes</dt><dd class="font-medium">${this.formatNumber(c.deaths)}</dd></div>
            <div class="flex justify-between"><dt>Recuperados</dt><dd class="font-medium">${this.formatNumber(c.recovered)}</dd></div>
          </dl>
        </article>`
            )
            .join("");
    }

    // ----- Selector de continentes (poblado dinámicamente) -----
    renderContinentOptions(continents) {
        const options = continents
            .map((c) => `<option value="${c.continent}">${c.continent}</option>`)
            .join("");
        this.$continentSelect.innerHTML = `<option value="all">Todos los continentes</option>${options}`;
    }

    // ----- Gráfico Chart.js (Nivel Oro) -----
    renderChart(countries) {
        const top10 = [...countries].sort((a, b) => b.cases - a.cases).slice(0, 10);
        const ctx = document.getElementById("covid-chart");

        const data = {
            labels: top10.map((c) => c.name),
            datasets: [
                {
                    label: "Casos totales",
                    data: top10.map((c) => c.cases),
                    backgroundColor: "#3b82f6",
                    borderRadius: 6,
                },
                {
                    label: "Muertes",
                    data: top10.map((c) => c.deaths),
                    backgroundColor: "#ef4444",
                    borderRadius: 6,
                },
            ],
        };

        if (this.chart) {
            this.chart.data = data;
            this.chart.update();
            return;
        }

        this.chart = new Chart(ctx, {
            type: "bar",
            data,
            options: {
                responsive: true,
                plugins: {legend: {position: "bottom"}},
                scales: {y: {beginAtZero: true}},
            },
        });
    }
}

/**
 * GalleryAnimator
 * Responsabilidad única: observar las imágenes de la galería y
 * agregarles la clase "is-visible" cuando entran en el viewport
 * al hacer scroll. Usa IntersectionObserver (API nativa del
 * navegador), no requiere ninguna librería externa.
 */
class GalleryAnimator {
    constructor(selector = ".scroll-reveal") {
        this.elements = document.querySelectorAll(selector);
    }

    init() {
        if (!this.elements.length) return;

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add("is-visible");
                        // Una vez visible, dejamos de observarla (mejora rendimiento)
                        observer.unobserve(entry.target);
                    }
                });
            },
            {
                threshold: 0.15, // se activa cuando el 15% de la imagen es visible
            }
        );

        this.elements.forEach((el) => observer.observe(el));
    }
}

/* ----------------------------------------------------------------
   4) APP — orquesta API + UI + eventos
   ---------------------------------------------------------------- */

class CovidApp {
    constructor() {
        this.api = new CovidApiService();
        this.ui = new UIManager();
        this.allCountries = []; // CountryStat[]
        this.allContinents = [];
    }

    async init() {
        this.bindStaticEvents();
        await this.loadData();
        new GalleryAnimator().init(); // activa la animación de scroll de la galería
    }

    bindStaticEvents() {
        document.getElementById("retry-btn").addEventListener("click", () => this.loadData());

        // Buscador de país (event listener requerido)
        document.getElementById("country-search").addEventListener("input", (e) => {
            this.applyFilters({search: e.target.value});
        });

        // Selector de continente
        document.getElementById("continent-select").addEventListener("change", (e) => {
            this.applyFilters({continent: e.target.value});
        });

        // Toggle de tema claro/oscuro
        document.getElementById("theme-toggle").addEventListener("click", () => this.toggleTheme());
        this.initTheme();
    }

    initTheme() {
        const saved = localStorage.getItem("covid-theme");
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        const isDark = saved ? saved === "dark" : prefersDark;
        document.documentElement.classList.toggle("dark", isDark);
        document.getElementById("theme-icon").textContent = isDark ? "☀️" : "🌙";
    }

    toggleTheme() {
        const isDark = document.documentElement.classList.toggle("dark");
        document.getElementById("theme-icon").textContent = isDark ? "☀️" : "🌙";
        localStorage.setItem("covid-theme", isDark ? "dark" : "light");
    }

    async loadData() {
        this.ui.showLoading();
        try {
            const {global, countries, continents} = await this.api.getAllData();

            const globalStat = new GlobalStat(global);
            this.allCountries = countries.map((c) => new CountryStat(c));
            this.allContinents = continents
                .map((c) => ({
                    continent: c.continent,
                    cases: c.cases ?? 0,
                    deaths: c.deaths ?? 0,
                    recovered: c.recovered ?? 0,
                }))
                // find/filter usados aquí para limpiar continentes vacíos o nulos
                .filter((c) => c.continent && c.continent !== "null");

            this.ui.renderLastUpdated(globalStat);
            this.ui.renderGlobalCards(globalStat);
            this.ui.renderContinentOptions(this.allContinents);
            this.ui.renderContinentCards(this.allContinents);
            this.applyFilters({}); // pinta lista + gráfico con todo
            this.ui.showContent();
        } catch (err) {
            console.error(err);
            this.ui.showError(
                "Ocurrió un problema al conectarse con disease.sh. Revisa tu conexión a internet e inténtalo nuevamente."
            );
        }
    }

    /**
     * Filtra this.allCountries según búsqueda de texto y/o continente,
     * y vuelve a pintar la lista + el gráfico. Usa map/filter/sort/find.
     */
    applyFilters({search, continent} = {}) {
        this._search = search ?? this._search ?? "";
        this._continent = continent ?? this._continent ?? "all";

        let result = this.allCountries.filter((c) => {
            const matchesSearch = c.name.toLowerCase().includes(this._search.toLowerCase());
            const matchesContinent = this._continent === "all" || c.continent === this._continent;
            return matchesSearch && matchesContinent;
        });

        result = result.sort((a, b) => b.cases - a.cases).slice(0, 25);

        this.ui.renderCountriesList(result);
        this.ui.renderChart(result.length ? result : this.allCountries);
    }
}

/* ----------------------------------------------------------------
   5) ARRANQUE DE LA APP
   ---------------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
    const app = new CovidApp();
    app.init();
});


//comentario asdfasdfasd