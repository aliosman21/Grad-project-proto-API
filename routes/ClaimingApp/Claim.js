const router = require("express").Router();
const verify = require("./verifyState");
const sql = require("mssql");
const moment = require("moment");

/*GOOGLE API INFO
 */

//---------------------------------------------------------------------------------------------------------------------------------------

router.post("/reg", async (req, res) => {
  //console.log(req.body.mobile_number);

  //will register the user for the first time in the database
  try {
    //Start sql to look if the mobile already registered if not register it
    var verify_number = Math.floor(100000 + Math.random() * 900000);
    console.log(verify_number);

    output = await sql.query` BEGIN\n 
  IF NOT EXISTS (SELECT * FROM Public_Users 
    WHERE mobile_number = ${"" + req.body.mobile_number + ""}  )\n
    BEGIN \n
    INSERT INTO Public_Users (mobile_number, status, verified ,verification_code) 
    VALUES (${"" + req.body.mobile_number + ""} ,1,0,${verify_number})\n
    END\n
  END;`;

    if (output.rowsAffected == 0) {
      //if mobile already registered it returns -1
      var verify_number = Math.floor(100000 + Math.random() * 900000);
      console.log(verify_number);
      result = await sql.query`UPDATE Public_Users
      SET verification_code = ${verify_number}, verified= 0
      WHERE mobile_number = ${req.body.mobile_number};`;
      return res.send({
        Code: -1,
        Title: "Already existing user Verify code changed",
      });
    }
    //if its successfully registered it returns 1
    return res.send({ Code: 1, Title: "Successfully reg" });
  } catch (err) {
    //error occured
    console.log(err);
    return res.send({ Code: 0, Title: "Error occured", Error: err });
  }
});

router.post("/codeVerify", async (req, res) => {
  try {
    output = await sql.query`SELECT verification_code FROM Public_Users WHERE mobile_number =${req.body.mobile_number} `;

    var ver_code = output.recordset[0].verification_code;

    if (ver_code == req.body.ver_code) {
      result = await sql.query`UPDATE Public_Users
      SET verification_code = 0, verified= 1
      WHERE mobile_number = ${req.body.mobile_number};`;
      //USER state verified
      return res.send({ Code: 1, Title: "User verified" });
    } else {
      //USER code doesnt match
      return res.send({ Code: -1, Title: "Code doesn't match" });
    }
  } catch (error) {
    console.log(err);
    //ERROR occured
    return res.send({ Code: 0, Title: "Error occured", Error: err });
  }
});

router.post("/send", verify, async (req, res) => {
  //Will receieve incoming claims verify the user is not blocked and submit report
  //Claims to be sent authenticity is 1---> authentic , 0----> unknown , -1-----> bogus
  try {
    //Selects the ID to set it as foriegn key
    result = await sql.query`Select ID FROM Public_Users WHERE mobile_number = ${req.body.mobile_number}`;

    claimTime = moment().format("YYYY-MM-D h:mm:ss");
    //Sets tolerance of coordinates by +-0.000005
    var lat = req.body.latitude;
    var long = req.body.longitude;
    var latToleranceUP = parseFloat(req.body.latitude + 0.004504).toFixed(6);
    var longToleranceUP = parseFloat(req.body.longitude + 0.004504).toFixed(6);
    var latToleranceDOWN = parseFloat(req.body.latitude - 0.004504).toFixed(6);
    var longToleranceDOWN = parseFloat(req.body.longitude - 0.004504).toFixed(
      6
    );
    console.log(latToleranceUP);
    console.log(latToleranceDOWN);
    //Checks if there is a claim in the tolerance zone pending or serving
    output = await sql.query`SELECT * FROM Claims WHERE (latitude BETWEEN ${latToleranceDOWN} AND ${latToleranceUP}) 
    AND (longitude BETWEEN ${longToleranceDOWN} AND ${longToleranceUP}) AND (status!=${"Served"})`;

    console.log(output);
    if (output.rowsAffected == 0) {
      insert = await sql.query`INSERT INTO Claims (latitude,longitude,claim_date_time,status,authentic,public_ID) 
    VALUES (${lat},${long},${claimTime},${"Pending"},${0},${
        result.recordset[0].ID
      })`;
    } else {
      var claim_level_ID = output.recordset[0].claimID;
      //A claim is pending at same location
      //UPDATED CANNOT INCREASE PRIORITY OF A SERVED CLAIM 21/2/2020
      end = await sql.query`Update Claims Set priority_count = priority_count + 1 where claimID = ${claim_level_ID} AND status!=${"Served"}`;
      return res.send({
        Code: -1,
        Title: "An active claim in the same location exists",
      });
    }
    //A new claim is set
    return res.send({ Code: 1, Title: "A claim is submitted" });
  } catch (err) {
    //error occured
    console.log(err);
    return res.send({ Code: 0, Title: "Error occured", Error: err });
  }
});

