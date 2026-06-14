const express = require("express");
const mongoose = require("mongoose");

const app = express();
const PORT = 3002;

app.use(express.json());

const EVENT_SERVICE_URL =
  process.env.EVENT_SERVICE_URL || "http://event-service:8000";

const MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb://tiket_user:tiket_password@tiket-db:27017/tiket_db?authSource=admin";

const ticketSchema = new mongoose.Schema(
  {
    customer_name: {
      type: String,
      required: true
    },
    event_id: {
      type: Number,
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    event_snapshot: {
      id: Number,
      name: String,
      location: String,
      date: String,
      capacity: Number
    },
    status: {
      type: String,
      default: "booked"
    }
  },
  {
    timestamps: true
  }
);

const Ticket = mongoose.model("Ticket", ticketSchema);

async function connectWithRetry(retries = 20, delay = 3000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await mongoose.connect(MONGO_URI);
      console.log("Ticket Service berhasil terhubung ke MongoDB");
      return;
    } catch (error) {
      console.log(`Menunggu MongoDB siap... percobaan ${attempt}`);
      console.log(error.message);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error("Ticket Service gagal terhubung ke MongoDB");
}

async function getEventById(eventId) {
  const response = await fetch(`${EVENT_SERVICE_URL}/api/events/${eventId}`);
  if (!response.ok) {
    throw new Error("Event tidak ditemukan di Event Service");
  }
  return response.json();
}

async function countTicketsByEvent(eventId) {
  const result = await Ticket.aggregate([
    {
      $match: {
        event_id: eventId,
        status: { $ne: "cancelled" }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: "$quantity" }
      }
    }
  ]);
  return result.length > 0 ? result[0].total : 0;
}

app.get("/health", (req, res) => {
  res.json({
    service: "ticket-service",
    database: "mongodb",
    status: "running"
  });
});

app.get("/tickets", async (req, res) => {
  try {
    const tickets = await Ticket.find().sort({ createdAt: -1 });
    res.json({
      service: "ticket-service",
      database: "mongodb",
      data: tickets
    });
  } catch (error) {
    res.status(500).json({
      message: "Gagal mengambil data tiket",
      error: error.message
    });
  }
});

app.get("/tickets/:id", async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({
        message: "Tiket tidak ditemukan"
      });
    }
    res.json({
      service: "ticket-service",
      database: "mongodb",
      data: ticket
    });
  } catch (error) {
    res.status(500).json({
      message: "Gagal mengambil detail tiket",
      error: error.message
    });
  }
});

app.post("/tickets", async (req, res) => {
  try {
    const { customer_name, event_id, quantity } = req.body;

    if (!customer_name || !event_id || !quantity) {
      return res.status(400).json({
        message: "customer_name, event_id, dan quantity wajib diisi"
      });
    }

    const event = await getEventById(event_id);

    const alreadyBooked = await countTicketsByEvent(event_id);
    const remainingCapacity = event.capacity - alreadyBooked;

    if (quantity > remainingCapacity) {
      return res.status(400).json({
        message: "Kuota tiket tidak cukup",
        remaining_capacity: remainingCapacity
      });
    }

    const ticket = await Ticket.create({
      customer_name,
      event_id,
      quantity,
      event_snapshot: {
        id: event.id,
        name: event.name,
        location: event.location,
        date: event.date,
        capacity: event.capacity
      },
      status: "booked"
    });

    res.status(201).json({
      service: "ticket-service",
      message: "Tiket berhasil dibuat",
      data: ticket
    });
  } catch (error) {
    res.status(500).json({
      message: "Gagal membuat tiket",
      error: error.message
    });
  }
});

app.put("/tickets/:id/status", async (req, res) => {
  try {
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        message: "Status wajib diisi"
      });
    }

    const allowedStatus = ["booked", "paid", "cancelled", "used"];
    if (!allowedStatus.includes(status)) {
      return res.status(400).json({
        message: "Status tidak valid",
        allowed_status: allowedStatus
      });
    }

    const ticket = await Ticket.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!ticket) {
      return res.status(404).json({
        message: "Tiket tidak ditemukan"
      });
    }

    res.json({
      service: "ticket-service",
      message: "Status tiket berhasil diperbarui",
      data: ticket
    });
  } catch (error) {
    res.status(500).json({
      message: "Gagal memperbarui status tiket",
      error: error.message
    });
  }
});

app.delete("/tickets/:id", async (req, res) => {
  try {
    const ticket = await Ticket.findByIdAndDelete(req.params.id);

    if (!ticket) {
      return res.status(404).json({
        message: "Tiket tidak ditemukan"
      });
    }

    res.json({
      service: "ticket-service",
      message: "Tiket berhasil dihapus"
    });
  } catch (error) {
    res.status(500).json({
      message: "Gagal menghapus tiket",
      error: error.message
    });
  }
});

async function startServer() {
  await connectWithRetry();
  app.listen(PORT, () => {
    console.log(`Ticket Service berjalan pada port ${PORT}`);
  });
}

startServer();