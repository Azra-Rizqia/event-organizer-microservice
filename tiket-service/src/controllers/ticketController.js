const Ticket =
require("../models/Ticket");

exports.createTicket =
async (req,res)=>{

  try{

    const {
      userId,
      eventId,
      eventName,
      eventDate,
      eventLocation,
      ticketPrice,
      quantity
    } = req.body;

    const ticket =
    await Ticket.create({

      userId,
      eventId,
      eventName,
      eventDate,
      eventLocation,
      ticketPrice,
      quantity,

      totalPrice:
      ticketPrice * quantity

    });

    res.status(201)
    .json(ticket);

  }catch(error){

    res.status(500)
    .json(error);

  }

};

exports.getAllTickets =
async (req,res)=>{

  const tickets =
  await Ticket.find();

  res.json(tickets);

};

exports.getTicketById =
async (req,res)=>{

  const ticket =
  await Ticket.findById(
    req.params.id
  );

  res.json(ticket);

};

exports.updateStatus = async (req, res) => {

  try {

    const ticket = await Ticket.findById(
      req.params.id
    );

    if (!ticket) {
      return res.status(404).json({
        message: "Ticket tidak ditemukan"
      });
    }

    const newStatus =
      req.body.status;

    const allowedTransitions = {
      pending: ["paid"],
      paid: ["confirmed"],
      confirmed: ["used"],
      used: []
    };

    if (
      !allowedTransitions[
        ticket.status
      ].includes(newStatus)
    ) {
      return res.status(400).json({
        message:
        `Status tidak bisa berubah dari ${ticket.status} ke ${newStatus}`
      });
    }

    ticket.status = newStatus;

    await ticket.save();

    res.json(ticket);

  } catch (error) {

    res.status(500).json({
      message: error.message
    });

  }

};

exports.deleteTicket =
async (req, res) => {

  try {

    const ticket =
    await Ticket.findById(
      req.params.id
    );

    if (!ticket) {
      return res.status(404).json({
        message:
        "Ticket tidak ditemukan"
      });
    }

    if (
      ticket.status !== "pending" &&
      ticket.status !== "paid"
    ) {
      return res.status(400).json({
        message:
        "Ticket hanya dapat dihapus saat status pending atau paid"
      });
    }

    await Ticket.findByIdAndDelete(
      req.params.id
    );

    res.json({
      message:
      "Ticket berhasil dihapus"
    });

  } catch (error) {

    res.status(500).json({
      message:
      error.message
    });

  }

};