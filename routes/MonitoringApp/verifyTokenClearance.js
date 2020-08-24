const jwt = require("jsonwebtoken");

//function to verify the token and its clearance level to make sure the user is admin
module.exports = function(req, res, next) {
  const token = req.body.token;
  if (!token) return res.status(401).send("Access denied");

  try {
    const verified = jwt.verify(token, process.env.TOKEN_SECRET);
    req.user = verified;
    //console.log(verified._clearance); GET THE Clearance of the Token
    if (!verified._clearance) return res.status(401).send("Access denied");
    next();
  } catch (err) {
    res.status(400).send("Invalid Token");
  }
};
