import { jsonError, jsonOk } from "@/lib/api";
import { getSessionUser } from "@/lib/auth/current-user";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return jsonOk({ user: null });
    return jsonOk({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        pictureUrl: user.pictureUrl,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
