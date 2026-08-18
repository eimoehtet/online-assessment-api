const getPagination = (query = {}, defaultLimit = 10) => {
  const parsedPage = Number.parseInt(query.page, 10);
  const parsedLimit = Number.parseInt(query.limit, 10);
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const limit = Math.min(
    Number.isInteger(parsedLimit) && parsedLimit > 0 ? parsedLimit : defaultLimit,
    100,
  );

  return { page, limit, skip: (page - 1) * limit };
};

const paginationMeta = ({ page, limit, total }) => ({
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit),
});

module.exports = { getPagination, paginationMeta };
