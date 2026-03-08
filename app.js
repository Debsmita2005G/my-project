const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const Listing = require("./models/listing");
const session = require("express-session");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const User = require("./models/user");
const flash = require("connect-flash");
const methodOverride = require("method-override");
const engine = require("ejs-mate");

const app = express();
const PORT = process.env.PORT || 3000;

/* VIEW ENGINE */

app.engine("ejs", engine);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

/* MIDDLEWARE */

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use(methodOverride("_method"));

/* SESSION */

const sessionOptions = {
    secret: "mysupersecretcode",
    resave: false,
    saveUninitialized: false,
    cookie: {
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        httpOnly: true
    }
};

app.use(session(sessionOptions));
app.use(flash());

/* PASSPORT */

app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

/* GLOBAL VARIABLES */

app.use((req, res, next) => {
    res.locals.success = req.flash("success");
    res.locals.error = req.flash("error");
    res.locals.currUser = req.user;
    next();
});

/* AUTH MIDDLEWARE */

function isLoggedIn(req, res, next) {
    if (!req.isAuthenticated()) {
        req.flash("error", "You must be logged in first!");
        return res.redirect("/login");
    }
    next();
}

const isOwner = async (req, res, next) => {
    let { id } = req.params;
    let listing = await Listing.findById(id);

    if (!req.user || !listing.owner.equals(req.user._id)) {
        req.flash("error", "You are not the owner of this crop!");
        return res.redirect(`/listings/${id}`);
    }

    next();
};

/* DATABASE CONNECTION */

mongoose.connect(process.env.MONGO_URL)
.then(() => {
    console.log("MongoDB Connected");

    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });

})
.catch((err) => {
    console.log("MongoDB Connection Error:", err);
});

/* HOME */

app.get("/", (req, res) => {
    res.redirect("/listings");
});

/* REACT TRANSPORT APP */

const transportPath = path.join(__dirname, "public/transport-app/build");

app.use(express.static(transportPath));

app.get("/transport", (req, res) => {
    res.sendFile(path.join(transportPath, "index.html"));
});

/* AUTH ROUTES */

app.get("/signup", (req, res) => {
    res.render("users/signup.ejs");
});

app.post("/signup", async (req, res, next) => {
    try {
        const { username, password, aadhar, phone } = req.body;

        if (!/^\d{12}$/.test(aadhar)) {
            throw new Error("Aadhar must be exactly 12 digits");
        }

        if (!/^\d{10}$/.test(phone)) {
            throw new Error("Phone number must be exactly 10 digits");
        }

        const newUser = new User({ username, aadhar, phone });
        const registeredUser = await User.register(newUser, password);

        req.login(registeredUser, (err) => {
            if (err) return next(err);
            req.flash("success", "Signup successful!");
            res.redirect("/listings");
        });

    } catch (err) {
        console.log(err);
        req.flash("error", err.message);
        res.redirect("/signup");
    }
});

app.get("/login", (req, res) => {
    res.render("users/login.ejs");
});

app.post("/login",
passport.authenticate("local", {
    failureRedirect: "/login",
    failureFlash: true
}),
(req, res) => {
    req.flash("success", "Welcome back!");
    res.redirect("/listings");
});

app.get("/logout", (req, res, next) => {
    req.logout(function (err) {
        if (err) {
            return next(err);
        }
        req.flash("success", "Logged out!");
        res.redirect("/listings");
    });
});

/* LISTINGS */

app.get("/listings", async (req, res) => {
    const allListings = await Listing.find({});
    res.render("listings/index.ejs", { allListings });
});

app.get("/listings/new", isLoggedIn, (req, res) => {
    res.render("listings/new.ejs");
});

app.post("/listings", isLoggedIn, async (req, res) => {
    const newListing = new Listing(req.body.listing);
    newListing.owner = req.user._id;

    await newListing.save();

    req.flash("success", "Listing created!");
    res.redirect("/listings");
});

app.get("/listings/:id", async (req, res) => {
    const { id } = req.params;
    const listing = await Listing.findById(id);

    res.render("listings/show.ejs", { listing });
});

/* EDIT */

app.get("/listings/:id/edit", isLoggedIn, async (req, res) => {
    const { id } = req.params;
    const listing = await Listing.findById(id);

    res.render("listings/edit.ejs", { listing });
});

app.put("/listings/:id", isLoggedIn, async (req, res) => {
    const { id } = req.params;

    await Listing.findByIdAndUpdate(id, { ...req.body.listing });

    req.flash("success", "Listing updated!");
    res.redirect(`/listings/${id}`);
});

/* DASHBOARD */

app.get("/dashboard", async (req, res) => {
    try {
        const listings = await Listing.find({});
        res.render("listings/dashboard.ejs", { listings });
    } catch (err) {
        console.log(err);
        req.flash("error", "Could not load dashboard");
        res.redirect("/listings");
    }
});

/* DELETE */

app.delete("/listings/:id", isLoggedIn, async (req, res) => {
    const { id } = req.params;

    const listing = await Listing.findById(id);

    if (!listing) {
        req.flash("error", "Listing not found");
        return res.redirect("/listings");
    }

    if (!req.user || !listing.owner || !listing.owner.equals(req.user._id)) {
        req.flash("error", "You are not the owner of this listing");
        return res.redirect(`/listings/${id}`);
    }

    await Listing.findByIdAndDelete(id);

    req.flash("success", "Listing deleted!");
    res.redirect("/listings");
});