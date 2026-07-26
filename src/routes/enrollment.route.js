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
router.use(authorizeRole('ADMIN', 'STUDENT', 'TEACHER'));

router.post('/', createEnrollment);
router.post('/bulk', authorizeRole('ADMIN'), bulkEnrollment);
router.get('/', listEnrollments);
router.get('/:id', getEnrollmentById);
router.get('/courses/:id', getEnrollmentsByCourse);
router.get('/students/:id', getEnrollmentsByStudent);
router.put('/:id', updateEnrollment);
router.delete('/:id', deleteEnrollmentById);

module.exports = router;