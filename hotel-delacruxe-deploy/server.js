const http = require("node:http");
const crypto = require("node:crypto");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { URL } = require("node:url");

const rootDir = __dirname;
const dataFile = process.env.DATA_FILE
  ? path.resolve(process.env.DATA_FILE)
  : path.join(process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(rootDir, "data"), "hotel-data.json");
const port = Number(process.env.PORT || 8770);
const host = process.env.HOST || "0.0.0.0";
const adminPassword = process.env.ADMIN_PASSWORD || "delacruxe-admin";
const adminSecret = process.env.ADMIN_SECRET || "hotel-delacruxe-local-secret";
const adminToken = crypto.createHmac("sha256", adminSecret).update(adminPassword).digest("hex");

if (process.env.NODE_ENV === "production" && !process.env.ADMIN_PASSWORD) {
  throw new Error("Set ADMIN_PASSWORD before running in production.");
}

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

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host || `${host}:${port}`}`);

    if (url.pathname.startsWith("/api/")) {
      await handleApi(request, response, url);
      return;
    }

    await serveStatic(url.pathname, response);
  } catch (error) {
    sendJson(response, 500, { error: "Server error", detail: error.message });
  }
});

server.listen(port, host, () => {
  const displayHost = host === "0.0.0.0" ? "127.0.0.1" : host;
  console.log(`Hotel Delacruxe is running at http://${displayHost}:${port}`);
});

async function handleApi(request, response, url) {
  if (url.pathname === "/api/admin/login" && request.method === "POST") {
    const body = await readJsonBody(request);
    if (String(body.password || "") === adminPassword) {
      sendJson(response, 200, { ok: true, token: adminToken });
    } else {
      sendJson(response, 401, { error: "Invalid password" });
    }
    return;
  }

  if (url.pathname === "/api/public-data" && request.method === "GET") {
    sendJson(response, 200, createPublicData(await readData()));
    return;
  }

  if (url.pathname === "/api/data" && request.method === "GET") {
    if (!requireAdmin(request, response)) {
      return;
    }
    sendJson(response, 200, await readData());
    return;
  }

  if (url.pathname === "/api/settings" && request.method === "PUT") {
    if (!requireAdmin(request, response)) {
      return;
    }
    const data = await readData();
    data.settings = normalizeSettings(await readJsonBody(request));
    await writeData(data);
    sendJson(response, 200, data.settings);
    return;
  }

  if (url.pathname === "/api/bookings" && request.method === "POST") {
    const data = await readData();
    const booking = createBooking(await readJsonBody(request), data.settings);
    data.bookings.unshift(booking);
    await writeData(data);
    sendJson(response, 201, booking);
    return;
  }

  if (url.pathname === "/api/bookings" && request.method === "DELETE") {
    if (!requireAdmin(request, response)) {
      return;
    }
    const data = await readData();
    data.bookings = [];
    await writeData(data);
    sendJson(response, 200, { ok: true });
    return;
  }

  const bookingMatch = url.pathname.match(/^\/api\/bookings\/([^/]+)$/);
  if (bookingMatch && request.method === "PATCH") {
    if (!requireAdmin(request, response)) {
      return;
    }
    const reference = decodeURIComponent(bookingMatch[1]);
    const body = await readJsonBody(request);
    const data = await readData();
    data.bookings = data.bookings.map((booking) =>
      booking.reference === reference ? { ...booking, status: normalizeStatus(body.status) } : booking,
    );
    await writeData(data);
    sendJson(response, 200, { ok: true });
    return;
  }

  if (bookingMatch && request.method === "DELETE") {
    if (!requireAdmin(request, response)) {
      return;
    }
    const reference = decodeURIComponent(bookingMatch[1]);
    const data = await readData();
    data.bookings = data.bookings.filter((booking) => booking.reference !== reference);
    await writeData(data);
    sendJson(response, 200, { ok: true });
    return;
  }

  sendJson(response, 404, { error: "Not found" });
}

async function serveStatic(pathname, response) {
  const cleanPath = pathname === "/" ? "/index.html" : decodeURIComponent(pathname);
  const filePath = path.normalize(path.join(rootDir, cleanPath));

  if (!filePath.startsWith(rootDir)) {
    sendText(response, 403, "Forbidden");
    return;
  }

  try {
    const stat = await fsp.stat(filePath);
    if (!stat.isFile()) {
      sendText(response, 404, "Not found");
      return;
    }

    response.writeHead(200, {
      "Content-Type": mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    fs.createReadStream(filePath).pipe(response);
  } catch {
    sendText(response, 404, "Not found");
  }
}

async function readData() {
  try {
    const file = await fsp.readFile(dataFile, "utf8");
    const data = JSON.parse(file);
    return {
      settings: { ...defaultData.settings, ...(data.settings || {}) },
      bookings: Array.isArray(data.bookings) ? data.bookings : [],
    };
  } catch {
    await writeData(defaultData);
    return structuredClone(defaultData);
  }
}

async function writeData(data) {
  await fsp.mkdir(path.dirname(dataFile), { recursive: true });
  await fsp.writeFile(dataFile, `${JSON.stringify(data, null, 2)}\n`);
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

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        request.destroy();
        reject(new Error("Request body too large"));
      }
    });
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    request.on("error", reject);
  });
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

function requireAdmin(request, response) {
  if (isAdminRequest(request)) {
    return true;
  }
  sendJson(response, 401, { error: "Admin login required" });
  return false;
}

function isAdminRequest(request) {
  return request.headers.authorization === `Bearer ${adminToken}`;
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

function sendJson(response, status, data) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(data));
}

function sendText(response, status, text) {
  response.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  response.end(text);
}
