import { describe, expect, it } from "vitest";
import pagination from "../src/utils/pagination.js";

const { getPagination, paginationMeta } = pagination;

describe("pagination utilities", () => {
  it("uses stable defaults and clamps the maximum page size", () => {
    expect(getPagination({})).toEqual({ page: 1, limit: 10, skip: 0 });
    expect(getPagination({ page: "3", limit: "500" })).toEqual({ page: 3, limit: 100, skip: 200 });
  });

  it("rejects invalid values by falling back to defaults", () => {
    expect(getPagination({ page: "bad", limit: "0" }, 20)).toEqual({ page: 1, limit: 20, skip: 0 });
  });

  it("builds accurate response metadata", () => {
    expect(paginationMeta({ page: 2, limit: 10, total: 21 })).toEqual({
      page: 2, limit: 10, total: 21, totalPages: 3,
    });
  });
});
