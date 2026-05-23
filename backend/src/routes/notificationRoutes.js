const { Router }  = require('express');
const prisma       = require('../config/database');
const { getIO }    = require('../config/socket');
const { authenticate } = require('../middlewares/authMiddleware');
const { stringifyJson, parseNotification } = require('../utils/jsonField');

// ─── Service ─────────────────────────────────────────────────

const send = async ({ userId, type, title, message, metadata }) => {
  const notification = await prisma.notification.create({
    data: { userId, type, title, message, metadata: stringifyJson(metadata) },
  });

  // Push via socket em tempo real
  try {
    getIO().to(`user:${userId}`).emit('notification:new', notification);
  } catch (_) {}

  return notification;
};

const list = async (userId, { page = 1, limit = 20, unreadOnly = false } = {}) => {
  const where = { userId, ...(unreadOnly ? { read: false } : {}) };
  const [total, items] = await Promise.all([
    prisma.notification.count({ where }),
    prisma.notification.findMany({
      where,
      skip:    (Number(page) - 1) * Number(limit),
      take:    Number(limit),
      orderBy: { createdAt: 'desc' },
    }),
  ]);
  return { total, page, limit, items: items.map(parseNotification) };
};

const markRead = async (notificationId, userId) => {
  const notif = await prisma.notification.findFirst({ where: { id: notificationId, userId } });
  if (!notif) throw Object.assign(new Error('Notificação não encontrada'), { status: 404 });
  return prisma.notification.update({ where: { id: notificationId }, data: { read: true } });
};

const markAllRead = async (userId) =>
  prisma.notification.updateMany({ where: { userId, read: false }, data: { read: true } });

const countUnread = async (userId) =>
  prisma.notification.count({ where: { userId, read: false } });

// ─── Controller + Routes ──────────────────────────────────────

const router = Router();
router.use(authenticate);

router.get('/',          async (req, res, next) => {
  try { res.json(await list(req.user.id, req.query)); } catch (e) { next(e); }
});

router.get('/unread-count', async (req, res, next) => {
  try { res.json({ count: await countUnread(req.user.id) }); } catch (e) { next(e); }
});

router.patch('/:id/read', async (req, res, next) => {
  try { res.json(await markRead(req.params.id, req.user.id)); } catch (e) { next(e); }
});

router.patch('/read-all', async (req, res, next) => {
  try {
    await markAllRead(req.user.id);
    res.json({ message: 'Todas as notificações marcadas como lidas' });
  } catch (e) { next(e); }
});

module.exports = { router, send };
