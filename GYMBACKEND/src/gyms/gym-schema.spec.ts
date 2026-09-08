import { model } from "mongoose";
import { Gym, GymSchema } from "@/gyms/schemas/gym.schema";

/**
 * A gym that has never had its pin placed must carry no `location` at all.
 *
 * The bug this guards against: giving the inner `type` field a default made
 * Mongoose materialise `location: { type: "Point" }` with no coordinates on
 * every new gym. A 2dsphere index rejects that outright — "Can't extract geo
 * keys" — so creating a gym, or saving any change to one, failed at insert.
 */
const GymModel = model<Gym>("GymSchemaSpec", GymSchema);

function newGym() {
  return new GymModel({
    name: "Segun Gym",
    branch: "Obawole",
    area: "Ifako Ijaiye",
    slug: "segun-gym-obawole",
    dayPassPrice: 500,
    ownerId: "6a9f41de8cd3a2fbe81a9ae0",
  });
}

describe("Gym location", () => {
  it("leaves location unset on a gym with no pin", () => {
    const doc = newGym().toObject();
    expect(doc.location).toBeUndefined();
  });

  it("never writes a Point without coordinates", () => {
    // The exact shape the index refused.
    const written = JSON.stringify(newGym().toObject());
    expect(written).not.toContain('"type":"Point"');
  });

  it("keeps a pin that was actually placed, in [lng, lat] order", () => {
    const gym = newGym();
    gym.location = { type: "Point", coordinates: [3.3792, 6.5244] };

    const doc = gym.toObject();
    expect(doc.location?.type).toBe("Point");
    expect(doc.location?.coordinates).toEqual([3.3792, 6.5244]);
  });

  it("still allows the day-pass floor of 100", () => {
    const gym = newGym();
    gym.dayPassPrice = 100;
    expect(gym.validateSync()?.errors.dayPassPrice).toBeUndefined();
  });
});
