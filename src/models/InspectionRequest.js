import mongoose from 'mongoose';

const inspectionRequestSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },

    requestNumber: {
      type: String,
      unique: true,
      index: true,
    },

    serviceType: {
      type: String,
      enum: ['PDI', 'UCI', 'VSH'],
      required: true,
    },

    customerSnapshot: {
      name: { type: String, required: true },
      phone: { type: String, required: true },
      email: { type: String, required: true },
    },

    vehicleSnapshot: {
      brand: { type: String, required: true },
      model: { type: String, required: true },
      year: { type: Number, required: true },
      vin: { type: String, default: '' },
      registrationNumber: { type: String, default: '' },
      price: { type: Number, default: null },
    },

    schedule: {
      date: { type: Date, required: true },
      slot: { type: String, required: true },
    },

    location: {
      address: { type: String, required: true },
      coordinates: {
        lat: { type: Number, required: true },
        lng: { type: Number, required: true },
      },
    },

    adminJobId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    status: {
      type: String,
      enum: [
        'PENDING_PAYMENT', 'PAID', 'FORWARDED',
        'CANCELLATION_REQUESTED', 'CANCELLED',
        'RESCHEDULE_REQUESTED', 'RESCHEDULED',
        'FAILED',
      ],
      default: 'PENDING_PAYMENT',
    },

    payment: {
      status: {
        type: String,
        enum: ['NOT_REQUIRED', 'PENDING', 'PAID', 'FAILED'],
        default: 'NOT_REQUIRED',
      },
      amount: Number,
      currency: { type: String, default: 'INR' },
      razorpayOrderId: String,
      razorpayPaymentId: String,
      paidAt: Date,
      provider: String,
      providerPaymentId: String,
    },

    customerNotes: {
      type: String,
      default: '',
    },

    cancellation: {
      reason: { type: String, default: '' },
      requestedAt: { type: Date, default: null },
      confirmedAt: { type: Date, default: null },
    },

    reschedule: {
      reason: { type: String, default: '' },
      originalSchedule: {
        date: { type: Date, default: null },
        slot: { type: String, default: '' },
      },
      requestedSchedule: {
        date: { type: Date, default: null },
        slot: { type: String, default: '' },
      },
      requestedAt: { type: Date, default: null },
      confirmedAt: { type: Date, default: null },
    },

    statusHistory: [{
      from: { type: String },
      to: { type: String },
      changedAt: { type: Date, default: Date.now },
      changedBy: { type: String, enum: ['CUSTOMER', 'ADMIN', 'SYSTEM'], default: 'SYSTEM' },
      note: { type: String, default: '' },
    }],
  },
  { timestamps: true }
);

inspectionRequestSchema.pre('save', async function preSave(next) {
  if (this.requestNumber) return next();

  const last = await mongoose.model('InspectionRequest')
    .findOne({}, { requestNumber: 1 })
    .sort({ requestNumber: -1 })
    .lean();

  let nextNum = 1;
  if (last?.requestNumber) {
    const match = last.requestNumber.match(/^REQ-(\d+)$/);
    if (match) nextNum = parseInt(match[1], 10) + 1;
  }

  this.requestNumber = `REQ-${String(nextNum).padStart(6, '0')}`;
  return next();
});

const InspectionRequest = mongoose.model('InspectionRequest', inspectionRequestSchema);

export default InspectionRequest;
