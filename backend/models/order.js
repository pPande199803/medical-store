import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema(
  {
    medicineName: {
      type: String,
      required: true,
      trim: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
    },

    // Human readable order date (yyyy-mm-dd), same format the UI uses.
    date: {
      type: String,
      default: () => new Date().toISOString().split('T')[0],
    },

    status: {
      type: String,
      enum: ['pending', 'received'],
      default: 'pending',
    },

    // Details captured when the stock is received into the database.
    received: {
      expiredDate: { type: Date },
      boxNumber: { type: Number },
      quantity: { type: Number },
      perMedicinePrice: { type: Number },
      receivedAt: { type: Date },
    },

    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
  }
);

const Order = mongoose.model('Order', orderSchema);

export default Order;
