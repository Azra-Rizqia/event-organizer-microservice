const mongoose = require("mongoose");

const ticketSchema = new mongoose.Schema(
  {
    userId: String,

    eventId: String,

    eventName: String,

    eventDate: Date,

    eventLocation: String,

    ticketPrice: Number,

    quantity: Number,

    totalPrice: Number,

    status: {
      type: String,
      enum: [
        "pending",
        "paid",
        "confirmed",
        "used"
      ],
      default: "pending"
    }
  },
  {
    timestamps: true
  }
);

module.exports =
mongoose.model(
  "Ticket",
  ticketSchema
);