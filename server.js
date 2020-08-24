const express = require("express");
const app = express();
const sql = require("mssql");
const dotenv = require("dotenv");
const authRoute = require("./routes/MonitoringApp/auth");
const UserpageRoute = require("./routes/MonitoringApp/UserPage");
const AdminpageRoute = require("./routes/MonitoringApp/AdminPage");
const truckTracker = require("./routes/trackerApp/tracker");
const claimsRoute = require("./routes/ClaimingApp/Claim");
// port must be 5000 in order to work on AWS
dotenv.config();
const port = process.env.PORT || 5000;
const cors = require("cors");

//Middleware
app.use(express.json());
app.use(cors());
//Route middlewares
app.use("/api/user", authRoute); //to login on monitoring app
app.use("/api/userpage", UserpageRoute); // to view a normal userpage monitoring app
app.use("/api/adminpage", AdminpageRoute); // to view admin userpage on monitoring app
app.use("/api/sendclaim", claimsRoute); // to give a report from reporting app
app.use("/api/track", truckTracker); // to update the truck info from tracker app

//-------------------------------------------------

//Database configuration for connection on server start
var config = {
  user: process.env.DB_username,
  password: process.env.DB_password,
  server: process.env.DB_Server,
  database: process.env.Database,
};
//connection trial if error exists exit
sql.connect(config, function(err) {
  console.log("connected to MSSQL");
  if (err) console.log(err);
});
//listen to requests on port 5000 OR the environment port
app.listen(port, () => console.log("Server is up and running"));
