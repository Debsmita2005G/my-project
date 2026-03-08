const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const passportLocalMongoose = require("passport-local-mongoose").default || require("passport-local-mongoose");

const userSchema = new mongoose.Schema({
        username: { type: String, required: true },
    aadhar: { type: String, required: true },
    phone: { type: String, required: true }

});


userSchema.plugin(passportLocalMongoose);

module.exports = mongoose.model("User", userSchema);