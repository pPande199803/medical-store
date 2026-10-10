import express from "express";
import Medicine from "../models/medicine.js";
import auth from "../middleware/auth.js";

const router = express.Router();

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/*
  GET ALL MEDICINES (with optional ?search=)
  Only returns medicines that belong to the logged-in user.
  GET /api/medicines
*/
router.get("/", auth, async (req, res) => {
  try {
    const search = (req.query.search || "").trim();

    const filter = { user: req.user.id };

    if (search) {
      filter.name = { $regex: escapeRegex(search), $options: "i" };
    }

    const medicines = await Medicine.find(filter).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: medicines,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch medicines",
    });
  }
});

/*
  GET ONE MEDICINE
  GET /api/medicines/:id
*/
router.get("/:id", auth, async (req, res) => {
  try {
    const medicine = await Medicine.findOne({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!medicine) {
      return res.status(404).json({
        success: false,
        message: "Medicine not found",
      });
    }

    res.status(200).json({
      success: true,
      data: medicine,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch medicine",
    });
  }
});

/*
  ADD MEDICINE
  POST /api/medicines
*/
router.post("/", auth, async (req, res) => {
  try {
    const {
      name,
      perMedicinePrice,
      stripPrice,
      boxNumber,
      stockAvailable,
      expiredDate,
    } = req.body;

    if (!name || !perMedicinePrice || !expiredDate) {
      return res.status(400).json({
        success: false,
        message: "Name, price and expiry date are required.",
      });
    }

    // Check duplicate medicine (only within this user's list)
    const existingMedicine = await Medicine.findOne({
      name: {
        $regex: `^${escapeRegex(name.trim())}$`,
        $options: "i",
      },
      user: req.user.id,
    });

    /*
      Medicine already exists (same name, same user)?
      → do NOT create a duplicate — just increase the quantity.
    */
    if (existingMedicine) {

      const addQty = Number(stockAvailable);
      const increment = Number.isFinite(addQty) && addQty > 0 ? addQty : 0;

      existingMedicine.stockAvailable += increment;
      existingMedicine.inStock = existingMedicine.stockAvailable > 0;

      await existingMedicine.save();

      return res.status(200).json({
        success: true,
        message: increment
          ? `Medicine already exists — quantity updated. Total stock: ${existingMedicine.stockAvailable}`
          : `Medicine already exists. Total stock: ${existingMedicine.stockAvailable}`,
        data: existingMedicine,
      });
    }

    const medicine = await Medicine.create({
      name: name.trim(),
      perMedicinePrice,
      stripPrice: stripPrice ?? perMedicinePrice * 10,
      boxNumber: boxNumber ?? 0,
      stockAvailable,
      inStock: Number(stockAvailable) > 0,
      expiredDate,
      user: req.user.id,
    });

    res.status(201).json({
      success: true,
      message: "Medicine added successfully",
      data: medicine,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to add medicine",
    });
  }
});

/*
  UPDATE MEDICINE
  PUT /api/medicines/:id
*/
router.put("/:id", auth, async (req, res) => {
  try {
    const {
      name,
      perMedicinePrice,
      stripPrice,
      boxNumber,
      stockAvailable,
      expiredDate,
    } = req.body;

    const medicine = await Medicine.findOne({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!medicine) {
      return res.status(404).json({
        success: false,
        message: "Medicine not found",
      });
    }

    if (name !== undefined) medicine.name = name.trim();
    if (perMedicinePrice !== undefined) medicine.perMedicinePrice = perMedicinePrice;
    if (stripPrice !== undefined) medicine.stripPrice = stripPrice;
    if (boxNumber !== undefined) medicine.boxNumber = boxNumber;
    if (expiredDate !== undefined) medicine.expiredDate = expiredDate;

    if (stockAvailable !== undefined) {
      medicine.stockAvailable = Number(stockAvailable);
      medicine.inStock = Number(stockAvailable) > 0;
    }

    await medicine.save();

    res.status(200).json({
      success: true,
      message: "Medicine updated successfully",
      data: medicine,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to update medicine",
    });
  }
});

/*
  ADD STOCK (increase available quantity)
  PATCH /api/medicines/:id/add-stock
  body: { quantity, expiredDate?, boxNumber?, perMedicinePrice? }
*/
router.patch("/:id/add-stock", auth, async (req, res) => {
  try {
    const { quantity, expiredDate, boxNumber, perMedicinePrice } = req.body;

    const addQty = Number(quantity);

    if (!Number.isFinite(addQty) || addQty <= 0) {
      return res.status(400).json({
        success: false,
        message: "A valid quantity is required.",
      });
    }

    const medicine = await Medicine.findOne({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!medicine) {
      return res.status(404).json({
        success: false,
        message: "Medicine not found",
      });
    }

    medicine.stockAvailable += addQty;
    medicine.inStock = medicine.stockAvailable > 0;

    if (expiredDate) medicine.expiredDate = expiredDate;
    if (boxNumber !== undefined) medicine.boxNumber = boxNumber;
    if (perMedicinePrice !== undefined) medicine.perMedicinePrice = perMedicinePrice;

    await medicine.save();

    res.status(200).json({
      success: true,
      message: "Stock added successfully",
      data: medicine,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to add stock",
    });
  }
});

/*
  REDUCE STOCK (deduct immediately when a medicine is added to a bill)
  PATCH /api/medicines/:id/reduce-stock
  body: { quantity }
*/
router.patch("/:id/reduce-stock", auth, async (req, res) => {
  try {
    const reduceQty = Number(req.body.quantity);

    if (!Number.isFinite(reduceQty) || reduceQty <= 0) {
      return res.status(400).json({
        success: false,
        message: "A valid quantity is required.",
      });
    }

    const medicine = await Medicine.findOne({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!medicine) {
      return res.status(404).json({
        success: false,
        message: "Medicine not found",
      });
    }

    if (medicine.stockAvailable < reduceQty) {
      return res.status(400).json({
        success: false,
        message: `Not enough stock for ${medicine.name}. Available: ${medicine.stockAvailable}`,
      });
    }

    medicine.stockAvailable -= reduceQty;
    medicine.inStock = medicine.stockAvailable > 0;

    await medicine.save();

    res.status(200).json({
      success: true,
      message: "Stock reduced successfully",
      data: medicine,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to reduce stock",
    });
  }
});

/*
  DELETE MEDICINE
  DELETE /api/medicines/:id
*/
router.delete("/:id", auth, async (req, res) => {
  try {
    const medicine = await Medicine.findOneAndDelete({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!medicine) {
      return res.status(404).json({
        success: false,
        message: "Medicine not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Medicine deleted successfully",
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to delete medicine",
    });
  }
});

export default router;

