/**
 * Google Calendar helpers will wrap OAuth token refresh + inserts.
 * Implemented in Milestone 4 after credentials are validated.
 */

export async function assertGoogleConfigured(): Promise<void> {
  if (
    !process.env.GOOGLE_CLIENT_ID ||
    !process.env.GOOGLE_CLIENT_SECRET ||
    !process.env.GOOGLE_REDIRECT_URI
  ) {
    throw new Error("Google OAuth variables are incomplete.");
  }
}
