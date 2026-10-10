import express from "express";
import Order from "../models/order.js";
import Medicine from "../models/medicine.js";
import auth from "../middleware/auth.js";

const router = express.Router();

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/*
  GET ALL ORDERS (optional ?date=yyyy-mm-dd)
  GET /api/orders
*/
router.get("/", auth, async (req, res) => {
  try {
    const { date } = req.query;

    const filter = { user: req.user.id };
    if (date) filter.date = date;

    const orders = await Order.find(filter).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: orders,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch orders",
    });
  }
});

/*
  ADD ORDER
  POST /api/orders
  body: { medicineName, quantity }
*/
router.post("/", auth, async (req, res) => {
  try {
    const { medicineName, quantity } = req.body;

    const name = (medicineName || "").trim();
    const qty = Number(quantity);

    if (!name || !Number.isFinite(qty) || qty <= 0) {
      return res.status(400).json({
        success: false,
        message: "Medicine name and a valid quantity are required.",
      });
    }

    // Merge with an existing pending order of the same medicine.
    const existing = await Order.findOne({
      user: req.user.id,
      medicineName: { $regex: `^${escapeRegex(name)}$`, $options: "i" },
      status: "pending",
    });

    if (existing) {
      existing.quantity += qty;
      await existing.save();

      return res.status(200).json({
        success: true,
        message: "Order quantity updated",
        data: existing,
      });
    }

    const order = await Order.create({
      medicineName: name,
      quantity: qty,
      status: "pending",
      user: req.user.id,
    });

    res.status(201).json({
      success: true,
      message: "Order added successfully",
      data: order,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to add order",
    });
  }
});

/*
  RECEIVE ORDER INTO DATABASE  ⭐ (the "medicine arrived" action)
  POST /api/orders/:id/receive
  body: { expiredDate, boxNumber, quantity, perMedicinePrice }

  The user only provides expiry date, box number, quantity and price.
  - If the medicine already exists in the DB  -> its stock is increased.
  - If it does NOT exist                        -> a new medicine is created.
  The order is then marked as "received".
*/
router.post("/:id/receive", auth, async (req, res) => {
  try {
    const { expiredDate, boxNumber, quantity, perMedicinePrice } = req.body;

    const qty = Number(quantity);
    const price = Number(perMedicinePrice);

    if (!expiredDate || !Number.isFinite(qty) || qty <= 0) {
      return res.status(400).json({
        success: false,
        message: "Expiry date and a valid quantity are required.",
      });
    }

    if (!Number.isFinite(price) || price < 0) {
      return res.status(400).json({
        success: false,
        message: "A valid price is required.",
      });
    }

    const order = await Order.findOne({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Try to find an existing medicine (case-insensitive name match, this user only).
    let medicine = await Medicine.findOne({
      name: { $regex: `^${escapeRegex(order.medicineName)}$`, $options: "i" },
      user: req.user.id,
    });

    if (medicine) {
      // Add received stock to the existing medicine.
      medicine.stockAvailable += qty;
      medicine.inStock = medicine.stockAvailable > 0;
      medicine.expiredDate = expiredDate;
      if (boxNumber !== undefined) medicine.boxNumber = boxNumber;
      if (perMedicinePrice !== undefined) medicine.perMedicinePrice = price;

      await medicine.save();
    } else {
      // Create a brand new medicine entry.
      medicine = await Medicine.create({
        name: order.medicineName,
        perMedicinePrice: price,
        stripPrice: price * 10,
        boxNumber: boxNumber ?? 0,
        stockAvailable: qty,
        inStock: qty > 0,
        expiredDate,
        user: req.user.id,
      });
    }

    // Mark the order as received and store the details.
    order.status = "received";
    order.received = {
      expiredDate,
      boxNumber,
      quantity: qty,
      perMedicinePrice: price,
      receivedAt: new Date(),
    };
    await order.save();

    res.status(200).json({
      success: true,
      message: "Medicine added to database successfully",
      data: { order, medicine },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to receive order",
    });
  }
});

/*
  DELETE ORDER
  DELETE /api/orders/:id
*/
router.delete("/:id", auth, async (req, res) => {
  try {
    const order = await Order.findOneAndDelete({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Order removed successfully",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to remove order",
    });
  }
});

export default router;
