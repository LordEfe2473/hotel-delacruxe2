const storageKeys = {
  settings: "hotel-delacruxe-settings",
  bookings: "hotel-delacruxe-bookings",
  theme: "hotel-delacruxe-theme",
};

const defaultSettings = {
  hotelName: "Hotel Delacruxe",
  roomName: "Delacruxe Room",
  price: 16000,
  inventory: 15,
  currency: "NGN",
  receptionistPhone: "09163351767",
  whatsappNumber: "2349163351767",
  address: "GPWX+VRH, opposite Rhema Bible Church, Warri, Ugboroke 332104, Delta",
  mapQuery: "Hotel Delacruxe GPWX+VRH opposite Rhema Bible Church Warri Ugboroke 332104 Delta",
};

const appData = {
  settings: { ...defaultSettings },
  bookings: [],
  apiAvailable: false,
};

const state = {
  checkin: "",
  checkout: "",
  rooms: 1,
  guests: 2,
  available: 0,
};

const selectors = {
  body: document.body,
  menuToggle: document.querySelector("[data-menu-toggle]"),
  nav: document.querySelector("[data-nav]"),
  themeToggle: document.querySelector("[data-theme-toggle]"),
  availabilityForm: document.querySelector("[data-availability-form]"),
  reservationForm: document.querySelector("[data-reservation-form]"),
  availabilityStatus: document.querySelector("[data-availability-status]"),
  bookingNote: document.querySelector("[data-booking-note]"),
  priceChip: document.querySelector("[data-price-chip]"),
  roomSummary: document.querySelector("[data-room-summary]"),
  availablePill: document.querySelector("[data-available-pill]"),
  roomName: document.querySelector("[data-room-name]"),
  mapFrame: document.querySelector("[data-map-frame]"),
  mapLinks: document.querySelectorAll("[data-map-link]"),
  phoneLinks: document.querySelectorAll("[data-phone-link]"),
  whatsappLinks: document.querySelectorAll("[data-whatsapp-link]"),
  locationCopy: document.querySelector("[data-location-copy]"),
};

init();

async function init() {
  await loadHotelData();
  setDefaultDates();
  setupTheme();
  setupNavigation();
  setupLocation();
  setupContactLinks();
  renderRoomContent();
  runAvailabilityCheck();

  selectors.availabilityForm.addEventListener("submit", (event) => {
    event.preventDefault();
    runAvailabilityCheck();
  });

  selectors.availabilityForm.addEventListener("change", () => {
    runAvailabilityCheck();
  });

  selectors.reservationForm.addEventListener("submit", handleReservation);

  window.addEventListener("storage", (event) => {
    if (event.key === storageKeys.settings || event.key === storageKeys.bookings) {
      loadFallbackData();
      setupContactLinks();
      renderRoomContent();
      runAvailabilityCheck();
    }
  });
}

async function loadHotelData() {
  try {
    const response = await fetch("/api/public-data", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("API unavailable");
    }
    const data = await response.json();
    appData.settings = { ...defaultSettings, ...(data.settings || {}) };
    appData.bookings = Array.isArray(data.bookings) ? data.bookings : [];
    appData.apiAvailable = true;
  } catch {
    loadFallbackData();
  }
}

function loadFallbackData() {
  appData.settings = getFallbackSettings();
  appData.bookings = getFallbackBookings();
  appData.apiAvailable = false;
}

function setDefaultDates() {
  const checkinInput = selectors.availabilityForm.elements.checkin;
  const checkoutInput = selectors.availabilityForm.elements.checkout;
  const today = startOfDay(new Date());
  const tomorrow = addDays(today, 1);
  const dayAfter = addDays(today, 2);

  checkinInput.min = toDateInputValue(today);
  checkoutInput.min = toDateInputValue(tomorrow);
  checkinInput.value = toDateInputValue(tomorrow);
  checkoutInput.value = toDateInputValue(dayAfter);
  readAvailabilityForm();
}

function setupTheme() {
  const savedTheme = getStoredItem(storageKeys.theme) || "system";
  applyTheme(savedTheme);

  selectors.themeToggle.addEventListener("click", () => {
    const current = getStoredItem(storageKeys.theme) || "system";
    const next = current === "system" ? "light" : current === "light" ? "dark" : "system";
    applyTheme(next);
    setStoredItem(storageKeys.theme, next);
  });
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme === "system" ? "" : theme;
  const label = theme === "system" ? "Use device theme" : theme === "light" ? "Use light theme" : "Use dark theme";
  selectors.themeToggle.setAttribute("aria-label", label);
  selectors.themeToggle.title = label;
}

