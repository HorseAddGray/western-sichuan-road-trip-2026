const state = {
  data: null,
  config: null,
  runtimeAdapters: {},
  localMigrationAdapter: null,
  sharedAccessCode: "",
  expandedDay: null,
  countdownTimer: null,
  purchasedTickets: new Set(),
  todos: [],
  activeNoticeSubcategory: "health",
  noticeGroupOrder: {},
  noticeGroupLabels: {},
  collapsedNoticeGroups: new Set(),
  draggedNoticeGroup: "",
  selectedPackingSubcategories: new Set(),
  selectedPackingLuggage: "",
  selectedPackingContainer: "",
  selectedPackingOwner: "",
  selectedPackingProperty: "",
  packingSearchText: "",
  collapsedPackingCategories: new Set(),
  collapsedPackingOverviewCategories: new Set(),
  packingCustomCategories: {},
  packingCategoryLabels: {},
  deletedPackingCategories: new Set(),
  packingTagAssociations: {},
  packingCategoryOrder: [],
  expandedPackingDictionaryCategories: new Set(),
  activePackingDictionaryTab: "categories",
  editingPackingDictionaryCategory: "",
  addingPackingDictionaryTagCategory: "",
  packingDictionaryOutsideHandler: null,
  draggedPackingDictionaryTag: null,
  draggedPackingDictionaryCategory: "",
  packingAddDefaults: { subcategory: "documents", owner: "shared", property: "none", quantity: "1", usesTotal: "1" },
  packingLuggageLabels: {},
  packingCustomLuggage: [],
  deletedPackingLuggage: new Set(),
  packingLuggageParents: {},
  packingLuggageIcons: {},
  editingPackingLuggage: "",
  activePackingWorkspace: "details",
  packingPurchases: [],
  packingOverviewOwner: "all",
  removedPurchaseIds: new Set(),
  packingCheck: { active: false, index: 0, completed: false, openLuggage: [] },
  editingPackingTodoId: "",
  activeToiletMapDay: 0
};

const MODULE_NAMES = Object.freeze(["flights", "overview", "itinerary", "todo", "driving", "ledger"]);
const SHARED_COLLECTIONS = Object.freeze(["todos", "tickets", "ledger"]);
const OBSOLETE_PACKING_ITEM_IDS = new Set([
  "packing-documents", "packing-clothes", "packing-medicines", "packing-hygiene",
  "packing-weather", "packing-electronics", "packing-supplies"
]);

function normalizeTripConfig(raw = {}) {
  if (!raw || typeof raw !== "object" || raw.schemaVersion !== "1.0.0") throw new Error("trip-data.json config.schemaVersion must be 1.0.0");
  if (!raw.modules || typeof raw.modules !== "object") throw new Error("trip-data.json config must contain confirmed module switches");
  const modules = Object.fromEntries(MODULE_NAMES.map((name) => {
    if (typeof raw.modules[name] !== "boolean") throw new Error(`trip-data.json config.modules.${name} must be boolean`);
    return [name, raw.modules[name]];
  }));
  const mode = raw?.persistence?.mode;
  if (mode !== "local" && mode !== "d1") throw new Error("trip-data.json config.persistence.mode must be local or d1");
  const sharedCollections = mode === "d1" ? [...new Set(raw.persistence.sharedCollections || [])] : [];
  if (mode === "d1" && (!sharedCollections.length || sharedCollections.some((name) => !SHARED_COLLECTIONS.includes(name)))) {
    throw new Error("D1 mode requires an explicit sharedCollections allowlist");
  }
  const apiBase = raw.persistence.apiBase || "/api/trip";
  if (mode === "d1" && (!/^\/(?!\/)/.test(apiBase) || apiBase.includes("\\") || /[?#]/.test(apiBase))) {
    throw new Error("D1 apiBase must be a same-origin path");
  }
  return {
    ...raw,
    modules,
    persistence: {
      ...(raw.persistence || {}),
      mode,
      ...(mode === "d1" ? { apiBase, sharedCollections } : {})
    }
  };
}

function moduleEnabled(name) {
  return Boolean(state.config && state.config.modules?.[name] === true);
}

function applyModuleConfig() {
  document.querySelectorAll("[data-module]").forEach((element) => {
    element.hidden = !moduleEnabled(element.dataset.module);
  });
  const visibleTravelLinks = [...document.querySelectorAll(".travel-navigation-menu [data-module]")].filter((link) => !link.hidden);
  const travelNavigation = $("#travel-navigation");
  if (travelNavigation) travelNavigation.hidden = visibleTravelLinks.length === 0;
  document.documentElement.dataset.persistence = state.config.persistence.mode;

  const hashModules = {
    "#flights": "flights", "#route": "overview", "#itinerary": "itinerary",
    "#drive": "driving", "#packing": "todo", "#packing-overview": "todo", "#packing-details": "todo", "#packing-purchase": "todo", "#packing-check": "todo", "#packing-dictionary": "todo", "#notices": "todo", "#ledger": "ledger", "#ledger-stats": "ledger"
  };
  const requestedModule = hashModules[location.hash];
  if (requestedModule && !moduleEnabled(requestedModule)) {
    const firstVisible = visibleTravelLinks[0]?.getAttribute("href") || "#top";
    history.replaceState({ view: "travel" }, "", firstVisible);
  }
  window.dispatchEvent(new CustomEvent("travel-config:ready", { detail: { config: state.config } }));
}

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
document.addEventListener("click", (event) => {
  if (!event.target.closest(".todo-more")) {
    document.querySelectorAll(".todo-more[open]").forEach((menu) => { menu.open = false; });
  }
});
const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "'": "&#39;",
  '"': "&quot;"
})[character]);

const airportCity = (airport) => airport.city || airport.airportCode;

function localDateTime(date, time, _airportCode, utcOffset = "") {
  return new Date(`${date}T${time}:00${utcOffset || "+00:00"}`);
}

function countdownParts(target, now = new Date()) {
  const difference = target.getTime() - now.getTime();
  if (difference <= 0) return { difference, days: 0, hours: 0, minutes: 0 };
  const totalMinutes = Math.floor(difference / 60000);
  return {
    difference,
    days: Math.floor(totalMinutes / 1440),
    hours: Math.floor((totalMinutes % 1440) / 60),
    minutes: totalMinutes % 60
  };
}

function countdownText(target, completionText = "已出发") {
  const value = countdownParts(target);
  if (value.difference <= 0) return completionText;
  if (value.days > 0) return `${value.days}天 ${String(value.hours).padStart(2, "0")}小时`;
  if (value.hours > 0) return `${value.hours}小时 ${String(value.minutes).padStart(2, "0")}分`;
  return `${Math.max(1, value.minutes)}分钟`;
}

function preciseCountdownText(target, completionText = "已出发") {
  const difference = target.getTime() - Date.now();
  if (difference <= 0) return completionText;
  const totalSeconds = Math.floor(difference / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const clock = [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
  return days > 0 ? `${days}天 ${clock}` : clock;
}

function formatDate(dateString, includeYear = false) {
  const date = new Date(`${dateString}T12:00:00`);
  const options = includeYear
    ? { year: "numeric", month: "long", day: "numeric" }
    : { month: "long", day: "numeric" };
  return new Intl.DateTimeFormat("zh-CN", options).format(date);
}

function formatCompactDate(dateString) {
  const [, month, day] = dateString.split("-");
  return `${Number(month)}月${Number(day)}日`;
}

function todayForTrip() {
  const timeZone = state.data?.metadata?.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(new Date());
  } catch {
    return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  }
}

function mapsSearch(query) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function heroDestinationFor(trip) {
  const destinations = (trip.countries || []).filter((country) => (trip.primaryDestinationCountries || []).includes(country.code));
  const isDomestic = destinations.length > 0 && destinations.every((country) => country.code === "CN");
  const customTitle = String(trip.heroTitle || "").trim();
  if (customTitle) {
    return { title: customTitle, eyebrow: String(trip.heroEyebrow || "").trim(), destinations, isDomestic };
  }
  if (isDomestic) {
    const destination = String(trip.primaryDestinationName || trip.primaryDestinationCity || trip.citiesAndAreas?.[0] || "目的地待补充").trim();
    return {
      title: destination,
      eyebrow: String(trip.primaryDestinationNameEn || trip.primaryDestinationCityEn || "DOMESTIC JOURNEY").trim(),
      destinations,
      isDomestic
    };
  }
  return {
    title: destinations.map((country) => country.nameZh || country.name).join(" × ") || "目的地待补充",
    eyebrow: destinations.map((country) => country.nameEn || country.name).filter(Boolean).join(" × "),
    destinations,
    isDomestic
  };
}

function renderHero() {
  const { trip } = state.data;
  if (trip.status === "uninitialized") {
    document.title = state.data.metadata.title;
    $("#trip-title").textContent = "旅行计划待生成";
    $("#trip-eyebrow").textContent = "READY FOR YOUR JOURNEY";
    $("#wordmark").innerHTML = "TRIP <span>· READY</span>";
    $("#footer-mark").textContent = "TRIP · READY";
    $("#route-day-count").textContent = "0 DAYS";
    $("#trip-date").textContent = "等待旅行资料";
    return;
  }
  const hero = heroDestinationFor(trip);
  const { destinations } = hero;
  const shortMark = destinations.map((country) => country.code).join(" / ");
  const year = trip.startDate.slice(0, 4);
  document.title = state.data.metadata.title;
  $("#trip-title").textContent = hero.title;
  $("#trip-eyebrow").textContent = hero.eyebrow;
  $("#wordmark").innerHTML = `${escapeHtml(shortMark)} <span>· ${escapeHtml(year)}</span>`;
  $("#footer-mark").textContent = `${shortMark} · ${year}`;
  $("#route-day-count").textContent = `${trip.dayCount} DAYS`;
  $("#trip-date").textContent = `${formatCompactDate(trip.startDate)} — ${formatCompactDate(trip.endDate)} · ${trip.dayCount}天`;
}

function journeyFlights(journeyId) {
  return state.data.flights
    .filter((flight) => flight.journeyId === journeyId)
    .sort((first, second) => first.sequence - second.sequence);
}

function journeyStatusAndTarget(flights) {
  const now = new Date();
  for (const flight of flights) {
    const departure = localDateTime(flight.departure.date, flight.departure.time, flight.departure.airportCode, flight.departure.utcOffset);
    const arrival = localDateTime(flight.arrival.date, flight.arrival.time, flight.arrival.airportCode, flight.arrival.utcOffset);
    if (now < departure) return { target: departure, label: flight === flights[0] ? "距离起飞还剩" : "距离下一程起飞还剩", complete: false };
    if (now < arrival) return { target: arrival, label: "飞行中 · 距抵达", complete: false };
  }
  return { target: null, label: "已抵达", complete: true };
}

function relativeFlightDate(date, journeyStartDate) {
  if (date === journeyStartDate) return formatCompactDate(date);
  const difference = Math.round((new Date(`${date}T12:00:00`) - new Date(`${journeyStartDate}T12:00:00`)) / 86400000);
  return difference === 1 ? "次日" : formatCompactDate(date);
}

function flightStopMarkup(stop, position, journeyStartDate) {
  let timing;
  if (position === 0) {
    timing = `<span>${escapeHtml(relativeFlightDate(stop.departure.date, journeyStartDate))}</span><b>${escapeHtml(stop.departure.time)} 出发</b>`;
  } else if (position === stop.totalStops - 1) {
    timing = `<span>${escapeHtml(relativeFlightDate(stop.arrival.date, journeyStartDate))}</span><b>${escapeHtml(stop.arrival.time)} 抵达</b>`;
  } else {
    const nextFlight = stop.nextFlight;
    const connection = nextFlight.connectionFromPrevious || {};
    const duration = connection.calculatedFromSchedule || connection.durationUsingTicketTimes || connection.plannedDurationText || "中转";
    timing = `
      <span>${escapeHtml(stop.arrival.time)} 抵达</span>
      <em>${escapeHtml(duration)}</em>
      <b>${escapeHtml(relativeFlightDate(nextFlight.departure.date, journeyStartDate))} ${escapeHtml(nextFlight.departure.time)}</b>
      <span>起飞</span>
    `;
  }
  return `
    <div class="flight-stop${position > 0 && position < stop.totalStops - 1 ? " is-transfer" : ""}">
      <span class="flight-stop__code">${escapeHtml(stop.airport.airportCode)}</span>
      <span class="flight-stop__city">${escapeHtml(airportCity(stop.airport))}</span>
      <span class="flight-stop__dot" aria-hidden="true"></span>
      <div class="flight-stop__timing">${timing}</div>
    </div>
  `;
}

function flightMissingFieldLabel(field) {
  return ({
    carrierId: "航空公司",
    flightNumber: "航班号",
    departure: "起飞信息",
    arrival: "抵达信息",
    departurePlace: "出发机场",
    arrivalPlace: "抵达机场",
    departureTime: "起飞时间",
    arrivalTime: "抵达时间",
    timeZone: "当地时区"
  })[field] || String(field || "待补充信息");
}

function flightPlaceholderCard(journey, index) {
  const missingFields = [...new Set(journey.missingFields || [])].map(flightMissingFieldLabel);
  return `
    <article class="flight-card flight-card--placeholder" data-journey="${escapeHtml(journey.id)}">
      <div class="flight-card__top">
        <span>FLIGHT ${String(index + 1).padStart(2, "0")} / ${String(state.data.flightJourneys.length).padStart(2, "0")}</span>
      </div>
      <div class="flight-placeholder">
        <span class="flight-placeholder__eyebrow">资料待补充</span>
        <h3>${escapeHtml(journey.title || "航班信息待补充")}</h3>
        <p>已按第二轮确认继续生成标准预览；系统没有猜测或伪造缺失的航班事实。</p>
        ${missingFields.length ? `<ul>${missingFields.map((field) => `<li>${escapeHtml(field)}</li>`).join("")}</ul>` : ""}
      </div>
      <div class="flight-card__countdown-row">
        <div class="flight-countdown" data-countdown-journey="${escapeHtml(journey.id)}" data-placeholder="true">
          <span>当前状态</span>
          <strong>待补充</strong>
        </div>
      </div>
    </article>
  `;
}

function flightCard(journey, index) {
  const flights = journeyFlights(journey.id);
  if (journey.placeholder || journey.status === "missing" || journey.status === "pending" || !flights.length || flights.some((flight) => flight.placeholder)) {
    return flightPlaceholderCard(journey, index);
  }
  const first = flights[0];
  const last = flights[flights.length - 1];
  const status = journeyStatusAndTarget(flights);
  const countdown = status.complete ? "已完成" : preciseCountdownText(status.target, "即将出发");
  const stops = [
    { airport: first.departure, departure: first.departure },
    ...flights.map((flight, flightIndex) => ({
      airport: flight.arrival,
      arrival: flight.arrival,
      nextFlight: flights[flightIndex + 1]
    }))
  ];
  const routeItems = [];
  stops.forEach((stop, stopIndex) => {
    routeItems.push(flightStopMarkup({ ...stop, totalStops: stops.length }, stopIndex, first.departure.date));
    if (stopIndex < flights.length) {
      const flight = flights[stopIndex];
      routeItems.push(`
        <div class="flight-segment">
          <span>${escapeHtml(flight.flightNumber)}</span>
          <i aria-hidden="true">→</i>
        </div>
      `);
    }
  });
  return `
    <article class="flight-card" data-journey="${escapeHtml(journey.id)}">
      <div class="flight-card__top">
        <span>FLIGHT ${String(index + 1).padStart(2, "0")} / ${String(state.data.flightJourneys.length).padStart(2, "0")}</span>
      </div>
      <div class="flight-card__airlines">${escapeHtml([...new Set(flights.map((flight) => flight.airline.nameZh || flight.airline.name))].join(" · "))}</div>
      <div class="flight-flow" style="--route-columns: ${stops.map((_, stopIndex) => stopIndex < stops.length - 1 ? "minmax(0,1fr) minmax(34px,.5fr)" : "minmax(0,1fr)").join(" ")}">
        ${routeItems.join("")}
      </div>
      <div class="flight-card__countdown-row">
        <div class="flight-countdown" data-countdown-journey="${escapeHtml(journey.id)}">
          <span>${escapeHtml(status.label)}</span>
          <strong>${escapeHtml(countdown)}</strong>
        </div>
      </div>
    </article>
  `;
}

function renderFlights() {
  const journeys = state.data.flightJourneys;
  $("#flight-carousel").innerHTML = journeys.map(flightCard).join("");
  $("#flight-dots").innerHTML = journeys.map((_, index) => `<span class="carousel-dot${index === 0 ? " is-active" : ""}"></span>`).join("");
  $("#flight-index").textContent = `1 / ${journeys.length}`;

  const carousel = $("#flight-carousel");
  let scheduled = false;
  carousel.addEventListener("scroll", () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      const cards = $$(".flight-card", carousel);
      const center = carousel.scrollLeft + carousel.clientWidth / 2;
      let activeIndex = 0;
      let distance = Infinity;
      cards.forEach((card, index) => {
        const cardCenter = card.offsetLeft + card.offsetWidth / 2;
        if (Math.abs(cardCenter - center) < distance) {
          distance = Math.abs(cardCenter - center);
          activeIndex = index;
        }
      });
      $$(".carousel-dot", $("#flight-dots")).forEach((dot, index) => dot.classList.toggle("is-active", index === activeIndex));
      $("#flight-index").textContent = `${activeIndex + 1} / ${journeys.length}`;
      scheduled = false;
    });
  }, { passive: true });
}

