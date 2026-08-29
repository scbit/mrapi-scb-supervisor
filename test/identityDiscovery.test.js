const test = require("node:test");
const assert = require("node:assert/strict");
const { SellerIdentityResolver } = require("../src/core/sellerIdentity");

test("CRM and Hunter aliases can resolve to one canonical seller", () => {
  const r = new SellerIdentityResolver({ seller_identity: { aliases: {} } });
  r.registerCrmUser({ id: "crm-1", name: "Juan Perez", email: "juan@scb.com" });
  r.register("juan@scb.com", ["hunter-77", "Juan Perez"], "manual_cross_source");
  assert.equal(r.resolve("hunter-77").id, "juan@scb.com");
  assert.equal(r.resolve("Juan Perez").id, "juan@scb.com");
});
