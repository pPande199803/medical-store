import mongoose from 'mongoose';

const medicineSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },

    perMedicinePrice: {
      type: Number,
      required: true,
      min: 0
    },

    stripPrice: {
      type: Number,
      required: true,
      min: 0
    },

    boxNumber: {
      type: Number,
      required: true,
      min: 0
    },

    stockAvailable: {
      type: Number,
      required: true,
      min: 0
    },

    inStock: {
      type: Boolean,
      default: true
    },

    expiredDate: {
      type: Date,
      required: true
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true
  }
);

const Medicine = mongoose.model('AllMedicine', medicineSchema);

export default Medicine;