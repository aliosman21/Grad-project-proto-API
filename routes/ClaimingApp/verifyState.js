const sql = require("mssql");
//Function to verify if the user is blocked or not
module.exports = async function(req, res, next) {
  try {
    result = await sql.query`Select status FROM Public_Users WHERE mobile_number= ${req.body.mobile_number}`;
    if (result.rowsAffected == 0) {
      //Mobile number not existing
      return res.send({ Code: -1, Title: "Number doesn't exist" });
    } else {
      //if status is 0 then the number is blocked
      if (result.recordset[0].status == 0) {
        return res.send({ Code: 1, Title: "The Number is Blocked" });
      }
      next();
    }
  } catch (err) {
    return res.send({ Code: 0, Title: "Verification error" });
  }
};