function updateFlightCountdowns() {
  state.data.flightJourneys.forEach((journey) => {
    const target = $(`[data-countdown-journey="${journey.id}"]`);
    if (!target || target.dataset.placeholder === "true" || journey.placeholder) return;
    const status = journeyStatusAndTarget(journeyFlights(journey.id));
    $("strong", target).textContent = status.complete ? "已完成" : preciseCountdownText(status.target, "即将出发");
    $("span", target).textContent = status.label;
  });
}

function costText(cost) {
  if (cost.amount !== undefined) return `${cost.item} · ${cost.currency} ${cost.amount}`;
  if (cost.standard !== undefined && cost.standard !== null) return `${cost.item} · ${cost.currency} ${cost.standard}`;
  if (cost.discounted !== undefined && cost.discounted !== null) return `${cost.item} · ${cost.currency} ${cost.discounted}`;
  if (cost.amountOptions) return `${cost.item} · ${cost.currency} ${cost.amountOptions.join(" / ")}`;
  return cost.item;
}

function ticketsForDay(day) {
  if (!moduleEnabled("itinerary")) return [];
  return (state.data.ticketPlanning?.items || []).filter((ticket) =>
    ticket.dayId ? ticket.dayId === day.id : ticket.day === day.day
  );
}

function ticketsForSchedule(day, item) {
  if (!moduleEnabled("itinerary")) return [];
  const tickets = ticketsForDay(day);
  if (Array.isArray(item.ticketIds)) return tickets.filter((ticket) => item.ticketIds.includes(ticket.id));
  if (item.id) {
    const explicit = tickets.filter((ticket) => (ticket.scheduleItemIds || ticket.itemIds || []).includes(item.id));
    if (explicit.length) return explicit;
  }
  const lowerText = String(item.text || item.title || "").toLocaleLowerCase();
  return tickets.filter((ticket) => (ticket.scheduleMatchTerms || []).some((term) => lowerText.includes(term.toLocaleLowerCase())));
}

function isTicketPurchased(ticket) {
  return ticket.purchaseStatus === "purchased" || state.purchasedTickets.has(ticket.id);
}

function ticketRequirement(ticket) {
  return ({
    "advance-required": "需提前购票",
    "advance-recommended": "建议预约",
    "needs-confirmation": "购票方式待确认"
  })[ticket.requirement] || "门票信息";
}

function ticketTitle(ticket) {
  return ticket.name || ticket.attraction?.nameZh || ticket.attraction?.name || "门票详情";
}

function ticketGuidance(ticket) {
  const guidance = ticket.guidance || ticket.notes || [];
  return Array.isArray(guidance) ? guidance.join("·") : String(guidance || "");
}

function ticketDocument(ticket) {
  const document = ticket.document || ticket.booking?.document;
  if (document && typeof document === "object") {
    return { url: document.url || document.path || "", type: document.type || "", label: document.label || "查看票据" };
  }
  const url = ticket.documentUrl || ticket.booking?.documentUrl || "";
  return url ? { url, type: "", label: ticket.documentLabel || "查看票据" } : null;
}

function inlineTicketMarkup(ticket) {
  const purchased = isTicketPurchased(ticket);
  const title = ticketTitle(ticket);
  return `
    <div class="schedule-ticket ${purchased ? "is-purchased" : `is-${escapeHtml(ticket.requirement)}`}" data-inline-ticket="${escapeHtml(ticket.id)}">
      <label class="schedule-ticket__toggle">
        <input type="checkbox" value="${escapeHtml(ticket.id)}" ${purchased ? "checked" : ""} aria-label="${purchased ? "取消已购票" : "标记为已购票"}：${escapeHtml(title)}">
        <span class="schedule-ticket__check" aria-hidden="true">✓</span>
        <span class="schedule-ticket__content">
          <span class="schedule-ticket__status">${purchased ? "已购票" : escapeHtml(ticketRequirement(ticket))}</span>
          <strong>${escapeHtml(title)}</strong>
          <small>${escapeHtml(ticketGuidance(ticket))}</small>
        </span>
      </label>
      <button type="button" class="schedule-ticket__open" data-ticket-open="${escapeHtml(ticket.id)}" aria-haspopup="dialog" aria-controls="ticket-dialog">查看</button>
    </div>`;
}

function dayCard(day) {
  const today = todayForTrip();
  const isToday = day.date === today;
  const expanded = state.expandedDay === day.day;
  const schedule = day.schedule.map((item) => {
    const destinations = navigationDestinations(item);
    const mapLinks = destinations.map((destination) => `
      <button type="button" class="schedule-map-link" data-map-query="${escapeHtml(destination.query)}" data-map-url="${escapeHtml(destination.url || "")}" data-map-label="${escapeHtml(destination.label)}" aria-haspopup="dialog" aria-controls="place-map" aria-label="查看 ${escapeHtml(destination.label)} 的地图">📍 ${escapeHtml(destination.label)}</button>
    `).join("");
    const scheduleTickets = ticketsForSchedule(day, item).map(inlineTicketMarkup).join("");
    return `
      <li class="schedule-item">
        <span class="schedule-time">${escapeHtml(item.time)}</span>
        <div class="schedule-content">
          <div class="schedule-text">${escapeHtml(item.text)}</div>
          ${scheduleTickets}
          ${mapLinks ? `<div class="schedule-map-links">${mapLinks}</div>` : ""}
        </div>
      </li>
    `;
  }).join("");
  const notes = [...(day.notes || []), ...(day.sourceDateLabelConflict ? [day.sourceDateLabelConflict] : [])];
  const costs = (day.costReferences || []).map((cost) => `<span class="cost-tag">${escapeHtml(costText(cost))}</span>`).join("");
  const dayTickets = ticketsForDay(day);
  const pendingTicketCount = dayTickets.filter((ticket) => !isTicketPurchased(ticket)).length;
  const ticketSummary = dayTickets.length
    ? `<span class="day-ticket-summary ${pendingTicketCount ? "has-pending" : "is-complete"}">${pendingTicketCount ? `${pendingTicketCount} 项待购票` : "门票已准备"}</span>`
    : "";
  return `
    <article class="day-card${isToday ? " is-today" : ""}" data-day="${day.day}">
      <span class="day-dot" aria-hidden="true"></span>
      <button class="day-toggle" type="button" aria-expanded="${expanded}" aria-controls="day-detail-${day.day}">
        <span>
          <span class="day-meta">DAY ${String(day.day).padStart(2, "0")} · ${escapeHtml(formatCompactDate(day.date))}${isToday ? " · 今天" : ""}</span>
          <span class="day-title">${escapeHtml(day.title)}</span>
          <span class="day-locations">${escapeHtml(day.locations.join(" → "))}</span>
          ${ticketSummary}
        </span>
        <span class="day-chevron" aria-hidden="true">+</span>
      </button>
      <div class="day-detail" id="day-detail-${day.day}" ${expanded ? "" : "hidden"}>
        <ol class="schedule">${schedule}</ol>
        ${costs ? `<div class="costs">${costs}</div>` : ""}
        ${notes.map((note) => `<p class="detail-note">${escapeHtml(note)}</p>`).join("")}
      </div>
    </article>
  `;
}

function navigationDestinations(item) {
  const policy = state.data.mapLinks?.navigationPolicy || { noNavigationTypes: [], selfNavigationTypes: [] };
  if (policy.noNavigationTypes.includes(item.type)) return [];
  const referencedPlaceIds = [...new Set([
    ...(Array.isArray(item.placeIds) ? item.placeIds : []),
    ...(item.placeId ? [item.placeId] : [])
  ])];
  if (referencedPlaceIds.length) {
    return referencedPlaceIds.map((placeId) => state.data.places.find((place) => place.id === placeId)).filter(Boolean).map((place) => ({
      id: place.id,
      label: place.nameZh || place.name,
      query: place.navigation?.query || place.googleMapsQuery || place.address || `${place.nameZh || place.name}${place.cityOrArea ? `, ${place.cityOrArea}` : ""}`,
      directUrl: Boolean(place.navigation?.url || place.googleMapsUrl),
      url: place.navigation?.url || place.googleMapsUrl || ""
    }));
  }
  const text = String(item.text || item.title || "");
  const lowerText = text.toLocaleLowerCase();
  const explicit = (state.data.mapLinks?.navigationPlaces || [])
    .filter((place) => place.matchTerms.some((term) => lowerText.includes(term.toLocaleLowerCase())))
    .map((place) => ({
      id: place.id,
      label: place.label,
      query: place.query,
      priority: place.priority || 1,
      matchIndex: Math.max(...place.matchTerms.map((term) => lowerText.lastIndexOf(term.toLocaleLowerCase())))
    }));
  const highestExplicitPriority = explicit.reduce((highest, place) => Math.max(highest, place.priority), 0);
  const selectedExplicit = highestExplicitPriority > 1
    ? explicit.filter((place) => place.priority === highestExplicitPriority)
    : explicit;

  const catalogPlaces = state.data.places
    .filter((place) => [place.name, place.nameZh].filter(Boolean).some((name) => lowerText.includes(name.toLocaleLowerCase())))
    .map((place) => ({
      id: place.id,
      label: place.nameZh || place.name,
      query: place.googleMapsUrl || [place.name, place.cityOrArea].filter(Boolean).join(", "),
      directUrl: Boolean(place.googleMapsUrl),
      matchIndex: Math.max(...[place.name, place.nameZh].filter(Boolean).map((name) => lowerText.lastIndexOf(name.toLocaleLowerCase())))
    }));

  const restaurants = state.data.restaurants
    .filter((restaurant) => lowerText.includes(restaurant.name.toLocaleLowerCase()))
    .map((restaurant) => ({
      id: `restaurant-${restaurant.name}`,
      label: restaurant.name,
      query: restaurant.googleMapsUrl || `${restaurant.name}, ${restaurant.city}`,
      directUrl: Boolean(restaurant.googleMapsUrl),
      matchIndex: lowerText.lastIndexOf(restaurant.name.toLocaleLowerCase())
    }));

  const specificExplicit = selectedExplicit.filter((place) => place.priority > 1);
  let destinations = specificExplicit.length
    ? [...specificExplicit, ...restaurants]
    : catalogPlaces.length
      ? [...catalogPlaces, ...restaurants]
      : [...selectedExplicit, ...restaurants];
  destinations = destinations.filter((place, index, all) => all.findIndex((candidate) => candidate.id === place.id) === index);

  if (policy.selfNavigationTypes.includes(item.type) && destinations.length > 1 && !specificExplicit.length) {
    destinations.sort((first, second) => second.matchIndex - first.matchIndex);
    return [destinations[0]];
  }
  return destinations;
}

function currentTripDay() {
  const today = todayForTrip();
  return state.data.days.find((day) => day.date === today)?.day || null;
}

function renderTimeline() {
  const today = currentTripDay();
  state.expandedDay = today;
  $("#day-count").textContent = `${state.data.days.length} DAYS`;
  $("#timeline").innerHTML = state.data.days.map(dayCard).join("");
  $("#timeline").onclick = (event) => {
    const ticketButton = event.target.closest("[data-ticket-open]");
    if (ticketButton) {
      openTicketDialog(ticketButton.dataset.ticketOpen, ticketButton);
      return;
    }
    const toggle = event.target.closest(".day-toggle");
    if (!toggle) return;
    const card = toggle.closest(".day-card");
    const dayNumber = Number(card.dataset.day);
    const wasExpanded = toggle.getAttribute("aria-expanded") === "true";
    $$(".day-toggle", $("#timeline")).forEach((button) => button.setAttribute("aria-expanded", "false"));
    $$(".day-detail", $("#timeline")).forEach((detail) => { detail.hidden = true; });
    if (!wasExpanded) {
      toggle.setAttribute("aria-expanded", "true");
      $(`#day-detail-${dayNumber}`).hidden = false;
      state.expandedDay = dayNumber;
    } else {
      state.expandedDay = null;
    }
  };
  $("#timeline").onchange = (event) => {
    const checkbox = event.target.closest(".schedule-ticket input[type='checkbox']");
    if (!checkbox) return;
    if (checkbox.checked) state.purchasedTickets.add(checkbox.value);
    else state.purchasedTickets.delete(checkbox.value);
    saveTicketState(checkbox.value, checkbox.checked);
    updateInlineTicketState(checkbox.value, checkbox.checked);
  };
}

function updateInlineTicketState(ticketId, purchased) {
  const ticketData = state.data.ticketPlanning.items.find((item) => item.id === ticketId);
  if (!ticketData) return;
  $$(`[data-inline-ticket="${ticketId}"]`).forEach((ticket) => {
    ticket.classList.toggle("is-purchased", purchased);
    ticket.querySelector("input").checked = purchased;
    ticket.querySelector("input").setAttribute("aria-label", `${purchased ? "取消已购票" : "标记为已购票"}：${ticketTitle(ticketData)}`);
    ticket.querySelector(".schedule-ticket__status").textContent = purchased ? "已购票" : ticketRequirement(ticketData);
  });
  const day = state.data.days.find((item) => ticketData.dayId ? item.id === ticketData.dayId : item.day === ticketData.day);
  const dayCardElement = day ? $(`[data-day="${day.day}"]`) : null;
  const badge = dayCardElement ? $(".day-ticket-summary", dayCardElement) : null;
  const dayTickets = day ? ticketsForDay(day) : [];
  const pending = dayTickets.filter((ticket) => !isTicketPurchased(ticket)).length;
  if (!badge) return;
  badge.textContent = pending ? `${pending} 项待购票` : "门票已准备";
  badge.classList.toggle("has-pending", pending > 0);
  badge.classList.toggle("is-complete", pending === 0);
}

async function loadTicketState() {
  state.purchasedTickets = new Set();
}

function saveTicketState(ticketId, completed) {
  return saveSharedChange("tickets", { id: ticketId, completed }, completed ? "upsert" : "delete").catch(console.error);
}

function rentalStatus(rental) {
  const pickup = new Date(`${rental.pickup.date}T${rental.pickup.time}:00${rental.pickup.utcOffset || "+00:00"}`);
  const dropoff = new Date(`${rental.dropoff.date}T${rental.dropoff.time}:00${rental.dropoff.utcOffset || "+00:00"}`);
  const now = new Date();
  if (now < pickup) return { label: "距取车", target: pickup, complete: false };
  if (now < dropoff) return { label: "距还车", target: dropoff, complete: false };
  return { label: "已超过预约还车时间", target: dropoff, complete: true };
}

function renderRental() {
  const transport = state.data.groundTransport;
  const rental = transport.rentalCar;
  $("#rental-provider-label").textContent = rental.company;
  const status = rentalStatus(rental);
  const vehicle = rental.vehicle || {};
  const price = rental.price || {};
  $("#rental-card").innerHTML = `
    <article class="rental-panel">
      <div class="return-deadline">
        <span class="return-deadline__label">重要 · 还车截止时间</span>
        <strong>${escapeHtml(formatCompactDate(rental.dropoff.date))} <time>${escapeHtml(rental.dropoff.time)}</time> 前</strong>
        <span>${escapeHtml(rental.dropoff.timeZoneLabel)}</span>
        <p>${escapeHtml(rental.dropoff.vehicleReturnPoint)}</p>
        <div class="return-deadline__timer" id="return-deadline-timer"></div>
        <p class="return-deadline__warning">${escapeHtml(rental.dropoff.deadlineWarning)}</p>
        <small>建议 ${escapeHtml(rental.dropoff.recommendedArrivalTime)} 抵达机场区域，预留还车及值机时间。</small>
      </div>
      <div class="rental-countdown" id="rental-countdown">
        <span>${escapeHtml(status.label)}</span>
        <strong>${status.complete ? `请立即联系 ${escapeHtml(rental.company)}` : escapeHtml(countdownText(status.target))}</strong>
        <small>${formatCompactDate(rental.dropoff.date)} ${escapeHtml(rental.dropoff.time)} 前 · ${escapeHtml(rental.dropoff.vehicleReturnPoint)}</small>
      </div>
      <div class="rental-details">
        <div class="rental-car">${escapeHtml(rental.company)} · ${escapeHtml(vehicle.example)}</div>
        <div class="rental-sub">${escapeHtml(vehicle.class)} · ${rental.unlimitedKilometers ? "无限里程" : "里程条款见订单"}</div>
        <div class="rental-stops">
          <div class="rental-stop">
            <span class="rental-stop__label">PICK UP</span>
            <div><b>${formatCompactDate(rental.pickup.date)} ${escapeHtml(rental.pickup.time)}</b><span>${escapeHtml(rental.pickup.location)}<br>${escapeHtml(rental.pickup.address)}</span></div>
          </div>
          <div class="rental-stop">
            <span class="rental-stop__label">RETURN</span>
            <div><b>${formatCompactDate(rental.dropoff.date)} ${escapeHtml(rental.dropoff.time)}</b><span>${escapeHtml(rental.dropoff.vehicleReturnPoint)}<br>建议 ${escapeHtml(rental.dropoff.recommendedArrivalTime)} 抵达机场区域</span></div>
          </div>
        </div>
        <div class="rental-price"><span>柜台支付 · ${rental.rentalPeriodDays} 天</span><strong>${escapeHtml(price.currency)} ${Number(price.payAtCounter).toFixed(2)}</strong></div>
      </div>
    </article>
  `;
  const insurance = (rental.insurance || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const panels = {
    checklist: transport.rentalChecklist.map((rule) => `<li>${escapeHtml(rule)}</li>`).join(""),
    insurance,
    driving: `${(transport.drivingNotes || []).map((rule) => `<li>${escapeHtml(rule)}</li>`).join("")}${(transport.drivingReferenceLinks || []).map((link) => `<li><a href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(link.label)} ↗</a></li>`).join("")}`
  };
  const notes = $("#drive-notes");
  notes.innerHTML = `
    <div class="drive-note-tabs" role="group" aria-label="自驾注意事项">
      <button type="button" aria-expanded="true" aria-controls="drive-note-content" data-drive-note="checklist">取还车检查</button>
      <button type="button" aria-expanded="false" aria-controls="drive-note-content" data-drive-note="insurance">订单保障</button>
      <button type="button" aria-expanded="false" aria-controls="drive-note-content" data-drive-note="driving">驾驶提醒</button>
    </div>
    <div class="drive-note-panel" id="drive-note-content"><ul>${panels.checklist}</ul></div>`;
  notes.onclick = (event) => {
    const button = event.target.closest("button[data-drive-note]");
    if (!button) return;
    const collapse = button.getAttribute("aria-expanded") === "true";
    $$("button[data-drive-note]", notes).forEach((item) => item.setAttribute("aria-expanded", String(item === button && !collapse)));
    const panel = $(".drive-note-panel", notes);
    panel.hidden = collapse;
    if (!collapse) panel.innerHTML = `<ul>${panels[button.dataset.driveNote]}</ul>`;
  };
}

