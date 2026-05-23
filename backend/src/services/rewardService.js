const prisma = require('../config/database');
const coinService = require('./coinService');

const listAvailable = async () => {
  return prisma.reward.findMany({
    where:   { available: true },
    orderBy: { costCoins: 'asc' },
  });
};

const redeem = async (patientId, rewardId) => {
  const reward = await prisma.reward.findUnique({ where: { id: rewardId } });
  if (!reward || !reward.available)
    throw Object.assign(new Error('Recompensa indisponível'), { status: 404 });

  return prisma.$transaction(async (tx) => {
    const patient = await tx.patient.findUnique({
      where: { id: patientId },
      select: { healthCoins: true },
    });
    if (!patient) throw Object.assign(new Error('Paciente não encontrado'), { status: 404 });
    if (patient.healthCoins < reward.costCoins)
      throw Object.assign(new Error('Coins insuficientes para resgatar'), { status: 400 });

    // Cria redemption
    const redemption = await tx.rewardRedemption.create({
      data: {
        patientId,
        rewardId,
        costCoins: reward.costCoins,
        status:    'PENDING',
      },
    });

    // Debita coins (replicado da função debit para manter tudo na mesma transação)
    await tx.healthCoinTx.create({
      data: {
        patientId,
        delta:   -reward.costCoins,
        reason:  `Resgate: ${reward.title}`,
        refType: 'redemption',
        refId:   redemption.id,
      },
    });
    await tx.patient.update({
      where: { id: patientId },
      data:  { healthCoins: { decrement: reward.costCoins } },
    });

    return { redemption, reward };
  });
};

const myRedemptions = async (patientId) => {
  return prisma.rewardRedemption.findMany({
    where:   { patientId },
    include: { reward: true },
    orderBy: { redeemedAt: 'desc' },
  });
};

module.exports = { listAvailable, redeem, myRedemptions };
