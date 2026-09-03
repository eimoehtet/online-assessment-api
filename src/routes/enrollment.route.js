const {Router} = require('express');
const {
  createEnrollment,
  listEnrollments,
  getEnrollmentById,
  updateEnrollment,
  deleteEnrollmentById,
  getEnrollmentsByCourse,
  getEnrollmentsByCourseAndShift,
  getEnrollmentsByStudent,
  bulkEnrollment,
} = require('../controllers/enrollment.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const authorizeRole = require('../middlewares/authorize-role.middleware');

const router = Router();

router.use(authMiddleware);
router.post('/', authorizeRole('ADMIN'), createEnrollment);
router.post('/bulk', authorizeRole('ADMIN'), bulkEnrollment);
router.get('/', authorizeRole('ADMIN'), listEnrollments);
router.get('/courses/:id', authorizeRole('ADMIN'), getEnrollmentsByCourse);
router.get('/students/:id', authorizeRole('ADMIN', 'STUDENT'), getEnrollmentsByStudent);
router.get('/:id', authorizeRole('ADMIN'), getEnrollmentById);
router.put('/:id', authorizeRole('ADMIN'), updateEnrollment);
router.delete('/:id', authorizeRole('ADMIN'), deleteEnrollmentById);

module.exports = router;
