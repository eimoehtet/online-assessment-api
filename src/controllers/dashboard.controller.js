const { getDashboardStats } = require("../services/dashboard.service");

const getStats = async (req, res) => {
  try {
    return res.status(200).json({ data: await getDashboardStats(req.user) });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return res.status(500).json({ message: "Failed to fetch dashboard statistics." });
  }
};

module.exports = { getStats };
