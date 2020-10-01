//Import all the libraies

//The application server
const express = require("express");
const app = express();

//The Google clent library
const { google } = require("googleapis");

//The OAuth2 client credentials
const OAuth2Data = require("./credentials.json");

//Library to upload files on express server
const multer = require("multer");

//Built in module to store files in nodejs
const fs = require("fs");

//A template engine
const { render } = require("ejs");

//Package for providing express middleware
const cors = require("cors");

//Nodejs body parsing middleware
const bodyParser = require("body-parser");

//Stores the user name and the profile picture
var name, picture;

//To access the OAuth2 credentials, we have to initialize OAuth client
const CLIENT_ID = OAuth2Data.web.client_id;
const CLIENT_SECRET = OAuth2Data.web.client_secret;
const REDIRECT_URI = OAuth2Data.web.redirect_uris[0];

//Client object
const oAuthClient = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

//Variable used to check wether the client is authenticated or not
var authed = false;

//The scopes define what are the things that the application needs to access
const SCOPES =
  "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile";

//Setting the template engine
app.set("view engine", "ejs");

//Initialize multer to upload images
var Storage = multer.diskStorage({
  destination: function (req, file, callback) {
    callback(null, "./images");
  },
  filename: function (req, file, callback) {
    callback(null, file.fieldname + "_" + Date.now() + "_" + file.originalname);
  },
});

var upload = multer({
  storage: Storage,
}).single("file"); //Field name and max count

//Route which will open the home page
app.get("/", (req, res) => {
  //Checks that the client is authenticated or not
  if (!authed) {
    //Making a URL to redirect the user
    var url = oAuthClient.generateAuthUrl({
      access_type: "offline",
      scope: SCOPES,
    });

    //Render the index page and pass the URL to the template
    console.log(url);
    res.render("index", { url: url });
  } else {
    var oauth2 = google.oauth2({
      //If the client is authenticated, the client object will be passed to the auth parameter
      auth: oAuthClient,
      version: "v2",
    });

    //Get user information
    oauth2.userinfo.get(function (err, response) {
      if (err) throw err;
      console.log(response.data);

      //Store the user values
      name = response.data.name;
      picture = response.data.picture;

      //Sending the user values to the template
      res.render("success", { name: name, picture: picture, success: false });
    });
  }
});

//Handeling the route to the callback URL
app.get("/google/callback", (req, res) => {
  //This method is used to exchange the authorization code which will be coming from the google developer console with the access token

  //Storing the authorization code in a variable
  const code = req.query.code;

  //Check if there is any code available
  if (code) {
    //If the code is available, we get the access token
    //getToken function will help to exchange the access tokens
    //The authorization code will be passed to the function and then the access token will be taken by this function
    oAuthClient.getToken(code, function (err, tokens) {
      //Check whether if there is any error
      if (err) {
        console.log("Error in authenticating");
        console.log(err);
      } else {
        //If no error, the token can be achieved and then the user will be redirect to the home page
        console.log("Successfuly authenticated");
        console.log(tokens);

        //Set the credentials and pass the token
        oAuthClient.setCredentials(tokens);
        authed = true;
        res.redirect("/");
      }
    });
  }
});

//Route to upload an image to the drive
app.post("/upload", (req, res) => {
  //Calling the upload function which was declared earlier
  upload(req, res, function (err) {
    //Chech if there is any error
    if (err) {
      console.log(err);
      return res.end("Something went wrong");
    } else {
      //Providing the file path that the file needs to be stored
      console.log(req.file.path);

      //Calling the drive API
      const drive = google.drive({ version: "v3", auth: oAuthClient });

      //Stores the name of the file
      const fileMetadata = {
        name: req.file.filename,
      };

      const media = {
        mimeType: req.file.mimetype, //Stores the extension
        body: fs.createReadStream(req.file.path),
      };

      //For uploading the file to drive, we need to use this method
      drive.files.create(
        {
          resource: fileMetadata,
          media: media,
          fields: "id",
        },
        (err, file) => {
          if (err) {
            //Handles the error
            console.error(err);
          } else {
            //Delete the file images folder
            fs.unlinkSync(req.file.path);
            //Renders success.ejs with a success massage
            res.render("success", {
              name: name,
              picture: picture,
              success: true,
            });
          }
        }
      );
    }
  });
});

//The logout route which will logout the user from the account
app.get("/logout", (req, res) => {
  authed = false;
  res.redirect("/");
});

app.post("/getToken", (req, res) => {
  if (req.body.code == null) return res.status(400).send("Invalid request");
  oAuthClient.getToken(req.body.code, (err, token) => {
    if (err) {
      console.error("Error retrieving access token", err);
      return res.status(400).send("Error retrieving access token");
    }
    res.send(token);
  });
});

//The application is listening to port 5000
app.listen(5000, () => {
  console.log("App started on port 5000");
});