function updateRentalCountdown() {
  const dropoff = state.data.groundTransport.rentalCar.dropoff;
  const deadline = new Date(`${dropoff.date}T${dropoff.time}:00${dropoff.utcOffset}`);
  const remaining = deadline.getTime() - Date.now();
  $("#return-deadline-timer").textContent = remaining > 0
    ? `距还车截止 ${preciseCountdownText(deadline)}`
    : "预约还车时间已过 · 如尚未还车，请立即联系租车公司";
  $(".return-deadline").classList.toggle("is-urgent", remaining <= 86400000);
  const panel = $("#rental-countdown");
  if (!panel) return;
  const status = rentalStatus(state.data.groundTransport.rentalCar);
  $("span", panel).textContent = status.label;
  $("strong", panel).textContent = status.complete ? `请立即联系 ${state.data.groundTransport.rentalCar.company}` : countdownText(status.target);
}

function loadTodoState() { state.todos = []; }

function removedAuthoredPackingTodoIdsKey() {
  return `travel-plan:${state.data.metadata.tripId}:removed-authored-packing-todos`;
}

function readRemovedAuthoredPackingTodoIds() {
  try {
    const value = JSON.parse(localStorage.getItem(removedAuthoredPackingTodoIdsKey()) || "[]");
    return new Set(Array.isArray(value) ? value.map(String) : []);
  } catch {
    return new Set();
  }
}

function rememberRemovedAuthoredPackingTodo(todo) {
  const authoredPackingIds = new Set((state.data.preTrip?.packingItems || [])
    .filter((item) => window.TravelPrep.normalizeTodoCategory(item) === "packing")
    .map((item) => String(item.id)));
  if (!authoredPackingIds.has(String(todo.id))) return;
  const removed = readRemovedAuthoredPackingTodoIds();
  removed.add(String(todo.id));
  localStorage.setItem(removedAuthoredPackingTodoIdsKey(), JSON.stringify([...removed]));
}

function sharedAccessCodeStorageKey() {
  return `travel-plan:${state.data.metadata.tripId}:shared-access-code`;
}

function d1LocalMigrationKey() {
  return `travel-plan:${state.data.metadata.tripId}:d1-todos-migrated`;
}

function requestSharedAccessCode(errorMessage = "") {
  const storedCode = String(localStorage.getItem(sharedAccessCodeStorageKey()) || "").trim();
  if (storedCode) return Promise.resolve(storedCode);
  const gate = $("#shared-access-gate");
  const form = $("#shared-access-form");
  const input = $("#shared-access-code");
  const error = $("#shared-access-error");
  if (!gate || !form || !input || !error) throw new Error("Shared access gate is required for D1 mode");
  error.hidden = !errorMessage;
  error.textContent = errorMessage;
  gate.hidden = false;
  window.setTimeout(() => input.focus(), 0);
  return new Promise((resolve) => {
    form.onsubmit = (event) => {
      event.preventDefault();
      const code = input.value.trim();
      if (!code) {
        error.hidden = false;
        error.textContent = "请输入邀请码。";
        input.focus();
        return;
      }
      localStorage.setItem(sharedAccessCodeStorageKey(), code);
      gate.hidden = true;
      input.value = "";
      resolve(code);
    };
  });
}

async function loadConfiguredRuntimeState() {
  const sharedMode = state.config.persistence.mode === "d1";
  let accessError = "";
  while (true) {
    if (sharedMode) state.sharedAccessCode = await requestSharedAccessCode(accessError);
    createRuntimeAdapters();
    try {
      await loadSharedState();
      return;
    } catch (error) {
      if (!sharedMode || !/^API 401$/.test(error.message)) throw error;
      localStorage.removeItem(sharedAccessCodeStorageKey());
      state.sharedAccessCode = "";
      accessError = "邀请码不正确，请向马甲或仔仔确认后重试。";
    }
  }
}

function createRuntimeAdapters() {
  const storage = window.TravelRuntimeStorage;
  if (!storage?.createAdapter) throw new Error("runtime-storage.js is required");
  const persistence = state.config.persistence || { mode: "local" };
  const sharedCollections = new Set(Array.isArray(persistence.sharedCollections)
    ? persistence.sharedCollections
    : ["todos", "tickets", "ledger"]);
  const tripId = state.data.metadata.tripId;
  const enabledCollections = [
    ...(moduleEnabled("todo") ? ["todos"] : []),
    ...(moduleEnabled("itinerary") ? ["tickets"] : [])
  ];
  const localCollections = enabledCollections.filter((collection) => persistence.mode !== "d1" || !sharedCollections.has(collection));
  const d1Collections = enabledCollections.filter((collection) => persistence.mode === "d1" && sharedCollections.has(collection));
  const localAdapter = localCollections.length ? storage.createAdapter({ mode: "local", tripId, collections: localCollections }) : null;
  const d1Adapter = d1Collections.length ? storage.createAdapter({
    mode: "d1",
    tripId,
    apiBase: persistence.apiBase || "/api/trip",
    collections: d1Collections,
    accessCode: state.sharedAccessCode
  }) : null;
  state.localMigrationAdapter = d1Collections.length
    ? storage.createAdapter({ mode: "local", tripId, collections: d1Collections })
    : null;
  state.runtimeAdapters = {};
  localCollections.forEach((collection) => { state.runtimeAdapters[collection] = localAdapter; });
  d1Collections.forEach((collection) => { state.runtimeAdapters[collection] = d1Adapter; });
}

function authoredTodosForMigration() {
  return (state.data.preTrip?.todoItems || state.data.preTrip?.packingItems || []).map((item, index) => ({
    id: String(item.id || `todo-initial-${index + 1}`),
    text: String(item.text || item.title || "").trim(),
    category: window.TravelPrep.normalizeTodoCategory(item),
    subcategory: window.TravelPrep.normalizeTodoSubcategory(item),
    luggage: String(item.luggage || "").trim(),
    owner: String(item.owner || "unassigned").trim(),
    property: String(item.property || "").trim(),
    container: String(item.container || "").trim(),
    usesTotal: Number(item.usesTotal || 0),
    usesRemaining: Number(item.usesRemaining || 0),
    checked: Boolean(item.checked),
    detail: String(item.detail || "").trim(),
    group: String(item.group || "").trim(),
    completed: Boolean(item.completed)
  })).filter((item) => item.text && !OBSOLETE_PACKING_ITEM_IDS.has(item.id));
}

async function migrateLocalTodosToD1(todoAdapter, remoteInitialized) {
  if (todoAdapter?.mode !== "d1" || !state.localMigrationAdapter) return;
  if (localStorage.getItem(d1LocalMigrationKey()) === "1") return;
  const localSnapshot = await state.localMigrationAdapter.load();
  const localTodos = Array.isArray(localSnapshot.todos) ? localSnapshot.todos.filter((todo) => !OBSOLETE_PACKING_ITEM_IDS.has(todo.id)) : [];
  const hasLegacySnapshot = Boolean(state.localMigrationAdapter.storageKey && localStorage.getItem(state.localMigrationAdapter.storageKey));
  const todosToMigrate = localTodos.length ? localTodos : (!remoteInitialized && !hasLegacySnapshot ? authoredTodosForMigration() : []);
  if (!todosToMigrate.length) return;
  state.todos = todosToMigrate;
  await Promise.all(todosToMigrate.map((todo) => todoAdapter.applyChange("todos", todo, "upsert")));
  localStorage.setItem(d1LocalMigrationKey(), "1");
}

async function loadSharedState() {
  const adapters = [...new Set(Object.values(state.runtimeAdapters).filter(Boolean))];
  const todoAdapter = state.runtimeAdapters.todos;
  const snapshots = await Promise.all(adapters.map(async (adapter) => [adapter, await adapter.load()]));
  const snapshotFor = (collection) => snapshots.find(([adapter]) => adapter === state.runtimeAdapters[collection])?.[1] || {};
  const todoSnapshot = snapshotFor("todos");
  const ticketSnapshot = snapshotFor("tickets");
  state.todos = Array.isArray(todoSnapshot.todos) ? todoSnapshot.todos : [];
  if (state.todos.length === 0) await migrateLocalTodosToD1(todoAdapter, Boolean(todoSnapshot.initialized));
  state.purchasedTickets = new Set((Array.isArray(ticketSnapshot.tickets) ? ticketSnapshot.tickets : []).filter((item) => item.completed).map((item) => item.id));
  const authoredTodos = state.data.preTrip?.todoItems || state.data.preTrip?.packingItems || [];
  if (todoAdapter?.mode === "local" && authoredTodos.length) {
    const removedAuthoredTodoIds = readRemovedAuthoredPackingTodoIds();
    const obsoleteTodos = state.todos.filter((todo) => OBSOLETE_PACKING_ITEM_IDS.has(todo.id));
    if (obsoleteTodos.length) {
      state.todos = state.todos.filter((todo) => !OBSOLETE_PACKING_ITEM_IDS.has(todo.id));
      await Promise.all(obsoleteTodos.map((todo) => todoAdapter.applyChange("todos", { id: todo.id }, "delete")));
    }
    const existingIds = new Set(state.todos.map((item) => String(item.id)));
    const missingTodos = authoredTodos.map((item, index) => ({
      id: String(item.id || `todo-initial-${index + 1}`),
      text: String(item.text || item.title || "").trim(),
      category: window.TravelPrep.normalizeTodoCategory(item),
      subcategory: window.TravelPrep.normalizeTodoSubcategory(item),
      luggage: String(item.luggage || "").trim(),
      owner: String(item.owner || "unassigned").trim(),
      property: String(item.property || "").trim(),
      container: String(item.container || "").trim(),
      usesTotal: Number(item.usesTotal || 0),
      usesRemaining: Number(item.usesRemaining || 0),
      checked: Boolean(item.checked),
      detail: String(item.detail || "").trim(),
      group: String(item.group || "").trim(),
      completed: Boolean(item.completed)
    })).filter((item) => item.text && !existingIds.has(item.id) && !removedAuthoredTodoIds.has(item.id));
    state.todos.push(...missingTodos);
    await Promise.all(missingTodos.map((todo) => todoAdapter.applyChange("todos", todo, "upsert")));
    const legacyOxygenReminder = state.todos.find((todo) => todo.id === "oxygen-reminder");
    const splitOxygenReminder = authoredTodos.find((todo) => todo.id === "oxygen-reminder");
    if (legacyOxygenReminder?.detail?.includes("如果氧气袋或者氧气瓶作用不大") && splitOxygenReminder) {
      Object.assign(legacyOxygenReminder, {
        text: splitOxygenReminder.text,
        detail: splitOxygenReminder.detail,
        category: window.TravelPrep.normalizeTodoCategory(splitOxygenReminder),
        subcategory: window.TravelPrep.normalizeTodoSubcategory(splitOxygenReminder),
        group: splitOxygenReminder.group || ""
      });
      await todoAdapter.applyChange("todos", legacyOxygenReminder, "upsert");
    }
  }
}

async function saveSharedChange(collection, value, op = "upsert") {
  const adapter = state.runtimeAdapters[collection];
  if (!adapter) return null;
  return adapter.applyChange(collection, value, op);
}

function saveTodoState() { return Promise.all(state.todos.map((todo) => saveSharedChange("todos", todo))); }

const PREP_LABELS = {
  notice: { health: "健康", toilet: "厕所" },
  packing: { documents: "证件", clothing: "衣物", care: "洗护", medicine: "药品", electronics: "电子", daily: "日用品", other: "户外", misc: "其他" }
};
const PACKING_WORKSPACE_TITLES = { overview: "行囊总览", details: "行囊明细", purchase: "采购清单", check: "检查行囊", dictionary: "字典设置" };

const PACKING_LUGGAGE = [
  { key: "clothes-case", icon: "🧳", label: "衣箱", kind: "case" },
  { key: "care-case", icon: "🧳", label: "洗箱", kind: "case" },
  { key: "medicine-pack", icon: "🎒", label: "药包", kind: "pack" },
  { key: "camera-pack", icon: "🎒", label: "相包", kind: "pack" },
  { key: "daily-bag", icon: "👜", label: "随包", kind: "bag" }
];

const PACKING_LUGGAGE_BY_SUBCATEGORY = {
  documents: "daily-bag",
  clothing: "clothes-case",
  care: "care-case",
  medicine: "medicine-pack",
  electronics: "camera-pack",
  daily: "daily-bag",
  other: "daily-bag"
};

const PACKING_OWNER_LABELS = { shared: "共同", "ma-jia": "马甲", "zai-zai": "仔仔", unassigned: "待分配" };
const PACKING_PROPERTY_LABELS = { none: "无", appliance: "电器", consumable: "消耗品", coat: "外套", trousers: "长裤", sweater: "毛衣", base: "打底", sleepwear: "睡衣", other: "其他" };
const PACKING_TAGS_BY_CATEGORY = {
  clothing: ["coat", "trousers", "sweater", "base", "sleepwear", "consumable", "other", "none"],
  electronics: ["appliance", "none"],
  daily: ["none", "consumable"]
};
const PACKING_CONTAINERS = [
  { key: "skincare-pouch", parent: "care-case", label: "护包", icon: "🧴" },
  { key: "makeup-pouch", parent: "care-case", label: "妆包", icon: "💄" },
  { key: "wash-pouch", parent: "care-case", label: "洗包", icon: "🧼" },
  { key: "camera-pouch", parent: "camera-pack", label: "相袋", icon: "📷" }
];

