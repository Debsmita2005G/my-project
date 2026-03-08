const mongoose = require("mongoose");

const listingSchema = new mongoose.Schema({

    crop: String,

    category: String,

    soilType: String,

    climate: String,

    sowingSeason: String,

    harvestSeason: String,

    price: Number,

    location: String,

    image: String,

    description: String,

    owner:{
        type: mongoose.Schema.Types.ObjectId,
        ref:"User"
    }

});

module.exports = mongoose.model("Listing", listingSchema);