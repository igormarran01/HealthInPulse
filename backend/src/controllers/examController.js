const examService   = require('../services/examService');
const patientService = require('../services/patientService');
const doctorService  = require('../services/doctorService');

// ─── Paciente ────────────────────────────────────────────────

const upload = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    const patient = await patientService.getProfile(req.user.id);
    const exam    = await examService.uploadExam(patient.id, req.file, req.body);
    res.status(202).json({ message: 'Exame recebido e sendo processado', exam });
  } catch (err) { next(err); }
};

const list = async (req, res, next) => {
  try {
    const patient = await patientService.getProfile(req.user.id);
    res.json(await examService.getExams(patient.id, req.query));
  } catch (err) { next(err); }
};

const getOne = async (req, res, next) => {
  try {
    const patient = await patientService.getProfile(req.user.id);
    res.json(await examService.getExamById(req.params.examId, patient.id));
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    const patient = await patientService.getProfile(req.user.id);
    await examService.deleteExam(req.params.examId, patient.id);
    res.status(204).send();
  } catch (err) { next(err); }
};

// ─── Médico ──────────────────────────────────────────────────

const getForDoctor = async (req, res, next) => {
  try {
    const doctor = await doctorService.getProfile(req.user.id);
    res.json(await examService.getExamForDoctor(req.params.examId, doctor.id));
  } catch (err) { next(err); }
};

module.exports = { upload, list, getOne, remove, getForDoctor };
