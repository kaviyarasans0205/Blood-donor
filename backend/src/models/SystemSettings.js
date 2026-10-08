import mongoose from 'mongoose';

const systemSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, lowercase: true, trim: true },
    value: { type: mongoose.Schema.Types.Mixed, required: true },
    description: { type: String, maxlength: 300 },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

systemSettingsSchema.statics.get = async function get(key, defaultValue = null) {
  const doc = await this.findOne({ key });
  return doc ? doc.value : defaultValue;
};

systemSettingsSchema.statics.set = async function set(key, value, updatedBy = null, description = '') {
  return this.findOneAndUpdate(
    { key },
    { value, updatedBy, description },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

const SystemSettings = mongoose.model('SystemSettings', systemSettingsSchema);
export default SystemSettings;
