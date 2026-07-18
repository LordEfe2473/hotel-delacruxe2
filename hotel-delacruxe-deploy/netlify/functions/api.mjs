import crypto from "node:crypto";
import { getStore } from "@netlify/blobs";

const dataKey = "hotel-data";

const defaultData = {
  settings: {
    hotelName: "Hotel Delacruxe",
    roomName: "Delacruxe Room",
    price: 16000,
    inventory: 15,
    currency: "NGN",
    receptionistPhone: "09163351767",
    whatsappNumber: "2349163351767",
    address: "GPWX+VRH, opposite Rhema Bible Church, Warri, Ugboroke 332104, Delta",
    mapQuery: "Hotel Delacruxe GPWX+VRH opposite Rhema Bible Church Warri Ugboroke 332104 Delta",
  },
  bookings: [],
};

export default async function handler(request) {
  try {
    const apiPath = getApiPath(request.url);

    if (apiPath === "/admin/login" && request.method === "POST") {
      const body = await readJsonBody(request);
      if (String(body.password || "") === getAdminPassword()) {
        return sendJson(200, { ok: true, token: getAdminToken() });
      }
      return sendJson(401, { error: "Invalid password" });
    }

    if (apiPath === "/public-data" && request.method === "GET") {
      return sendJson(200, createPublicData(await readData()));
    }

    if (apiPath === "/data" && request.method === "GET") {
      if (!isAdminRequest(request)) {
        return sendJson(401, { error: "Admin login required" });
      }
      return sendJson(200, await readData());
    }

    if (apiPath === "/settings" && request.method === "PUT") {
      if (!isAdminRequest(request)) {
        return sendJson(401, { error: "Admin login required" });
      }
      const data = await readData();
      data.settings = normalizeSettings(await readJsonBody(request));
      await writeData(data);
      return sendJson(200, data.settings);
    }

    if (apiPath === "/bookings" && request.method === "POST") {
      const data = await readData();
      const booking = createBooking(await readJsonBody(request), data.settings);
      data.bookings.unshift(booking);
      await writeData(data);
      return sendJson(201, booking);
    }

    if (apiPath === "/bookings" && request.method === "DELETE") {
      if (!isAdminRequest(request)) {
        return sendJson(401, { error: "Admin login required" });
      }
      const data = await readData();
      data.bookings = [];
      await writeData(data);
      return sendJson(200, { ok: true });
    }

    const bookingMatch = apiPath.match(/^\/bookings\/([^/]+)$/);
    if (bookingMatch && request.method === "PATCH") {
      if (!isAdminRequest(request)) {
        return sendJson(401, { error: "Admin login required" });
      }
      const reference = decodeURIComponent(bookingMatch[1]);
      const body = await readJsonBody(request);
      const data = await readData();
      data.bookings = data.bookings.map((booking) =>
        booking.reference === reference ? { ...booking, status: normalizeStatus(body.status) } : booking,
      );
      await writeData(data);
      return sendJson(200, { ok: true });
    }

    if (bookingMatch && request.method === "DELETE") {
      if (!isAdminRequest(request)) {
        return sendJson(401, { error: "Admin login required" });
      }
      const reference = decodeURIComponent(bookingMatch[1]);
      const data = await readData();
      data.bookings = data.bookings.filter((booking) => booking.reference !== reference);
      await writeData(data);
      return sendJson(200, { ok: true });
    }

    return sendJson(404, { error: "Not found" });
  } catch (error) {
    return sendJson(500, { error: "Server error", detail: error.message });
  }
}

async function readData() {
  const store = getStore("hotel-delacruxe");
  const data = await store.get(dataKey, { type: "json" });
  return {
    settings: { ...defaultData.settings, ...(data?.settings || {}) },
    bookings: Array.isArray(data?.bookings) ? data.bookings : [],
  };
}

async function writeData(data) {
  const store = getStore("hotel-delacruxe");
  await store.setJSON(dataKey, data);
}

function createPublicData(data) {
  return {
    settings: data.settings,
    bookings: data.bookings
      .filter((booking) => booking.status !== "cancelled")
      .map((booking) => ({
        checkin: booking.checkin,
        checkout: booking.checkout,
        rooms: Number(booking.rooms || 1),
        status: booking.status || "new",
      })),
  };
}

function normalizeSettings(input) {
  return {
    hotelName: cleanText(input.hotelName, defaultData.settings.hotelName),
    roomName: cleanText(input.roomName, defaultData.settings.roomName),
    price: Math.max(Number(input.price || 0), 0),
    inventory: Math.max(Math.floor(Number(input.inventory || 0)), 0),
    currency: "NGN",
    receptionistPhone: cleanText(input.receptionistPhone, defaultData.settings.receptionistPhone),
    whatsappNumber: normalizePhone(input.whatsappNumber || input.receptionistPhone || defaultData.settings.whatsappNumber),
    address: cleanText(input.address, defaultData.settings.address),
    mapQuery: cleanText(input.mapQuery, defaultData.settings.mapQuery),
  };
}

function createBooking(input, settings) {
  const checkin = cleanText(input.checkin, "");
  const checkout = cleanText(input.checkout, "");
  const rooms = Math.max(Math.floor(Number(input.rooms || 1)), 1);
  const guests = Math.max(Math.floor(Number(input.guests || 1)), 1);
  const nights = getNightCount(checkin, checkout);
  const pricePerNight = Number(settings.price || defaultData.settings.price);

  return {
    reference: createBookingReference(),
    fullName: cleanText(input.fullName, "Guest"),
    email: cleanText(input.email, ""),
    phone: cleanText(input.phone, ""),
    note: cleanText(input.note, ""),
    guests,
    rooms,
    checkin,
    checkout,
    nights,
    pricePerNight,
    total: pricePerNight * nights * rooms,
    status: "new",
    createdAt: new Date().toISOString(),
  };
}

async function readJsonBody(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function getApiPath(url) {
  const pathname = new URL(url).pathname;
  if (pathname.startsWith("/api/")) {
    return pathname.slice(4);
  }
  if (pathname.startsWith("/.netlify/functions/api/")) {
    return pathname.slice("/.netlify/functions/api".length);
  }
  if (pathname === "/.netlify/functions/api") {
    return "/";
  }
  return pathname;
}

function cleanText(value, fallback) {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function normalizePhone(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.startsWith("0")) {
    return `234${digits.slice(1)}`;
  }
  return digits || defaultData.settings.whatsappNumber;
}

function normalizeStatus(value) {
  return ["new", "confirmed", "cancelled"].includes(value) ? value : "new";
}

function getNightCount(checkin, checkout) {
  const start = new Date(`${checkin}T00:00:00`);
  const end = new Date(`${checkout}T00:00:00`);
  const difference = end - start;
  return Number.isFinite(difference) ? Math.max(Math.round(difference / 86400000), 1) : 1;
}

function createBookingReference() {
  const stamp = Date.now().toString(36).slice(-6).toUpperCase();
  return `HD-${stamp}`;
}

function isAdminRequest(request) {
  return request.headers.get("authorization") === `Bearer ${getAdminToken()}`;
}

function getAdminPassword() {
  return process.env.ADMIN_PASSWORD || "delacruxe-admin";
}

function getAdminToken() {
  const secret = process.env.ADMIN_SECRET || "hotel-delacruxe-local-secret";
  return crypto.createHmac("sha256", secret).update(getAdminPassword()).digest("hex");
}

function sendJson(status, data) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
