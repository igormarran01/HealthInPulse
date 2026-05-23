const patientService = require('../services/patientService');

const getProfile = async (req, res, next) => {
  try {
    const patient = await patientService.getProfile(req.user.id);
    res.json(patient);
  } catch (err) { next(err); }
};

const updateProfile = async (req, res, next) => {
  try {
    const updated = await patientService.updateProfile(req.user.id, req.body);
    res.json(updated);
  } catch (err) { next(err); }
};

const updateAvatar = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    const updated   = await patientService.updateAvatar(req.user.id, avatarUrl);
    res.json({ avatarUrl: updated.avatarUrl });
  } catch (err) { next(err); }
};

const addVitalSign = async (req, res, next) => {
  try {
    const patient  = await patientService.getProfile(req.user.id);
    const vital    = await patientService.addVitalSign(patient.id, req.body);

    // Emite em tempo real para médicos vinculados
    const { getIO } = require('../config/socket');
    try {
      getIO().to('doctors').emit('vital:new', { patientId: patient.id, vital });
    } catch (_) { /* socket opcional */ }

    res.status(201).json(vital);
  } catch (err) { next(err); }
};

const getVitalSigns = async (req, res, next) => {
  try {
    const patient = await patientService.getProfile(req.user.id);
    const result  = await patientService.getVitalSigns(patient.id, req.query);
    res.json(result);
  } catch (err) { next(err); }
};

const getLatestVitals = async (req, res, next) => {
  try {
    const patient = await patientService.getProfile(req.user.id);
    const vitals  = await patientService.getLatestVitals(patient.id);
    res.json(vitals);
  } catch (err) { next(err); }
};

const getDashboard = async (req, res, next) => {
  try {
    const patient   = await patientService.getProfile(req.user.id);
    const dashboard = await patientService.getDashboard(patient.id);
    res.json(dashboard);
  } catch (err) { next(err); }
};

module.exports = {
  getProfile, updateProfile, updateAvatar,
  addVitalSign, getVitalSigns, getLatestVitals,
  getDashboard,
};
