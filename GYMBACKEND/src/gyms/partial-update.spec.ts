import { plainToInstance } from "class-transformer";
import { model } from "mongoose";
import { applyDefined } from "@/gyms/gyms.service";
import { UpdateGymDto } from "@/gyms/dto/gym.dto";
import { Gym, GymSchema } from "@/gyms/schemas/gym.schema";

/**
 * The bug this guards against: `Object.assign(gym, dto)` on a PATCH that only
 * sent a location blanked `name`, `branch`, `area` and `dayPassPrice`, because
 * the DTO carries every declared field as an own property — undefined where the
 * request said nothing. Saving then failed on all four as required.
 */
const GymModel = model<Gym>("GymPartialUpdateSpec", GymSchema);

function existingGym() {
  return new GymModel({
    name: "Segs Gym",
    branch: "Obawole",
    area: "Ifako Ijaiye",
    slug: "segs-gym-obawole",
    dayPassPrice: 500,
    ownerId: "6a9f46dded8ecd140460c4fa",
  });
}

describe("partial gym updates", () => {
  it("carries undefined for every field the request omitted", () => {
    // Not a behaviour we want — just the trap that has to be handled.
    const dto = plainToInstance(UpdateGymDto, { lat: 6.655, lng: 3.3328 });

    expect(Object.keys(dto)).toEqual(expect.arrayContaining(["name", "area"]));
    expect(dto.name).toBeUndefined();
  });

  it("leaves untouched fields alone when only a pin is sent", () => {
    const gym = existingGym();
    const { lat, lng, ...fields } = plainToInstance(UpdateGymDto, {
      lat: 6.655,
      lng: 3.3328,
    });

    applyDefined(gym, fields);
    if (lat !== undefined && lng !== undefined) {
      gym.location = { type: "Point", coordinates: [lng, lat] };
    }

    expect(gym.validateSync()).toBeUndefined();
    expect(gym.name).toBe("Segs Gym");
    expect(gym.branch).toBe("Obawole");
    expect(gym.area).toBe("Ifako Ijaiye");
    expect(gym.dayPassPrice).toBe(500);
    expect(gym.location?.coordinates).toEqual([3.3328, 6.655]);
  });

  it("still applies the fields that were sent", () => {
    const gym = existingGym();
    const dto = plainToInstance(UpdateGymDto, { dayPassPrice: 100 });

    applyDefined(gym, { ...dto });

    expect(gym.validateSync()).toBeUndefined();
    expect(gym.dayPassPrice).toBe(100);
    expect(gym.name).toBe("Segs Gym");
  });
});
