const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({
    service: "ticket-service",
    status: "running"
  });
});

app.use("/tickets", require("./routes/ticketRoutes"));

module.exports = app;