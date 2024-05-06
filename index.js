const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const session = require("express-session");
const { spawn } = require('child_process'); // Import 'spawn' from child_process module
const fs = require('fs');
const app = express();
app.set("view engine", "ejs");

app.use(bodyParser.json());
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
// Setup session middleware
app.use(session({
    secret: "your-secret-key",
    resave: false,
    saveUninitialized: false
}));

mongoose.connect('mongodb://127.0.0.1:27017/reg');
const db = mongoose.connection;

// Define user schema and model
const userSchema = new mongoose.Schema({
    name: String,
    age: Number,
    email: String,
    phno: String,
    gender: String,
    password: String,
    niches: [String] // Include niches field in the user schema
});

const User = mongoose.models.User || mongoose.model('User', userSchema);

db.on('error', () => console.log("Error in Connecting to Database"));
db.once('open', () => console.log("Connected to Database"));

// Route for rendering the landing page
app.get("/landingpage", (req, res) => {
    try {
        // Read data from the file
        const videosData = fs.readFileSync('recommended_videos.json', 'utf8');

        // Parse JSON data
        const parsedData = JSON.parse(videosData);

        // Add video ID to each video object
        const videosWithIds = parsedData.map((video, index) => {
            video.videoId = index + 1;
            return video;
        });

        // Render landingpage.ejs with videos data
        res.render("landingpage.ejs", { videosData: videosWithIds });
    } catch (error) {
        // Log error and send error response
        console.error("Error reading videos data:", error);
        return res.status(500).send("Error reading videos data");
    }
});


app.post("/landingpage", async (req, res) => {
    try {
        const { email, password } = req.body;

        // Authenticate the user
        const user = await User.findOne({ email });

        if (user && await bcrypt.compare(password, user.password)) {
            // Successful login
            req.session.userId = user._id;
            return res.redirect("/landingpage");  // Redirect to GET /landingpage
        } else {
            // Login failed, redirect back to login page
            return res.redirect("/login.html?error=Invalid credentials");
        }
    } catch (error) {
        console.error("Error during user login:", error);
        return res.status(500).send("Internal Server Error");
    }
});

app.get("/trendingvideos", (req, res) => {
    try {
        // Read data from the trending videos file (e.g., 'trending_videos.json')
        const trendingVideosData = fs.readFileSync('trending_videos.json', 'utf8');

        // Parse the JSON data
        const parsedData = JSON.parse(trendingVideosData);

        // Add video ID to each video object
        const trendingVideosWithIds = parsedData.map((video, index) => {
            video.videoId = index + 1;
            return video;
        });

        // Return the trending videos data as a JSON response
        res.json(trendingVideosWithIds);
    } catch (error) {
        console.error("Error reading trending videos data:", error);
        return res.status(500).send("Error reading trending videos data");
    }
});


// Signup Route
app.post("/sign_up", async (req, res) => {
    try {
        const { name, age, email, phno, gender, password, niches } = req.body;

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = new User({
            name,
            age,
            email,
            phno,
            gender,
            password: hashedPassword,
            niches // Save selected niches
        });

        await newUser.save();
        console.log("User inserted successfully");
        return res.redirect('/login.html');
    } catch (error) {
        console.error("Error inserting user:", error);
        return res.status(500).send("Error inserting user");
    }
});


// Logout Route
app.get("/logout", (req, res) => {
    // Destroy the session
    req.session.destroy(err => {
        if (err) {
            console.error("Error destroying session:", err);
            res.status(500).send("Internal Server Error");
        } else {
            // Redirect to the login page after logout
            res.redirect("/login.html");
        }
    });
});

// Route to fetch user data for the logged-in user
app.get("/userdata", async (req, res) => {
    try {
        // Retrieve the user ID from the session
        const userId = req.session.userId;
        if (!userId) {
            return res.status(401).send("Unauthorized");
        }

        // Find the user by their ID
        const user = await User.findById(userId);
        if (!user) {
            return res.status(400).send("User not found");
        }

        // Send the user data as JSON response
        res.json(user);
    } catch (error) {
        console.error("Error fetching user data:", error);
        return res.status(500).send("Internal Server Error");
    }
});

// Edit Profile Route
app.get("/edit_profile", async (req, res) => {
    try {
        // Fetch the user's data from the session
        const userId = req.session.userId;
        if (!userId) {
            return res.redirect("/login.html"); // Redirect to login if user is not logged in
        }

        // Find the user by their ID
        const user = await User.findById(userId);
        if (!user) {
            return res.status(400).send("User not found");
        }

        // Render the edit profile page with user data
        res.render("edit_profile", { user });
    } catch (error) {
        console.error("Error fetching user data:", error);
        return res.status(500).send("Internal Server Error");
    }
});

// Update Profile Route
app.post("/update_profile", async (req, res) => {
    try {
        const { name, age, phno, gender } = req.body;

        // Fetch the user's data from the session
        const userId = req.session.userId;
        if (!userId) {
            return res.status(401).send("Unauthorized");
        }

        // Find the user by their ID
        const user = await User.findById(userId);
        if (!user) {
            return res.status(400).send("User not found");
        }

        // Update the user's profile data
        user.name = name;
        user.age = age;
        user.phno = phno;
        user.gender = gender;

        // Save the updated user object
        await user.save();

        console.log("User profile updated successfully");
        return   res.render("dashboard", { user });// Redirect to the dashboard or profile page
    } catch (error) {
        console.error("Error updating user profile:", error);
        return res.status(500).send("Error updating user profile");
    }
});

// Change Password Route
app.get("/change_password", (req, res) => {
    res.render("change_password");
});

app.get('/homess', (req, res) => {
    res.render("homess"); // Assuming 'homess.ejs' is in your views directory
});

// Update Password Route
app.post("/update_password", async (req, res) => {
    try {
        const { currentPassword, newPassword, confirmNewPassword } = req.body;

        // Check if the new password and confirm new password match
        if (newPassword !== confirmNewPassword) {
            return res.status(400).send("New password and confirm new password do not match");
        }

        // Retrieve the user ID from the session
        const userId = req.session.userId;

        // Find the user by their ID
        const user = await User.findById(userId);

        if (!user) {
            return res.status(400).send("User not found");
        }

        // Check if the current password is correct
        const passwordMatch = await bcrypt.compare(currentPassword, user.password);

        if (!passwordMatch) {
            return res.status(400).send("Current password is incorrect");
        }

        // Hash the new password
        const hashedNewPassword = await bcrypt.hash(newPassword, 10);

        // Update the user's password
        user.password = hashedNewPassword;

        // Save the updated user object
        await user.save();

        console.log("Password updated successfully");
        return   res.render("dashboard", { user }); // Redirect to the dashboard or profile page
    } catch (error) {
        console.error("Error updating password:", error);
        return res.status(500).send("Error updating password");
    }
});

app.listen(3000, () => {
    console.log("Listening on port 3000");
});
