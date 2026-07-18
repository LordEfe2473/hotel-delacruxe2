const storageKeys = {
  settings: "hotel-delacruxe-settings",
  bookings: "hotel-delacruxe-bookings",
  adminToken: "hotel-delacruxe-admin-token",
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
  adminToken: getStoredItem(storageKeys.adminToken) || "",
};

const selectors = {
  loginPanel: document.querySelector("[data-login-panel]"),
  loginForm: document.querySelector("[data-login-form]"),
  loginNote: document.querySelector("[data-login-note]"),
  adminContent: document.querySelector("[data-admin-content]"),
  adminLogout: document.querySelector("[data-admin-logout]"),
  settingsForm: document.querySelector("[data-settings-form]"),
  settingsNote: document.querySelector("[data-settings-note]"),
  resetSettings: document.querySelector("[data-reset-settings]"),
  bookingsBody: document.querySelector("[data-bookings-body]"),
  emptyState: document.querySelector("[data-empty-state]"),
  exportBookings: document.querySelector("[data-export-bookings]"),
  clearBookings: document.querySelector("[data-clear-bookings]"),
  summaryPrice: document.querySelector("[data-summary-price]"),
  summaryRooms: document.querySelector("[data-summary-rooms]"),
  summaryNew: document.querySelector("[data-summary-new]"),
  tonightAvailable: document.querySelector("[data-tonight-available]"),
  tonightReserved: document.querySelector("[data-tonight-reserved]"),
  nightlyRevenue: document.querySelector("[data-nightly-revenue]"),
};

init();

async function init() {
  selectors.loginForm.addEventListener("submit", handleLogin);
  selectors.adminLogout.addEventListener("click", handleLogout);

  const loaded = await loadHotelData();
  if (loaded) {
    showAdminContent();
    fillSettingsForm();
    renderAdmin();
  } else {
    showLoginPanel();
  }

  selectors.settingsForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveSettings();
  });

  selectors.resetSettings.addEventListener("click", async () => {
    appData.settings = { ...defaultSettings };
    await persistSettings(appData.settings);
    fillSettingsForm();
    renderAdmin();
    showSettingsNote("Default hotel settings restored.", "success");
  });

  selectors.bookingsBody.addEventListener("click", handleBookingAction);
  selectors.exportBookings.addEventListener("click", exportBookings);
  selectors.clearBookings.addEventListener("click", clearBookings);
}

async function loadHotelData() {
  if (!appData.adminToken) {
    return false;
  }

  try {
    const response = await adminFetch("/api/data", { cache: "no-store" });
    if (response.status === 401) {
      appData.adminToken = "";
      setStoredItem(storageKeys.adminToken, "");
      return false;
    }
    if (!response.ok) {
      throw new Error("API unavailable");
    }
    const data = await response.json();
    appData.settings = { ...defaultSettings, ...(data.settings || {}) };
    appData.bookings = Array.isArray(data.bookings) ? data.bookings : [];
    appData.apiAvailable = true;
    return true;
  } catch {
    appData.settings = getFallbackSettings();
    appData.bookings = getFallbackBookings();
    appData.apiAvailable = false;
    return true;
  }
}

async function handleLogin(event) {
  event.preventDefault();
  const password = String(new FormData(selectors.loginForm).get("password") || "");

  try {
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (!response.ok) {
      throw new Error("Invalid password");
    }

    const data = await response.json();
    appData.adminToken = data.token;
    setStoredItem(storageKeys.adminToken, data.token);
    selectors.loginForm.reset();
    await loadHotelData();
    fillSettingsForm();
    renderAdmin();
    showAdminContent();
  } catch {
    selectors.loginNote.textContent = "Password not accepted.";
    selectors.loginNote.className = "booking-note error";
  }
}

function handleLogout() {
  appData.adminToken = "";
  setStoredItem(storageKeys.adminToken, "");
  showLoginPanel();
}

function showLoginPanel() {
  selectors.loginPanel.hidden = false;
  selectors.adminContent.hidden = true;
  selectors.adminLogout.hidden = true;
}

