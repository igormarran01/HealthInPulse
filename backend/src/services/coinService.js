const prisma = require('../config/database');

/**
 * Credita coins ao paciente e registra transação.
 * delta deve ser > 0.
 */
const credit = async (patientId, delta, reason, ref = {}) => {
  if (delta <= 0) throw Object.assign(new Error('Delta deve ser positivo'), { status: 400 });
  return prisma.$transaction(async (tx) => {
    const txRow = await tx.healthCoinTx.create({
      data: {
        patientId, delta, reason,
        refType: ref.refType || null,
        refId:   ref.refId   || null,
      },
    });
    await tx.patient.update({
      where: { id: patientId },
      data:  { healthCoins: { increment: delta } },
    });
    return txRow;
  });
};

/**
 * Debita coins. Lança erro 400 se saldo insuficiente.
 */
const debit = async (patientId, amount, reason, ref = {}) => {
  if (amount <= 0) throw Object.assign(new Error('Valor deve ser positivo'), { status: 400 });
  return prisma.$transaction(async (tx) => {
    const patient = await tx.patient.findUnique({
      where: { id: patientId },
      select: { healthCoins: true },
    });
    if (!patient) throw Object.assign(new Error('Paciente não encontrado'), { status: 404 });
    if (patient.healthCoins < amount)
      throw Object.assign(new Error('Saldo de coins insuficiente'), { status: 400 });

    const txRow = await tx.healthCoinTx.create({
      data: {
        patientId, delta: -amount, reason,
        refType: ref.refType || null,
        refId:   ref.refId   || null,
      },
    });
    await tx.patient.update({
      where: { id: patientId },
      data:  { healthCoins: { decrement: amount } },
    });
    return txRow;
  });
};

const balance = async (patientId) => {
  const p = await prisma.patient.findUnique({
    where: { id: patientId },
    select: { healthCoins: true },
  });
  return p?.healthCoins ?? 0;
};

const history = async (patientId, { limit = 50 } = {}) => {
  return prisma.healthCoinTx.findMany({
    where:   { patientId },
    take:    Number(limit),
    orderBy: { createdAt: 'desc' },
  });
};

module.exports = { credit, debit, balance, history };
