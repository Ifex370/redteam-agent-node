const express = require("express");
const app = express();

app.get("/search", (req, res) => {
  const query = req.query.q || "";
  res.send(`<h1>Results for ${query}</h1>`);
});

app.listen(3000);