function packingLuggageSettingsKey() {
  return `travel-plan:${state.data.metadata.tripId}:packing-luggage-labels`;
}
function packingLuggageTreeSettingsKey() {
  return `travel-plan:${state.data.metadata.tripId}:packing-luggage-tree`;
}
function packingCustomCategoriesKey() {
  return `travel-plan:${state.data.metadata.tripId}:packing-custom-categories`;
}
function packingCategorySettingsKey() {
  return `travel-plan:${state.data.metadata.tripId}:packing-category-settings`;
}
function packingTagAssociationsKey() {
  return `travel-plan:${state.data.metadata.tripId}:packing-tag-associations`;
}
function packingCategoryEntries() {
  const entries = [...Object.entries(PREP_LABELS.packing), ...Object.entries(state.packingCustomCategories || {})]
    .filter(([category]) => !state.deletedPackingCategories.has(category))
    .map(([category, label]) => [category, state.packingCategoryLabels[category] || label]);
  const order = [...state.packingCategoryOrder, ...entries.map(([category]) => category).filter((category) => !state.packingCategoryOrder.includes(category))];
  return order.map((category) => entries.find(([key]) => key === category)).filter(Boolean);
}
function savePackingCategorySettings() {
  localStorage.setItem(packingCategorySettingsKey(), JSON.stringify({
    labels: state.packingCategoryLabels,
    deleted: [...state.deletedPackingCategories],
    order: state.packingCategoryOrder
  }));
}
function packingTagsForCategory(category) {
  if (Object.hasOwn(state.packingTagAssociations, category)) return state.packingTagAssociations[category];
  return PACKING_TAGS_BY_CATEGORY[category] || ["none"];
}
function defaultPackingTagAssociations() {
  return Object.fromEntries(packingCategoryEntries().map(([category]) => [category, [...(PACKING_TAGS_BY_CATEGORY[category] || ["none"])]]));
}
function savePackingTagAssociations() {
  localStorage.setItem(packingTagAssociationsKey(), JSON.stringify(state.packingTagAssociations));
}
function attachPackingTagToCategory(tag, category) {
  const tags = new Set(packingTagsForCategory(category));
  tags.add(tag);
  state.packingTagAssociations[category] = [...tags];
  savePackingTagAssociations();
}
function syncPackingDictionaryCategory(category, property = "") {
  if (!Object.hasOwn(state.packingTagAssociations, category)) {
    state.packingTagAssociations[category] = ["none"];
    savePackingTagAssociations();
  }
  if (isCustomPackingProperty(property)) attachPackingTagToCategory(property, category);
}
function movePackingDictionaryTag(sourceCategory, tag, targetCategory, beforeTag = "") {
  const sourceTags = packingTagsForCategory(sourceCategory).filter((item) => item !== tag);
  const targetTags = sourceCategory === targetCategory
    ? sourceTags
    : packingTagsForCategory(targetCategory).filter((item) => item !== tag);
  const index = beforeTag ? targetTags.indexOf(beforeTag) : -1;
  targetTags.splice(index >= 0 ? index : targetTags.length, 0, tag);
  state.packingTagAssociations[sourceCategory] = sourceTags;
  state.packingTagAssociations[targetCategory] = targetTags;
  savePackingTagAssociations();
}
function movePackingDictionaryCategory(sourceCategory, targetCategory) {
  const categories = packingCategoryEntries().map(([category]) => category).filter((category) => category !== sourceCategory);
  const index = categories.indexOf(targetCategory);
  categories.splice(index < 0 ? categories.length : index, 0, sourceCategory);
  state.packingCategoryOrder = categories;
  savePackingCategorySettings();
}
function rememberOpenPackingDictionaryBranches() {
  $$(".packing-dictionary-branch", $("#packing-dictionary")).forEach((branch) => {
    const category = branch.dataset.packingDictionaryCategory;
    if (branch.open) state.expandedPackingDictionaryCategories.add(category);
    else state.expandedPackingDictionaryCategories.delete(category);
  });
}
function deletePackingDictionaryCategory(category) {
  const remaining = packingCategoryEntries().filter(([key]) => key !== category);
  const fallback = remaining.find(([key]) => key === "other")?.[0] || remaining[0]?.[0];
  if (!fallback) return;
  window.TravelPrep.filterTodosByCategory(state.todos, "packing").forEach((todo) => {
    if (window.TravelPrep.normalizeTodoSubcategory(todo) !== category) return;
    todo.subcategory = fallback;
    todo.luggage = packingLuggageFor(todo);
    todo.container = packingLuggageFor(todo);
    saveSharedChange("todos", todo).catch(console.error);
  });
  if (Object.hasOwn(state.packingCustomCategories, category)) {
    delete state.packingCustomCategories[category];
    localStorage.setItem(packingCustomCategoriesKey(), JSON.stringify(state.packingCustomCategories));
  } else {
    state.deletedPackingCategories.add(category);
  }
  delete state.packingCategoryLabels[category];
  delete state.packingTagAssociations[category];
  state.expandedPackingDictionaryCategories.delete(category);
  state.editingPackingDictionaryCategory = "";
  savePackingCategorySettings();
  savePackingTagAssociations();
}
function isCustomPackingProperty(property) {
  return typeof property === "string" && property.startsWith("custom:");
}
function packingPropertyLabel(property) {
  if (isCustomPackingProperty(property)) {
    try { return decodeURIComponent(property.slice("custom:".length)); } catch { return property.slice("custom:".length) || "其他"; }
  }
  return PACKING_PROPERTY_LABELS[property] || "无";
}
function packingCustomPropertyValues() {
  return [...new Set([
    ...window.TravelPrep.filterTodosByCategory(state.todos, "packing")
    .map(packingPropertyFor)
    .filter(isCustomPackingProperty),
    ...Object.values(state.packingTagAssociations).flat().filter(isCustomPackingProperty)
  ])];
}
function packingKnownTagValues() {
  return [...Object.keys(PACKING_PROPERTY_LABELS), ...packingCustomPropertyValues()];
}
function packingTagOptions(tags, selected) {
  const availableTags = [...new Set([...tags, selected].filter((key) => key && key !== "__custom__"))];
  return `${availableTags.map((key) => `<option value="${escapeHtml(key)}" ${selected === key ? "selected" : ""}>${escapeHtml(packingPropertyLabel(key))}</option>`).join("")}<option value="__custom__">新增标签…</option>`;
}
function packingQuantityFor(todo) {
  return Math.min(5, Math.max(1, Number(todo.quantity) || 1));
}
function packingCategoryLabel(key) {
  return Object.fromEntries(packingCategoryEntries())[key] || "其他";
}
function syncPackingTagOptions() {
  const category = $("#packing-subcategory")?.value || "";
  const tags = packingTagsForCategory(category);
  const select = $("#packing-property");
  if (!select) return;
  const selected = tags.includes(select.value) ? select.value : tags[0];
  select.innerHTML = packingTagOptions(tags, selected);
  select.value = selected;
  const usesRow = $("[data-packing-uses-row]");
  if (usesRow) usesRow.hidden = select.value !== "consumable";
  const customPropertyRow = $("[data-packing-custom-property-row]");
  if (customPropertyRow) customPropertyRow.hidden = select.value !== "__custom__";
}

function packingLuggageFor(todo) {
  return todo.luggage || PACKING_LUGGAGE_BY_SUBCATEGORY[window.TravelPrep.normalizeTodoSubcategory(todo)] || "daily-bag";
}

function packingLuggageLabel(luggage) {
  return state.packingLuggageLabels[luggage.key] || luggage.label;
}

function packingLuggageItems() {
  return [...PACKING_LUGGAGE, ...PACKING_CONTAINERS, ...state.packingCustomLuggage]
    .filter((luggage) => !state.deletedPackingLuggage.has(luggage.key))
    .map((luggage) => ({
      ...luggage,
      label: packingLuggageLabel(luggage),
      icon: state.packingLuggageIcons[luggage.key] || luggage.icon,
      parent: state.packingLuggageParents[luggage.key] ?? luggage.parent ?? ""
    }));
}
function packingPrimaryLuggage() { return packingLuggageItems().filter((luggage) => !luggage.parent); }
function packingLuggageItem(key) { return packingLuggageItems().find((luggage) => luggage.key === key); }
function savePackingLuggageTree() {
  localStorage.setItem(packingLuggageTreeSettingsKey(), JSON.stringify({
    custom: state.packingCustomLuggage,
    deleted: [...state.deletedPackingLuggage],
    parents: state.packingLuggageParents,
    icons: state.packingLuggageIcons
  }));
}

function packingOwnerFor(todo) { return PACKING_OWNER_LABELS[todo.owner] ? todo.owner : "unassigned"; }
function packingPropertyFor(todo) {
  if (todo.property === "common") return "none";
  if (isCustomPackingProperty(todo.property)) return todo.property;
  if (PACKING_PROPERTY_LABELS[todo.property]) return todo.property;
  return Number(todo.usesTotal || 0) > 0 ? "consumable" : "none";
}
function packingContainerFor(todo) { return todo.container || packingLuggageFor(todo); }
function packingEditFormMarkup(todo) {
  const category = window.TravelPrep.normalizeTodoSubcategory(todo);
  const property = packingPropertyFor(todo);
  const tags = packingTagsForCategory(category);
  const usesTotal = Number(todo.usesTotal || 0);
  return `<form class="packing-edit-form" data-packing-edit-form data-todo-id="${escapeHtml(todo.id)}">
    <div class="packing-form-heading"><strong>编辑物品</strong><button type="button" data-packing-edit-cancel aria-label="取消编辑：${escapeHtml(todo.text)}">×</button></div>
    <div class="packing-form-selectors packing-form-selectors--add">
      <label><span>物品类别</span><select data-packing-edit-category aria-label="物品类别">${packingCategoryEntries().map(([key, label]) => `<option value="${key}" ${category === key ? "selected" : ""}>${escapeHtml(label)}</option>`).join("")}<option value="__custom__">新增类别…</option></select></label>
      <label><span>人物归属</span><select data-packing-edit-owner aria-label="人物归属">${Object.entries(PACKING_OWNER_LABELS).map(([key, label]) => `<option value="${key}" ${packingOwnerFor(todo) === key ? "selected" : ""}>${label}</option>`).join("")}</select></label>
      <label><span>物品标签</span><select data-packing-edit-property aria-label="物品标签">${packingTagOptions(tags, property)}</select></label>
      <label><span>数量</span><select data-packing-edit-quantity aria-label="物品数量">${[1, 2, 3, 4, 5].map((quantity) => `<option value="${quantity}" ${packingQuantityFor(todo) === quantity ? "selected" : ""}>${quantity}</option>`).join("")}</select></label>
      <label class="packing-form-name"><span>物品名称</span><input data-packing-edit-name type="text" maxlength="80" value="${escapeHtml(todo.text)}" aria-label="物品名称"></label>
      <div class="packing-add-todo-form__actions"><label class="packing-uses-field" data-packing-edit-uses-row ${property === "consumable" ? "" : "hidden"}><span>可用次数</span><input data-packing-edit-uses type="number" min="1" max="99" value="${usesTotal || 1}" aria-label="消耗品可用次数"></label><button type="button" data-packing-edit-submit>保存</button></div>
    </div>
    <label class="packing-custom-category-field" data-packing-edit-custom-category-row ${category === "__custom__" ? "" : "hidden"}><span>新类别名称</span><input data-packing-edit-custom-category type="text" maxlength="12" placeholder="例如：摄影"></label>
    <label class="packing-custom-category-field" data-packing-edit-custom-property-row ${isCustomPackingProperty(property) ? "" : "hidden"}><span>新物品标签</span><input data-packing-edit-custom-property type="text" maxlength="12" value="${isCustomPackingProperty(property) ? escapeHtml(packingPropertyLabel(property)) : ""}" placeholder="例如：摄影"></label>
  </form>`;
}
function packingWorkspaceFromHash(hash = location.hash) {
  return { "#packing": "details", "#packing-overview": "overview", "#packing-details": "details", "#packing-purchase": "purchase", "#packing-check": "check", "#packing-dictionary": "dictionary" }[hash] || null;
}
function packingWorkspaceKey() { return `travel-plan:${state.data.metadata.tripId}:packing-workspace`; }
function savePackingWorkspace() {
  localStorage.setItem(packingWorkspaceKey(), JSON.stringify({ purchases: state.packingPurchases, removedPurchaseIds: [...state.removedPurchaseIds], check: state.packingCheck }));
}

function noticeGroupSettingsKey() {
  return `travel-plan:${state.data.metadata.tripId}:notice-group-settings-v2`;
}

function noticeGroupId(category, group) {
  return `${category}::${group}`;
}

function noticeGroups(category, items) {
  const groups = [...new Set(items.map((todo) => todo.group || "其他信息"))];
  const settings = window.TravelPrep.normalizeNoticeSubcategorySettings({
    order: state.noticeGroupOrder[category],
    collapsed: groups.filter((group) => state.collapsedNoticeGroups.has(noticeGroupId(category, group)))
  }, groups);
  state.noticeGroupOrder[category] = settings.order;
  return settings.order.map((group) => ({
    group,
    id: noticeGroupId(category, group),
    label: state.noticeGroupLabels[noticeGroupId(category, group)] || group,
    collapsed: state.collapsedNoticeGroups.has(noticeGroupId(category, group))
  }));
}

function saveNoticeGroupSettings() {
  localStorage.setItem(noticeGroupSettingsKey(), JSON.stringify({
    order: state.noticeGroupOrder,
    labels: state.noticeGroupLabels,
    collapsed: [...state.collapsedNoticeGroups]
  }));
}

