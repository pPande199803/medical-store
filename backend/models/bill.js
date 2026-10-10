import mongoose from 'mongoose';

const billItemSchema = new mongoose.Schema(
  {
    medicineId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AllMedicine',
    },
    name: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 1 },
    perMedicinePrice: { type: Number, required: true, min: 0 },
    totalPrice: { type: Number, required: true, min: 0 },
    expiredDate: { type: Date },
  },
  { _id: false }
);

const billSchema = new mongoose.Schema(
  {
    billNumber: { type: String, unique: true },

    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    customerName: { type: String, default: '', trim: true },
    mobileNumber: { type: String, default: '', trim: true },

    items: { type: [billItemSchema], default: [] },

    totalAmount: { type: Number, default: 0, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    discountAmount: { type: Number, default: 0, min: 0 },
    finalAmount: { type: Number, default: 0, min: 0 },
  },
  {
    timestamps: true,
  }
);

const Bill = mongoose.model('Bill', billSchema);

export default Bill;
