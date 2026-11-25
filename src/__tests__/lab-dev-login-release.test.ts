import { login, labOrgs } from "@/api/auth";
import { api } from "@/api/client";

jest.mock("@/api/client", () => ({ api: { post: jest.fn(async () => ({ token: "t" })), get: jest.fn(async () => ({ orgs: [] })) } }));

describe("Lab dev login is compiled out of release builds (launch guide 11.142)", () => {
  const g = global as unknown as { __DEV__: boolean };
  const prev = g.__DEV__;
  afterEach(() => { g.__DEV__ = prev; jest.clearAllMocks(); });
  it("a development build still reaches the Lab dev login", async () => {
    g.__DEV__ = true;
    await expect(login("lab", { email: "a@b.c", org: "x" })).resolves.toEqual({ token: "t" });
    expect(api.post).toHaveBeenCalledWith("lab", "/auth/dev-login", expect.anything(), expect.anything());
  });
  it("a release build (__DEV__ false) never calls the Lab dev login or the dev org list", async () => {
    g.__DEV__ = false;
    await expect(login("lab", { email: "a@b.c", org: "x" })).rejects.toThrow("LAB_DEV_LOGIN_UNAVAILABLE");
    expect(await labOrgs()).toEqual([]);
    expect(api.post).not.toHaveBeenCalled(); expect(api.get).not.toHaveBeenCalled();
  });
});
