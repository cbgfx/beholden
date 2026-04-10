import { z } from "zod";

export const FacilityInputSchema = z.object({
  id: z.string().trim().min(1).optional(),
  facilityKey: z.string().trim().min(1),
  source: z.enum(["player", "dm_extra"]),
  ownerPlayerId: z.string().trim().min(1).nullable().optional(),
  order: z.string().trim().min(1).nullable().optional(),
  notes: z.string().optional(),
});

export type FacilityInput = z.infer<typeof FacilityInputSchema>;

export const BastionCreateSchema = z.object({
  name: z.string().trim().min(1),
  active: z.boolean().optional(),
  walled: z.boolean().optional(),
  defendersArmed: z.number().int().min(0).optional(),
  defendersUnarmed: z.number().int().min(0).optional(),
  assignedPlayerIds: z.array(z.string().trim().min(1)).optional(),
  assignedCharacterIds: z.array(z.string().trim().min(1)).optional(),
  notes: z.string().optional(),
  maintainOrder: z.boolean().optional(),
  facilities: z.array(FacilityInputSchema).optional(),
});

export const BastionUpdateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  active: z.boolean().optional(),
  walled: z.boolean().optional(),
  defendersArmed: z.number().int().min(0).optional(),
  defendersUnarmed: z.number().int().min(0).optional(),
  assignedPlayerIds: z.array(z.string().trim().min(1)).optional(),
  assignedCharacterIds: z.array(z.string().trim().min(1)).optional(),
  notes: z.string().optional(),
  maintainOrder: z.boolean().optional(),
  facilities: z.array(FacilityInputSchema).optional(),
});

export const BastionPlayerUpdateSchema = z.object({
  facilities: z.array(FacilityInputSchema),
  maintainOrder: z.boolean().optional(),
  notes: z.string().optional(),
});
