/** Review of a whole-campaign restore. Records are matched by ID, never by name. */
export type CampaignImportPreview = {
  campaignId: string;
  name: string;
  existingName: string | null;
  sameNameCampaigns: string[];
  counts: { collection: string; incoming: number; existing: number }[];
  warnings: string[];
};
