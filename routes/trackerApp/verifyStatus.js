const sql = require("mssql");
//Function to verify if the truck is active or not
module.exports = async function(req, res, next) {
  try {
    result = await sql.query`Select active FROM Trucks WHERE truck_ID= ${req.body.truck_ID}`;
    if (result.rowsAffected == 0) {
      //Truck ID isn't valid
      return res.send({ Code: -1, Title: "Wrong Truck ID" });
    } else {
      //if active is 0 then the truck is not working now
      if (result.recordset[0].active == 0) {
        return res.send({ Code: 1, Title: "Truck Not active" });
      }
      next();
    }
  } catch (err) {
    return res.send({ Code: 0, Title: "Verification error" });
  }
};
