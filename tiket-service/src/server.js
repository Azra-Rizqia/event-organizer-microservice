require("dotenv")
.config();

const mongoose =
require("mongoose");

const app =
require("./app");

mongoose.connect(
process.env.MONGO_URI
)
.then(()=>{

  console.log(
  "MongoDB Connected"
  );

  app.listen(
  process.env.PORT,
  ()=>{

    console.log(
    "Ticket Service Running"
    );

  });

})
.catch(console.error);