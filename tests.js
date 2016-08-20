function proxiesHomepageToPrelovedCore () {
  mockServer("localhost", 8080).on("/", then(respond(200, "homepage")));
  startNginx("live");
  expect(nginxRequest("/")).code(is(200)).body(is("homepage"));
};

function proxiesClassifiedsToMarketplaceWeb () {
  mockDns().on("beta.marketplace.thehutgroup.local", goto("127.0.0.2"));
  mockServer("127.0.0.2", 8080).on("/classifieds/pets/cats/all/uk", then(respond(200, "classifieds")));
  startNginx("live");
  expect(nginxRequest("/classifieds/pets/cats/all/uk")).code(is(200)).body(is("classifieds"));
};
