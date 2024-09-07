const express = require("express");
const mongoose = require("mongoose");
const app = express();
const bodyParser = require("body-parser");

// Middleware
app.use(bodyParser.json());

// MongoDB Connection
mongoose.connect("mongodb://127.0.0.1:27017/monkCommerce", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error:"));
db.once("open", () => {
  console.log("Connected to MongoDB");
});

// Coupon Schema and Model
const couponSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ["cart-wise", "product-wise", "bxgy"],
  },
  details: {
    threshold: { type: Number, default: 0 }, // for cart-wise
    discount: { type: Number, default: 0 }, // for cart-wise and product-wise
    product_id: { type: Number }, // for product-wise
    buy_products: [
      {
        product_id: { type: Number },
        quantity: { type: Number },
      },
    ], // for bxgy
    get_products: [
      {
        product_id: { type: Number },
        quantity: { type: Number },
      },
    ], // for bxgy
    repetition_limit: { type: Number, default: 1 }, // for bxgy
  },
  expiration_date: { type: Date }, // for bonus feature
});

const Coupon = mongoose.model("Coupon", couponSchema);

// Routes

// Create a new coupon
app.post("/coupons", async (req, res) => {
  try {
    const coupon = new Coupon(req.body);
    await coupon.save();
    res.status(201).json(coupon);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Retrieve all coupons
app.get("/coupons", async (req, res) => {
  try {
    const coupons = await Coupon.find();
    res.json(coupons);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Retrieve a specific coupon by its ID
app.get("/coupons/:id", async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) {
      return res.status(404).json({ error: "Coupon not found" });
    }
    res.json(coupon);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update a specific coupon by its ID
app.put("/coupons/:id", async (req, res) => {
  try {
    const coupon = await Coupon.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!coupon) {
      return res.status(404).json({ error: "Coupon not found" });
    }
    res.json(coupon);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete a specific coupon by its ID
app.delete("/coupons/:id", async (req, res) => {
  try {
    const coupon = await Coupon.findByIdAndDelete(req.params.id);
    if (!coupon) {
      return res.status(404).json({ error: "Coupon not found" });
    }
    res.json({ message: "Coupon deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Fetch all applicable coupons for a given cart and calculate the total discount
app.post("/applicable-coupons", async (req, res) => {
  try {
    const { cart } = req.body;
    const applicableCoupons = [];

    const coupons = await Coupon.find();

    coupons.forEach((coupon) => {
      let discount = 0;

      switch (coupon.type) {
        case "cart-wise":
          const cartTotal = cart.items.reduce(
            (acc, item) => acc + item.price * item.quantity,
            0
          );
          if (cartTotal > coupon.details.threshold) {
            discount = (cartTotal * coupon.details.discount) / 100;
            applicableCoupons.push({
              coupon_id: coupon._id,
              type: coupon.type,
              discount,
            });
          }
          break;

        case "product-wise":
          cart.items.forEach((item) => {
            if (item.product_id === coupon.details.product_id) {
              discount +=
                (item.price * item.quantity * coupon.details.discount) / 100;
              applicableCoupons.push({
                coupon_id: coupon._id,
                type: coupon.type,
                discount,
              });
            }
          });
          break;

        case "bxgy":
          let buyCount = 0;
          let getCount = 0;

          cart.items.forEach((item) => {
            const buyProduct = coupon.details.buy_products.find(
              (bp) => bp.product_id === item.product_id
            );
            if (buyProduct) {
              buyCount += item.quantity;
            }

            const getProduct = coupon.details.get_products.find(
              (gp) => gp.product_id === item.product_id
            );
            if (getProduct) {
              getCount += item.quantity;
            }
          });

          const applicableTimes = Math.min(
            Math.floor(buyCount / coupon.details.buy_products[0].quantity),
            coupon.details.repetition_limit
          );

          if (applicableTimes > 0) {
            getCount = Math.min(
              applicableTimes,
              coupon.details.get_products[0].quantity
            );
            discount =
              getCount *
              cart.items.find(
                (item) =>
                  item.product_id === coupon.details.get_products[0].product_id
              ).price;
            applicableCoupons.push({
              coupon_id: coupon._id,
              type: coupon.type,
              discount,
            });
          }
          break;

        default:
          break;
      }
    });

    res.json({ applicable_coupons: applicableCoupons });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Apply a specific coupon to the cart and return the updated cart
app.post("/apply-coupon/:id", async (req, res) => {
  try {
    const { cart } = req.body;
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) {
      return res.status(404).json({ error: "Coupon not found" });
    }

    let totalDiscount = 0;

    // Example logic to apply the discount; you can expand on this
    switch (coupon.type) {
      case "cart-wise":
        const cartTotal = cart.items.reduce(
          (acc, item) => acc + item.price * item.quantity,
          0
        );
        if (cartTotal > coupon.details.threshold) {
          totalDiscount = (cartTotal * coupon.details.discount) / 100;
        }
        break;

      case "product-wise":
        cart.items.forEach((item) => {
          if (item.product_id === coupon.details.product_id) {
            totalDiscount +=
              (item.price * item.quantity * coupon.details.discount) / 100;
          }
        });
        break;

      case "bxgy":
        let buyCount = 0;
        let getCount = 0;

        cart.items.forEach((item) => {
          const buyProduct = coupon.details.buy_products.find(
            (bp) => bp.product_id === item.product_id
          );
          if (buyProduct) {
            buyCount += item.quantity;
          }

          const getProduct = coupon.details.get_products.find(
            (gp) => gp.product_id === item.product_id
          );
          if (getProduct) {
            getCount += item.quantity;
          }
        });

        const applicableTimes = Math.min(
          Math.floor(buyCount / coupon.details.buy_products[0].quantity),
          coupon.details.repetition_limit
        );

        if (applicableTimes > 0) {
          getCount = Math.min(
            applicableTimes,
            coupon.details.get_products[0].quantity
          );
          totalDiscount =
            getCount *
            cart.items.find(
              (item) =>
                item.product_id === coupon.details.get_products[0].product_id
            ).price;
        }
        break;

      default:
        break;
    }

    const finalCart = {
      items: cart.items,
      total_price: cart.items.reduce(
        (acc, item) => acc + item.price * item.quantity,
        0
      ),
      total_discount: totalDiscount,
      final_price:
        cart.items.reduce((acc, item) => acc + item.price * item.quantity, 0) -
        totalDiscount,
    };

    res.json({ updated_cart: finalCart });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Start server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
