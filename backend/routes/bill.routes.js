import express from "express";
import Bill from "../models/bill.js";
import auth from "../middleware/auth.js";

const router = express.Router();

/*
  GET ALL BILLS (for logged-in user)
  GET /api/bills
*/
router.get("/", auth, async (req, res) => {
  try {
    const bills = await Bill.find({ user: req.user.id }).sort({
      createdAt: -1,
    });

    res.status(200).json({
      success: true,
      data: bills,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch bills",
    });
  }
});

/*
  GET ONE BILL
  GET /api/bills/:id
*/
router.get("/:id", auth, async (req, res) => {
  try {
    const bill = await Bill.findOne({ _id: req.params.id, user: req.user.id });

    if (!bill) {
      return res.status(404).json({
        success: false,
        message: "Bill not found",
      });
    }

    res.status(200).json({
      success: true,
      data: bill,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch bill",
    });
  }
});

/*
  SAVE BILL
  POST /api/bills

  NOTE: Stock is already deducted the moment each medicine is added
  to the bill (via PATCH /api/medicines/:id/reduce-stock). This endpoint
  only records the finalised bill, so it does NOT deduct stock again.
  If a bill is abandoned, the frontend calls add-stock to restore it.
*/
router.post("/", auth, async (req, res) => {
  try {
    const {
      customerName,
      mobileNumber,
      items,
      totalAmount,
      discount,
      discountAmount,
      finalAmount,
    } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "A bill must contain at least one medicine.",
      });
    }

    const billNumber = "BILL-" + Date.now();

    // Customer details are optional: a walk-in customer without a name
    // gets a random label so every bill still reads clearly in history,
    // and the mobile number simply stays empty.
    const finalName =
      (typeof customerName === "string" && customerName.trim()) ||
      `Walk-In-${Math.floor(1000 + Math.random() * 9000)}`;

    const finalMobile =
      typeof mobileNumber === "string" ? mobileNumber.trim() : "";

    const bill = await Bill.create({
      billNumber,
      user: req.user.id,
      customerName: finalName,
      mobileNumber: finalMobile,
      items: items.map((item) => ({
        medicineId: item.medicineId,
        name: item.name,
        quantity: Number(item.quantity),
        perMedicinePrice: Number(item.perMedicinePrice),
        totalPrice: Number(item.totalPrice),
        expiredDate: item.expiredDate || undefined,
      })),
      totalAmount: Number(totalAmount) || 0,
      discount: Number(discount) || 0,
      discountAmount: Number(discountAmount) || 0,
      finalAmount: Number(finalAmount) || 0,
    });

    res.status(201).json({
      success: true,
      message: "Bill saved successfully",
      data: bill,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to save bill",
    });
  }
});

/*
  DELETE ALL BILLS OF ONE DATE
  DELETE /api/bills?date=YYYY-MM-DD

  Deletes every bill whose stored day equals the requested date, using the
  same calendar day the UI displays (UTC date part of createdAt), so what
  you see filtered on screen is exactly what gets deleted.
*/
router.delete("/", auth, async (req, res) => {
  try {
    const date = String(req.query.date || "").trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        success: false,
        message: "A valid date (YYYY-MM-DD) is required.",
      });
    }

    const start = new Date(`${date}T00:00:00.000Z`);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

    const result = await Bill.deleteMany({
      user: req.user.id,
      createdAt: { $gte: start, $lt: end },
    });

    res.status(200).json({
      success: true,
      message: `${result.deletedCount} bill(s) deleted for ${date.replace(/-/g, "/")}`,
      data: { deletedCount: result.deletedCount },
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to delete bills",
    });
  }
});

export default router;
