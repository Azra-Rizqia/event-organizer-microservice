const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3002;
const MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb://tiket_user:tiket_password@tiket-db:27017/tiket_db?authSource=admin";
const EVENT_SERVICE_URL =
  process.env.EVENT_SERVICE_URL || "http://event-service:8000";
const USER_SERVICE_URL =
  process.env.USER_SERVICE_URL || "http://user-service:3001";

// ===================== SCHEMA =====================
const tiketSchema = new mongoose.Schema(
  {
    user_id: { type: Number, required: true },
    event_id: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },
    // Snapshot data user & event saat tiket dibuat
    user_snapshot: {
      id: Number,
      name: String,
      email: String
    },
    event_snapshot: {
      id: Number,
      name: String,
      location: String,
      date: String,
      capacity: Number
    },
    total_harga: { type: Number, required: true },
    harga_per_tiket: { type: Number, required: true },
    status: {
      type: String,
      enum: ["pending", "confirmed", "cancelled"],
      default: "pending"
    }
  },
  { timestamps: true }
);

const Tiket = mongoose.model("Tiket", tiketSchema);

// ===================== HELPERS =====================
async function fetchUser(userId) {
  const res = await fetch(`${USER_SERVICE_URL}/users/${userId}`);
  if (!res.ok) throw new Error(`User dengan id ${userId} tidak ditemukan`);
  return await res.json();
}

async function fetchEvent(eventId) {
  const res = await fetch(`${EVENT_SERVICE_URL}/api/events/${eventId}`);
  if (!res.ok) throw new Error(`Event dengan id ${eventId} tidak ditemukan`);
  const data = await res.json();
  // Laravel bisa return langsung object atau {data: ...}
  return data.data || data;
}

// ===================== RETRY CONNECT =====================
async function connectWithRetry(retries = 20, delay = 3000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await mongoose.connect(MONGO_URI);
      console.log("Tiket Service berhasil terhubung ke MongoDB");
      return;
    } catch (error) {
      console.log(`Menunggu MongoDB siap... percobaan ${attempt}`);
      console.log(error.message);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error("Tiket Service gagal terhubung ke MongoDB");
}

// ===================== ROUTES =====================

// Health check
app.get("/health", (req, res) => {
  res.json({
    service: "tiket-service",
    database: "mongodb",
    status: "running"
  });
});

// GET semua tiket
app.get("/tikets", async (req, res) => {
  try {
    const tikets = await Tiket.find().sort({ createdAt: -1 });
    res.json({
      service: "tiket-service",
      data: tikets
    });
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil data tiket", error: error.message });
  }
});

// GET tiket by ID
app.get("/tikets/:id", async (req, res) => {
  try {
    const tiket = await Tiket.findById(req.params.id);
    if (!tiket) return res.status(404).json({ message: "Tiket tidak ditemukan" });
    res.json({ service: "tiket-service", data: tiket });
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil tiket", error: error.message });
  }
});

// GET tiket by user_id
app.get("/tikets/user/:userId", async (req, res) => {
  try {
    const tikets = await Tiket.find({ user_id: Number(req.params.userId) }).sort({ createdAt: -1 });
    res.json({ service: "tiket-service", data: tikets });
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil tiket user", error: error.message });
  }
});

// GET tiket by event_id
app.get("/tikets/event/:eventId", async (req, res) => {
  try {
    const tikets = await Tiket.find({ event_id: Number(req.params.eventId) }).sort({ createdAt: -1 });
    res.json({ service: "tiket-service", data: tikets });
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil tiket event", error: error.message });
  }
});

// POST buat tiket baru
// Body: { user_id, event_id, quantity, harga_per_tiket }
app.post("/tikets", async (req, res) => {
  try {
    const { user_id, event_id, quantity, harga_per_tiket } = req.body;

    if (!user_id || !event_id || !quantity || !harga_per_tiket) {
      return res.status(400).json({
        message: "user_id, event_id, quantity, dan harga_per_tiket wajib diisi"
      });
    }

    // Ambil data user dari user-service
    const user = await fetchUser(user_id);

    // Ambil data event dari event-service
    const event = await fetchEvent(event_id);

    const total_harga = harga_per_tiket * quantity;

    const tiket = await Tiket.create({
      user_id,
      event_id,
      quantity,
      harga_per_tiket,
      total_harga,
      user_snapshot: {
        id: user.id,
        name: user.name,
        email: user.email
      },
      event_snapshot: {
        id: event.id,
        name: event.name,
        location: event.location,
        date: event.date,
        capacity: event.capacity
      },
      status: "pending"
    });

    res.status(201).json({
      service: "tiket-service",
      message: "Tiket berhasil dibuat",
      data: tiket
    });
  } catch (error) {
    res.status(500).json({ message: "Gagal membuat tiket", error: error.message });
  }
});

// PATCH update status tiket
app.patch("/tikets/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ["pending", "confirmed", "cancelled"];
    if (!status || !allowed.includes(status)) {
      return res.status(400).json({
        message: "Status tidak valid",
        allowed_status: allowed
      });
    }

    const tiket = await Tiket.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!tiket) return res.status(404).json({ message: "Tiket tidak ditemukan" });

    res.json({
      service: "tiket-service",
      message: "Status tiket berhasil diperbarui",
      data: tiket
    });
  } catch (error) {
    res.status(500).json({ message: "Gagal update status tiket", error: error.message });
  }
});

// DELETE tiket
app.delete("/tikets/:id", async (req, res) => {
  try {
    const tiket = await Tiket.findByIdAndDelete(req.params.id);
    if (!tiket) return res.status(404).json({ message: "Tiket tidak ditemukan" });
    res.json({ service: "tiket-service", message: "Tiket berhasil dihapus" });
  } catch (error) {
    res.status(500).json({ message: "Gagal menghapus tiket", error: error.message });
  }
});

// ===================== START =====================
async function startServer() {
  await connectWithRetry();
  app.listen(PORT, () => {
    console.log(`Tiket Service berjalan pada port ${PORT}`);
  });
}

startServer();