function setupNavigation() {
  selectors.menuToggle.addEventListener("click", () => {
    const isOpen = selectors.body.classList.toggle("nav-open");
    selectors.menuToggle.setAttribute("aria-label", isOpen ? "Close menu" : "Open menu");
  });

  selectors.nav.addEventListener("click", (event) => {
    if (event.target.matches("a")) {
      selectors.body.classList.remove("nav-open");
      selectors.menuToggle.setAttribute("aria-label", "Open menu");
    }
  });
}

function setupLocation() {
  const settings = getSettings();
  const encodedQuery = encodeURIComponent(settings.mapQuery || settings.address);

  selectors.mapFrame.src = `https://www.google.com/maps?q=${encodedQuery}&output=embed`;
  selectors.mapFrame.title = `${settings.hotelName} location map`;
  selectors.mapLinks.forEach((link) => {
    link.href = `https://www.google.com/maps/search/?api=1&query=${encodedQuery}`;
  });
  selectors.locationCopy.textContent = settings.address;
}

function setupContactLinks() {
  const settings = getSettings();
  const displayPhone = settings.receptionistPhone || "09163351767";
  const callNumber = normalizePhone(settings.receptionistPhone || settings.whatsappNumber);
  const whatsappNumber = normalizePhone(settings.whatsappNumber || settings.receptionistPhone);
  const whatsappMessage = encodeURIComponent(`Hello ${settings.hotelName}, I would like to book a room.`);

  selectors.phoneLinks.forEach((link) => {
    link.href = `tel:+${callNumber}`;
    link.textContent = `Call ${displayPhone}`;
  });

  selectors.whatsappLinks.forEach((link) => {
    link.href = `https://wa.me/${whatsappNumber}?text=${whatsappMessage}`;
  });
}

function renderRoomContent() {
  const settings = getSettings();
  const price = formatMoney(settings.price);
  const availableToday = getAvailableCount(toDateInputValue(new Date()), toDateInputValue(addDays(new Date(), 1)));

  selectors.priceChip.textContent = `${price}/night`;
  selectors.roomSummary.textContent = `${settings.roomName} is ${price} per night, with ${settings.inventory} total rooms managed by the admin page.`;
  selectors.availablePill.textContent = `${Math.max(availableToday, 0)} available tonight`;
  selectors.roomName.textContent = settings.roomName;
  document.title = `${settings.hotelName} | Book Your Stay`;
}

function readAvailabilityForm() {
  const data = new FormData(selectors.availabilityForm);
  state.checkin = data.get("checkin");
  state.checkout = data.get("checkout");
  state.rooms = clampNumber(Number(data.get("rooms")), 1, 100);
  state.guests = clampNumber(Number(data.get("guests")), 1, 100);

  const checkoutInput = selectors.availabilityForm.elements.checkout;
  const minimumCheckout = state.checkin ? toDateInputValue(addDays(parseDate(state.checkin), 1)) : checkoutInput.min;
  checkoutInput.min = minimumCheckout;

  if (state.checkout <= state.checkin) {
    checkoutInput.value = minimumCheckout;
    state.checkout = minimumCheckout;
  }
}

function runAvailabilityCheck() {
  readAvailabilityForm();

  if (!state.checkin || !state.checkout || state.checkout <= state.checkin) {
    state.available = 0;
    showAvailabilityMessage("Choose valid check-in and check-out dates.", "bad");
    return;
  }

  const settings = getSettings();
  state.available = getAvailableCount(state.checkin, state.checkout);
  const nights = getNightCount(state.checkin, state.checkout);
  const total = settings.price * nights * state.rooms;

  if (state.available >= state.rooms) {
    const roomWord = state.available === 1 ? "room" : "rooms";
    showAvailabilityMessage(
      `${state.available} ${roomWord} available for ${formatStayDates(state.checkin, state.checkout)}. Estimated total: ${formatMoney(total)}.`,
      "good",
    );
  } else if (state.available > 0) {
    showAvailabilityMessage(`Only ${state.available} room(s) left for those dates. Reduce the rooms needed or choose other dates.`, "bad");
  } else {
    showAvailabilityMessage("No rooms are available for those dates. Try another date.", "bad");
  }
}

