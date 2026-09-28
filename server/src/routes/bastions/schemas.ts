import { z } from "zod";

/**
 * Optional id of the client making the write, echoed back on the resulting broadcast so that client
 * can ignore its own change. A client that doesn't send one simply refreshes on its own echo.
 */
const clientIdField = z.string().trim().min(1).max(64).optional();

const FacilityInputSchema = z.object({
  id: z.string().trim().min(1).optional(),
  facilityKey: z.string().trim().min(1),
  source: z.enum(["player", "dm_extra"]),
  ownerPlayerId: z.string().trim().min(1).nullable().optional(),
  order: z.string().trim().min(1).nullable().optional(),
  notes: z.string().optional(),
});

export type FacilityInput = z.infer<typeof FacilityInputSchema>;

export const BastionCreateSchema = z.object({
  clientId: clientIdField,
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

// MARK: - Operations
// One schema per operation endpoint. Each carries only the fields that operation changes, and the
// server applies it to the current row, so edits to different fields never overwrite each other.

/** Bodiless operations (assign, unassign, remove) still identify the client for echo suppression. */
export const BastionOperationSchema = z.object({
  clientId: clientIdField,
});

export const BastionFieldsSchema = z.object({
  clientId: clientIdField,
  name: z.string().trim().min(1).optional(),
  active: z.boolean().optional(),
  walled: z.boolean().optional(),
  defendersArmed: z.number().int().min(0).optional(),
  defendersUnarmed: z.number().int().min(0).optional(),
  notes: z.string().optional(),
}).refine((body) => Object.keys(body).some((key) => key !== "clientId"), { message: "Nothing to change." });

export const BastionMaintainSchema = z.object({
  clientId: clientIdField,
  enabled: z.boolean(),
});

export const FacilityAddSchema = z.object({
  clientId: clientIdField,
  facilityKey: z.string().trim().min(1),
  source: z.enum(["player", "dm_extra"]),
  ownerPlayerId: z.string().trim().min(1).nullable().optional(),
});

export const FacilityEditSchema = z.object({
  clientId: clientIdField,
  /** An empty string or null clears the order. */
  order: z.string().trim().nullable().optional(),
  notes: z.string().optional(),
}).refine((body) => body.order !== undefined || body.notes !== undefined, { message: "Nothing to change." });

/** The DM's upgrade pill: the size to set, e.g. "vast". */
export const FacilitySizeSchema = z.object({
  clientId: clientIdField,
  size: z.string().trim().min(1).transform((size) => size.toLowerCase()),
});