function showAdminContent() {
  selectors.loginPanel.hidden = true;
  selectors.adminContent.hidden = false;
  selectors.adminLogout.hidden = false;
}

function fillSettingsForm() {
  const settings = getSettings();
  selectors.settingsForm.elements.hotelName.value = settings.hotelName;
  selectors.settingsForm.elements.roomName.value = settings.roomName;
  selectors.settingsForm.elements.price.value = settings.price;
  selectors.settingsForm.elements.inventory.value = settings.inventory;
  selectors.settingsForm.elements.receptionistPhone.value = settings.receptionistPhone;
  selectors.settingsForm.elements.whatsappNumber.value = settings.whatsappNumber;
  selectors.settingsForm.elements.address.value = settings.address;
  selectors.settingsForm.elements.mapQuery.value = settings.mapQuery;
}

async function saveSettings() {
  const formData = new FormData(selectors.settingsForm);
  const settings = {
    hotelName: String(formData.get("hotelName") || defaultSettings.hotelName).trim(),
    roomName: String(formData.get("roomName") || defaultSettings.roomName).trim(),
    price: Math.max(Number(formData.get("price") || 0), 0),
    inventory: Math.max(Math.floor(Number(formData.get("inventory") || 0)), 0),
    currency: "NGN",
    receptionistPhone: String(formData.get("receptionistPhone") || defaultSettings.receptionistPhone).trim(),
    whatsappNumber: normalizePhone(formData.get("whatsappNumber") || formData.get("receptionistPhone") || defaultSettings.whatsappNumber),
    address: String(formData.get("address") || defaultSettings.address).trim(),
    mapQuery: String(formData.get("mapQuery") || defaultSettings.mapQuery).trim(),
  };

  appData.settings = settings;
  await persistSettings(settings);
  renderAdmin();
  showSettingsNote("Changes saved. The guest website will use the new details on refresh.", "success");
}

async function persistSettings(settings) {
  if (appData.apiAvailable) {
    try {
      const response = await adminFetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!response.ok) {
        throw new Error("Settings save failed");
      }
      appData.settings = await response.json();
      return;
    } catch {
      appData.apiAvailable = false;
    }
  }

  setStoredItem(storageKeys.settings, JSON.stringify(settings));
}

function renderAdmin() {
  const settings = getSettings();
  const bookings = getBookings();
  const newBookings = bookings.filter((booking) => booking.status === "new").length;
  const today = toDateInputValue(new Date());
  const tomorrow = toDateInputValue(addDays(new Date(), 1));
  const reservedTonight = getReservedCount(today, tomorrow);
  const availableTonight = Math.max(Number(settings.inventory || 0) - reservedTonight, 0);

  selectors.summaryPrice.textContent = `${formatMoney(settings.price)}/night`;
  selectors.summaryRooms.textContent = String(settings.inventory);
  selectors.summaryNew.textContent = String(newBookings);
  selectors.tonightAvailable.textContent = String(availableTonight);
  selectors.tonightReserved.textContent = String(reservedTonight);
  selectors.nightlyRevenue.textContent = formatMoney(availableTonight * Number(settings.price || 0));

  renderBookings(bookings);
}

function renderBookings(bookings) {
  selectors.emptyState.hidden = bookings.length > 0;
  selectors.bookingsBody.innerHTML = bookings
    .map(
      (booking) => `
        <tr>
          <td><strong>${escapeHtml(booking.reference)}</strong></td>
          <td>
            <strong>${escapeHtml(booking.fullName)}</strong>
            <span>${escapeHtml(booking.phone)}<br />${escapeHtml(booking.email)}</span>
          </td>
          <td>
            ${formatDate(booking.checkin)} to ${formatDate(booking.checkout)}
            <span>${Number(booking.nights || 1)} night(s), ${Number(booking.guests || 1)} guest(s)</span>
          </td>
          <td>${Number(booking.rooms || 1)}</td>
          <td>${formatMoney(booking.total || 0)}</td>
          <td><span class="status-pill ${escapeHtml(booking.status || "new")}">${escapeHtml(booking.status || "new")}</span></td>
          <td>
            <div class="table-actions">
              <button type="button" data-action="confirm" data-reference="${escapeHtml(booking.reference)}">Confirm</button>
              <button type="button" data-action="cancel" data-reference="${escapeHtml(booking.reference)}">Cancel</button>
              <button type="button" data-action="delete" data-reference="${escapeHtml(booking.reference)}">Delete</button>
            </div>
          </td>
        </tr>
      `,
    )
    .join("");
}

