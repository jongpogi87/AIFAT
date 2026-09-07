import { getSettingsRepository } from "@/lib/repositories";

export async function GET() {
  try {
    const settingsRepo = getSettingsRepository();
    const settings = await settingsRepo.getSettings();
    return Response.json({
      registrationEnabled: settings?.registrationEnabled === true,
      officialContactNumber: settings?.officialContactNumber || "",
      officialContactEmail: settings?.officialContactEmail || "",
      courseTitle: settings?.courseTitle || "",
    });
  } catch {
    // Fail-closed defaults
    return Response.json({
      registrationEnabled: false,
      officialContactNumber: "",
      officialContactEmail: "",
      courseTitle: "",
    });
  }
}
