const { updateAttendance, getQuizAttendanceByQuizId } = require("../services/quiz_attendance.service");

const getQuizAttendanceController = async (req, res) => {
  try {
    const { quiz_id } = req.params;

    if (!quiz_id) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    const attendanceRecords = await getQuizAttendanceByQuizId(parseInt(quiz_id, 10));

    return res.status(200).json({
      message: "Quiz attendance fetched successfully.",
      data: attendanceRecords,
    });
  } catch (error) {
    console.error("Error fetching quiz attendance:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

const updateAttendanceController = async (req, res) => {
  try {
    const { quiz_id, student_id, status } = req.body;

    if (!quiz_id || !student_id || status === undefined) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    const quizAttendanceData = {
      quiz_id,
      student_id,
      status,
    };

    const updatedQuizAttendance = await updateAttendance(quizAttendanceData);

    return res.status(200).json({
      message: "Quiz attendance updated successfully.",
      data: updatedQuizAttendance,
    });
  } catch (error) {
    console.error("Error updating quiz attendance:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

module.exports = {
  updateAttendanceController,
  getQuizAttendanceController,
};