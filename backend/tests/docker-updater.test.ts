import assert from "node:assert/strict";
import test from "node:test";
import {
  buildReplacementCreatePayload,
  imageRefForVersion,
  normalizeArchitecture,
  validateTargetVersion,
  type DockerContainerInspect,
  type DockerImageInspect,
} from "../src/updater/docker";

test("updater only accepts a concrete semantic version in the official image repository", () => {
  assert.equal(validateTargetVersion("v1.4.2"), "1.4.2");
  assert.equal(validateTargetVersion("1.4.2-rc.1"), "1.4.2-rc.1");
  assert.equal(imageRefForVersion("1.4.2"), "pipcloud/glean:v1.4.2");
  assert.throws(() => validateTargetVersion("latest"));
  assert.throws(() => validateTargetVersion("pipcloud/other:1.0.0"));
  assert.throws(() => validateTargetVersion("1.4.2;rm -rf /"));
});

test("architecture aliases normalize to the Docker manifest names", () => {
  assert.equal(normalizeArchitecture("x86_64"), "amd64");
  assert.equal(normalizeArchitecture("amd64"), "amd64");
  assert.equal(normalizeArchitecture("aarch64"), "arm64");
});

test("replacement preserves user runtime configuration without pinning old build metadata", () => {
  const current = {
    Id: "container-id",
    Name: "/glean",
    Image: "sha256:old",
    Config: {
      Image: "pipcloud/glean:v1.4.1",
      Env: [
        "NODE_ENV=production",
        "DB_PATH=/app/data/glean.db",
        "GLEAN_APP_VERSION=1.4.1",
        "GLEAN_BUILD_TIME=old",
        "TZ=Asia/Shanghai",
        "PUBLIC_WEB_ORIGIN=https://notes.example.com",
      ],
      Cmd: ["node", "backend/dist/index.js"],
      Entrypoint: ["/sbin/tini", "--", "/usr/local/bin/docker-entrypoint.sh"],
      Labels: {
        "com.glean.managed": "true",
        "com.glean.role": "app",
        "com.glean.project": "glean",
        "com.glean.instance": "glean",
      },
      Healthcheck: { Test: ["CMD", "old-health"] },
      WorkingDir: "/app",
    },
    HostConfig: {
      Binds: ["glean-data:/app/data:rw"],
      PortBindings: { "3001/tcp": [{ HostPort: "3001" }] },
      RestartPolicy: { Name: "unless-stopped" },
      NetworkMode: "glean_glean-network",
      Privileged: false,
    },
    NetworkSettings: { Networks: {} },
    State: { Running: true, Status: "running" },
  } as unknown as DockerContainerInspect;

  const oldImage = {
    Id: "sha256:old",
    Config: {
      Env: [
        "NODE_ENV=production",
        "DB_PATH=/app/data/glean.db",
        "GLEAN_APP_VERSION=1.4.1",
        "GLEAN_BUILD_TIME=old",
      ],
      Cmd: ["node", "backend/dist/index.js"],
      Entrypoint: ["/sbin/tini", "--", "/usr/local/bin/docker-entrypoint.sh"],
      WorkingDir: "/app",
    },
  } as DockerImageInspect;
  const targetImage = {
    Id: "sha256:new",
    Config: {
      Env: [
        "NODE_ENV=production",
        "DB_PATH=/app/data/glean.db",
        "GLEAN_APP_VERSION=1.4.2",
        "GLEAN_BUILD_TIME=new",
      ],
      Healthcheck: { Test: ["CMD", "node", "health.js"] },
    },
  } as DockerImageInspect;

  const payload = buildReplacementCreatePayload(
    current,
    "pipcloud/glean:v1.4.2",
    [{ name: "glean_glean-network", aliases: ["glean"], links: [] }],
    oldImage,
    targetImage,
  );

  assert.equal(payload.Image, "pipcloud/glean:v1.4.2");
  assert.deepEqual(payload.Env.sort(), [
    "PUBLIC_WEB_ORIGIN=https://notes.example.com",
    "TZ=Asia/Shanghai",
  ]);
  assert.equal(payload.Cmd, undefined);
  assert.equal(payload.Entrypoint, undefined);
  assert.deepEqual(payload.Healthcheck, targetImage.Config?.Healthcheck);
  assert.deepEqual(payload.HostConfig.Binds, ["glean-data:/app/data:rw"]);
  assert.deepEqual(payload.HostConfig.PortBindings, { "3001/tcp": [{ HostPort: "3001" }] });
  assert.equal(payload.HostConfig.AutoRemove, false);
  assert.deepEqual(payload.NetworkingConfig.EndpointsConfig["glean_glean-network"].Aliases, ["glean"]);
});
