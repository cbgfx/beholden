import { z } from "zod";
import { FeatMechanicsSchema } from "./nativeCompendiumV2Schemas.shared.js";

export const FeatSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    source: z.string().min(1).optional(),
    category: z.string().min(1).optional(),
    prerequisite: z.union([z.string().min(1), z.record(z.string(), z.unknown())]).optional(),
    repeatable: z.literal(true).optional(),
    description: z.string(),
    resolution: z.enum(["automatic", "manual", "mixed"]).optional(),
    resolutionNotes: z.array(z.string().min(1)).min(1).optional(),
    mechanics: FeatMechanicsSchema
      .refine((value) => Object.keys(value).length > 0, "Empty mechanics must be omitted")
      .optional(),
  })
  .strict();
