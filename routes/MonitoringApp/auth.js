const router = require("express").Router();
const sql = require("mssql");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const moment = require("moment");

//Login function that readys the query for execution using the supported username and pass
//From the frontend monitoring app
router.post("/login", async (req, res) => {
  //=================================================================================
  //VALIDATIONS IS TO BE PUT HERE
  //VALIDATION TO SET YET
  //=================================================================================
  let result;
  let nowLoginDateTime;
  try {
    //result is the query to be sent
    result = await sql.query`Select user_name,password,clearance FROM Users WHERE user_name= ${req.body.username}`;
    //comparing passwords for the returned record
    //PASSWORDS ARE ENCRYPTED SO IT HAS TO BE DONE BY BCRYPT
    const validPass = await bcrypt.compare(
      req.body.password,
      result.recordset[0].password
    );
    if (!validPass) {
      //Returns -1 if the password was invalid meaning no error occured in
      //Database connection or password retreival only wrong password
      return res.send({ token: -1, Title: "Password Mismatch" });
    }
    if (result.recordset[0].clearance != req.body.clearance) {
      return res.send({ token: -1, Title: "Unauthorized or wrong clearance" });
    }
    //If it passes the valid pass check it assigns a token and sends it back
    const token = jwt.sign(
      {
        _name: result.recordset[0].user_name,
        _clearance: result.recordset[0].clearance,
      },
      process.env.TOKEN_SECRET
    );
    nowLoginDateTime = moment().format("YYYY-MM-D h:mm:ss");

    update = await sql.query`Update Users SET last_login_date =${nowLoginDateTime} WHERE user_name= ${req.body.username}`;
    return res.send({ token: token });
  } catch (err) {
    //if an error is caught it returns a token of 0

    return res.send({ token: 0, Title: "Error" });
  }
});

router.post("/logout", async (req, res) => {
  const token = req.body.token;
  let nowLogoutDateTime;
  //Try for executing the Logout query
  try {
    const decodedToken = jwt.verify(token, process.env.TOKEN_SECRET);
    const user_name = decodedToken._name;
    //nodejs is set on UTC timezone to fix this we use moment.js
    nowLogoutDateTime = moment().format("YYYY-MM-D h:mm:ss");
    update = await sql.query`Update Users SET last_logout_date =${nowLogoutDateTime} WHERE user_name= ${user_name}`;
    return res.send({ Message: "Logged out successfully" });
  } catch (err) {
    res.status(400).send(err);
  }
});

module.exports = router;