async function handleBookingAction(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) {
    return;
  }

  const action = button.dataset.action;
  const reference = button.dataset.reference;

  if (action === "delete") {
    if (!window.confirm(`Delete booking ${reference}?`)) {
      return;
    }
    await deleteBooking(reference);
    renderAdmin();
    return;
  }

  const status = action === "confirm" ? "confirmed" : "cancelled";
  await updateBookingStatus(reference, status);
  renderAdmin();
}

async function updateBookingStatus(reference, status) {
  appData.bookings = appData.bookings.map((booking) => (booking.reference === reference ? { ...booking, status } : booking));

  if (appData.apiAvailable) {
    try {
      const response = await adminFetch(`/api/bookings/${encodeURIComponent(reference)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        throw new Error("Status update failed");
      }
      return;
    } catch {
      appData.apiAvailable = false;
    }
  }

  setStoredItem(storageKeys.bookings, JSON.stringify(appData.bookings));
}

async function deleteBooking(reference) {
  appData.bookings = appData.bookings.filter((booking) => booking.reference !== reference);

  if (appData.apiAvailable) {
    try {
      const response = await adminFetch(`/api/bookings/${encodeURIComponent(reference)}`, { method: "DELETE" });
      if (!response.ok) {
        throw new Error("Booking delete failed");
      }
      return;
    } catch {
      appData.apiAvailable = false;
    }
  }

  setStoredItem(storageKeys.bookings, JSON.stringify(appData.bookings));
}

function exportBookings() {
  const bookings = getBookings();
  if (!bookings.length) {
    return;
  }

  const headers = ["Reference", "Name", "Email", "Phone", "Check-in", "Check-out", "Rooms", "Guests", "Total", "Status", "Note"];
  const rows = bookings.map((booking) => [
    booking.reference,
    booking.fullName,
    booking.email,
    booking.phone,
    booking.checkin,
    booking.checkout,
    booking.rooms,
    booking.guests,
    booking.total,
    booking.status,
    booking.note,
  ]);
  const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "hotel-delacruxe-bookings.csv";
  link.click();
  URL.revokeObjectURL(url);
}

async function clearBookings() {
  const bookings = getBookings();
  if (!bookings.length) {
    return;
  }

  if (!window.confirm("Clear all bookings?")) {
    return;
  }

  appData.bookings = [];

  if (appData.apiAvailable) {
    try {
      const response = await adminFetch("/api/bookings", { method: "DELETE" });
      if (!response.ok) {
        throw new Error("Clear bookings failed");
      }
      renderAdmin();
      return;
    } catch {
      appData.apiAvailable = false;
    }
  }

  setStoredItem(storageKeys.bookings, "[]");
  renderAdmin();
}

function getSettings() {
  return appData.settings;
}

function getBookings() {
  return appData.bookings;
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

function getReservedCount(checkin, checkout) {
  return getBookings()
    .filter((booking) => booking.status !== "cancelled")
    .filter((booking) => datesOverlap(checkin, checkout, booking.checkin, booking.checkout))
    .reduce((sum, booking) => sum + Number(booking.rooms || 1), 0);
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

function adminFetch(url, options = {}) {
  return fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${appData.adminToken}`,
    },
  });
}

function datesOverlap(startA, endA, startB, endB) {
  return startA < endB && endA > startB;
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

function formatDate(value) {
  if (!value) {
    return "";
  }
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatMoney(value) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function showSettingsNote(message, tone) {
  selectors.settingsNote.textContent = message;
  selectors.settingsNote.className = `booking-note ${tone}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function normalizePhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("0")) {
    return `234${digits.slice(1)}`;
  }
  return digits || "2349163351767";
}
