const jwt = require("jsonwebtoken");

//Function to verify the token of the user it doesn't verify its clearance level
module.exports = function(req, res, next) {
  const token = req.body.token;
  if (!token) return res.status(401).send("Access denied");

  try {
    const verified = jwt.verify(token, process.env.TOKEN_SECRET);
    req.user = verified;
    next();
  } catch (err) {
    res.status(400).send("Invalid Token");
  }
};
