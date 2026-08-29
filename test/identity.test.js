const test = require("node:test");
const assert = require("node:assert/strict");
const { SellerIdentityResolver } = require("../src/core/sellerIdentity");

test("configured aliases unify seller identities", () => {
  const resolver = new SellerIdentityResolver({
    seller_identity: {
      aliases: {
        "seller-1": ["facu@example.com", "Facu", "FACU"]
      }
    }
  });
  assert.equal(resolver.resolve("Facu").id, "seller-1");
  assert.equal(resolver.resolve("facu@example.com").id, "seller-1");
});

test("unconfigured seller gets deterministic derived id", () => {
  const resolver = new SellerIdentityResolver({});
  assert.equal(resolver.resolve("Juan Perez").id, "juan-perez");
});
