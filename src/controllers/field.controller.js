import Field from '../models/Field.js';
import apiResponse from '../utils/apiResponse.js';

const slugify = (text) =>
  text.toString().toLowerCase()
    .replace(/\s+/g, '-').replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-').replace(/^-+/, '').replace(/-+$/, '');

export const getAllFields = async (req, res) => {
  try {
    const fields = await Field.find().sort({ name: 1 });
    return res.status(200).json(apiResponse.success('Fields retrieved successfully.', { fields }));
  } catch (error) {
    return res.status(500).json(apiResponse.error('Internal server error getting fields list.'));
  }
};

export const createField = async (req, res) => {
  try {
    const { name } = req.body;
    const slug = slugify(name);
    const existingField = await Field.findOne({ $or: [{ name: { $regex: new RegExp(`^${name}$`, 'i') } }, { slug }] });
    if (existingField) return res.status(400).json(apiResponse.error('Field with this name or slug already exists.'));

    const field = new Field({ name, slug, isDefault: false, createdBy: req.user._id });
    await field.save();
    return res.status(201).json(apiResponse.success('Field created successfully.', { field }));
  } catch (error) {
    return res.status(500).json(apiResponse.error('Internal server error creating field.'));
  }
};

export const deleteField = async (req, res) => {
  try {
    const field = await Field.findByIdAndDelete(req.params.id);
    if (!field) return res.status(404).json(apiResponse.error('Field not found.'));
    return res.status(200).json(apiResponse.success('Field deleted successfully.'));
  } catch (error) {
    return res.status(500).json(apiResponse.error('Internal server error deleting field.'));
  }
};