async function handleReservation(event) {
  event.preventDefault();
  runAvailabilityCheck();

  if (state.available < state.rooms) {
    setBookingNote("There are not enough rooms available for that stay.", "error");
    return;
  }

  const formData = new FormData(selectors.reservationForm);
  const fullName = String(formData.get("fullName") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const phone = String(formData.get("phone") || "").trim();

  if (!fullName || !email || !phone) {
    setBookingNote("Add the guest name, email, and phone number.", "error");
    return;
  }

  const bookingDraft = {
    fullName,
    email,
    phone,
    note: String(formData.get("note") || "").trim(),
    guests: state.guests,
    rooms: state.rooms,
    checkin: state.checkin,
    checkout: state.checkout,
  };

  const booking = await saveBooking(bookingDraft);
  selectors.reservationForm.reset();
  setBookingNote(`Booking ${booking.reference} received. The hotel admin can now see it.`, "success");
  runAvailabilityCheck();
  renderRoomContent();
}

async function saveBooking(bookingDraft) {
  if (appData.apiAvailable) {
    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bookingDraft),
      });
      if (!response.ok) {
        throw new Error("Booking failed");
      }
      const booking = await response.json();
      appData.bookings.unshift(booking);
      return booking;
    } catch {
      appData.apiAvailable = false;
    }
  }

  const settings = getSettings();
  const nights = getNightCount(bookingDraft.checkin, bookingDraft.checkout);
  const booking = {
    reference: createBookingReference(),
    ...bookingDraft,
    nights,
    pricePerNight: settings.price,
    total: settings.price * nights * bookingDraft.rooms,
    status: "new",
    createdAt: new Date().toISOString(),
  };

  appData.bookings.unshift(booking);
  setStoredItem(storageKeys.bookings, JSON.stringify(appData.bookings));
  return booking;
}

function getSettings() {
  return appData.settings;
}

function getFallbackSettings() {
  try {
    return { ...defaultSettings, ...JSON.parse(getStoredItem(storageKeys.settings) || "{}") };
  } catch {
    return { ...defaultSettings };
  }
}

function getFallbackBookings() {
  try {
    return JSON.parse(getStoredItem(storageKeys.bookings) || "[]");
  } catch {
    return [];
  }
}

function getAvailableCount(checkin, checkout) {
  const settings = getSettings();
  const reserved = appData.bookings
    .filter((booking) => booking.status !== "cancelled")
    .filter((booking) => datesOverlap(checkin, checkout, booking.checkin, booking.checkout))
    .reduce((sum, booking) => sum + Number(booking.rooms || 1), 0);

  return Math.max(Number(settings.inventory || 0) - reserved, 0);
}

function showAvailabilityMessage(message, tone) {
  selectors.availabilityStatus.textContent = message;
  selectors.availabilityStatus.className = `availability-status ${tone}`;
}

function setBookingNote(message, tone) {
  selectors.bookingNote.textContent = message;
  selectors.bookingNote.className = `booking-note ${tone}`;
}

function getStoredItem(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function setStoredItem(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    return false;
  }
  return true;
}

function datesOverlap(startA, endA, startB, endB) {
  return startA < endB && endA > startB;
}

function parseDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getNightCount(checkin, checkout) {
  const difference = parseDate(checkout) - parseDate(checkin);
  return Math.max(Math.round(difference / 86400000), 1);
}

function formatStayDates(checkin, checkout) {
  const options = { month: "short", day: "numeric" };
  const start = parseDate(checkin).toLocaleDateString(undefined, options);
  const end = parseDate(checkout).toLocaleDateString(undefined, options);
  return `${start} to ${end}`;
}

function formatMoney(value) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function clampNumber(value, minimum, maximum) {
  if (!Number.isFinite(value)) {
    return minimum;
  }
  return Math.min(Math.max(value, minimum), maximum);
}

function createBookingReference() {
  const stamp = Date.now().toString(36).slice(-6).toUpperCase();
  return `HD-${stamp}`;
}

function normalizePhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("0")) {
    return `234${digits.slice(1)}`;
  }
  return digits || "2349163351767";
}
