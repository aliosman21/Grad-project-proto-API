const router = require("express").Router();
const verify = require("./verifyTokenClearance");
const sql = require("mssql");
const bcrypt = require("bcryptjs");
//const distance = require("google-distance");
//const Client = require("@googlemaps/google-maps-services-js").Client;
//distance.apiKey = "AIzaSyC7bMWso-FEIXgEtarntyFrypFS96EnlgQ";
//const key = "AIzaSyC7bMWso-FEIXgEtarntyFrypFS96EnlgQ";

//Admin priviliged page which will verify the token and clearance each time
//the admin tries to use a function either to register or change the
//route of a truck

router.post("/register", verify, async (req, res) => {
  //Hash Password for saving in database
  const salt = await bcrypt.genSalt(10);
  const hashPassword = await bcrypt.hash(req.body.password, salt);

  //see if user already exists
  try {
    let output = await sql.query`BEGIN\n 
    IF NOT EXISTS (SELECT * FROM Users  
    WHERE user_name = ${req.body.username})\n 
    BEGIN\n 
     INSERT INTO Users (user_name, password, clearance) 
    VALUES (${req.body.username},${hashPassword},${req.body.clearance})\n 
    END\n 
    END;`;

    if (output.rowsAffected == 0) {
      //username already exists it returns -1
      return res.send({ Code: -1 });
    }
    //username created returns 1
    return res.send({ Code: 1 });
  } catch (err) {
    //IF error occurs return 0
    //console.log(err);
    return res.send({ Code: 0 });
  }
});

router.post("/Trigger", verify, async (req, res) => {
  //Trigger to set nearest trucks on claims
  const client = new Client({});
  var durations;
  try {
    result = await sql.query`Select * FROM Claims WHERE status = ${"Pending"}`;
    Output = await sql.query`Select * FROM Trucks WHERE type = ${0} AND active=${1} AND status !=${"Return"}`;
    var table = [];
    var formatted = [];
    if (result.rowsAffected == 0 || Output.rowsAffected == 0) {
      //No past claims
      return res.send({ Code: -1, Title: "No active claims" });
    } else {
      for (var i = 0; i < Output.rowsAffected; i++) {
        for (var j = 0; j < result.rowsAffected; j++) {
          var truckLOC = Output.recordset[i].current_lat;
          truckLOC =
            truckLOC + "," + Output.recordset[i].current_long.toString();
          var claimLOC = result.recordset[j].latitude;
          claimLOC = claimLOC + "," + result.recordset[j].longitude.toString();

          await client
            .distancematrix({
              params: {
                origins: [truckLOC],
                destinations: [claimLOC],
                key: key,
              },
              timeout: 1000, // milliseconds
            })
            .then((r) => {
              //console.log(r.data.rows[0].elements[0].duration.text);
              durations = r.data.rows[0].elements[0].duration.value / 60;
            })
            .catch((e) => {
              console.log(e);
            });

          table.push({
            Truck_ID: Output.recordset[i].truck_ID,
            Claim_ID: result.recordset[j].claimID,
            duration: durations,
          });
        }
      }

      table.sort((a, b) => parseFloat(a.duration) - parseFloat(b.duration));
      for (var i = 0; i < table.length; i++) {
        var cID = table[0].Claim_ID;
        var tID = table[0].Truck_ID;
        formatted.push({
          Truck_ID: tID,
          Claim_ID: cID,
        });
        for (var j = table.length - 1; j >= 0; j--) {
          if (table[j].Truck_ID === tID || table[j].Claim_ID === cID) {
            table.splice(j, 1);
          }
        }
      }

      console.log(formatted);
      for (var i = 0; i < formatted.length; i++) {
        getClaimCoords = await sql.query`Select latitude,longitude FROM Claims WHERE claimID = ${formatted[i].Claim_ID}`;

        //console.log(getClaimCoords.recordset[0].latitude);

        switch_state = await sql.query`BEGIN TRANSACTION [TrucksToClaims]\n

        BEGIN TRY\n
    
        UPDATE Trucks SET next_lat =${
          getClaimCoords.recordset[0].latitude
        }, next_long = ${getClaimCoords.recordset[0].longitude},
        status = ${"On Claim"}
         WHERE Truck_ID = ${formatted[i].Truck_ID};\n

         UPDATE Claims SET status = ${"Serving"}, truck_ID= ${
          formatted[i].Truck_ID
        }
         WHERE claimID = ${formatted[i].Claim_ID};\n
    
       COMMIT TRANSACTION [TrucksToClaims]\n
    
    END TRY\n
    
    BEGIN CATCH\n
    
       ROLLBACK TRANSACTION [TrucksToClaims]\n
    
    END CATCH\n`;
      }
      return res.send({
        Code: 1,
        Title: "Done with triggering type 2 vehicles",
      });
    }
  } catch (err) {
    //IF error occurs return 0
    console.log(err);
    return res.send({ Code: 0, Error: err });
  }
});

module.exports = router;
