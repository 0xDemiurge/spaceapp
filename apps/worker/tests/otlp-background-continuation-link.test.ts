import { describe, expect, it } from "vitest";
import { dummyTurnInputSchema } from "@space/contracts";
import { prepareBackgroundContinuation } from "../src/room-background-continuation.js";
import { continuationFixture } from "./room-continuation-fixture.js";

const originating = "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01";

describe("background continuation span link", () => {
  it("carries the originating turn's traceparent as continuationTraceparent and keeps the trace:bg id", async () => {
    const c = continuationFixture("OPEN_TYPES", originating);
    const prepared = await prepareBackgroundContinuation(c.input, c.store);
    if (prepared.state !== "READY") throw Error("Missing continuation");
    expect(prepared.item.turn.traceId).toBe("trace:bg-test-1");
    expect(prepared.item.turn.continuationTraceparent).toBe(originating);
    expect(prepared.item.turn.traceparent).toBeUndefined();
  });

  it("adds no link field when the originating turn had no traceparent", async () => {
    const c = continuationFixture();
    const prepared = await prepareBackgroundContinuation(c.input, c.store);
    if (prepared.state !== "READY") throw Error("Missing continuation");
    expect(prepared.item.turn.continuationTraceparent).toBeUndefined();
  });

  it("validates the field as a W3C traceparent", () => {
    const turn = { roomId: "room_otlp_link", paneId: "pane_otlp_link", prompt: "hi", traceId: "req:abcdefghijkl" };
    expect(dummyTurnInputSchema.parse({ ...turn, continuationTraceparent: originating }).continuationTraceparent).toBe(originating);
    expect(dummyTurnInputSchema.safeParse({ ...turn, continuationTraceparent: "https://example.test" }).success).toBe(false);
  });
});
