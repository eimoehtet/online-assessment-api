const prisma = require("../config/prisma");


const getQuizAttendanceByQuizId = async (quizId) => {
  const attendence = await prisma.quizAttendance.findMany({
    where: { quiz_id: quizId },
    select: {
      quiz_id: true,
      student_id: true,
      status: true,
    },
  });
  if (attendence.length === 0) {
    const enrollments = await prisma.enrollment.findMany({
      where: { course: { quizzes: { some: { id: quizId } } } },
      select: {
        student_id: true,
      },
    });

    const newAttendanceRecords = enrollments.map((enrollment) => ({
      quiz_id: quizId,
      student_id: enrollment.student_id,
      status: true, // Default status to true (present) for new records
    }));

    //insert new attendance records into the database
    await prisma.quizAttendance.createMany({
      data: newAttendanceRecords,
      skipDuplicates: true, // Skip duplicates if any
    });
    return newAttendanceRecords;
  }
  return attendence;
};

const updateAttendance = async (data) => {
  return prisma.quizAttendance.update({
    where: {
      quiz_id_student_id: {
        quiz_id: parseInt(data.quiz_id, 10),
        student_id: data.student_id,
      },
    },
    data: {
      status: {
        set: !data.status,
      },
    },
  });
};
module.exports = {
  getQuizAttendanceByQuizId,
  updateAttendance,
};


