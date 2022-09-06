/* eslint-disable no-multi-spaces */

/* Rationale:
 *   no-multi-spaces: Aligned paths make for easier reading
 */

import contentType from 'content-type';

import fetch from 'node-fetch';
import fs from 'fs';

const auspiceEntrypoint = fs.readFileSync("auspice-client/dist/index.html").toString();
const gatsby404 = fs.readFileSync("static-site/public/404.html").toString();

/* It would be better if none of these tests relied on actual production
 * datasets/narratives and instead solely used fixtures explicitly put in place
 * for testing (like the nextstrain/community-test repo).  However, it is not
 * just a matter of uploading fixtures to our various sources, as then they'll
 * automatically show up in listings of dataset, narratives, groups, etc.  We
 * don't currently have a way to mark things as "hidden", and adding a way is
 * not a tangent I want to embark on right now.
 *
 * Until then, this test file may be a bit more fragile than is ideal, but it
 * should still be better than not testing.
 *   -trs, 23 Nov 2021
 */

/* Set a lenient timeout of 15s as these depend on remote/upstream servers
 * which might be slow to respond at times and/or network might be slow.
 */
jest.setTimeout(15000);

describe.skipIf = (condition) =>
  condition ? describe.skip : describe;


describe("datasets", () => {
  const noSidecars = { rootSequence: false, tipFrequencies: false };

  describe("core", () => {
    testPaths([
      { case: "nested",        path: "/flu/seasonal/h3n2/ha/2y" },
      { case: "canonicalized", path: "/flu/seasonal" },
      { case: "top-level",     path: "/zika", tipFrequencies: false },
    ]);
  });

  describe("staging", () => {
    testPaths([
      { case: "nested",        path: "/staging/flu/seasonal/h3n2/ha/2y" },
      { case: "canonicalized", path: "/staging/flu/seasonal" },
      { case: "top-level",     path: "/staging/zika", tipFrequencies: false },
    ]);
  });

  describe("community", () => {
    testPaths([
      { case: "nested",     path: "/community/nextstrain/community-test/zika/tutorial", ...noSidecars },
      { case: "top-level",  path: "/community/nextstrain/community-test@top-level", ...noSidecars },
      { case: "alt branch", path: "/community/nextstrain/community-test@alt/beta-cov", ...noSidecars },
    ]);
    describe("bogus", () => {
      testGatsby404("/community/nextstrain/community-test@does-not-exist");
      testGatsby404("/community/nextstrain/does-not-exist");
    });
  });

  describe("groups", () => {
    testPaths([
      { case: "nested",    path: "/groups/blab/ncov/19B" },
      { case: "top-level", path: "/groups/blab/beta-cov", ...noSidecars },
    ]);
    describe("bogus", () => {
      testGatsby404("/groups/blab/does-not-exist");
      testGatsby404("/groups/does-not-exist");
    });
  });

  describe("fetch", () => {
    testPaths([
      { case: "with extension",
        path: "/fetch/github.com/nextstrain/community-test/raw/master/auspice/community-test_zika_tutorial.json",
        testDoesNotExist: false,
        ...noSidecars },

      { case: "without extension",
        path: "/fetch/github.com/nextstrain/community-test/raw/master/auspice/community-test_zika_tutorial",
        testDoesNotExist: false,
        ...noSidecars },
    ]);
  });

  function testPaths(cases) {
    cases.forEach(testPath);
  }

  function testPath({case: case_, path, rootSequence = true, tipFrequencies = true, testDoesNotExist = true}) {
    describe(case_, () => {
      // Auspice
      testIsAuspice(path);

      // Main JSON
      testPathMediaTypes({
        path,
        mediaTypes: [
          "application/vnd.nextstrain.dataset.main+json",
          "application/json",
        ],
        additionalAcceptableTypes: ["application/json"],
        checkBody(mediaType, req) {
          // Really naive quick body check
          test("looks like main json", async () => {
            const res = await req;
            const body = await res.json();
            expect(body).toHaveProperty("version", "v2");
            expect(body).toHaveProperty("meta");
            expect(body).toHaveProperty("tree");
          });
        },
      });

      // Root sequence
      testPathMediaTypes({
        path,
        mediaTypes: ["application/vnd.nextstrain.dataset.root-sequence+json"],
        additionalAcceptableTypes: ["application/json"],
        status: rootSequence ? 200 : 404,
        checkBody(mediaType, req) {
          // Really naive quick body check
          test("looks like root-sequence", async () => {
            const res = await req;
            const body = await res.json();
            expect(body).toHaveProperty("nuc");
          });
        },
      });

      // Tip frequencies
      testPathMediaTypes({
        path,
        mediaTypes: ["application/vnd.nextstrain.dataset.tip-frequencies+json"],
        additionalAcceptableTypes: ["application/json"],
        status: tipFrequencies ? 200 : 404,
        checkBody(mediaType, req) {
          // Really naive quick body check
          test("looks like root-sequence", async () => {
            const res = await req;
            const body = await res.json();
            expect(body).toHaveProperty("pivots");
          });
        },
      });

      // Non-existent datasets under this path
      if (testDoesNotExist) {
        testGatsby404(`${path}/does-not-exist`);
      }
    });
  }
});

