const router = require("express").Router();
const verify = require("./verifyToken");
const sql = require("mssql");

//users will be able to track the claims from here
//ACTUALLY CAN BE MADE AS POST AND FRONT-END SENDS ITS STATUS NEEDED
router.post("/monitorActiveClaims", verify, async (req, res) => {
  try {
    //Gets all necessary information about claims to be able to set them on maps
    output = await sql.query`BEGIN TRANSACTION [MonitorClaims]\n

    BEGIN TRY\n

    Select C.claimID,C.latitude,C.longitude,
    C.claim_date_time,C.status,C.authentic,C.priority_count,C.priority_level,P.mobile_number public_ID
    FROM Claims C JOIN Public_Users P 
    ON public_ID = P.ID\n
    WHERE C.status!=${"Served"}

   COMMIT TRANSACTION [MonitorClaims]\n

END TRY\n

BEGIN CATCH\n

   ROLLBACK TRANSACTION [MonitorClaims]\n

END CATCH\n  `;

    return res.send({
      Code: 1,
      Output: output.recordset,
      Title: "Returned Successfully",
    });
  } catch (error) {
    console.log("error");
    return res.send({ Code: -1, Error: error });
  }
});

router.post("/monitorLegacyClaims", verify, async (req, res) => {
  try {
    //Gets all necessary information about claims to be able to set them on maps
    output = await sql.query`BEGIN TRANSACTION [MonitorLegacyClaims]\n

    BEGIN TRY\n

    Select C.claimID,C.latitude,C.longitude,
    C.claim_date_time,C.status,C.authentic,C.priority_count,C.priority_level,P.mobile_number public_ID
    FROM Claims C JOIN Public_Users P 
    ON public_ID = P.ID\n
    WHERE C.status=${"Served"}

   COMMIT TRANSACTION [MonitorLegacyClaims]\n

END TRY\n

BEGIN CATCH\n

   ROLLBACK TRANSACTION [MonitorLegacyClaims]\n

END CATCH\n  `;

    return res.send({
      Code: 1,
      Output: output.recordset,
      Title: "Returned Successfully",
    });
  } catch (error) {
    console.log("error");
    return res.send({ Code: -1, Error: error });
  }
});

//Get Bins Status
router.post("/monitorBins", verify, async (req, res) => {
  //Truck ID Not set yet Will be joing by the trucks later
  try {
    output = await sql.query` BEGIN TRANSACTION [MonitorBins]\n

    BEGIN TRY\n

    Select binID,bin_latitude,bin_longitude, last_served_time FROM Bins\n

   COMMIT TRANSACTION [MonitorBins]\n

END TRY\n

BEGIN CATCH\n

   ROLLBACK TRANSACTION [MonitorBins]\n

END CATCH\n `;

    return res.send({
      Code: 1,
      Output: output.recordset,
      Title: "Returned Successfully",
    });
  } catch (error) {
    console.log("error");
    return res.send({ Code: -1, Error: error });
  }
});

router.post("/setTruckRoute", verify, async (req, res) => {
  try {
    let i = 0;
    truckactivity = await sql.query`Select active FROM Trucks WHERE truck_ID = ${req.body.truck_ID}`;

    if (truckactivity.recordset[0].active || req.body.bins_ID.length == 0) {
      return res.send({
        Code: -1,
        Title: "Truck Already active no changes done or no bins selected",
      });
    }
    firstbin = await sql.query`Select bin_latitude,bin_longitude FROM Bins WHERE binID = ${req.body.bins_ID[0]}`;

    nextloc = await sql.query` Update Trucks Set next_lat =${firstbin.recordset[0].bin_latitude},
    next_long = ${firstbin.recordset[0].bin_longitude} where truck_ID = ${req.body.truck_ID}`;

    for (i = 0; i < req.body.bins_ID.length; i++) {
      output = await sql.query` BEGIN TRANSACTION [updateBinsPositions]\n

  BEGIN TRY\n

  Update Bins Set position =${i + 1},truck_ID = ${
        req.body.truck_ID
      } where binID = ${req.body.bins_ID[i]}\n

 COMMIT TRANSACTION [updateBinsPositions]\n

END TRY\n

BEGIN CATCH\n

 ROLLBACK TRANSACTION [updateBinsPositions]\n

END CATCH\n `;
    }

    return res.send({
      Code: 1,
      Title: "Returned Successfully",
    });
  } catch (error) {
    console.log(error);
    return res.send({ Code: 0, Error: error });
  }
});

router.post("/routeTrucks", verify, async (req, res) => {
  try {
    output = await sql.query` BEGIN TRANSACTION [MonitorTrucks]\n

    BEGIN TRY\n

    Select truck_ID,current_lat,current_long,next_lat,next_long,capacity,type,status FROM Trucks WHERE active = 0\n

   COMMIT TRANSACTION [MonitorTrucks]\n

END TRY\n

BEGIN CATCH\n

   ROLLBACK TRANSACTION [MonitorTrucks]\n

END CATCH\n `;

    return res.send({
      Code: 1,
      Output: output.recordset,
      Title: "Returned Successfully",
    });
  } catch (error) {
    console.log("error");
    return res.send({ Code: -1, Error: error });
  }
});

router.post("/monitorTrucks", verify, async (req, res) => {
  try {
    output = await sql.query` BEGIN TRANSACTION [MonitorTrucks]\n

    BEGIN TRY\n

    Select truck_ID,current_lat,current_long,next_lat,next_long,capacity,type,status FROM Trucks WHERE active = 1\n

   COMMIT TRANSACTION [MonitorTrucks]\n

END TRY\n

BEGIN CATCH\n

   ROLLBACK TRANSACTION [MonitorTrucks]\n

END CATCH\n `;

    return res.send({
      Code: 1,
      Output: output.recordset,
      Title: "Returned Successfully",
    });
  } catch (error) {
    console.log("error");
    return res.send({ Code: -1, Error: error });
  }
});
module.exports = router;
