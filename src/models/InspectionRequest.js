import mongoose from 'mongoose';

const inspectionRequestSchema = new mongoose.Schema(
  {
    requestNumber: {
      type: String,
      unique: true,
      index: true,
    },

    serviceType: {
      type: String,
      enum: ['PDI', 'UCI'],
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
      enum: ['PENDING', 'FORWARDED', 'FAILED'],
      default: 'PENDING',
    },

    payment: {
      status: {
        type: String,
        enum: ['NOT_REQUIRED', 'PENDING', 'PAID', 'FAILED'],
        default: 'NOT_REQUIRED',
      },
      amount: Number,
      currency: String,
      provider: String,
      providerPaymentId: String,
    },
  },
  { timestamps: true }
);

inspectionRequestSchema.pre('save', async function preSave(next) {
  if (this.requestNumber) return next();

  const totalCount = await mongoose.model('InspectionRequest').countDocuments();
  this.requestNumber = `REQ-${String(totalCount + 1).padStart(6, '0')}`;
  return next();
});

const InspectionRequest = mongoose.model('InspectionRequest', inspectionRequestSchema);

export default InspectionRequest;
