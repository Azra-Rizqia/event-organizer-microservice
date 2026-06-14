const express = require("express");
const cors = require("cors");
const app = express();

app.use(cors());
app.use(express.json());

const USER_SERVICE_URL       = process.env.USER_SERVICE_URL       || "http://user-service:3001";
const EVENT_SERVICE_URL      = process.env.EVENT_SERVICE_URL      || "http://event-service:8000";
const TIKET_SERVICE_URL      = process.env.TIKET_SERVICE_URL      || "http://tiket-service:3002";
const TRANSAKSI_SERVICE_URL  = process.env.TRANSAKSI_SERVICE_URL  || "http://transaksi-service:5000";

app.get("/", (req, res) => {
  res.json({
    service: "api-gateway",
    endpoints: ["/users", "/events", "/tikets", "/transaksi", "/health"]
  });
});

app.get("/health", (req, res) => {
  res.json({ service: "api-gateway", status: "running" });
});

// USERS
app.all("/users{*path}", async (req, res) => {
  try {
    const url = `${USER_SERVICE_URL}${req.path}`;
    const response = await fetch(url, {
      method: req.method,
      headers: { "Content-Type": "application/json" },
      body: ["GET", "DELETE"].includes(req.method) ? undefined : JSON.stringify(req.body)
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    res.status(500).json({ message: "Gagal menghubungi user-service", error: error.message });
  }
});

// EVENTS
app.all("/events{*path}", async (req, res) => {
  try {
    const path = req.path.replace("/events", "/api/events");
    const url = `${EVENT_SERVICE_URL}${path}`;
    const response = await fetch(url, {
      method: req.method,
      headers: { "Content-Type": "application/json" },
      body: ["GET", "DELETE"].includes(req.method) ? undefined : JSON.stringify(req.body)
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    res.status(500).json({ message: "Gagal menghubungi event-service", error: error.message });
  }
});

// TIKETS
app.all("/tikets{*path}", async (req, res) => {
  try {
    const url = `${TIKET_SERVICE_URL}${req.path}`;
    const response = await fetch(url, {
      method: req.method,
      headers: { "Content-Type": "application/json" },
      body: ["GET", "DELETE"].includes(req.method) ? undefined : JSON.stringify(req.body)
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    res.status(500).json({ message: "Gagal menghubungi tiket-service", error: error.message });
  }
});

// TRANSAKSI
app.all("/transaksi{*path}", async (req, res) => {
  try {
    const url = `${TRANSAKSI_SERVICE_URL}${req.path}`;
    const response = await fetch(url, {
      method: req.method,
      headers: { "Content-Type": "application/json" },
      body: ["GET", "DELETE"].includes(req.method) ? undefined : JSON.stringify(req.body)
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    res.status(500).json({ message: "Gagal menghubungi transaksi-service", error: error.message });
  }
});

app.listen(3000, () => {
  console.log("API Gateway berjalan pada port 3000");
});