describe("narratives", () => {

  describe("core", () => {
    testPaths([
      { case: "top-level", path: "/narratives/intro-to-narratives" },
      { case: "nested",    path: "/narratives/ncov/sit-rep/2020-08-14" },
    ]);
  });

  describe("staging", () => {
    testPaths([
      { case: "top-level", path: "/staging/narratives/intro-to-narratives" },
      { case: "nested",    path: "/staging/narratives/test/fixture/intro-to-narratives" },
    ]);
  });

  describe("community", () => {
    testPaths([
      { case: "nested",     path: "/community/narratives/nextstrain/community-test/intro-to-narratives" },
      { case: "top-level",  path: "/community/narratives/nextstrain/community-test@top-level" },
      { case: "alt branch", path: "/community/narratives/nextstrain/community-test@alt/alternate-branch" },
    ]);
    describe("bad branch", () => {
      testGatsby404("/community/narratives/nextstrain/community-test@does-not-exist");
    });
  });

  describe("groups", () => {
    testPaths([
      { case: "nested", path: "/groups/blab/narratives/test/fixture" },
    ]);
    describe("bogus", () => {
      testGatsby404("/groups/blab/narratives/does-not-exist");
    });
  });

  describe("fetch", () => {
    testPaths([
      { case: "with extension",
        path: "/fetch/narratives/github.com/nextstrain/community-test/raw/master/narratives/community-test_intro-to-narratives.md",
        testDoesNotExist: false
      },
      { case: "without extension",
        path: "/fetch/narratives/github.com/nextstrain/community-test/raw/master/narratives/community-test_intro-to-narratives",
        testDoesNotExist: false
      },
    ]);
  });

  function testPaths(cases) {
    cases.forEach(testPath);
  }

  function testPath({case: case_, path, testDoesNotExist = true}) {
    describe(case_, () => {
      // Auspice
      testIsAuspice(path);

      // Markdown
      testPathMediaTypes({
        path,
        mediaTypes: [
          "text/vnd.nextstrain.narrative+markdown",
          "text/markdown",
        ],
        additionalAcceptableTypes: ["text/markdown", "text/plain"],
        checkBody(mediaType, req) {
          // Really naive quick body check
          test("looks like frontmatter", async () => {
            const res = await req;
            const body = await res.text();
            expect(body.startsWith("---\n")).toBe(true);
          });
        },
      });

      // Non-existent narratives under this path
      if (testDoesNotExist) {
        testGatsby404(`${path}/does-not-exist`);
      }
    });
  }
});


function testIsAuspice(path) {
  testPathMediaTypes({
    path,
    mediaTypes: ["*/*"],
    additionalAcceptableTypes: ["text/html"],
    checkBody(mediaType, req) {
      test("looks like Auspice", async () => {
        const res = await req;
        const body = await res.text();
        expect(body).toBe(auspiceEntrypoint);
      });
    },
  });
}

function testPathMediaTypes({path, mediaTypes, additionalAcceptableTypes, checkBody, status = 200}) {
  describe.each(mediaTypes)(`${path} (accept: %s)`, (mediaType) => {
    const req = fetch(url(path), accept(mediaType));

    test(`status is ${status}`, async () => {
      const res = await req;
      expect(res.status).toBe(status);
    });

    describe.skipIf(status === 404)("body", () => {
      const acceptableMediaTypes = [mediaType, ...(additionalAcceptableTypes || [])];

      test(`content-type is one of ${acceptableMediaTypes.join(", ")}`, async () => {
        const res = await req;

        expect(contentType.parse(res.headers.get("Content-Type")).type)
          .toBeOneOf(acceptableMediaTypes);
      });

      if (checkBody) checkBody(mediaType, req);
    });
  });
}

function testGatsby404(path) {
  describe(`${path} sends Gatsby 404`, () => {
    const req = fetch(url(path), {headers: {accept: "text/html,*/*;q=0.1"}});

    test("status is 404", async () => {
      const res = await req;
      expect(res.status).toBe(404);
    });

    test("body looks like 404 page", async () => {
      const res = await req;
      expect(await res.text()).toBe(gatsby404);
    });
  });
}

function url(path) {
  return new URL(path, BASE_URL);
}

function accept(mediaType) {
  return {
    headers: {
      Accept: mediaType
    }
  };
}
