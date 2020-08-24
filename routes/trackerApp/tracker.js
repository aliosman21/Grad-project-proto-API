const router = require("express").Router();
const sql = require("mssql");
const verify = require("./verifyStatus");
const moment = require("moment");

//SOME TRIGGER WILL UPDATE THE STATUS OF TRUCK TO ON CLAIM
//ON SERVING A NEXT LOCATION THE QUERY WILL BE TO SEE WHICH BINS NEXT ASSOCIATTED TO THE TRUCK USING
//FOREIGN KEY IN BINS TABLE OR IF THE TRUCK IS OPTIMAL FOR CLAIM

//Type is 0 if it can go to claims 1 otherwise..

//active is 1 if it is active 0 otherwise..

router.post("/startup", async (req, res) => {
  //Set startup information for the truck
  try {
    ooutput = await sql.query` UPDATE Trucks SET current_lat = ${
      req.body.current_lat
    }
    ,current_long = ${req.body.current_long}
    ,capacity=${req.body.capacity}
    ,active=${1}
    ,type = ${req.body.type}
    ,status= ${"Ready"}
     WHERE truck_ID = ${req.body.truck_ID}; `;

    return res.send({ Code: 1, Title: "Truck Ready to go" });
  } catch (error) {
    //console.log("error");
    console.log(error);
    return res.send(error);
  }
});

router.post("/updateCurrentState", verify, async (req, res) => {
  //Will receieve incoming truck positions
  try {
    output = await sql.query` UPDATE Trucks SET current_lat = ${req.body.current_lat}
    ,current_long = ${req.body.current_long}
    ,capacity=${req.body.capacity}
     WHERE truck_ID = ${req.body.truck_ID}; `;

    checkstate = await sql.query` SELECT status,next_lat,next_long FROM Trucks
      WHERE truck_ID = ${req.body.truck_ID}`;

    if (checkstate.recordset[0].next_lat == null) {
      return res.send({
        Code: 3,
        Title: "Truck had no next location to be updated ------- contact admin",
      });
    }

    if (req.body.capacity == 100) {
      result = await sql.query` SELECT base_lat,base_long FROM Trucks
      WHERE truck_ID = ${req.body.truck_ID}`;
      state = await sql.query` UPDATE Trucks SET active=${0} , status =${"Return"}
       WHERE truck_ID = ${req.body.truck_ID};`;
      return res.send({
        Code: -1,
        Title: "Set Back to base",
        baseLat: result.recordset[0].base_lat,
        baseLong: result.recordset[0].base_long,
      });
    }
    if (
      req.body.reqType == "bin" &&
      checkstate.recordset[0].status == "On Claim"
    ) {
      getClaim = await sql.query` SELECT claimID FROM Claims
      WHERE latitude = ${checkstate.recordset[0].next_lat} AND longitude = ${checkstate.recordset[0].next_long}`;
      return res.send({
        Code: 2,
        Title: "Claim Recieved Redirect",
        lat: checkstate.recordset[0].next_lat,
        long: checkstate.recordset[0].next_long,
        reqType: "Claim",
        ID: getClaim.recordset[0].claimID,
      });
    }

    return res.send({ Code: 1, Title: "Carry On" });
  } catch (error) {
    console.log(error);
    return res.send({ Code: 0, Title: "Error occured", Error: error });
  }
});

router.post("/nextLocation", verify, async (req, res) => {
  //STILL NEEDS TO UPDATE THE STATUS COLUMN OF THE TRUCK
  //Status can be ---> Not operational (Truck in base not working)
  //--->On Claim (Truck set on claim)
  //--->On route (Truck set to predefined route)
  //--->Return (Truck heading back to base)
  //--->Ready  (initial state waiting for next location)
  try {
    output = await sql.query` SELECT next_lat,next_long,status FROM Trucks
    WHERE truck_ID = ${req.body.truck_ID}`;

    if (output.recordset[0].status == "Return") {
      return res.send({ Title: "base location signal received" });
    }

    result = await sql.query` SELECT binID,position FROM Bins
        WHERE bin_latitude = ${output.recordset[0].next_lat} AND bin_longitude = ${output.recordset[0].next_long}`;

    if (output.recordset[0].status == "Ready") {
      state = await sql.query` UPDATE Trucks SET status =${"On route"}
         WHERE truck_ID = ${req.body.truck_ID};`;

      return res.send({
        Code: 1,
        Title: "First Bin received",
        lat: output.recordset[0].next_lat,
        long: output.recordset[0].next_long,
        type: "bin",
        ID: result.recordset[0].binID,
        position: result.recordset[0].position,
      });
    }

    return res.send({
      Code: 1,
      Title: "Next location received is for Bin",
      lat: output.recordset[0].next_lat,
      long: output.recordset[0].next_long,
      type: "bin",
      ID: result.recordset[0].binID,
      position: result.recordset[0].position,
    });
  } catch (error) {
    console.log("error");
    return res.send(error);
  }
});

//Function to tell that this position is cleared
//INCREMENT POSITION FROM TRACKING APP BEFORE SENDING
router.post("/cleared", verify, async (req, res) => {
  try {
    output = await sql.query` SELECT status FROM Trucks WHERE truck_ID = ${req.body.truck_ID}`;

    if (output.recordset[0].status == "On Claim") {
      //Need to figure out to send claim ID -----------------------------------------------------
      endClaim = await sql.query`Update Claims Set status =${"Served"},authentic=${1},truck_ID=${
        req.body.truck_ID
      }
         where claimID = ${req.body.ID}`;
    } else {
      serve_time = moment().format("YYYY-MM-D h:mm:ss");
      endBin = await sql.query`Update Bins Set last_served_time =${serve_time},position = ${0}
      where binID = ${req.body.binID}`;
    }

    nextposition = await sql.query`SELECT binID,bin_latitude,bin_longitude FROM Bins 
      WHERE truck_ID = ${req.body.truck_ID} AND position = ${req.body.position}`;

    if (nextposition.rowsAffected == 0) {
      return res.send({ Code: -1, Title: "No next positions" });
    }

    transaction = await sql.query`BEGIN TRANSACTION [Tran1]\n

       BEGIN TRY\n

       UPDATE Trucks SET next_lat=${nextposition.recordset[0].bin_latitude},
       next_long =${nextposition.recordset[0].bin_longitude}
       ,status= ${"On route"}
       WHERE truck_ID = ${req.body.truck_ID};\n

      COMMIT TRANSACTION [Tran1]\n

  END TRY\n

  BEGIN CATCH\n

      ROLLBACK TRANSACTION [Tran1]\n

  END CATCH\n`;

    return res.send({ Code: 1, Title: "Updated and go to next" });
  } catch (error) {
    console.log("error");
    return res.send(error);
  }
});

router.post("/close", verify, async (req, res) => {
  try {
    endBin = await sql.query`Update Trucks Set active =${0},status=${"Return"} where truck_ID = ${
      req.body.truck_ID
    }`;

    return res.send({ Code: 1, Title: "Truck logged off" });
  } catch (error) {
    console.log("error");
    return res.send(error);
  }
});

module.exports = router;
