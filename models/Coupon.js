// Example schema structure in MongoDB using Mongoose
const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ["cart-wise", "product-wise", "bxgy"],
  },
  details: {
    threshold: Number, // For cart-wise
    discount: Number, // For cart-wise or product-wise
    product_id: mongoose.Schema.Types.ObjectId, // For product-wise
    buy_products: [
      { product_id: mongoose.Schema.Types.ObjectId, quantity: Number },
    ], // For bxgy
    get_products: [
      { product_id: mongoose.Schema.Types.ObjectId, quantity: Number },
    ], // For bxgy
    repetition_limit: Number, // For bxgy
  },
  expiration_date: Date,
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

const Coupon = mongoose.model("Coupon", couponSchema);
