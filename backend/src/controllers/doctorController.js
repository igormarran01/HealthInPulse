const doctorService = require('../services/doctorService');

const getProfile = async (req, res, next) => {
  try {
    res.json(await doctorService.getProfile(req.user.id));
  } catch (err) { next(err); }
};

const updateProfile = async (req, res, next) => {
  try {
    res.json(await doctorService.updateProfile(req.user.id, req.body));
  } catch (err) { next(err); }
};

const updateAvatar = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    res.json({ avatarUrl: (await doctorService.updateAvatar(req.user.id, avatarUrl)).avatarUrl });
  } catch (err) { next(err); }
};

const getDashboard = async (req, res, next) => {
  try {
    const doctor = await doctorService.getProfile(req.user.id);
    res.json(await doctorService.getDashboard(doctor.id));
  } catch (err) { next(err); }
};

const getPatients = async (req, res, next) => {
  try {
    const doctor = await doctorService.getProfile(req.user.id);
    res.json(await doctorService.getPatients(doctor.id, req.query));
  } catch (err) { next(err); }
};

const getPatientDetail = async (req, res, next) => {
  try {
    const doctor = await doctorService.getProfile(req.user.id);
    res.json(await doctorService.getPatientDetail(doctor.id, req.params.patientId));
  } catch (err) { next(err); }
};

const linkPatient = async (req, res, next) => {
  try {
    const doctor = await doctorService.getProfile(req.user.id);
    res.status(201).json(await doctorService.linkPatient(doctor.id, req.body.patientId));
  } catch (err) { next(err); }
};

const unlinkPatient = async (req, res, next) => {
  try {
    const doctor = await doctorService.getProfile(req.user.id);
    await doctorService.unlinkPatient(doctor.id, req.params.patientId);
    res.status(204).send();
  } catch (err) { next(err); }
};

const getPatientConsolidated = async (req, res, next) => {
  try {
    const doctor = await doctorService.getProfile(req.user.id);
    res.json(await doctorService.getPatientConsolidated(doctor.id, req.params.patientId));
  } catch (err) { next(err); }
};

const getPatientHistory = async (req, res, next) => {
  try {
    const doctor = await doctorService.getProfile(req.user.id);
    res.json(await doctorService.getPatientHistory(doctor.id, req.params.patientId));
  } catch (err) { next(err); }
};

module.exports = {
  getProfile, updateProfile, updateAvatar, getDashboard,
  getPatients, getPatientDetail, linkPatient, unlinkPatient,
  getPatientConsolidated, getPatientHistory,
};