router.post("/smsVerify", async (req, res) => {
  //will send an sms message to tell if there is a change in the claim's state

  // AWS.config.update({ region: "us-east-1" });

  var number = "+20" + req.body.mobile_number;

  // Create publish parameters

  /* var verify_number = Math.floor(100000 + Math.random() * 900000);
  console.log(verify_number);
  console.log(number); */
  //process.exit(0);
  //Input an unverified number into the database

  try {
    output = await sql.query`SELECT verification_code FROM Public_Users WHERE mobile_number = ${"" +
      req.body.mobile_number +
      ""} AND verification_code != 0`;
  } catch (err) {
    //error occured
    console.log(err);
    return res.send({ Code: 0, Title: "Error occured in DB", Error: err });
  }
  if (output.rowsAffected == 0) {
    //if mobile already registered it returns -1
    return res.send({
      Code: -1,
      Title: "User Not registered Or code already verified",
    });
  }
  /*  console.log(output.recordset[0].verification_code);
  process.exit(0); */
  var params = {
    Message: `Your Verification code is ${output.recordset[0].verification_code}`,
    PhoneNumber: number,
  };

  // Create promise and SNS service object
  // var publishTextPromise = new AWS.SNS({ apiVersion: "latest" })
  // .publish(params)
  // .promise();

  // Handle promise's fulfilled/rejected states
  publishTextPromise
    .then(function(data) {
      console.log("MessageID is " + data.MessageId);
    })
    .catch(function(err) {
      console.error(err, err.stack);
    });

  //code 1 means message is sent
  return res.send({ Code: 1, Title: "Message sent" });
});

//Verify number before sending history ADD VERIFY MIDDLE WARE
router.post("/history", verify, async (req, res) => {
  //This will send the history of past claims
  var Names = [];
  try {
    result = await sql.query`Select ID FROM Public_Users WHERE mobile_number = ${req.body.mobile_number}`;
    var ID = result.recordset[0].ID;
    output = await sql.query`Select latitude,longitude,claim_date_time,status,authentic FROM Claims WHERE public_ID = ${ID} ORDER BY claim_date_time DESC;`;

    //console.log(output);
    for (var i = 0; i < output.rowsAffected; i++) {
      var lat = output.recordset[i].latitude;
      var long = output.recordset[i].longitude;
      await geocoder.reverse({ lat: lat, lon: long }, function(err, response) {
        if (!err) {
          //console.log(response[0].formattedAddress);
          Names.push({
            Name: response[0].formattedAddress,
            state: output.recordset[i],
          });
        } else {
          //  console.log("ERROR");
          // console.log(err);
        }
      });
      //console.log(i);
    }

    console.log(Names);
    if (output.rowsAffected == 0) {
      //No past claims
      return res.send({ Code: -1, Title: "No past Claims" });
    }
    //Past claims sent back
    return res.send({ code: 1, Names: Names });
  } catch (err) {
    //error occured
    console.log(err);
    return res.send({ Code: 0, Title: "Error occured", Error: err });
  }
});
module.exports = router;