function renderToiletMap() {
  const root = $("#toilet-map");
  if (!root) return;
  const visible = state.activeNoticeSubcategory === "toilet";
  root.hidden = !visible;
  if (!visible) return;
  const source = travelMapSource(state.data.routeMap, state.data.routeMap?.defaultRegionId);
  const canvas = source.canvas || { width: 1448, height: 1086 };
  const routes = mapRouteDefinitions(source);
  const selectedRoute = routes.find((route) => route.day === state.activeToiletMapDay);
  const artwork = travelOverviewArtwork(state.data.days, source, { includeAllPlaces: true, useDetailedRoutes: true }).replace(/(<svg[^>]*>)/, `$1${selectedRoute ? `<style>[id^="overview-route-"]{display:none}#overview-route-${selectedRoute.day}{display:inline}</style>` : ""}`);
  const toilets = state.todos.filter((todo) => window.TravelPrep.normalizeTodoCategory(todo) === "notice" && window.TravelPrep.normalizeTodoSubcategory(todo) === "toilet");
  const pins = (state.data.preTrip?.toiletMapPins || []).map((pin) => ({ ...pin, todo: toilets.find((todo) => todo.id === pin.todoId) })).filter((pin) => pin.todo);
  root.innerHTML = `<div class="toilet-map__heading"><strong>厕所位置分布</strong><span><i class="toilet-map__key toilet-map__key--trusted"></i>推荐　<i class="toilet-map__key toilet-map__key--warning"></i>请留意</span></div><div class="toilet-map__days" aria-label="厕所地图路线日期"><button type="button" data-toilet-map-day="0" aria-pressed="${state.activeToiletMapDay === 0}">全部</button>${routes.map((route) => { const day = state.data.days.find((item) => item.day === route.day); return day ? `<button type="button" data-toilet-map-day="${route.day}" aria-pressed="${state.activeToiletMapDay === route.day}">Day ${route.day}</button>` : ""; }).join("")}</div><div class="travel-map-block is-overview"><div class="travel-map-scroll"><div class="travel-map-canvas">${artwork}${pins.map((pin) => `<button class="toilet-map-pin toilet-map-pin--${pin.todo.group === "殿堂级" ? "trusted" : "warning"}" type="button" style="left:${pin.x / canvas.width * 100}%;top:${pin.y / canvas.height * 100}%" data-toilet-map-pin="${escapeHtml(pin.todoId)}" aria-label="${escapeHtml(pin.todo.group)}：${escapeHtml(pin.todo.text)}">${pin.todo.group === "殿堂级" ? "★" : "!"}</button>`).join("")}</div></div><p class="toilet-map__note">点击标记查看对应地点说明。位置为路线示意，请以当天导航和现场情况为准。</p></div>`;
  root.onclick = (event) => {
    const day = event.target.closest("[data-toilet-map-day]");
    if (day) { state.activeToiletMapDay = Number(day.dataset.toiletMapDay); renderToiletMap(); return; }
    const pin = event.target.closest("[data-toilet-map-pin]");
    if (!pin) return;
    const info = document.querySelector(`[data-todo-id="${pin.dataset.toiletMapPin}"]`);
    if (!info) return;
    info.scrollIntoView({ behavior: "smooth", block: "center" });
    info.classList.add("is-highlighted");
    setTimeout(() => info.classList.remove("is-highlighted"), 2200);
  };
}

function renderTodoList(kind) {
  const labels = kind === "packing" ? Object.fromEntries(packingCategoryEntries()) : PREP_LABELS[kind];
  const categoryTodos = window.TravelPrep.filterTodosByCategory(state.todos, kind);
  if (kind === "notice") {
    const activeCategory = state.activeNoticeSubcategory;
    const orderedTodos = window.TravelPrep.sortNoticeItems(categoryTodos.filter((todo) => window.TravelPrep.normalizeTodoSubcategory(todo) === activeCategory));
    $("#notice-count").textContent = `${orderedTodos.length} 条信息`;
    const itemMarkup = (todo) => `
      <article class="notice-item" data-todo-id="${escapeHtml(todo.id)}">
        <span class="todo-copy"><span class="todo-text">${escapeHtml(todo.text)}</span>${todo.detail ? `<span class="todo-detail">${escapeHtml(todo.detail)}</span>` : ""}</span>
      </article>`;
    $("#notice-list").innerHTML = orderedTodos.length ? noticeGroups(activeCategory, orderedTodos).map(({ group, id, label, collapsed }) => {
      const groupedItems = orderedTodos.filter((todo) => (todo.group || "其他信息") === group);
      const tone = group === "殿堂级" ? "trusted" : group === "雷区警示" ? "warning" : "";
      return `<section class="notice-subcategory${tone ? ` notice-subcategory--${tone}` : ""}" data-notice-group="${escapeHtml(group)}"><button type="button" class="notice-subcategory__toggle" data-notice-group-toggle="${escapeHtml(group)}" aria-expanded="${!collapsed}"><span class="notice-subcategory__title">${escapeHtml(label)}<i aria-hidden="true">⌄</i></span><small>${groupedItems.length} 条</small></button><div class="notice-subcategory__panel" ${collapsed ? "hidden" : ""}><div class="todo-list">${groupedItems.map(itemMarkup).join("")}</div></div></section>`;
    }).join("") : `<p class="todo-empty">该类别还没有信息。</p>`;
    return;
  }

  const activeTodos = categoryTodos.filter((todo) => {
    const matchesCategory = !state.selectedPackingSubcategories.size || state.selectedPackingSubcategories.has(window.TravelPrep.normalizeTodoSubcategory(todo));
    const matchesLuggage = !state.selectedPackingLuggage || packingLuggageFor(todo) === state.selectedPackingLuggage;
    const matchesContainer = !state.selectedPackingContainer || packingContainerFor(todo) === state.selectedPackingContainer;
    const matchesOwner = !state.selectedPackingOwner || state.selectedPackingOwner === packingOwnerFor(todo);
    const matchesProperty = !state.selectedPackingProperty || state.selectedPackingProperty === packingPropertyFor(todo);
    const matchesSearch = !state.packingSearchText || todo.text.toLocaleLowerCase("zh-CN").includes(state.packingSearchText.trim().toLocaleLowerCase("zh-CN"));
    return matchesCategory && matchesLuggage && matchesContainer && matchesOwner && matchesProperty && matchesSearch;
  });
  const completed = activeTodos.filter((todo) => todo.completed).length;
  $("#packing-progress").textContent = `${completed} / ${activeTodos.length}`;
  const itemMarkup = (todo) => {
    const property = packingPropertyFor(todo);
    const usesTotal = Number(todo.usesTotal || 0);
    const usesRemaining = Number(todo.usesRemaining ?? usesTotal);
    const exhausted = property === "consumable" && usesTotal > 0 && usesRemaining <= 0;
    return `
    <div class="todo-item${todo.completed ? " is-complete" : ""}${exhausted ? " is-exhausted" : ""}" data-todo-id="${escapeHtml(todo.id)}">
      <label>
        <input type="checkbox" ${todo.completed ? "checked" : ""} aria-label="完成：${escapeHtml(todo.text)}">
        <span class="todo-check" aria-hidden="true">✓</span>
        <span class="todo-copy"><span class="packing-item-title"><strong class="todo-text">${escapeHtml(todo.text)}${packingQuantityFor(todo) > 1 ? ` <small class="packing-item-quantity">×${packingQuantityFor(todo)}</small>` : ""}</strong><select data-packing-owner="${escapeHtml(todo.id)}" aria-label="${escapeHtml(todo.text)}归属">${Object.entries(PACKING_OWNER_LABELS).map(([key, label]) => `<option value="${key}" ${packingOwnerFor(todo) === key ? "selected" : ""}>${label}</option>`).join("")}</select>${property === "consumable" && usesTotal > 0 ? `<span class="packing-item-meta packing-item-meta--inline"><button type="button" data-todo-use="${escapeHtml(todo.id)}" ${exhausted ? "disabled" : ""}>${exhausted ? "已用尽" : `使用一次 · ${usesRemaining}/${usesTotal}`}</button></span>` : ""}</span>${todo.detail ? `<span class="todo-detail">${escapeHtml(todo.detail)}</span>` : ""}</span>
      </label>
      <div class="todo-actions"><details class="todo-more"><summary aria-label="更多操作：${escapeHtml(todo.text)}">•••</summary><div class="todo-more__menu"><button type="button" data-packing-find="${escapeHtml(todo.id)}">查找</button><button type="button" class="todo-edit">编辑</button><button type="button" data-todo-copy>复制</button><button type="button" class="todo-delete">删除</button></div></details></div>
    </div>${state.editingPackingTodoId === todo.id ? packingEditFormMarkup(todo) : ""}`;
  };
  $("#packing-list").innerHTML = activeTodos.length ? Object.entries(labels).map(([key, label]) => {
    const items = activeTodos
      .filter((todo) => window.TravelPrep.normalizeTodoSubcategory(todo) === key)
      .sort((a, b) => a.text.localeCompare(b.text, "zh-CN"));
    if (!items.length) return "";
    const done = items.filter((todo) => todo.completed).length;
    const collapsed = state.collapsedPackingCategories.has(key);
    return `<section class="prep-group prep-group--packing" data-packing-category="${key}"><button type="button" class="packing-category-toggle" data-packing-category-toggle="${key}" aria-expanded="${!collapsed}"><span class="packing-category-toggle__title">${label}<i aria-hidden="true">⌄</i></span><small>${done} / ${items.length}</small></button><div class="todo-list" ${collapsed ? "hidden" : ""}>${items.map(itemMarkup).join("")}</div></section>`;
  }).join("") : `<p class="todo-empty">还没有准备事项，添加第一项吧。</p>`;
}

function hasActivePackingFilters() {
  return Boolean(
    state.selectedPackingLuggage || state.selectedPackingContainer || state.selectedPackingOwner ||
    state.selectedPackingProperty || state.packingSearchText.trim() || state.selectedPackingSubcategories.size
  );
}

function packingOverviewCategoryTotals(owner) {
  return window.TravelPrep.filterTodosByCategory(state.todos, "packing")
    .filter((todo) => [owner, "shared"].includes(packingOwnerFor(todo)))
    .reduce((categories, todo) => {
      const tag = packingPropertyFor(todo);
      const category = window.TravelPrep.normalizeTodoSubcategory(todo);
      const categoryTotals = categories[category] || { key: category, label: packingCategoryLabel(category), quantity: 0, tags: {} };
      categoryTotals.quantity += packingQuantityFor(todo);
      categoryTotals.tags[tag] = {
        label: tag === "none" ? packingCategoryLabel(category) : packingPropertyLabel(tag),
        quantity: (categoryTotals.tags[tag]?.quantity || 0) + packingQuantityFor(todo)
      };
      categories[category] = categoryTotals;
      return categories;
    }, {});
}

function renderPackingOverview() {
  const overview = $("#packing-overview");
  if (!overview) return;
  const owners = ["ma-jia", "zai-zai"];
  const visibleOwners = state.packingOverviewOwner === "all" ? owners : owners.filter((owner) => owner === state.packingOverviewOwner);
  const cardMarkup = (owner) => {
    const categories = Object.values(packingOverviewCategoryTotals(owner))
      .map((category) => ({ ...category, tags: Object.values(category.tags).sort((first, second) => second.quantity - first.quantity) }))
      .sort((first, second) => second.quantity - first.quantity);
    return `<article class="packing-overview-card">
      <div class="packing-overview-card__heading"><span>${PACKING_OWNER_LABELS[owner]}</span><small>实际物品标签数量</small></div>
      <div class="packing-overview-card__items">${categories.length ? categories.map((category) => {
        const categoryId = `${owner}:${category.key}`;
        const collapsed = state.collapsedPackingOverviewCategories.has(categoryId);
        return `<section class="packing-overview-category"><button type="button" class="packing-overview-category-toggle" data-packing-overview-category="${escapeHtml(category.key)}" data-packing-overview-owner="${owner}" aria-expanded="${!collapsed}"><span><strong>${escapeHtml(category.label)}</strong><small>${category.quantity}件</small></span><i aria-hidden="true">⌄</i></button><div class="packing-overview-category__items" ${collapsed ? "hidden" : ""}>${category.tags.map((tag) => `<div class="packing-overview-item"><strong class="packing-overview-tag">${escapeHtml(tag.label)}</strong><strong class="packing-overview-value">${tag.quantity}<i>件</i></strong></div>`).join("")}</div></section>`;
      }).join("") : `<p class="todo-empty">行囊明细中还没有归属给${PACKING_OWNER_LABELS[owner]}的物品。</p>`}</div>
    </article>`;
  };
  overview.innerHTML = `<section class="packing-overview">
    <div class="packing-overview-toolbar"><div><p class="section-kicker">PACKING ACTUALS</p><strong>行囊实际数量</strong><small>直接汇总行囊明细；修改物品数量、标签或人物归属后会即时更新。</small></div><div class="packing-overview-owner-tabs" aria-label="按人物查看"><button type="button" data-packing-overview-owner="all" aria-pressed="${state.packingOverviewOwner === "all"}">共同</button>${owners.map((owner) => `<button type="button" data-packing-overview-owner="${owner}" aria-pressed="${state.packingOverviewOwner === owner}">${PACKING_OWNER_LABELS[owner]}</button>`).join("")}</div></div>
    <div class="packing-overview-cards${visibleOwners.length === 1 ? " is-single" : ""}">${visibleOwners.map(cardMarkup).join("")}</div>
  </section>`;
}

function renderPackingDictionary() {
  const dictionary = $("#packing-dictionary");
  if (!dictionary) return;
  const categories = packingCategoryEntries();
  const tab = state.activePackingDictionaryTab;
  const tabs = `<div class="packing-dictionary-tabs" role="tablist"><button type="button" data-packing-dictionary-tab="categories" aria-selected="${tab === "categories"}">类别与标签</button><button type="button" data-packing-dictionary-tab="luggage" aria-selected="${tab === "luggage"}">行囊用途</button></div>`;
  const iconOptions = (selected) => ["🧳", "🎒", "👜", "📷", "🧴", "💄", "🧼", "🛍️"].map((icon) => `<option value="${icon}" ${selected === icon ? "selected" : ""}>${icon}</option>`).join("");
  const parentOptions = (selected, current = "") => `<option value="" ${!selected ? "selected" : ""}>主收纳包</option>${packingPrimaryLuggage().filter((luggage) => luggage.key !== current).map((luggage) => `<option value="${escapeHtml(luggage.key)}" ${selected === luggage.key ? "selected" : ""}>${escapeHtml(luggage.label)}</option>`).join("")}`;
  const luggageBranch = (luggage) => {
    const children = packingLuggageItems().filter((item) => item.parent === luggage.key);
    const editing = state.editingPackingLuggage === luggage.key;
    return `<details class="packing-dictionary-branch packing-luggage-branch" open><summary><span><b aria-hidden="true">${escapeHtml(luggage.icon)}</b>${editing ? `<input data-packing-luggage-label="${escapeHtml(luggage.key)}" value="${escapeHtml(luggage.label)}" maxlength="24" aria-label="${escapeHtml(luggage.label)}名称">` : `<strong>${escapeHtml(luggage.label)}</strong>`}<small>${luggage.parent ? "子收纳包" : "主收纳包"}</small>}<i aria-hidden="true">⌄</i></span></summary><div class="packing-dictionary-branch__actions"><details class="todo-more"><summary aria-label="更多操作：${escapeHtml(luggage.label)}">•••</summary><div class="todo-more__menu"><button type="button" data-packing-luggage-edit="${escapeHtml(luggage.key)}">编辑</button><button type="button" class="todo-delete" data-packing-luggage-delete="${escapeHtml(luggage.key)}">删除</button></div></details></div>${editing ? `<form class="packing-luggage-edit" data-packing-luggage-edit-form data-packing-luggage-key="${escapeHtml(luggage.key)}"><label><span>图标</span><select data-packing-luggage-icon>${iconOptions(luggage.icon)}</select></label><label><span>归属</span><select data-packing-luggage-parent>${parentOptions(luggage.parent, luggage.key)}</select></label><button type="submit">保存</button></form>` : ""}<div class="packing-luggage-children">${children.map(luggageBranch).join("")}</div></details>`;
  };
  const categoryPanel = `<div class="packing-dictionary-tree" role="tree"><p class="packing-dictionary-root">物品类别</p>${categories.map(([category, label]) => {
      const tags = packingTagsForCategory(category);
      const editing = state.editingPackingDictionaryCategory === category;
      const addingTag = state.addingPackingDictionaryTagCategory === category;
      return `<details class="packing-dictionary-branch" draggable="true" data-packing-dictionary-category-drag="${escapeHtml(category)}" data-packing-dictionary-category="${escapeHtml(category)}" ${state.expandedPackingDictionaryCategories.has(category) ? "open" : ""}><summary data-packing-dictionary-drop="${escapeHtml(category)}" data-packing-dictionary-category-drop="${escapeHtml(category)}"><span>${editing ? `<input data-packing-dictionary-category-label="${escapeHtml(category)}" value="${escapeHtml(label)}" maxlength="24" aria-label="${escapeHtml(label)}类别名称">` : `<strong>${escapeHtml(label)}</strong>`}<i aria-hidden="true">⌄</i></span></summary><div class="packing-dictionary-branch__actions"><details class="todo-more"><summary aria-label="更多操作：${escapeHtml(label)}">•••</summary><div class="todo-more__menu"><button type="button" data-packing-dictionary-category-edit="${escapeHtml(category)}">编辑</button><button type="button" data-packing-dictionary-tag-create="${escapeHtml(category)}">新增</button><button type="button" class="todo-delete" data-packing-dictionary-category-delete="${escapeHtml(category)}">删除</button></div></details></div><div class="packing-dictionary-tags" data-packing-dictionary-drop="${escapeHtml(category)}">${tags.length ? tags.map((tag) => `<span class="packing-dictionary-tag" draggable="true" data-packing-dictionary-tag="${escapeHtml(tag)}" data-packing-dictionary-category="${escapeHtml(category)}" data-packing-dictionary-tag-drop="${escapeHtml(tag)}" title="拖动标签调整位置"><span>${escapeHtml(packingPropertyLabel(tag))}</span><button type="button" data-packing-dictionary-unlink="${escapeHtml(tag)}" data-packing-dictionary-category="${escapeHtml(category)}" aria-label="从${escapeHtml(label)}移除${escapeHtml(packingPropertyLabel(tag))}">×</button></span>`).join("") : `<p>把标签拖到这里</p>`}</div>${addingTag ? `<form class="packing-dictionary-tag-add" data-packing-dictionary-tag-add data-packing-dictionary-category="${escapeHtml(category)}"><input name="tag" type="text" maxlength="24" placeholder="输入新标签名称" aria-label="${escapeHtml(label)}新增标签"><button type="submit">新增</button></form>` : ""}</details>`;
    }).join("")}</div>`;
  const luggagePanel = `<div class="packing-dictionary-tree"><div class="packing-dictionary-luggage-heading"><p class="packing-dictionary-root">主收纳包</p><button type="button" class="packing-action-trigger" data-packing-luggage-add-open>新增</button></div><form class="packing-luggage-add" data-packing-luggage-add hidden><label><span>类型</span><select name="kind"><option value="case">箱子</option><option value="pack">背包</option><option value="bag">挎包</option></select></label><label><span>图标</span><select name="icon">${iconOptions("🧳")}</select></label><label><span>归属</span><select name="parent">${parentOptions("")}</select></label><label><span>名称</span><input name="label" maxlength="24" placeholder="例如：车载包" required></label><button type="submit">新增</button></form>${packingPrimaryLuggage().map(luggageBranch).join("") || `<p class="todo-empty">还没有主收纳包。</p>`}</div>`;
  dictionary.innerHTML = `<section class="packing-dictionary">
    <div class="packing-dictionary__heading"><div><p class="section-kicker">PACKING DICTIONARY</p><strong>${tab === "categories" ? "类别与标签" : "行囊用途"}</strong><small>${tab === "categories" ? "展开类别查看标签；拖动类别或标签即可调整位置。新增请使用对应类别的更多菜单。" : "设置箱子、背包、挎包的名称、图标及主子收纳关系。"}</small></div></div>
    ${tabs}
    ${tab === "categories" ? categoryPanel : luggagePanel}
  </section>`;
}

function renderPackingWorkspace() {
  const overview = $("#packing-overview");
  const details = $("#packing-details");
  const purchases = $("#packing-purchases");
  const checker = $("#packing-checker");
  const dictionary = $("#packing-dictionary");
  if (!overview || !details || !purchases || !checker || !dictionary) return;
  $("#packing-title").textContent = PACKING_WORKSPACE_TITLES[state.activePackingWorkspace] || PACKING_WORKSPACE_TITLES.details;
  overview.hidden = state.activePackingWorkspace !== "overview";
  details.hidden = state.activePackingWorkspace !== "details";
  purchases.hidden = state.activePackingWorkspace !== "purchase";
  checker.hidden = state.activePackingWorkspace !== "check";
  dictionary.hidden = state.activePackingWorkspace !== "dictionary";
  renderPackingOverview();
  renderPackingDictionary();
  $("#packing-purchase-list").innerHTML = state.packingPurchases.length ? state.packingPurchases.map((item) => {
    const property = packingPropertyFor(item);
    return `<div class="todo-item" data-purchase-id="${escapeHtml(item.id)}"><span class="todo-copy"><span class="todo-text">${escapeHtml(item.text)}</span>${item.detail ? `<span class="todo-detail">${escapeHtml(item.detail)}</span>` : ""}<span class="todo-detail">${packingPropertyLabel(property)}${property === "consumable" && item.usesTotal ? ` · 可用 ${item.usesTotal} 次` : ""}</span></span><div class="todo-actions"><button type="button" data-purchase-submit="${escapeHtml(item.id)}">提交到行囊</button><button type="button" data-purchase-delete="${escapeHtml(item.id)}">删除</button></div></div>`;
  }).join("") : `<p class="todo-empty">还没有采购项。</p>`;
  const packingTodos = window.TravelPrep.filterTodosByCategory(state.todos, "packing");
  const openLuggage = state.packingCheck.openLuggage || [];
  const checkPicker = `<div class="packing-check-picker"><strong>选择已打开的行李</strong><div>${packingPrimaryLuggage().map((luggage) => `<button type="button" data-packing-check-luggage="${luggage.key}" aria-pressed="${openLuggage.includes(luggage.key)}">${luggage.icon} ${escapeHtml(luggage.label)}</button>`).join("")}</div></div>`;
  const checkTodos = packingTodos.filter((todo) => openLuggage.includes(packingLuggageFor(todo)));
  if (!state.packingCheck.active) {
    checker.innerHTML = `${checkPicker}<p class="todo-empty">选择已打开的行李后，会从第一件物品起逐件核对。</p><button type="button" class="packing-check-button" data-packing-check-start ${openLuggage.length ? "" : "disabled"}>开始检查 ${openLuggage.length ? `${openLuggage.length} 个行李` : ""}</button>`;
    return;
  }
  const current = checkTodos[state.packingCheck.index];
  if (!current) {
    checker.innerHTML = `<p class="packing-check-complete">检查已完成 · ${checkTodos.length} 件物品均已核对无误。</p><div><button type="button" class="packing-check-button" data-packing-check-reselect>重新选择行囊</button><button type="button" class="packing-check-button" data-packing-check-reset>重置检查</button></div>`;
    return;
  }
  checker.innerHTML = `<p class="section-kicker">CHECK ${state.packingCheck.index + 1} / ${checkTodos.length}</p><article class="packing-check-card"><strong>${escapeHtml(current.text)}</strong><span>${escapeHtml(PACKING_OWNER_LABELS[packingOwnerFor(current)])} · ${escapeHtml(packingContainerFor(current))}</span><div><button type="button" class="packing-check-button" data-packing-check-next="${escapeHtml(current.id)}">确认无误，检查下一件</button><button type="button" class="packing-check-button" data-packing-check-reselect>重新选择行囊</button><button type="button" class="packing-check-button" data-packing-check-reset>重置检查</button></div></article>`;
}

function renderTravelPrep() {
  const workspaceFromHash = packingWorkspaceFromHash();
  if (workspaceFromHash) state.activePackingWorkspace = workspaceFromHash;
  const preferenceKey = `travel-plan:${state.data.metadata.tripId}:notice-subcategory`;
  const saved = localStorage.getItem(preferenceKey);
  if (PREP_LABELS.notice[saved]) state.activeNoticeSubcategory = saved;
  let storedSettings = null;
  try {
    const latestSettings = localStorage.getItem(noticeGroupSettingsKey());
    if (latestSettings) {
      storedSettings = JSON.parse(latestSettings);
    } else {
      const legacySettings = JSON.parse(
        localStorage.getItem(`travel-plan:${state.data.metadata.tripId}:notice-group-settings`) || "null"
      );
      if (legacySettings) {
        storedSettings = { ...legacySettings, collapsed: [] };
        localStorage.setItem(noticeGroupSettingsKey(), JSON.stringify(storedSettings));
      }
    }
  } catch {
    storedSettings = null;
  }
  state.noticeGroupOrder = storedSettings?.order && typeof storedSettings.order === "object" ? storedSettings.order : {};
  state.noticeGroupLabels = storedSettings?.labels && typeof storedSettings.labels === "object" ? storedSettings.labels : {};
  state.collapsedNoticeGroups = new Set(Array.isArray(storedSettings?.collapsed) ? storedSettings.collapsed : []);
  try {
    const luggageLabels = JSON.parse(localStorage.getItem(packingLuggageSettingsKey()) || "{}");
    state.packingLuggageLabels = luggageLabels && typeof luggageLabels === "object" ? luggageLabels : {};
  } catch {
    state.packingLuggageLabels = {};
  }
  try {
    const luggageTree = JSON.parse(localStorage.getItem(packingLuggageTreeSettingsKey()) || "{}");
    state.packingCustomLuggage = Array.isArray(luggageTree?.custom) ? luggageTree.custom : [];
    state.deletedPackingLuggage = new Set(Array.isArray(luggageTree?.deleted) ? luggageTree.deleted : []);
    state.packingLuggageParents = luggageTree?.parents && typeof luggageTree.parents === "object" ? luggageTree.parents : {};
    state.packingLuggageIcons = luggageTree?.icons && typeof luggageTree.icons === "object" ? luggageTree.icons : {};
  } catch {
    state.packingCustomLuggage = [];
    state.deletedPackingLuggage = new Set();
    state.packingLuggageParents = {};
    state.packingLuggageIcons = {};
  }
  try {
    const customCategories = JSON.parse(localStorage.getItem(packingCustomCategoriesKey()) || "{}");
    state.packingCustomCategories = customCategories && typeof customCategories === "object" ? customCategories : {};
  } catch {
    state.packingCustomCategories = {};
  }
  try {
    const categorySettings = JSON.parse(localStorage.getItem(packingCategorySettingsKey()) || "{}");
    state.packingCategoryLabels = categorySettings?.labels && typeof categorySettings.labels === "object" ? categorySettings.labels : {};
    state.deletedPackingCategories = new Set(Array.isArray(categorySettings?.deleted) ? categorySettings.deleted : []);
    state.packingCategoryOrder = Array.isArray(categorySettings?.order) ? categorySettings.order : [];
  } catch {
    state.packingCategoryLabels = {};
    state.deletedPackingCategories = new Set();
    state.packingCategoryOrder = [];
  }
  try {
    const savedAssociations = JSON.parse(localStorage.getItem(packingTagAssociationsKey()) || "null");
    state.packingTagAssociations = savedAssociations && typeof savedAssociations === "object" ? savedAssociations : defaultPackingTagAssociations();
    packingCategoryEntries().forEach(([category]) => {
      if (!Object.hasOwn(state.packingTagAssociations, category)) state.packingTagAssociations[category] = [...(PACKING_TAGS_BY_CATEGORY[category] || ["none"])];
    });
    if (!savedAssociations) {
      window.TravelPrep.filterTodosByCategory(state.todos, "packing").forEach((todo) => {
        const tag = packingPropertyFor(todo);
        if (isCustomPackingProperty(tag)) {
          const category = window.TravelPrep.normalizeTodoSubcategory(todo);
          state.packingTagAssociations[category] = [...new Set([...packingTagsForCategory(category), tag])];
        }
      });
      savePackingTagAssociations();
    }
  } catch {
    state.packingTagAssociations = defaultPackingTagAssociations();
  }
  try {
    const authoredPurchases = (Array.isArray(state.data.preTrip?.purchaseItems) ? state.data.preTrip.purchaseItems : []).map((item, index) => ({
      id: String(item.id || `purchase-initial-${index + 1}`),
      text: String(item.text || item.title || "").trim(),
      detail: String(item.detail || "").trim(),
      property: packingPropertyFor(item),
      usesTotal: Number(item.usesTotal || 0)
    })).filter((item) => item.text);
    const workspace = JSON.parse(localStorage.getItem(packingWorkspaceKey()) || "{}");
    state.removedPurchaseIds = new Set(Array.isArray(workspace.removedPurchaseIds) ? workspace.removedPurchaseIds.map(String) : []);
    const storedPurchases = Array.isArray(workspace.purchases) ? workspace.purchases : [];
    state.packingPurchases = [...new Map([...authoredPurchases, ...storedPurchases].map((item) => [String(item.id), item])).values()]
      .filter((item) => !state.removedPurchaseIds.has(String(item.id)));
    state.packingCheck = workspace.check && typeof workspace.check === "object" ? workspace.check : { active: false, index: 0, completed: false, openLuggage: [] };
    if (!Array.isArray(state.packingCheck.openLuggage)) state.packingCheck.openLuggage = [];
  } catch {
    state.packingPurchases = (Array.isArray(state.data.preTrip?.purchaseItems) ? state.data.preTrip.purchaseItems : []).map((item, index) => ({
      id: String(item.id || `purchase-initial-${index + 1}`),
      text: String(item.text || item.title || "").trim(),
      detail: String(item.detail || "").trim(),
      property: packingPropertyFor(item),
      usesTotal: Number(item.usesTotal || 0)
    })).filter((item) => item.text);
    state.removedPurchaseIds = new Set();
    state.packingCheck = { active: false, index: 0, completed: false, openLuggage: [] };
  }
  const optionMarkup = (kind) => (kind === "notice" ? Object.entries(PREP_LABELS.notice) : packingCategoryEntries()).map(([key, label]) => ({ key, label }))
    .map(({ key, label }) => `<option value="${key}">${escapeHtml(label)}</option>`).join("");
  const packingOwnerOptions = () => Object.entries(PACKING_OWNER_LABELS).map(([key, label]) => `<option value="${key}">${label}</option>`).join("");
  const packingPropertyOptions = () => Object.entries(PACKING_PROPERTY_LABELS).map(([key, label]) => `<option value="${key}">${label}</option>`).join("");
  const packingAddDefaults = state.packingAddDefaults;
  const packingCategories = packingCategoryEntries().map(([key]) => key);
  if (!packingCategories.includes(packingAddDefaults.subcategory)) packingAddDefaults.subcategory = "documents";
  $("#packing-subcategory").innerHTML = `${optionMarkup("packing")}<option value="__custom__">新增类别…</option>`;
  $("#packing-subcategory").value = packingAddDefaults.subcategory;
  $("#packing-owner").innerHTML = packingOwnerOptions();
  $("#packing-owner").value = packingAddDefaults.owner;
  $("#packing-quantity").value = packingAddDefaults.quantity;
  syncPackingTagOptions();
  const availablePackingTags = packingTagsForCategory(packingAddDefaults.subcategory);
  $("#packing-property").value = availablePackingTags.includes(packingAddDefaults.property) ? packingAddDefaults.property : availablePackingTags[0];
  $("#packing-uses").value = packingAddDefaults.usesTotal;
  $("[data-packing-uses-row]").hidden = $("#packing-property").value !== "consumable";
  $("#packing-purchase-property").innerHTML = packingPropertyOptions();
  $("#notice-subcategory").innerHTML = optionMarkup("notice");
  $("#notice-subcategory").value = state.activeNoticeSubcategory;
  const renderControls = () => {
    const packingTodos = window.TravelPrep.filterTodosByCategory(state.todos, "packing");
    $("#packing-luggage-filters").innerHTML = packingPrimaryLuggage().map((luggage) => `<button type="button" class="packing-luggage-filter" data-packing-luggage="${luggage.key}" aria-pressed="${state.selectedPackingLuggage === luggage.key}"><b aria-hidden="true">${luggage.icon}</b><span>${escapeHtml(luggage.label)}</span></button>`).join("");
    const containers = packingLuggageItems().filter((item) => item.parent === state.selectedPackingLuggage);
    $("#packing-container-filter-group").hidden = containers.length === 0;
    $("#packing-container-filters").innerHTML = containers.map((container) => `<button type="button" data-packing-container="${container.key}" aria-pressed="${state.selectedPackingContainer === container.key}">${container.icon} ${escapeHtml(container.label)}</button>`).join("");
    $("#packing-owner-filter-select").innerHTML = `<option value="">全部归属</option>${Object.entries(PACKING_OWNER_LABELS).map(([key, label]) => `<option value="${key}" ${state.selectedPackingOwner === key ? "selected" : ""}>${label}</option>`).join("")}`;
    const packingPropertyFilterOptions = [
      ...Object.entries(PACKING_PROPERTY_LABELS),
      ...packingCustomPropertyValues().map((key) => [key, packingPropertyLabel(key)])
    ];
    $("#packing-property-filter-select").innerHTML = `<option value="">全部属性</option>${packingPropertyFilterOptions.map(([key, label]) => `<option value="${escapeHtml(key)}" ${state.selectedPackingProperty === key ? "selected" : ""}>${escapeHtml(label)}</option>`).join("")}`;
    $("#packing-search-input").value = state.packingSearchText;
    const selectedCategory = [...state.selectedPackingSubcategories][0] || "";
    $("#packing-category-filter-select").innerHTML = `<option value="">全部类别</option>${packingCategoryEntries().map(([key, label]) => `<option value="${key}" ${selectedCategory === key ? "selected" : ""}>${label}</option>`).join("")}`;
    $("[data-packing-filter-reset]").classList.toggle("is-active", hasActivePackingFilters());
    $("#notice-category-tabs").innerHTML = Object.entries(PREP_LABELS.notice).map(([key, label]) => `<button type="button" data-notice-subcategory="${key}" aria-selected="${key === state.activeNoticeSubcategory}">${label}</button>`).join("");
    const activeItems = window.TravelPrep.sortNoticeItems(window.TravelPrep.filterTodosByCategory(state.todos, "notice").filter((todo) => window.TravelPrep.normalizeTodoSubcategory(todo) === state.activeNoticeSubcategory));
    $("#notice-category-settings").innerHTML = noticeGroups(state.activeNoticeSubcategory, activeItems).map(({ group, label }) => `<div class="notice-subcategory-setting" draggable="true" data-notice-group="${escapeHtml(group)}"><span class="notice-subcategory-setting__handle" aria-hidden="true">⋮⋮</span><input type="text" maxlength="24" value="${escapeHtml(label)}" data-notice-group-label="${escapeHtml(group)}" aria-label="${escapeHtml(group)}名称"></div>`).join("") || `<p class="todo-empty">该类别还没有子类别。</p>`;
  };
  const renderAll = () => { renderControls(); renderTodoList("packing"); renderTodoList("notice"); renderToiletMap(); renderPackingWorkspace(); };
  renderAll();
  state.packingDictionaryOutsideHandler?.();
  const packingDictionaryOutsideHandler = (event) => {
    const editingCategory = state.editingPackingDictionaryCategory;
    const editingLuggage = state.editingPackingLuggage;
    if ((!editingCategory && !editingLuggage) || event.target.closest("[data-packing-dictionary-category-label], [data-packing-dictionary-category-edit], [data-packing-luggage-label], [data-packing-luggage-edit], [data-packing-luggage-edit-form]")) return;
    state.editingPackingDictionaryCategory = "";
    state.editingPackingLuggage = "";
    renderAll();
  };
  state.packingDictionaryOutsideHandler = () => document.removeEventListener("click", packingDictionaryOutsideHandler);
  document.addEventListener("click", packingDictionaryOutsideHandler);
  $("#packing-overview").onclick = (event) => {
    const category = event.target.closest("[data-packing-overview-category]");
    if (category) {
      const categoryId = `${category.dataset.packingOverviewOwner}:${category.dataset.packingOverviewCategory}`;
      if (state.collapsedPackingOverviewCategories.has(categoryId)) state.collapsedPackingOverviewCategories.delete(categoryId);
      else state.collapsedPackingOverviewCategories.add(categoryId);
      renderPackingWorkspace();
      return;
    }
    const owner = event.target.closest("[data-packing-overview-owner]");
    if (!owner) return;
    state.packingOverviewOwner = owner.dataset.packingOverviewOwner;
    renderPackingWorkspace();
  };
  $("#packing-dictionary").onsubmit = (event) => {
    if (event.target.matches("[data-packing-luggage-add]")) {
      event.preventDefault();
      const form = new FormData(event.target);
      const label = String(form.get("label") || "").trim();
      if (!label) return;
      const key = `luggage-${Date.now().toString(36)}`;
      state.packingCustomLuggage.push({ key, label, icon: String(form.get("icon") || "🧳"), kind: String(form.get("kind") || "bag"), parent: String(form.get("parent") || "") });
      savePackingLuggageTree();
      renderAll();
      return;
    }
    if (event.target.matches("[data-packing-luggage-edit-form]")) {
      event.preventDefault();
      const key = event.target.dataset.packingLuggageKey;
      const luggage = packingLuggageItem(key);
      const label = $("[data-packing-luggage-label]", event.target.closest(".packing-dictionary-branch"))?.value.trim();
      if (!luggage || !label) return;
      const base = [...PACKING_LUGGAGE, ...PACKING_CONTAINERS].find((item) => item.key === key);
      if (!base) {
        const custom = state.packingCustomLuggage.find((item) => item.key === key);
        if (custom) custom.label = label;
      } else if (label !== base.label) state.packingLuggageLabels[key] = label;
      else delete state.packingLuggageLabels[key];
      state.packingLuggageIcons[key] = String($("[data-packing-luggage-icon]", event.target).value || luggage.icon);
      state.packingLuggageParents[key] = String($("[data-packing-luggage-parent]", event.target).value || "");
      localStorage.setItem(packingLuggageSettingsKey(), JSON.stringify(state.packingLuggageLabels));
      savePackingLuggageTree();
      state.editingPackingLuggage = "";
      renderAll();
      return;
    }
    if (!event.target.matches("[data-packing-dictionary-tag-add]")) return;
    event.preventDefault();
    const form = new FormData(event.target);
    const label = String(form.get("tag") || "").trim();
    const category = event.target.dataset.packingDictionaryCategory || "";
    if (!label || !category) return;
    const tag = packingCustomPropertyValues().find((value) => packingPropertyLabel(value) === label) || `custom:${encodeURIComponent(label)}`;
    attachPackingTagToCategory(tag, category);
    state.addingPackingDictionaryTagCategory = "";
    state.expandedPackingDictionaryCategories.add(category);
    renderAll();
  };
  $("#packing-dictionary").onclick = (event) => {
    const tab = event.target.closest("[data-packing-dictionary-tab]");
    if (tab) {
      state.activePackingDictionaryTab = tab.dataset.packingDictionaryTab;
      state.editingPackingDictionaryCategory = "";
      state.editingPackingLuggage = "";
      renderAll();
      return;
    }
    const addLuggage = event.target.closest("[data-packing-luggage-add-open]");
    if (addLuggage) {
      const form = $("[data-packing-luggage-add]", $("#packing-dictionary"));
      form.hidden = !form.hidden;
      if (!form.hidden) $("input", form)?.focus();
      return;
    }
    const editLuggage = event.target.closest("[data-packing-luggage-edit]");
    if (editLuggage) {
      state.editingPackingLuggage = editLuggage.dataset.packingLuggageEdit;
      renderAll();
      return;
    }
    const deleteLuggage = event.target.closest("[data-packing-luggage-delete]");
    if (deleteLuggage) {
      const key = deleteLuggage.dataset.packingLuggageDelete;
      const luggage = packingLuggageItem(key);
      if (!luggage) return;
      const children = packingLuggageItems().filter((item) => item.parent === key);
      if (children.length && !window.confirm(`“${luggage.label}”下有 ${children.length} 个子收纳包，确认删除并提升为主收纳包吗？`)) return;
      window.TravelPrep.filterTodosByCategory(state.todos, "packing").forEach((todo) => {
        if (packingLuggageFor(todo) !== key && packingContainerFor(todo) !== key) return;
        todo.luggage = "daily-bag";
        todo.container = "daily-bag";
        saveSharedChange("todos", todo).catch(console.error);
      });
      if (state.packingCustomLuggage.some((item) => item.key === key)) state.packingCustomLuggage = state.packingCustomLuggage.filter((item) => item.key !== key);
      else state.deletedPackingLuggage.add(key);
      children.forEach((item) => { state.packingLuggageParents[item.key] = ""; });
      delete state.packingLuggageLabels[key];
      delete state.packingLuggageParents[key];
      delete state.packingLuggageIcons[key];
      localStorage.setItem(packingLuggageSettingsKey(), JSON.stringify(state.packingLuggageLabels));
      savePackingLuggageTree();
      renderAll();
      return;
    }
    const labelInput = event.target.closest("[data-packing-dictionary-category-label]");
    if (labelInput) {
      event.stopPropagation();
      return;
    }
    const luggageLabelInput = event.target.closest("[data-packing-luggage-label]");
    if (luggageLabelInput) {
      event.stopPropagation();
      return;
    }
    const summary = event.target.closest(".packing-dictionary-branch > summary");
    if (summary && summary.parentElement.dataset.packingDictionaryCategory) {
      const branch = summary.parentElement;
      setTimeout(() => {
        if (branch.open) state.expandedPackingDictionaryCategories.add(branch.dataset.packingDictionaryCategory);
        else state.expandedPackingDictionaryCategories.delete(branch.dataset.packingDictionaryCategory);
      });
      return;
    }
    const editCategory = event.target.closest("[data-packing-dictionary-category-edit]");
    if (editCategory) {
      rememberOpenPackingDictionaryBranches();
      const category = editCategory.dataset.packingDictionaryCategoryEdit;
      state.editingPackingDictionaryCategory = category;
      state.expandedPackingDictionaryCategories.add(category);
      renderAll();
      $("[data-packing-dictionary-category-label]", $("#packing-dictionary"))?.focus();
      return;
    }
    const createTag = event.target.closest("[data-packing-dictionary-tag-create]");
    if (createTag) {
      rememberOpenPackingDictionaryBranches();
      const category = createTag.dataset.packingDictionaryTagCreate;
      state.addingPackingDictionaryTagCategory = category;
      state.expandedPackingDictionaryCategories.add(category);
      renderAll();
      $("[data-packing-dictionary-tag-add] input", $("#packing-dictionary"))?.focus();
      return;
    }
    const deleteCategory = event.target.closest("[data-packing-dictionary-category-delete]");
    if (deleteCategory) {
      const category = deleteCategory.dataset.packingDictionaryCategoryDelete;
      const label = packingCategoryLabel(category);
      const tags = packingTagsForCategory(category);
      if (tags.length && !window.confirm(`“${label}”类别内仍有 ${tags.length} 个标签，确认删除类别及这些关联标签吗？`)) return;
      rememberOpenPackingDictionaryBranches();
      deletePackingDictionaryCategory(category);
      renderAll();
      return;
    }
    const unlink = event.target.closest("[data-packing-dictionary-unlink]");
    if (!unlink) return;
    rememberOpenPackingDictionaryBranches();
    const category = unlink.dataset.packingDictionaryCategory;
    const tag = unlink.dataset.packingDictionaryUnlink;
    const tags = new Set(packingTagsForCategory(category));
    tags.delete(tag);
    state.packingTagAssociations[category] = [...tags];
    savePackingTagAssociations();
    renderAll();
  };
  $("#packing-dictionary").onchange = (event) => {
    const input = event.target.closest("[data-packing-dictionary-category-label]");
    if (!input) return;
    const category = input.dataset.packingDictionaryCategoryLabel;
    const label = input.value.trim();
    const defaultLabel = PREP_LABELS.packing[category] || state.packingCustomCategories[category];
    if (label && label !== defaultLabel) state.packingCategoryLabels[category] = label;
    else delete state.packingCategoryLabels[category];
    state.editingPackingDictionaryCategory = "";
    savePackingCategorySettings();
    renderAll();
  };
  $("#packing-dictionary").ondragstart = (event) => {
    const tag = event.target.closest("[data-packing-dictionary-tag]");
    if (tag && event.dataTransfer) {
      state.draggedPackingDictionaryTag = { type: "tag", tag: tag.dataset.packingDictionaryTag, category: tag.dataset.packingDictionaryCategory };
      event.dataTransfer.setData("text/plain", JSON.stringify(state.draggedPackingDictionaryTag));
      event.dataTransfer.effectAllowed = "move";
      return;
    }
    const category = event.target.closest("[data-packing-dictionary-category-drag]");
    if (!category || !event.dataTransfer) return;
    state.draggedPackingDictionaryTag = null;
    state.draggedPackingDictionaryCategory = category.dataset.packingDictionaryCategoryDrag;
    event.dataTransfer.setData("text/plain", JSON.stringify({ type: "category", category: state.draggedPackingDictionaryCategory }));
    event.dataTransfer.effectAllowed = "move";
  };
  $("#packing-dictionary").ondragover = (event) => {
    if (!event.target.closest("[data-packing-dictionary-drop], [data-packing-dictionary-tag-drop], [data-packing-dictionary-category-drop]")) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
  };
  $("#packing-dictionary").ondrop = (event) => {
    const target = event.target.closest("[data-packing-dictionary-tag-drop], [data-packing-dictionary-drop], [data-packing-dictionary-category-drop]");
    if (!target || !event.dataTransfer) return;
    event.preventDefault();
    let source = state.draggedPackingDictionaryTag;
    try { source ||= JSON.parse(event.dataTransfer.getData("text/plain")); } catch { source = null; }
    const targetCategoryBranch = target.dataset.packingDictionaryCategoryDrop || target.closest("[data-packing-dictionary-category-drag]")?.dataset.packingDictionaryCategoryDrag;
    if (source?.type === "category") {
      if (!source.category || !targetCategoryBranch || source.category === targetCategoryBranch) return;
      movePackingDictionaryCategory(source.category, targetCategoryBranch);
      state.draggedPackingDictionaryCategory = "";
      renderAll();
      return;
    }
    const targetCategory = target.dataset.packingDictionaryCategory || target.dataset.packingDictionaryDrop;
    const beforeTag = target.dataset.packingDictionaryTagDrop || "";
    if (!source?.tag || !source.category || !targetCategory) return;
    if (source.category === targetCategory && source.tag === beforeTag) return;
    rememberOpenPackingDictionaryBranches();
    state.expandedPackingDictionaryCategories.add(targetCategory);
    movePackingDictionaryTag(source.category, source.tag, targetCategory, beforeTag);
    state.draggedPackingDictionaryTag = null;
    renderAll();
  };
  $("#packing-dictionary").ondragend = () => { state.draggedPackingDictionaryTag = null; state.draggedPackingDictionaryCategory = ""; };
  $("#packing-luggage-filters").onclick = (event) => {
    const button = event.target.closest("[data-packing-luggage]");
    if (!button) return;
    const key = button.dataset.packingLuggage;
    state.selectedPackingLuggage = state.selectedPackingLuggage === key ? "" : key;
    state.selectedPackingContainer = "";
    renderAll();
  };
  $("#packing-container-filters").onclick = (event) => {
    const button = event.target.closest("[data-packing-container]");
    if (!button) return;
    const key = button.dataset.packingContainer;
    state.selectedPackingContainer = state.selectedPackingContainer === key ? "" : key;
    renderAll();
  };
  $("#packing-owner-filter-select").onchange = (event) => {
    state.selectedPackingOwner = event.target.value;
    renderAll();
  };
  $("#packing-property-filter-select").onchange = (event) => {
    state.selectedPackingProperty = event.target.value;
    renderAll();
  };
  $("#packing-search-input").oninput = (event) => {
    state.packingSearchText = event.target.value;
    renderAll();
  };
  $("#packing-search-panel").onsubmit = (event) => event.preventDefault();
  $("#packing-category-filter-select").onchange = (event) => {
    state.selectedPackingSubcategories = event.target.value ? new Set([event.target.value]) : new Set();
    renderAll();
  };
  $("[data-packing-filter-reset]").onclick = () => {
    state.selectedPackingLuggage = "";
    state.selectedPackingContainer = "";
    state.selectedPackingOwner = "";
    state.selectedPackingProperty = "";
    state.packingSearchText = "";
    state.selectedPackingSubcategories = new Set();
    renderAll();
  };
  $("#notice-category-tabs").onclick = (event) => {
    const button = event.target.closest("[data-notice-subcategory]");
    if (!button) return;
    state.activeNoticeSubcategory = button.dataset.noticeSubcategory;
    localStorage.setItem(preferenceKey, state.activeNoticeSubcategory);
    $("#notice-subcategory").value = state.activeNoticeSubcategory;
    renderAll();
  };
  $("#notice-list").onclick = (event) => {
    const button = event.target.closest("[data-notice-group-toggle]");
    if (!button) return;
    const id = noticeGroupId(state.activeNoticeSubcategory, button.dataset.noticeGroupToggle);
    state.collapsedNoticeGroups.has(id) ? state.collapsedNoticeGroups.delete(id) : state.collapsedNoticeGroups.add(id);
    saveNoticeGroupSettings();
    renderAll();
  };
  $("#notice-category-settings").onchange = (event) => {
    const input = event.target.closest("[data-notice-group-label]");
    if (!input) return;
    const key = noticeGroupId(state.activeNoticeSubcategory, input.dataset.noticeGroupLabel);
    const label = input.value.trim();
    if (label) state.noticeGroupLabels[key] = label;
    else delete state.noticeGroupLabels[key];
    saveNoticeGroupSettings();
    renderAll();
  };
  $("#notice-category-settings").ondragstart = (event) => {
    const row = event.target.closest("[data-notice-group]");
    if (!row) return;
    state.draggedNoticeGroup = row.dataset.noticeGroup;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", state.draggedNoticeGroup);
  };
  $("#notice-category-settings").ondragover = (event) => {
    if (event.target.closest("[data-notice-group]")) event.preventDefault();
  };
  $("#notice-category-settings").ondrop = (event) => {
    event.preventDefault();
    const row = event.target.closest("[data-notice-group]");
    const source = state.draggedNoticeGroup || event.dataTransfer.getData("text/plain");
    const target = row?.dataset.noticeGroup;
    const order = state.noticeGroupOrder[state.activeNoticeSubcategory] || [];
    const sourceIndex = order.indexOf(source);
    const targetIndex = order.indexOf(target);
    if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return;
    order.splice(sourceIndex, 1);
    order.splice(targetIndex, 0, source);
    state.noticeGroupOrder[state.activeNoticeSubcategory] = order;
    state.draggedNoticeGroup = "";
    saveNoticeGroupSettings();
    renderAll();
  };
  $("#notice-category-settings").ondragend = () => { state.draggedNoticeGroup = ""; };
  $("#notice-subcategory").onchange = (event) => {
    state.activeNoticeSubcategory = event.target.value;
    localStorage.setItem(preferenceKey, state.activeNoticeSubcategory);
    renderAll();
  };
  $("#packing-purchase-form").onsubmit = (event) => {
    event.preventDefault();
    const input = $("#packing-purchase-input");
    const text = input.value.trim();
    if (!text) return;
    const property = $("#packing-purchase-property").value;
    const usesTotal = property === "consumable" ? Number($("#packing-purchase-uses").value) || 0 : 0;
    state.packingPurchases.push({ id: `purchase-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, text, property, usesTotal });
    input.value = "";
    $("#packing-purchase-property").value = "none";
    $("#packing-purchase-uses").value = "0";
    $("[data-packing-purchase-uses-row]").hidden = true;
    savePackingWorkspace();
    renderAll();
  };
  $("#packing-purchase-list").onclick = (event) => {
    const button = event.target.closest("[data-purchase-submit], [data-purchase-delete]");
    if (!button) return;
    const id = button.dataset.purchaseSubmit || button.dataset.purchaseDelete;
    const purchase = state.packingPurchases.find((item) => item.id === id);
    if (!purchase) return;
    if (button.dataset.purchaseSubmit) {
      const property = packingPropertyFor(purchase);
      const usesTotal = property === "consumable" ? Number(purchase.usesTotal) || 0 : 0;
      const todo = { id: `todo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, text: purchase.text, category: "packing", subcategory: "other", luggage: "daily-bag", container: "daily-bag", owner: "unassigned", property, usesTotal, usesRemaining: usesTotal, completed: false };
      state.todos.push(todo);
      saveSharedChange("todos", todo).catch(console.error);
    }
    state.removedPurchaseIds.add(id);
    state.packingPurchases = state.packingPurchases.filter((item) => item.id !== id);
    savePackingWorkspace();
    renderAll();
  };
  $("#packing-checker").onclick = (event) => {
    const luggage = event.target.closest("[data-packing-check-luggage]");
    if (luggage && !state.packingCheck.active) {
      const openLuggage = state.packingCheck.openLuggage || [];
      state.packingCheck.openLuggage = openLuggage.includes(luggage.dataset.packingCheckLuggage)
        ? openLuggage.filter((key) => key !== luggage.dataset.packingCheckLuggage)
        : [...openLuggage, luggage.dataset.packingCheckLuggage];
      savePackingWorkspace();
      renderAll();
      return;
    }
    const reselect = event.target.closest("[data-packing-check-reselect]");
    if (reselect) {
      state.packingCheck = { active: false, index: 0, completed: false, openLuggage: state.packingCheck.openLuggage || [] };
      savePackingWorkspace();
      renderAll();
      return;
    }
    const reset = event.target.closest("[data-packing-check-start], [data-packing-check-reset]");
    if (reset) {
      const openLuggage = state.packingCheck.openLuggage || [];
      state.todos.filter((todo) => window.TravelPrep.normalizeTodoCategory(todo) === "packing" && openLuggage.includes(packingLuggageFor(todo))).forEach((todo) => { todo.checked = false; saveSharedChange("todos", todo).catch(console.error); });
      state.packingCheck = { active: true, index: 0, completed: false, openLuggage };
      savePackingWorkspace();
      renderAll();
      return;
    }
    const next = event.target.closest("[data-packing-check-next]");
    if (!next) return;
    const todo = state.todos.find((item) => item.id === next.dataset.packingCheckNext);
    if (todo) { todo.checked = true; saveSharedChange("todos", todo).catch(console.error); }
    state.packingCheck.index += 1;
    state.packingCheck.completed = state.packingCheck.index >= window.TravelPrep.filterTodosByCategory(state.todos, "packing").filter((item) => (state.packingCheck.openLuggage || []).includes(packingLuggageFor(item))).length;
    savePackingWorkspace();
    renderAll();
  };
  const submitForm = (kind) => (event) => {
    event.preventDefault();
    const input = $(`#${kind}-input`);
    const text = input.value.trim();
    if (!text) return;
    let subcategory = $(`#${kind}-subcategory`).value;
    if (kind === "packing" && subcategory === "__custom__") {
      const label = $("#packing-custom-category").value.trim();
      if (!label) {
        $("#packing-custom-category").focus();
        return;
      }
      const existing = packingCategoryEntries().find(([, value]) => value === label);
      subcategory = existing ? existing[0] : `custom-${Date.now().toString(36)}`;
      if (!existing) {
        state.packingCustomCategories[subcategory] = label;
        localStorage.setItem(packingCustomCategoriesKey(), JSON.stringify(state.packingCustomCategories));
        $("#packing-subcategory").innerHTML = `${optionMarkup("packing")}<option value="__custom__">新增类别…</option>`;
      }
    }
    let property = kind === "packing" ? $("#packing-property").value : "common";
    if (kind === "packing" && property === "__custom__") {
      const label = $("#packing-custom-property").value.trim();
      if (!label) {
        $("#packing-custom-property").focus();
        return;
      }
      property = `custom:${encodeURIComponent(label)}`;
    }
    if (kind === "packing") syncPackingDictionaryCategory(subcategory, property);
    const usesTotal = kind === "packing" && property === "consumable" ? Number($("#packing-uses").value) || 0 : 0;
    const owner = kind === "packing" ? $("#packing-owner").value : "unassigned";
    const todo = { id: `todo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, text, category: kind, subcategory, ...(kind === "packing" ? { luggage: packingLuggageFor({ category: kind, subcategory }), owner, property, quantity: Number($("#packing-quantity").value) || 1, container: packingLuggageFor({ category: kind, subcategory }), usesTotal, usesRemaining: usesTotal } : {}), completed: false };
    state.todos.push(todo);
    input.value = "";
    if (kind === "packing") {
      state.packingAddDefaults = { subcategory, owner, property, quantity: $("#packing-quantity").value, usesTotal: $("#packing-uses").value };
      $("#packing-custom-category").value = "";
      $("[data-packing-custom-category-row]").hidden = true;
      $("#packing-custom-property").value = "";
      $("[data-packing-custom-property-row]").hidden = true;
    }
    saveSharedChange("todos", todo).catch(console.error);
    renderAll();
  };
  const submitPackingForm = submitForm("packing");
  $("#packing-form").onsubmit = submitPackingForm;
  $("[data-packing-add-submit]").onclick = () => submitPackingForm({ preventDefault() {} });
  $("#notice-form").onsubmit = submitForm("notice");
  $("[data-packing-form-open]").onclick = () => {
    $("#packing-search-panel").hidden = true;
    $("#packing-form-panel").hidden = false;
    $("#packing-input").focus();
  };
  $("[data-packing-form-close]").onclick = () => {
    $("#packing-form-panel").hidden = true;
  };
  $("[data-packing-search-open]").onclick = () => {
    $("#packing-form-panel").hidden = true;
    $("#packing-search-panel").hidden = false;
    $("#packing-search-input").focus();
  };
  $("[data-packing-search-close]").onclick = () => {
    $("#packing-search-panel").hidden = true;
  };
  $("#packing-subcategory").onchange = () => {
    const isCustom = $("#packing-subcategory").value === "__custom__";
    $("[data-packing-custom-category-row]").hidden = !isCustom;
    syncPackingTagOptions();
    state.packingAddDefaults.subcategory = $("#packing-subcategory").value;
    state.packingAddDefaults.property = $("#packing-property").value;
    if (isCustom) $("#packing-custom-category").focus();
  };
  const updateUsesVisibility = (propertySelect, usesRow) => {
    const isConsumable = propertySelect.value === "consumable";
    usesRow.hidden = !isConsumable;
    if (!isConsumable) $("input", usesRow).value = "0";
  };
  const updateCustomPropertyVisibility = (propertySelect, customRow, customInput) => {
    const isCustom = propertySelect.value === "__custom__";
    customRow.hidden = !isCustom;
    if (isCustom) customInput.focus();
  };
  $("#packing-property").onchange = () => {
    updateUsesVisibility($("#packing-property"), $("[data-packing-uses-row]"));
    updateCustomPropertyVisibility($("#packing-property"), $("[data-packing-custom-property-row]"), $("#packing-custom-property"));
    state.packingAddDefaults.property = $("#packing-property").value;
  };
  $("#packing-owner").onchange = () => { state.packingAddDefaults.owner = $("#packing-owner").value; };
  $("#packing-quantity").onchange = () => { state.packingAddDefaults.quantity = $("#packing-quantity").value; };
  $("#packing-uses").oninput = () => { state.packingAddDefaults.usesTotal = $("#packing-uses").value; };
  $("#packing-purchase-property").onchange = () => updateUsesVisibility($("#packing-purchase-property"), $("[data-packing-purchase-uses-row]"));
  const syncPackingEditFields = (form) => {
    const category = $("[data-packing-edit-category]", form).value;
    const isCustom = category === "__custom__";
    $("[data-packing-edit-custom-category-row]", form).hidden = !isCustom;
    const property = $("[data-packing-edit-property]", form);
    const tags = packingTagsForCategory(category);
    const selected = property.value !== "__custom__" ? property.value : tags[0];
    property.innerHTML = packingTagOptions(tags, selected);
    property.value = selected;
    updateUsesVisibility(property, $("[data-packing-edit-uses-row]", form));
    $("[data-packing-edit-custom-property-row]", form).hidden = true;
    if (isCustom) $("[data-packing-edit-custom-category]", form).focus();
  };
  const submitPackingEdit = (event) => {
    const form = event.target.closest("[data-packing-edit-form]");
    if (!form) return;
    event.preventDefault();
    const todo = state.todos.find((entry) => entry.id === form.dataset.todoId);
    const text = $("[data-packing-edit-name]", form).value.trim();
    if (!todo || !text) return;
    let subcategory = $("[data-packing-edit-category]", form).value;
    if (subcategory === "__custom__") {
      const label = $("[data-packing-edit-custom-category]", form).value.trim();
      if (!label) { $("[data-packing-edit-custom-category]", form).focus(); return; }
      const existing = packingCategoryEntries().find(([, value]) => value === label);
      subcategory = existing ? existing[0] : `custom-${Date.now().toString(36)}`;
      if (!existing) {
        state.packingCustomCategories[subcategory] = label;
        localStorage.setItem(packingCustomCategoriesKey(), JSON.stringify(state.packingCustomCategories));
      }
    }
    let property = $("[data-packing-edit-property]", form).value;
    if (property === "__custom__") {
      const label = $("[data-packing-edit-custom-property]", form).value.trim();
      if (!label) { $("[data-packing-edit-custom-property]", form).focus(); return; }
      property = `custom:${encodeURIComponent(label)}`;
    }
    syncPackingDictionaryCategory(subcategory, property);
    const usesTotal = property === "consumable" ? Number($("[data-packing-edit-uses]", form).value) || 1 : 0;
    Object.assign(todo, {
      text,
      subcategory,
      owner: $("[data-packing-edit-owner]", form).value,
      property,
      quantity: Number($("[data-packing-edit-quantity]", form).value) || 1,
      usesTotal,
      usesRemaining: usesTotal
    });
    state.editingPackingTodoId = "";
    saveSharedChange("todos", todo).catch(console.error);
    renderAll();
  };
  const updateTodo = (event) => {
    const item = event.target.closest("[data-todo-id]");
    if (!item) return;
    const todo = state.todos.find((entry) => entry.id === item.dataset.todoId);
    if (!todo) return;
    if (event.target.matches("[data-packing-owner]")) todo.owner = event.target.value;
    else if (event.target.matches("[data-packing-container]")) {
      todo.container = event.target.value;
      const parent = PACKING_CONTAINERS.find((container) => container.key === todo.container)?.parent;
      if (parent) todo.luggage = parent;
      else todo.luggage = todo.container;
    } else if (event.target.matches("input[type='checkbox']")) todo.completed = event.target.checked;
    else return;
    saveSharedChange("todos", todo).catch(console.error);
    renderAll();
  };
  const manageTodo = (event) => {
    const item = event.target.closest("[data-todo-id]");
    const todo = item && state.todos.find((entry) => entry.id === item.dataset.todoId);
    if (!todo) return;
    if (event.target.closest(".todo-edit")) {
      state.editingPackingTodoId = todo.id;
      renderTodoList("packing");
      return;
    }
    if (event.target.closest("[data-todo-copy]")) {
      const duplicate = { ...todo,
        id: `todo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        completed: false
      };
      state.todos.push(duplicate);
      saveSharedChange("todos", duplicate).catch(console.error);
      renderAll();
      return;
    }
    if (!event.target.closest(".todo-delete")) return;
    if (window.TravelPrep.normalizeTodoCategory(todo) === "packing") rememberRemovedAuthoredPackingTodo(todo);
    state.todos = state.todos.filter((entry) => entry.id !== todo.id);
    saveSharedChange("todos", { id: todo.id }, "delete").catch(console.error);
    renderAll();
  };
  $("#packing-list").onsubmit = submitPackingEdit;
  $("#packing-list").onchange = (event) => {
    const form = event.target.closest("[data-packing-edit-form]");
    if (form && event.target.matches("[data-packing-edit-category]")) {
      syncPackingEditFields(form);
      return;
    }
    if (form && event.target.matches("[data-packing-edit-property]")) {
      const property = $("[data-packing-edit-property]", form);
      updateUsesVisibility(property, $("[data-packing-edit-uses-row]", form));
      updateCustomPropertyVisibility(property, $("[data-packing-edit-custom-property-row]", form), $("[data-packing-edit-custom-property]", form));
      return;
    }
    updateTodo(event);
  };
  $("#packing-list").onclick = (event) => {
    const editSave = event.target.closest("[data-packing-edit-submit]");
    if (editSave) {
      submitPackingEdit({ target: editSave.closest("[data-packing-edit-form]"), preventDefault() {} });
      return;
    }
    const editCancel = event.target.closest("[data-packing-edit-cancel]");
    if (editCancel) {
      state.editingPackingTodoId = "";
      renderTodoList("packing");
      return;
    }
    const categoryToggle = event.target.closest("[data-packing-category-toggle]");
    if (categoryToggle) {
      const key = categoryToggle.dataset.packingCategoryToggle;
      state.collapsedPackingCategories.has(key) ? state.collapsedPackingCategories.delete(key) : state.collapsedPackingCategories.add(key);
      renderTodoList("packing");
      return;
    }
    const find = event.target.closest("[data-packing-find]");
    if (find) {
      const todo = state.todos.find((entry) => entry.id === find.dataset.packingFind);
      const luggage = todo && packingLuggageItem(packingLuggageFor(todo));
      const filter = luggage && document.querySelector(`[data-packing-luggage="${luggage.key}"]`);
      if (filter) {
        filter.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
        filter.classList.add("is-highlighted");
        setTimeout(() => filter.classList.remove("is-highlighted"), 2200);
      }
      return;
    }
    const use = event.target.closest("[data-todo-use]");
    if (use) {
      const todo = state.todos.find((entry) => entry.id === use.dataset.todoUse);
      if (todo && Number(todo.usesRemaining) > 0) {
        todo.usesRemaining -= 1;
        saveSharedChange("todos", todo).catch(console.error);
        renderAll();
      }
      return;
    }
    manageTodo(event);
  };
}

function safeExternalUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw, location.href);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function localAssetUrl(value) {
  const raw = String(value || "").trim();
  if (!raw || raw.startsWith("//") || /^[a-z][a-z0-9+.-]*:/i.test(raw)) return "";
  try {
    const url = new URL(raw, location.href);
    return url.origin === location.origin ? url.href : "";
  } catch {
    return "";
  }
}

let ticketDialogOpener = null;

function openTicketDialog(ticketId, opener) {
  const ticket = state.data.ticketPlanning?.items?.find((item) => item.id === ticketId);
  const dialog = $("#ticket-dialog");
  if (!ticket || !dialog) return;
  ticketDialogOpener = opener || null;
  $("#ticket-dialog-title").textContent = ticketTitle(ticket);
  const document = ticketDocument(ticket);
  const localDocument = localAssetUrl(document?.url);
  const externalDocument = !localDocument ? safeExternalUrl(document?.url) : "";
  const officialUrl = safeExternalUrl(ticket.officialUrl || ticket.booking?.officialUrl || ticket.booking?.purchaseUrl);
  const extension = localDocument.split(/[?#]/)[0].split(".").at(-1)?.toLocaleLowerCase();
  let preview = "";
  if (localDocument && ["png", "jpg", "jpeg", "webp", "gif", "svg"].includes(extension)) {
    preview = `<img class="ticket-dialog__preview" src="${escapeHtml(localDocument)}" alt="${escapeHtml(ticketTitle(ticket))}">`;
  } else if (localDocument) {
    preview = `<iframe class="ticket-dialog__preview" src="${escapeHtml(localDocument)}" title="${escapeHtml(ticketTitle(ticket))}" sandbox="allow-same-origin" referrerpolicy="no-referrer"></iframe>`;
  }
  const links = [
    localDocument ? `<a href="${escapeHtml(localDocument)}" target="_blank" rel="noopener noreferrer">在新窗口打开票据 ↗</a>` : "",
    externalDocument ? `<a href="${escapeHtml(externalDocument)}" target="_blank" rel="noopener noreferrer">${escapeHtml(document?.label || "查看票据")} ↗</a>` : "",
    officialUrl ? `<a href="${escapeHtml(officialUrl)}" target="_blank" rel="noopener noreferrer">打开官方页面 ↗</a>` : ""
  ].filter(Boolean).join("");
  $("#ticket-dialog-body").innerHTML = `
    <p class="ticket-dialog__status">${escapeHtml(isTicketPurchased(ticket) ? "已标记购票" : ticketRequirement(ticket))}</p>
    ${ticketGuidance(ticket) ? `<p class="ticket-dialog__guidance">${escapeHtml(ticketGuidance(ticket))}</p>` : ""}
    ${preview || (!links ? `<p class="ticket-dialog__empty">当前没有可预览的票据文件或官方链接。</p>` : "")}
    ${links ? `<div class="ticket-dialog__links">${links}</div>` : ""}`;
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
  $("#ticket-dialog-close").focus();
}

function setupTicketDialog() {
  const dialog = $("#ticket-dialog");
  if (!dialog) return;
  const close = () => {
    if (typeof dialog.close === "function" && dialog.open) dialog.close();
    else dialog.removeAttribute("open");
  };
  $("#ticket-dialog-close").onclick = close;
  dialog.addEventListener("click", (event) => { if (event.target === dialog) close(); });
  dialog.addEventListener("close", () => {
    const body = $("#ticket-dialog-body");
    if (!body.querySelector(".ticket-dialog__preview--pdf")) body.replaceChildren();
    ticketDialogOpener?.focus({ preventScroll: true });
    ticketDialogOpener = null;
  });
}

function setupPlaceMap() {
  const panel = $("#place-map");
  const frame = $("#place-map-frame");
  let opener;
  let previousOverflow = "";
  const close = () => {
    panel.hidden = true;
    frame.src = "about:blank";
    document.body.style.overflow = previousOverflow;
    opener?.focus();
  };
  document.addEventListener("click", (event) => {
    const link = event.target.closest("button[data-map-query]");
    if (!link) return;
    event.preventDefault();
    opener = link;
    $("#place-map-title").textContent = link.dataset.mapLabel;
    $("#place-map-external").href = safeExternalUrl(link.dataset.mapUrl) || mapsSearch(link.dataset.mapQuery);
    frame.title = `${link.dataset.mapLabel} Google Maps`;
    frame.src = `https://maps.google.com/maps?q=${encodeURIComponent(link.dataset.mapQuery)}&output=embed`;
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.hidden = false;
    $("#place-map-close").focus();
  });
  $("#place-map-close").onclick = close;
  panel.addEventListener("click", (event) => { if (event.target === panel) close(); });
  panel.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
    if (event.key === "Tab") {
      const first = $("#place-map-close");
      const last = $("#place-map-external");
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
}

function startCountdowns() {
  if (moduleEnabled("flights")) updateFlightCountdowns();
  if (moduleEnabled("driving")) updateRentalCountdown();
  if (!moduleEnabled("flights") && !moduleEnabled("driving")) return;
  state.countdownTimer = window.setInterval(() => {
    if (moduleEnabled("flights")) updateFlightCountdowns();
    if (moduleEnabled("driving")) updateRentalCountdown();
  }, 1000);
}

function preloadDefaultRouteMap() {
  const routeMap = state.data?.routeMap;
  const source = travelMapSource(routeMap, routeMap?.defaultRegionId);
  if (!source?.baseImage) return;
  const image = new Image();
  image.decoding = "async";
  image.fetchPriority = "high";
  image.src = source.baseImage;
  state.routeMapPreload = image;
}

async function init() {
  try {
    const response = await fetch("trip-data.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.data = await response.json();
    state.config = normalizeTripConfig(state.data.config);
    window.TRAVEL_PLAN_CONFIG = state.config;
    window.TRAVEL_PLAN_DATA = state.data;
    document.dispatchEvent(new CustomEvent("travel-data-ready", { detail: state.data }));
    applyModuleConfig();
    if (moduleEnabled("overview")) preloadDefaultRouteMap();
    renderHero();
    if (moduleEnabled("flights")) renderFlights();
    if (moduleEnabled("overview")) setupRouteExplorer();
    if (moduleEnabled("itinerary")) {
      setupPlaceMap();
      setupTicketDialog();
    }
    if (moduleEnabled("todo") || moduleEnabled("itinerary")) {
      try {
        await loadConfiguredRuntimeState();
      } catch (error) {
        console.error(`${state.config.persistence.mode === "d1" ? "Shared" : "Local"} runtime data could not be loaded`, error);
        state.todos = [];
        state.purchasedTickets = new Set();
      }
    }
    if (moduleEnabled("itinerary")) renderTimeline();
    if (moduleEnabled("driving")) renderRental();
    if (moduleEnabled("todo")) renderTravelPrep();
    if (moduleEnabled("ledger")) {
      await window.TravelLedger?.init?.({ tripId: state.data.metadata.tripId, config: state.config });
    }
    startCountdowns();
  } catch (error) {
    console.error("Travel data could not be loaded", error);
    $("#loading-error").hidden = false;
  }
}

function syncPackingWorkspace(hash = location.hash) {
  const workspace = packingWorkspaceFromHash(hash);
  if (!workspace || workspace === state.activePackingWorkspace || !state.data) return;
  state.activePackingWorkspace = workspace;
  renderTravelPrep();
}

window.addEventListener("hashchange", () => syncPackingWorkspace());
window.addEventListener("travel-navigation:navigate", (event) => syncPackingWorkspace(event.detail?.hash));

document.addEventListener("DOMContentLoaded", init);
